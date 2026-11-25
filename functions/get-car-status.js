import { cors, ok, err, preflight, isOutstationMode } from './_shared.js';
export async function onRequestOptions() { return preflight(); }
/**
 * GET /get-car-status?secret=...
 * เรียกจาก selfbot คำสั่ง !cars
 * คืน list รถที่ pending + รถที่เกิน 24 ชั่วโมง
 * ถ้าเปิด "โหมดใช้งานรถต่างจังหวัด" → ไม่มีรถ overdue (ทุกคันอยู่ใน active)
 *   และส่ง outstation_mode:true กลับไปให้ selfbot ใช้งดแจ้งเตือน/งดบล็อก
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== env.SELFBOT_SECRET) return err('Unauthorized', 403, o);
    const { results } = await env.DB.prepare(`
      SELECT r.id, r.user_id, r.name, r.phone, r.car, r.mileage, r.reason, r.timestamp,
             u.department, u.status as user_status,
             ROUND((julianday('now') - julianday(r.timestamp)) * 24, 1) AS hours_elapsed
      FROM records r
      LEFT JOIN users u ON r.user_id = u.user_id
      WHERE r.return_status = 'pending'
      ORDER BY r.timestamp ASC
    `).all();
    const outstation = await isOutstationMode(env);
    const active = [];
    const overdue = [];
    for (const rec of results) {
      const hoursElapsed = rec.hours_elapsed || 0;
      if (outstation) {
        active.push({ ...rec, hoursElapsed });
      } else if (rec.user_status === 'blocked' || hoursElapsed >= 24) {
        overdue.push({ ...rec, hoursElapsed });
      } else {
        active.push({ ...rec, hoursElapsed });
      }
    }
    return ok({ active, overdue, outstation_mode: outstation }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
