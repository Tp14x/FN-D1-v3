// functions/_shared.js - Shared utilities for Cloudflare Pages Functions

export const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
});

export function ok(data, origin) {
  return new Response(JSON.stringify(data), { status: 200, headers: cors(origin) });
}

export function err(message, status = 400, origin) {
  return new Response(JSON.stringify({ success: false, error: message }), { status, headers: cors(origin) });
}

export function preflight() {
  return new Response('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }
  });
}

// ── Settings (global, key/value) ──
// ตาราง settings จะถูกสร้างอัตโนมัติถ้ายังไม่มี (ไม่ต้องรัน migration เอง)
export async function ensureSettings(env) {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT, updated_by TEXT)"
  ).run();
}

export async function getSetting(env, key, fallback = null) {
  try {
    await ensureSettings(env);
    const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
    return row ? row.value : fallback;
  } catch (e) {
    return fallback;
  }
}

export async function setSetting(env, key, value, by) {
  await ensureSettings(env);
  await env.DB.prepare(`
    INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by
  `).bind(key, String(value), new Date().toISOString(), by || null).run();
}

// โหมดใช้งานรถต่างจังหวัด: เปิด = ไม่บล็อก/ไม่แจ้งเตือนเกิน 24 ชม.
export async function isOutstationMode(env) {
  return (await getSetting(env, 'outstation_mode', '0')) === '1';
}
