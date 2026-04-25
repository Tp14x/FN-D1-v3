import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const { userId, pictureUrl } = await request.json();
    if (!userId) return err('Missing userId', 400, o);

    await env.DB.prepare(
      'UPDATE users SET picture_url = ?, updated_at = ? WHERE user_id = ?'
    ).bind(pictureUrl, new Date().toISOString(), userId).run();

    return ok({ success: true }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return ok({ status: 'ok' }, o);
    const user = await env.DB.prepare('SELECT * FROM users WHERE user_id = ?').bind(userId).first();
    return ok(user || null, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
