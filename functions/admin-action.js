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

    // โหลดข้อมูลทั้งหมด
    if (action === 'load') {
      const [usersRes, reqRes, statsRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all(),
        env.DB.prepare("SELECT * FROM requests ORDER BY submitted_at DESC").all(),
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

    // อนุมัติผู้ใช้
    if (action === 'approve') {
      const { userId, userData } = body;
      const now = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO users (user_id, name, phone, department, role, status, picture_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'user', 'active', ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          name = excluded.name,
          phone = excluded.phone,
          department = excluded.department,
          role = 'user',
          status = 'active',
          picture_url = excluded.picture_url,
          updated_at = excluded.updated_at
      `).bind(
        userId,
        userData.name || 'ไม่ระบุชื่อ',
        userData.phone || '',
        userData.department || 'ทั่วไป',
        userData.pictureUrl || null,
        now, now
      ).run();
      await env.DB.prepare("UPDATE requests SET status='approved' WHERE user_id=?")
        .bind(userId).run();
      return ok({ success: true }, o);
    }

    // ปฏิเสธผู้ใช้
    if (action === 'reject') {
      await env.DB.prepare("UPDATE requests SET status='rejected' WHERE user_id=?")
        .bind(body.userId).run();
      await env.DB.prepare("UPDATE users SET role='rejected', status='rejected', updated_at=? WHERE user_id=?")
        .bind(new Date().toISOString(), body.userId).run();
      return ok({ success: true }, o);
    }

    // แก้ไขข้อมูล user
    if (action === 'save') {
      const { userId, userData } = body;
      await env.DB.prepare(`
        UPDATE users SET name=?, phone=?, department=?, role=?, status=?, updated_at=?
        WHERE user_id=?
      `).bind(userData.name, userData.phone, userData.department,
        userData.role, userData.status, new Date().toISOString(), userId).run();
      return ok({ success: true }, o);
    }

    // สลับ active/inactive
    if (action === 'toggle') {
      const user = await env.DB.prepare('SELECT status FROM users WHERE user_id=?')
        .bind(body.userId).first();
      if (!user) return err('User not found', 404, o);
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      await env.DB.prepare('UPDATE users SET status=?, updated_at=? WHERE user_id=?')
        .bind(newStatus, new Date().toISOString(), body.userId).run();
      return ok({ success: true, newStatus }, o);
    }

    // ดูประวัติ records ใน admin
    if (action === 'records') {
      const { results } = await env.DB.prepare(`
        SELECT r.*, u.picture_url, u.department
        FROM records r
        LEFT JOIN users u ON r.user_id = u.user_id
        ORDER BY r.timestamp DESC
        LIMIT 100
      `).all();
      return ok({ records: results }, o);
    }

    return err('Invalid action', 400, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
