// functions/get-blocked.js
// GET /get-blocked?secret=xxx
// คืนรายชื่อ users ที่ status = 'blocked' ทั้งหมด
// เรียกจาก selfbot คำสั่ง !blocked

import { ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestGet(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== env.SELFBOT_SECRET) return err('Unauthorized', 403, o);

    const { results } = await env.DB.prepare(`
      SELECT user_id, name, phone, department, picture_url, updated_at
      FROM users
      WHERE status = 'blocked'
      ORDER BY updated_at DESC
    `).all();

    return ok({ users: results || [] }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
