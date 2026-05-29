import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const record = await request.json();
    if (!record.userId || !record.car) return err('Missing required fields', 400, o);

    // ✅ เช็ค status ของ user ก่อนบันทึก
    const user = await env.DB.prepare(
      'SELECT status, picture_url FROM users WHERE user_id = ?'
    ).bind(record.userId).first();

    if (!user) return err('ไม่พบบัญชีผู้ใช้', 404, o);
    if (user.status === 'blocked') return err('ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ', 403, o);
    if (user.status !== 'active') return err('บัญชีของคุณยังไม่ได้รับการอนุมัติ', 403, o);

    const id = `rec_${Date.now()}`;
    const now = new Date().toISOString();

    const routeTextToSave = record.destinations && record.destinations.length > 0
      ? JSON.stringify(record.destinations)
      : (record.routeText || '');

    await env.DB.prepare(`
      INSERT INTO records
        (id, user_id, name, phone, car, mileage, reason, route_text,
         total_distance, total_time, has_photo, photo_key, return_status, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(
      id,
      record.userId,
      record.name || 'ไม่ระบุชื่อ',
      record.phone || '-',
      record.car,
      record.mileage || '0',
      record.reason || '',
      routeTextToSave,
      record.totalDistance || 0,
      record.totalTime || 0,
      record.photoKey ? 1 : (record.hasPhoto ? 1 : 0),
      record.photoKey || null,
      now
    ).run();

    const selfbotUrl = env.SELFBOT_WEBHOOK_URL;
    if (selfbotUrl) {
      const pictureUrl = user?.picture_url || null;

      // สร้าง header contents — ถ้ามีรูปโปรไฟล์ให้แสดงพร้อมชื่อ
      const headerContents = pictureUrl
        ? [
            {
              type: "box", layout: "horizontal", spacing: "sm",
              contents: [
                {
                  type: "image", url: pictureUrl,
                  size: "xxs", aspectMode: "cover",
                  aspectRatio: "1:1", flex: 0
                },
                {
                  type: "text", text: "🚗 บันทึกการใช้รถ",
                  weight: "bold", size: "sm", color: "#FFFFFF",
                  gravity: "center", flex: 1
                }
              ]
            }
          ]
        : [
            {
              type: "text", text: "🚗 บันทึกการใช้รถ",
              weight: "bold", size: "sm", color: "#FFFFFF", align: "center"
            }
          ];

      const notifyPayload = {
        type: 'checkout',
        altText: `🚗 ${(record.name || 'ไม่ระบุชื่อ').slice(0, 30)} ยืม ${(record.car || '-').slice(0, 30)}`,
        record: {
          id: id,
          name: record.name || 'ไม่ระบุชื่อ',
          phone: record.phone || '-',
          car: record.car,
          mileage: record.mileage || '0',
          reason: record.reason || '',
          routeText: routeTextToSave,
          totalDistance: record.totalDistance || 0,
          timestamp: now,
          pictureUrl: pictureUrl
        },
        flex: {
          type: "bubble",
          size: "compact",
          header: {
            type: "box", layout: "vertical",
            backgroundColor: "#2ECC71", paddingAll: "10px",
            contents: headerContents
          },
          body: {
            type: "box", layout: "vertical",
            spacing: "xs", paddingAll: "10px",
            contents: [
              { type: "text", text: `👤 ${(record.name || 'ไม่ระบุชื่อ').slice(0, 20)}`, wrap: true, size: "sm" },
              { type: "text", text: `📞 ${record.phone || '-'}`, wrap: true, size: "sm" },
              { type: "text", text: `🚘 ${(record.car || '-').slice(0, 20)}`, wrap: true, size: "sm", weight: "bold" },
              { type: "text", text: `📍 ไมล์: ${record.mileage || '0'}`, wrap: true, size: "sm" },
              { type: "text", text: `📝 ${(record.reason || '-').slice(0, 30)}`, wrap: true, size: "xs", color: "#666666" }
            ]
          }
        }
      };

      context.waitUntil(
        fetch(selfbotUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Selfbot-Secret': env.SELFBOT_SECRET || ''
          },
          body: JSON.stringify(notifyPayload)
        }).then(r => r.json()).then(console.log).catch(() => {})
      );
    }

    return ok({ success: true, id }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
