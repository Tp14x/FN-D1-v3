import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

/**
 * POST /unblock-user
 * Body: { name: "ชื่อพนักงาน", secret: "..." }
 * เรียกจาก selfbot เมื่อ admin สั่ง !unblock <ชื่อ>
 * จะเปลี่ยน status จาก 'blocked' → 'active'
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const { name, secret } = await request.json();

    // ตรวจสอบ secret
    if (secret !== env.SELFBOT_SECRET) return err('Unauthorized', 403, o);
    if (!name) return err('Missing name', 400, o);

    // ค้นหาผู้ใช้จากชื่อ (LIKE)
    const user = await env.DB.prepare(
      `SELECT user_id, name, status FROM users WHERE name LIKE ? AND status='blocked' LIMIT 1`
    ).bind(`%${name}%`).first();

    if (!user) {
      return ok({ success: false, message: `ไม่พบผู้ใช้ชื่อ "${name}" ที่ถูกบล็อคอยู่` }, o);
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE users SET status='active', updated_at=? WHERE user_id=?`
    ).bind(now, user.user_id).run();

    return ok({ success: true, userId: user.user_id, name: user.name }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
