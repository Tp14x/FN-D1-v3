import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

/**
 * POST /notify-line
 * Body: { type: "checkout"|"return", record: {...} }
 * ส่งข้อมูลไปยัง selfbot (helper.py) ผ่าน HTTP webhook
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const body = await request.json();
    const { type, record } = body;

    if (!type || !record) return err('Missing type or record', 400, o);

    const selfbotUrl = env.SELFBOT_WEBHOOK_URL;
    const selfbotSecret = env.SELFBOT_SECRET;

    if (!selfbotUrl) return err('SELFBOT_WEBHOOK_URL not configured', 500, o);

    // ส่งข้อมูลไปยัง selfbot
    const resp = await fetch(selfbotUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Selfbot-Secret': selfbotSecret || ''
      },
      body: JSON.stringify({ type, record })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return err(`selfbot error: ${txt}`, 502, o);
    }

    return ok({ success: true }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
