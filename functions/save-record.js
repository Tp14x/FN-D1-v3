import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const record = await request.json();
    if (!record.userId || !record.car) return err('Missing required fields', 400, o);

    const id = `rec_${Date.now()}`;
    await env.DB.prepare(`
      INSERT INTO records
        (id, user_id, name, phone, car, mileage, reason, route_text,
         total_distance, total_time, has_photo, return_status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(
      id,
      record.userId,
      record.name || 'ไม่ระบุชื่อ',
      record.phone || '-',
      record.car,
      record.mileage || '0',
      record.reason || '',
      record.routeText || '',
      record.totalDistance || 0,
      record.totalTime || 0,
      record.hasPhoto ? 1 : 0,
      new Date().toISOString()
    ).run();

    return ok({ success: true, id }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
