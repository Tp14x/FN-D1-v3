import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const body = await request.json();
    const { action, userId, displayName, pictureUrl, formData } = body;

    // ตรวจสอบ request ที่รออยู่
    if (action === 'check') {
      const row = await env.DB.prepare(
        "SELECT id FROM requests WHERE user_id = ? AND status = 'pending'"
      ).bind(userId).first();
      return ok({ exists: !!row }, o);
    }

    // ส่งคำขอสมัคร
    if (action === 'submit') {
      if (!userId || !formData?.fullName || !formData?.phone || !formData?.department) {
        return err('ข้อมูลไม่ครบถ้วน', 400, o);
      }

      // ตรวจสอบซ้ำ
      const existing = await env.DB.prepare('SELECT id FROM requests WHERE user_id = ?')
        .bind(userId).first();
      if (existing) return ok({ duplicate: true }, o);

      const now = new Date().toISOString();
      const id = `req_${Date.now()}`;

      // เพิ่มใน requests
      await env.DB.prepare(`
        INSERT INTO requests (id, user_id, display_name, picture_url, full_name, phone, department, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).bind(id, userId, displayName || null, pictureUrl || null,
        formData.fullName, formData.phone, formData.department, now).run();

      // เพิ่มใน users ด้วย role=pending
      const userExists = await env.DB.prepare('SELECT user_id FROM users WHERE user_id = ?')
        .bind(userId).first();
      if (!userExists) {
        await env.DB.prepare(`
          INSERT INTO users (user_id, name, phone, department, role, status, picture_url, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)
        `).bind(userId, formData.fullName, formData.phone, formData.department,
          pictureUrl || null, now, now).run();
      }

      return ok({ success: true }, o);
    }

    return err('Invalid action', 400, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
