import { ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestGet(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return err('Missing userId', 400, o);

    const record = await env.DB.prepare(`
      SELECT id, car, mileage, reason, timestamp, name
      FROM records
      WHERE user_id = ? AND return_status = 'pending'
      ORDER BY timestamp DESC
      LIMIT 1
    `).bind(userId).first();

    return ok({ record: record || null }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
