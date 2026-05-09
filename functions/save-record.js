import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestPost(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const record = await request.json();
    if (!record.userId || !record.car) return err('Missing required fields', 400, o);

    const id = `rec_${Date.now()}`;
    const now = new Date().toISOString();

    // ✅ บันทึก destinations เป็น JSON ลง route_text
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

    // ── ส่งแจ้งเตือนไปยัง selfbot (LINE Group) ──
    const selfbotUrl = env.SELFBOT_WEBHOOK_URL;
    if (selfbotUrl) {
      // ✅ Flex แบบ COMPACT — เล็กลงมาก
      const name = (record.name || 'ไม่ระบุชื่อ').slice(0, 20);
      const car = (record.car || '-').slice(0, 20);
      
      const flex = {
        type: "bubble",
        size: "compact",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#2ECC71",
          paddingAll: "10px",
          contents: [{
            type: "text",
            text: "🚗 บันทึกการใช้รถ",
            weight: "bold",
            size: "sm",
            color: "#FFFFFF",
            align: "center"
          }]
        },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          paddingAll: "10px",
          contents: [
            { type: "text", text: `👤 ${name}`, wrap: true, size: "sm" },
            { type: "text", text: `📞 ${record.phone || '-'}`, wrap: true, size: "sm" },
            { type: "text", text: `🚘 ${car}`, wrap: true, size: "sm", weight: "bold" },
            { type: "text", text: `📍 ไมล์: ${record.mileage || '0'}`, wrap: true, size: "sm" },
            { type: "text", text: `📝 ${(record.reason || '-').slice(0, 30)}`, wrap: true, size: "xs", color: "#666666" }
          ]
        }
      };

      const notifyPayload = {
        type: 'checkout',
        altText: `🚗 ${name} ยืม ${car}`,
        flex: flex
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
