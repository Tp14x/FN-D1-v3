import { ok, err, preflight } from './_shared.js';
export async function onRequestOptions() { return preflight(); }

export async function onRequestGet(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    const period = url.searchParams.get('period'); // 'weekly' | 'monthly'
    if (secret !== env.SELFBOT_SECRET) return err('Unauthorized', 403, o);

    let dateFilter = '';
    if (period === 'daily') {
      dateFilter = `AND date(r.timestamp, '+7 hours') = date('now', '+7 hours')`;
    } else if (period === 'weekly') {
      dateFilter = `AND r.timestamp >= datetime('now', '-6 days')`;
    } else if (period === 'monthly') {
      dateFilter = `AND strftime('%Y-%m', r.timestamp) = strftime('%Y-%m', 'now', '-1 month')`;
    } else {
      return err('Invalid period', 400, o);
    }

    const { results } = await env.DB.prepare(`
      SELECT r.name, r.car, r.mileage, r.reason,
             r.timestamp, r.returned_at, r.duration_text,
             r.total_distance, r.return_status,
             u.department
      FROM records r
      LEFT JOIN users u ON r.user_id = u.user_id
      WHERE 1=1 ${dateFilter}
      ORDER BY r.timestamp DESC
    `).all();

    // สรุปข้อมูล
    const total      = results.length;
    const returned   = results.filter(r => r.return_status === 'returned').length;
    const pending    = results.filter(r => r.return_status === 'pending').length;
    const totalDist  = results.reduce((s, r) => s + (r.total_distance || 0), 0);

    // นับการใช้งานต่อรถ
    const carCount = {};
    results.forEach(r => { carCount[r.car] = (carCount[r.car] || 0) + 1; });
    const topCars = Object.entries(carCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([car, count]) => ({ car, count }));

    // นับการใช้งานต่อคน
    const userCount = {};
    results.forEach(r => { userCount[r.name] = (userCount[r.name] || 0) + 1; });
    const topUsers = Object.entries(userCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    return ok({ total, returned, pending, totalDist, topCars, topUsers }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
