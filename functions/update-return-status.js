import { cors, ok, err, preflight } from './_shared.js';
export async function onRequestOptions() { return preflight(); }
export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const { carPlate, returnedAt, durationText, returnLocation, userId } = await request.json();
    if (!carPlate) return err('Missing carPlate', 400, o);

    // เช็ค status ของ user ก่อนคืนรถ
    if (userId) {
      const user = await env.DB.prepare(
        'SELECT status FROM users WHERE user_id = ?'
      ).bind(userId).first();
      if (user && user.status === 'blocked') {
        return err('บัญชีของคุณถูกระงับการใช้งาน ไม่สามารถคืนรถได้\nกรุณาติดต่อผู้ดูแลระบบ', 403, o);
      }
    }

    const now = returnedAt || new Date().toISOString();

    // log ค่าที่รับมา ดูได้จาก Cloudflare Workers Logs
    console.log('[update-return-status] carPlate:', carPlate);
    console.log('[update-return-status] returnLocation:', JSON.stringify(returnLocation));

    const result = await env.DB.prepare(`
      UPDATE records
      SET return_status = 'returned',
          returned_at   = ?,
          duration_text = ?,
          return_location = ?
      WHERE id = (
        SELECT id FROM records
        WHERE car = ? AND return_status = 'pending'
        ORDER BY timestamp DESC
        LIMIT 1
      )
    `).bind(
      now,
      durationText || null,
      returnLocation ? JSON.stringify(returnLocation) : null,
      carPlate
    ).run();

    // เช็คว่า UPDATE กระทบ row จริงไหม
    console.log('[update-return-status] rows changed:', result.meta?.changes);
    if (!result.meta?.changes || result.meta.changes === 0) {
      return err('ไม่พบรายการการใช้รถที่ค้างอยู่สำหรับรถคันนี้', 404, o);
    }

    const returned = await env.DB.prepare(`
      SELECT r.id, r.name, r.phone, r.car, r.mileage, r.reason,
             r.timestamp, r.route_text, r.total_distance, r.user_id,
             u.picture_url
      FROM records r
      LEFT JOIN users u ON r.user_id = u.user_id
      WHERE r.car = ? AND r.return_status = 'returned'
      ORDER BY r.returned_at DESC LIMIT 1
    `).bind(carPlate).first();

    const selfbotUrl = env.SELFBOT_WEBHOOK_URL;
    if (selfbotUrl && returned) {
      const notifyPayload = {
        type: 'return',
        record: {
          id: returned.id,
          name: returned.name,
          phone: returned.phone,
          car: returned.car,
          mileage: returned.mileage,
          reason: returned.reason,
          totalDistance: returned.total_distance,
          checkoutTime: returned.timestamp,
          returnedAt: now,
          durationText: durationText || '',
          returnLocation: returnLocation || null,
          pictureUrl: returned.picture_url || null
        }
      };
      context.waitUntil(
        fetch(selfbotUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Selfbot-Secret': env.SELFBOT_SECRET || ''
          },
          body: JSON.stringify(notifyPayload)
        }).catch(() => {})
      );
    }
    return ok({ success: true }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
