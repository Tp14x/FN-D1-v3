import { ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestGet(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    if (secret !== env.SELFBOT_SECRET) return err('Unauthorized', 403, o);

    // ดึงเฉพาะ users ที่ status = 'blocked' พร้อม nickname
    const { results } = await env.DB.prepare(`
      SELECT user_id, name, nickname, phone, status, updated_at
      FROM users
      WHERE status = 'blocked'
      ORDER BY updated_at DESC
    `).all();

    return ok({
      users: results.map(u => ({
        user_id: u.user_id,
        name: u.name,           // ชื่อจริงที่ใช้แสดง
        nickname: u.nickname,   // ชื่อเล่นที่ admin ตั้ง (ใช้ค้นหาปลดบล็อค)
        phone: u.phone,
        status: u.status,
        updated_at: u.updated_at
      }))
    }, o);

  } catch (e) {
    return err(e.message, 500, o);
  }
}
