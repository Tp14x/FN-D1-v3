import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const { carPlate, returnedAt, durationText, returnLocation } = await request.json();
    if (!carPlate) return err('Missing carPlate', 400, o);

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
      returnedAt || new Date().toISOString(),
      durationText || null,
      returnLocation ? JSON.stringify(returnLocation) : null,
      carPlate
    ).run();

    return ok({ success: true }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
