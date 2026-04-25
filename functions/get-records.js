import { cors, ok, err, preflight } from './_shared.js';

export async function onRequestOptions() { return preflight(); }

export async function onRequestGet(context) {
  const { request, env } = context;
  const o = env.ALLOWED_ORIGIN;
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const limit  = parseInt(url.searchParams.get('limit') || '200');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status'); // 'pending' | 'returned' | null

    let query = `
      SELECT r.*, u.picture_url, u.department
      FROM records r
      LEFT JOIN users u ON r.user_id = u.user_id
    `;
    const params = [];
    const where = [];

    if (userId) { where.push('r.user_id = ?'); params.push(userId); }
    if (status) { where.push('r.return_status = ?'); params.push(status); }

    if (where.length) query += ' WHERE ' + where.join(' AND ');
    query += ' ORDER BY r.timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results } = await env.DB.prepare(query).bind(...params).all();

    const formatted = results.map(r => ({
      _id: r.id,
      name: r.name,
      phone: r.phone,
      car: r.car,
      mileage: r.mileage,
      reason: r.reason,
      routeText: r.route_text,
      totalDistance: r.total_distance,
      totalTime: r.total_time,
      hasPhoto: r.has_photo === 1,
      returnStatus: r.return_status,
      returnedAt: r.returned_at,
      durationText: r.duration_text,
      returnLocation: r.return_location ? JSON.parse(r.return_location) : null,
      timestamp: r.timestamp,
      userId: r.user_id,
      pictureUrl: r.picture_url || null,
      department: r.department || null
    }));

    // Stats summary
    const statsRes = await env.DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(total_distance) as total_km,
        SUM(CASE WHEN return_status = 'pending' THEN 1 ELSE 0 END) as active
      FROM records
    `).first();

    return ok({ records: formatted, stats: statsRes }, o);
  } catch (e) {
    return err(e.message, 500, o);
  }
}
