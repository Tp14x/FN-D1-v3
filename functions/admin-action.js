import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const body = await request.json();
    const { action, requestingUserId } = body;

    if (requestingUserId !== env.ADMIN_USER_ID) {
      return err('Unauthorized', 403, o);
    }

    if (action === 'load') {
      const [usersRes, reqRes, statsRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all(),
        env.DB.prepare('SELECT * FROM requests ORDER BY submitted_at DESC').all(),
        env.DB.prepare(`
          SELECT
            COUNT(*) as total_records,
            SUM(total_distance) as total_km,
            SUM(CASE WHEN return_status='pending' THEN 1 ELSE 0 END) as cars_out,
            COUNT(DISTINCT user_id) as total_users
          FROM records
        `).first()
      ]);
      const userMap = {};
      for (const u of usersRes.results) userMap[u.user_id] = u;
      return ok({ userMap, requests: reqRes.results, stats: statsRes }, o);
    }

    if (action === 'approve') {
      const { userId, userData } = body;
      const now = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO users (user_id, name, phone, department, role, status, picture_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          name=excluded.name, phone=excluded.phone, department=excluded.department,
          role='user', status='active', picture_url=excluded.picture_url, updated_at=excluded.updated_at
      `).bind(userId, userData.name||'ไม่ระบุชื่อ', userData.phone||'', userData.department||'ทั่วไป', userData.pictureUrl||null, now, now).run();
      await env.DB.prepare("UPDATE requests SET status='approved' WHERE user_id=?").bind(userId).run();
      return ok({ success: true }, o);
    }

    if (action === 'reject') {
      await env.DB.prepare("UPDATE requests SET status='rejected' WHERE user_id=?").bind(body.userId).run();
      await env.DB.prepare("UPDATE users SET role='rejected', status='rejected', updated_at=? WHERE user_id=?").bind(new Date().toISOString(), body.userId).run();
      return ok({ success: true }, o);
    }

    if (action === 'save') {
      const { userId, userData } = body;
      await env.DB.prepare(`UPDATE users SET name=?, phone=?, department=?, role=?, status=?, updated_at=? WHERE user_id=?`)
        .bind(userData.name, userData.phone, userData.department, userData.role, userData.status, new Date().toISOString(), userId).run();
      return ok({ success: true }, o);
    }

    if (action === 'toggle') {
      const user = await env.DB.prepare('SELECT status FROM users WHERE user_id=?').bind(body.userId).first();
      if (!user) return err('User not found', 404, o);
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      await env.DB.prepare('UPDATE users SET status=?, updated_at=? WHERE user_id=?').bind(newStatus, new Date().toISOString(), body.userId).run();
      return ok({ success: true, newStatus }, o);
    }

    if (action === 'records') {
      const { results } = await env.DB.prepare(`
        SELECT r.*, u.picture_url, u.department
        FROM records r LEFT JOIN users u ON r.user_id = u.user_id
        ORDER BY r.timestamp DESC
      `).all();
      return ok({ records: results }, o);
    }

    if (action === 'force-return') {
      const { recordId } = body;
      if (!recordId) return err('Missing recordId', 400, o);
      const now = new Date().toISOString();
      await env.DB.prepare(`
        UPDATE records SET return_status='returned', returned_at=?, duration_text='บังคับคืน (Admin)' WHERE id=?
      `).bind(now, recordId).run();
      return ok({ success: true }, o);
    }

    if (action === 'delete-record') {
      const { recordId } = body;
      if (!recordId) return err('Missing recordId', 400, o);
      await env.DB.prepare('DELETE FROM records WHERE id=?').bind(recordId).run();
      return ok({ success: true }, o);
    }

    if (action === 'edit-record') {
      const { recordId, data } = body;
      if (!recordId) return err('Missing recordId', 400, o);
      await env.DB.prepare(`
        UPDATE records SET
          car=?, mileage=?, reason=?, total_distance=?,
          return_status=?, duration_text=?
        WHERE id=?
      `).bind(
        data.car, data.mileage, data.reason,
        parseFloat(data.total_distance) || 0,
        data.return_status, data.duration_text || null,
        recordId
      ).run();
      return ok({ success: true }, o);
    }

    // ── PROXY: สร้างรายการยืมรถแทนพนักงาน ──
    if (action === 'proxy-save-record') {
      const { targetUserId, car, mileage, reason, totalDistance } = body;
      if (!targetUserId || !car) return err('Missing required fields', 400, o);
      const user = await env.DB.prepare('SELECT * FROM users WHERE user_id = ?').bind(targetUserId).first();
      if (!user) return err('User not found', 404, o);
      const id = `rec_${Date.now()}`;
      const now = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO records
          (id, user_id, name, phone, car, mileage, reason, route_text,
           total_distance, total_time, has_photo, return_status, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, 0, 0, 'pending', ?)
      `).bind(
        id, targetUserId,
        user.name || 'ไม่ระบุ',
        user.phone || '-',
        car,
        mileage || '0',
        reason || 'บันทึกโดย Admin',
        parseFloat(totalDistance) || 0,
        now
      ).run();
      return ok({ success: true, id }, o);
    }

    // ── PROXY: คืนรถแทนพนักงาน (ระบุ record id หรือ carPlate) ──
    if (action === 'proxy-return') {
      const { recordId, carPlate } = body;
      const now = new Date().toISOString();
      if (recordId) {
        await env.DB.prepare(`
          UPDATE records SET return_status='returned', returned_at=?, duration_text='คืนโดย Admin'
          WHERE id=?
        `).bind(now, recordId).run();
      } else if (carPlate) {
        await env.DB.prepare(`
          UPDATE records SET return_status='returned', returned_at=?, duration_text='คืนโดย Admin'
          WHERE id=(SELECT id FROM records WHERE car=? AND return_status='pending' ORDER BY timestamp DESC LIMIT 1)
        `).bind(now, carPlate).run();
      } else {
        return err('Missing recordId or carPlate', 400, o);
      }
      return ok({ success: true }, o);
    }

    // ── PROXY: ดึงรายการรถที่ pending อยู่ (สำหรับหน้า proxy) ──
    if (action === 'get-active-records') {
      const { results } = await env.DB.prepare(`
        SELECT r.id, r.user_id, r.name, r.car, r.mileage, r.reason, r.timestamp, u.department
        FROM records r
        LEFT JOIN users u ON r.user_id = u.user_id
        WHERE r.return_status = 'pending'
        ORDER BY r.timestamp DESC
      `).all();
      return ok({ records: results }, o);
    }

    return err('Invalid action', 400, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
