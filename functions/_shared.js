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
