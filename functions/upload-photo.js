// functions/upload-photo.js — รับไฟล์รูปภาพและอัปโหลดไปยัง Cloudflare R2
import { ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;

  try {
    if (!env.PHOTOS) return err('R2 bucket not configured', 500, o);

    const formData = await request.formData();
    const file = formData.get('photo');

    if (!file || typeof file === 'string') return err('ไม่พบไฟล์รูปภาพ', 400, o);

    // ตรวจสอบประเภทไฟล์
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return err('รองรับเฉพาะ JPG, PNG, GIF, WEBP เท่านั้น', 400, o);
    }

    // จำกัดขนาดไฟล์ 10MB
    if (file.size > 10 * 1024 * 1024) {
      return err('ไฟล์ต้องไม่เกิน 10MB', 400, o);
    }

    // สร้าง key ที่ไม่ซ้ำกัน
    const ext = file.type === 'image/jpeg' ? 'jpg'
              : file.type === 'image/png'  ? 'png'
              : file.type === 'image/gif'  ? 'gif' : 'webp';
    const key = `photos/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;

    // อัปโหลดไปยัง R2
    const arrayBuffer = await file.arrayBuffer();
    await env.PHOTOS.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    return ok({ success: true, key }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
