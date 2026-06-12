// functions/get-blocked.js — debug version
// เปลี่ยนกลับเป็น production หลังเช็คเสร็จ

import { ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestGet(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== env.SELFBOT_SECRET) return err('Unauthorized', 403, o);

    // ── DEBUG: ดึง users ทุกคนพร้อม status ──
    const { results } = await env.DB.prepare(`
      SELECT user_id, name, status, updated_at
      FROM users
      ORDER BY updated_at DESC
      LIMIT 20
    `).all();

    // แสดง status ทั้งหมดที่มีในระบบ
    const statusSummary = {};
    for (const u of results) {
      statusSummary[u.status] = (statusSummary[u.status] || 0) + 1;
    }

    return ok({
      debug: true,
      statusSummary,   // เช็คว่า status ที่ใช้จริงคืออะไร
      users: results   // รายการทั้งหมด
    }, o);

  } catch (e) {
    return err(e.message, 500, o);
  }
}
