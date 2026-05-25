import { ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const { userId, secret } = await request.json();
    if (secret !== env.SELFBOT_SECRET) return err('Unauthorized', 403, o);
    if (!userId) return err('Missing userId', 400, o);

    const now = new Date().toISOString();
    const result = await env.DB.prepare(`
      UPDATE users SET status = 'blocked', updated_at = ?
      WHERE user_id = ? AND status != 'blocked'
    `).bind(now, userId).run();

    if (!result.meta?.changes || result.meta.changes === 0) {
      return ok({ success: false, message: 'ไม่พบผู้ใช้ หรือถูกบล็อคไปแล้ว' }, o);
    }

    console.log(`[block-user] blocked userId: ${userId}`);
    return ok({ success: true }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
