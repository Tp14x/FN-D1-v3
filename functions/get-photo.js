// functions/get-photo.js — ดึงรูปภาพจาก Cloudflare R2 และส่งกลับ
import { err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestGet(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;

  try {
    if (!env.PHOTOS) return new Response('R2 bucket not configured', { status: 500 });

    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (!key) return err('Missing key', 400, o);

    // ป้องกัน path traversal
    if (!key.startsWith('photos/') || key.includes('..') || key.includes('//')) {
      return new Response('Invalid key', { status: 400 });
    }

    const object = await env.PHOTOS.get(key);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', o || '*');
    headers.set('Content-Length', object.size.toString());

    return new Response(object.body, { status: 200, headers });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
