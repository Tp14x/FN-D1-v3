import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const record = await request.json();
    if (!record.userId || !record.car) return err('Missing required fields', 400, o);

    const id = `rec_${Date.now()}`;
    const now = new Date().toISOString();

    // ✅ บันทึก destinations เป็น JSON ลง route_text
    const routeTextToSave = record.destinations && record.destinations.length > 0
      ? JSON.stringify(record.destinations)
      : (record.routeText || '');

    await env.DB.prepare(`
      INSERT INTO records
        (id, user_id, name, phone, car, mileage, reason, route_text,
         total_distance, total_time, has_photo, photo_key, return_status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(
      id,
      record.userId,
      record.name || 'ไม่ระบุชื่อ',
      record.phone || '-',
      record.car,
      record.mileage || '0',
      record.reason || '',
      routeTextToSave,
      record.totalDistance || 0,
      record.totalTime || 0,
      record.photoKey ? 1 : (record.hasPhoto ? 1 : 0),
      record.photoKey || null,
      now
    ).run();

    // ── ส่งแจ้งเตือนไปยัง selfbot (LINE Group) ──
    const selfbotUrl = env.SELFBOT_WEBHOOK_URL;
    if (selfbotUrl) {
      const notifyPayload = {
        type: 'checkout',
        record: {
          id,
          name: record.name || 'ไม่ระบุชื่อ',
          phone: record.phone || '-',
          car: record.car,
          mileage: record.mileage || '0',
          reason: record.reason || '',
          routeText: routeTextToSave,
          totalDistance: record.totalDistance || 0,
          timestamp: now
        }
      };
      // fire-and-forget ไม่รอ response เพื่อไม่ให้ช้า
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

    return ok({ success: true, id }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
