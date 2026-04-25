import { cors, ok, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  context.waitUntil((async () => {
    try {
      const data = await request.clone().json();
      if (data.userId) {
        await env.DB.prepare('UPDATE users SET updated_at = ? WHERE user_id = ?')
          .bind(new Date().toISOString(), data.userId).run();
      }
    } catch (_) {}
  })());
  return ok({ success: true }, env.ALLOWED_ORIGIN);
}

export async function onRequestGet(context) {
  return ok({ status: 'ok' }, context.env.ALLOWED_ORIGIN);
}
