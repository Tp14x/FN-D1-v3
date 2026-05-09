import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const { carPlate, returnedAt, durationText, returnLocation } = await request.json();
    if (!carPlate) return err('Missing carPlate', 400, o);

    const now = returnedAt || new Date().toISOString();

    // ใช้ subquery แทน ORDER BY + LIMIT ใน UPDATE (รองรับ D1 ดีกว่า)
    await env.DB.prepare(`
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

    // ดึงข้อมูล record ที่เพิ่งคืน เพื่อแจ้ง selfbot
    const returned = await env.DB.prepare(`
      SELECT r.id, r.name, r.phone, r.car, r.mileage, r.reason,
             r.timestamp, r.route_text, r.total_distance
      FROM records r
      WHERE r.car = ? AND r.return_status = 'returned'
      ORDER BY r.returned_at DESC LIMIT 1
    `).bind(carPlate).first();

    // ── ส่งแจ้งเตือน "คืนรถ" ไปยัง selfbot ──
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
          durationText: durationText || ''
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
