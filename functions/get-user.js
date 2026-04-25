import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestGet(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const url = new URL(request.url);
    const requestingUserId = url.searchParams.get('userId');

    // ถ้า Admin เข้าครั้งแรก → สร้าง record อัตโนมัติ
    if (requestingUserId && requestingUserId === env.ADMIN_USER_ID) {
      const existing = await env.DB.prepare('SELECT user_id FROM users WHERE user_id = ?')
        .bind(requestingUserId).first();
      if (!existing) {
        const now = new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO users (user_id, name, phone, department, role, status, picture_url, created_at, updated_at)
          VALUES (?, 'Admin', '', 'Admin', 'admin', 'active', null, ?, ?)
        `).bind(requestingUserId, now, now).run();
      }
    }

    const { results } = await env.DB.prepare('SELECT * FROM users').all();
    const userMap = {};
    for (const u of results) {
      userMap[u.user_id] = {
        name: u.name,
        phone: u.phone,
        department: u.department,
        role: u.role,
        status: u.status,
        pictureUrl: u.picture_url,
        updatedAt: u.updated_at
      };
    }
    return ok(userMap, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
