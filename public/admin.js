/* ──────────────────────────────────────────
   STATE
────────────────────────────────────────── */
let adminId = '';
let allData = { userMap:{}, requests:[], records:[], stats:{} };
let tripsChartInst = null, carsChartInst = null;

/* ──────────────────────────────────────────
   SIDEBAR MOBILE
────────────────────────────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ──────────────────────────────────────────
   LOGIN
────────────────────────────────────────── */
function adminLogin() {
  const id = document.getElementById('adminIdInput').value.trim();
  if (!id) { showToast('กรุณากรอก User ID', 'warning'); return; }
  adminId = id;
  if (document.getElementById('rememberMe').checked) {
    localStorage.setItem('admin_id', id);
  } else {
    localStorage.removeItem('admin_id');
  }
  loadAll();
}
function adminLogout() {
  adminId = '';
  if (tripsChartInst) { tripsChartInst.destroy(); tripsChartInst = null; }
  if (carsChartInst)  { carsChartInst.destroy();  carsChartInst  = null; }
  document.getElementById('adminApp').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

// Auto-fill saved ID
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('admin_id');
  if (saved) {
    document.getElementById('adminIdInput').value = saved;
    document.getElementById('rememberMe').checked = true;
  }
});

/* ──────────────────────────────────────────
   LOAD DATA
────────────────────────────────────────── */
async function loadAll() {
  try {
    const [mainRes, recRes] = await Promise.all([
      fetch('/admin-action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'load', requestingUserId:adminId }) }),
      fetch('/admin-action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'records', requestingUserId:adminId }) })
    ]);
    if (mainRes.status === 403) { showToast('ไม่ใช่ Admin', 'error'); return; }

    const data    = await mainRes.json();
    const recData = await recRes.json();

    allData.userMap  = data.userMap  || {};
    allData.requests = data.requests || [];
    allData.stats    = data.stats    || {};
    allData.records  = (recData.records || []).map(r => ({...r, returnStatus:r.returnStatus ?? r.return_status, returnedAt:r.returnedAt ?? r.returned_at, totalDistance:r.totalDistance ?? r.total_distance, totalTime:r.totalTime ?? r.total_time, hasPhoto:r.hasPhoto ?? (r.has_photo === 1), photoKey:r.photoKey ?? r.photo_key, routeText:r.routeText ?? r.route_text, userId:r.userId ?? r.user_id, pictureUrl:r.pictureUrl ?? r.picture_url, department:r.department ?? null}));

    // ชื่อ admin ใน sidebar
    const adminUser = allData.userMap[adminId];
    document.getElementById('adminName').textContent = adminUser?.name || 'Administrator';
    document.getElementById('adminLabel').textContent = adminId.slice(0, 18) + '…';

    updateStats();
    buildDashboardCharts();
    renderActiveCars();
    renderRecentRecords();
    renderRequests();
    renderUsers();
    recPage = 1; recFilter();

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminApp').style.display    = 'block';
  } catch(e) {
    showToast('โหลดข้อมูลไม่ได้: ' + e.message, 'error');
  }
}
function refreshAll() { loadAll(); showToast('รีเฟรชแล้ว', 'success'); }

/* ──────────────────────────────────────────
   STATS
────────────────────────────────────────── */
function updateStats() {
  const s = allData.stats;
  document.getElementById('s-trips').textContent     = (s.total_records || allData.records.length || 0).toLocaleString();
  document.getElementById('s-active').textContent    = s.cars_out || 0;
  document.getElementById('s-users').textContent     = s.total_users || Object.values(allData.userMap).filter(u => u.role === 'user').length;
  const pending = allData.requests.filter(r => r.status === 'pending').length;
  document.getElementById('s-pending-req').textContent = pending;
  const badge = document.getElementById('pendingBadge');
  badge.textContent = pending;
  badge.style.display = pending > 0 ? 'inline' : 'none';
}

/* ──────────────────────────────────────────
   DASHBOARD CHARTS
────────────────────────────────────────── */
function buildDashboardCharts() {
  const records = allData.records;
  const curYear = new Date().getFullYear();

  // 1) Bar chart: trips per month (ม.ค.–ธ.ค.)
  const monthLabels = [];
  const monthTrips  = [];
  for (let m = 0; m <= 11; m++) {
    const d = new Date(curYear, m, 1);
    monthLabels.push(d.toLocaleDateString('th-TH', { month: 'short' }));
    monthTrips.push(records.filter(r => {
      if (!r.timestamp) return false;
      const rd = new Date(r.timestamp);
      return rd.getFullYear() === curYear && rd.getMonth() === m;
    }).length);
  }

  if (tripsChartInst) tripsChartInst.destroy();
  tripsChartInst = new Chart(document.getElementById('tripsChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: monthLabels,
      datasets: [{
        label: 'จำนวนเที่ยว',
        data: monthTrips,
        backgroundColor: monthTrips.map((_, i) => i === new Date().getMonth() ? 'rgba(16,185,129,0.9)' : 'rgba(16,185,129,0.45)'),
        borderColor: 'rgba(16,185,129,1)',
        borderWidth: 1.5, borderRadius: 6, borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17,24,39,0.95)',
          titleFont: { family: 'Sarabun', size: 12 },
          bodyFont:  { family: 'Sarabun', size: 12 },
          padding: 10, cornerRadius: 8,
          callbacks: { label: ctx => ` ${ctx.parsed.y} เที่ยว` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#5a6a88', font: { family: 'Sarabun', size: 11 } } },
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#5a6a88', font: { family: 'Sarabun', size: 11 }, precision: 0 } }
      }
    }
  });

  // 2) Donut chart: trips per car
  const carCount = {};
  records.forEach(r => { if (r.car) carCount[r.car] = (carCount[r.car] || 0) + 1; });
  const carEntries = Object.entries(carCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const carColors  = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16'];

  if (carsChartInst) carsChartInst.destroy();
  if (carEntries.length === 0) {
    document.getElementById('carsChart').closest('.chart-card').innerHTML +=
      '<p style="text-align:center;color:var(--c-text3);font-size:13px;margin-top:20px">ยังไม่มีข้อมูล</p>';
    return;
  }
  carsChartInst = new Chart(document.getElementById('carsChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: carEntries.map(([k]) => k),
      datasets: [{ data: carEntries.map(([,v]) => v), backgroundColor: carColors, borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { position: 'right', labels: { color: '#8899bb', font: { family: 'Sarabun', size: 11 }, padding: 12, boxWidth: 12 } },
        tooltip: {
          backgroundColor: 'rgba(17,24,39,0.95)',
          titleFont: { family: 'Sarabun', size: 12 }, bodyFont: { family: 'Sarabun', size: 12 },
          callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} เที่ยว` }
        }
      }
    }
  });
}

/* ──────────────────────────────────────────
   ACTIVE CARS NOW
────────────────────────────────────────── */
function renderActiveCars() {
  const active = allData.records.filter(r => r.returnStatus === 'pending');
  document.getElementById('s-active').textContent = active.length;
  const el = document.getElementById('activeCarsSection');
  if (!el) return;
  if (active.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="active-cars-grid">${active.map(r => `
    <div class="active-car-card">
      <div class="active-car-plate">🚗 ${esc(r.car||'—')}</div>
      <div>
        <div class="active-car-name">${esc(r.name||'—')}</div>
        <div class="active-car-since"><i class="fas fa-clock" style="margin-right:4px"></i>${fmtDate(r.timestamp)}</div>
        ${r.department ? `<div class="active-car-since">${esc(r.department)}</div>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

/* ──────────────────────────────────────────
   RECENT RECORDS
────────────────────────────────────────── */
function renderRecentRecords() {
  const recent = allData.records.slice(0, 8);
  document.getElementById('recentBody').innerHTML = recent.length === 0
    ? '<tr><td colspan="5"><div class="empty-state"><div class="icon">📭</div><p>ยังไม่มีรายการ</p></div></td></tr>'
    : recent.map(r => {
        const badge = r.returnStatus === 'returned'
          ? '<span class="badge b-green"><i class="fas fa-check"></i> คืนแล้ว</span>'
          : '<span class="badge b-amber"><i class="fas fa-key"></i> ใช้อยู่</span>';
        return `<tr>
          <td><div class="u-cell">${avatar(r.pictureUrl, r.name)}<div class="u-name">${esc(r.name||'—')}</div></div></td>
          <td><span class="badge b-blue">🚗 ${esc(r.car||'—')}</span></td>
          <td style="font-size:13px;max-width:160px;color:var(--c-text2)">${esc((r.reason||'').slice(0,40))}${(r.reason||'').length>40?'…':''}</td>
          <td style="font-size:12px;white-space:nowrap;color:var(--c-text3)">${fmtDate(r.timestamp)}</td>
          <td>${badge}</td>
        </tr>`;
      }).join('');
}

/* ──────────────────────────────────────────
   REQUESTS
────────────────────────────────────────── */
function renderRequests() {
  const filter = document.getElementById('reqFilter').value;
  const list   = allData.requests.filter(r => !filter || r.status === filter);
  const el     = document.getElementById('requestsList');
  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>ไม่มีคำขอ${filter==='pending'?'ที่รอการอนุมัติ':''}</p></div>`;
    return;
  }
  el.innerHTML = list.map(r => {
    const isPending = r.status === 'pending';
    const statusBadge = r.status === 'approved'
      ? '<span class="badge b-green">✅ อนุมัติแล้ว</span>'
      : r.status === 'rejected'
      ? '<span class="badge b-red">❌ ปฏิเสธ</span>'
      : '<span class="badge b-amber">⏳ รอการอนุมัติ</span>';
    return `<div class="req-card ${r.status !== 'pending' ? r.status : ''}">
      <div class="req-top">
        ${avatarLg(r.pictureUrl, r.display_name || r.full_name)}
        <div style="flex:1">
          <div class="req-name">${esc(r.display_name || r.full_name || '—')}</div>
          <div class="req-meta"><i class="fas fa-clock" style="margin-right:4px"></i>ส่งเมื่อ ${fmtDate(r.submitted_at)}</div>
        </div>
        ${statusBadge}
      </div>
      <div class="req-info-grid">
        <div><div class="req-field-label">ชื่อจริง</div><div class="req-field-val">${esc(r.full_name||'—')}</div></div>
        <div><div class="req-field-label">เบอร์โทร</div><div class="req-field-val">${esc(r.phone||'—')}</div></div>
        <div><div class="req-field-label">แผนก</div><div class="req-field-val">${esc(r.department||'—')}</div></div>
        <div><div class="req-field-label">LINE ID</div><div class="req-field-val" style="font-size:11px;word-break:break-all;color:var(--c-text3)">${esc(r.user_id||'—')}</div></div>
      </div>
      ${isPending ? `<div class="req-actions">
        <button class="btn btn-primary" onclick="approveRequest('${r.user_id}')"><i class="fas fa-check"></i> อนุมัติ</button>
        <button class="btn btn-danger"  onclick="rejectRequest('${r.user_id}')"><i class="fas fa-times"></i> ปฏิเสธ</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

async function approveRequest(userId) {
  const req = allData.requests.find(r => r.user_id === userId);
  if (!req) return;
  showConfirm(`อนุมัติ <strong>${req.full_name || req.display_name}</strong>?`, 'ยืนยันการอนุมัติ', '✅', 'btn-primary', async () => {
    try {
      const res = await fetch('/admin-action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'approve', requestingUserId:adminId, userId, userData:{ name:req.full_name, phone:req.phone, department:req.department, pictureUrl:req.picture_url } }) });
      const d = await res.json();
      if (d.success) { showToast(`✅ อนุมัติ ${req.full_name} สำเร็จ`, 'success'); await loadAll(); }
    } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
  });
}

async function rejectRequest(userId) {
  const req = allData.requests.find(r => r.user_id === userId);
  showConfirm(`ปฏิเสธ <strong>${req?.full_name || userId}</strong>?`, 'ยืนยันการปฏิเสธ', '❌', 'btn-danger', async () => {
    try {
      const res = await fetch('/admin-action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'reject', requestingUserId:adminId, userId }) });
      const d = await res.json();
      if (d.success) { showToast('ปฏิเสธแล้ว', 'warning'); await loadAll(); }
    } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
  });
}

/* ──────────────────────────────────────────
   USERS
────────────────────────────────────────── */
function renderUsers() {
  const search     = document.getElementById('userSearch').value.toLowerCase();
  const roleFilter = document.getElementById('userRoleFilter').value;
  const entries    = Object.entries(allData.userMap).filter(([id, u]) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search && !`${u.name} ${u.department} ${id}`.toLowerCase().includes(search)) return false;
    return true;
  });
  const userBadge=document.getElementById('userCountBadge'); if(userBadge) userBadge.textContent = `${entries.length} คน`;
  const dashboardUserCount=document.getElementById('dashboardUserCount'); if(dashboardUserCount) dashboardUserCount.textContent = `${entries.length} คน`;
  if (entries.length === 0) {
    document.getElementById('usersBody').innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="icon">🔍</div><p>ไม่พบผู้ใช้</p></div></td></tr>';
    return;
  }
  document.getElementById('usersBody').innerHTML = entries.map(([uid, u]) => {
    const roleBadge =
      u.role === 'admin'   ? '<span class="badge b-purple"><i class="fas fa-crown"></i> admin</span>' :
      u.role === 'user'    ? '<span class="badge b-green"><i class="fas fa-check"></i> user</span>'   :
      u.role === 'pending' ? '<span class="badge b-amber"><i class="fas fa-hourglass"></i> pending</span>' :
      `<span class="badge b-red">${u.role}</span>`;
    const statusBadge =
      u.status === 'active'   ? '<span class="badge b-green">● active</span>'   :
      u.status === 'inactive' ? '<span class="badge b-red">● inactive</span>'   :
      `<span class="badge b-gray">${u.status||'—'}</span>`;
    return `<tr>
      <td><div class="u-cell">${avatar(u.pictureUrl||u.picture_url, u.name)}<div>
        <div class="u-name">${esc(u.name||'—')}</div>
        <div class="u-sub">${uid.slice(0,22)}…</div>
      </div></div></td>
      <td style="color:var(--c-text2)">${esc(u.phone||'—')}</td>
      <td style="color:var(--c-text2)">${esc(u.department||'—')}</td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td style="font-size:12px;white-space:nowrap;color:var(--c-text3)">${fmtDate(u.updatedAt||u.updated_at)}</td>
      <td><div class="row-actions">
        <button class="btn btn-secondary btn-icon btn-sm" onclick="openEditModal('${uid}')" title="แก้ไข"><i class="fas fa-pen"></i></button>
        <button class="btn ${u.status==='active'?'btn-amber':'btn-primary'} btn-icon btn-sm" onclick="toggleUser('${uid}')" title="${u.status==='active'?'ระงับ':'เปิดใช้งาน'}">
          ${u.status==='active'?'<i class="fas fa-ban"></i>':'<i class="fas fa-check"></i>'}
        </button>
      </div></td>
    </tr>`;
  }).join('');
}

function openEditModal(uid) {
  const u = allData.userMap[uid];
  if (!u) return;
  document.getElementById('editUserId').value = uid;
  document.getElementById('editName').value   = u.name || '';
  document.getElementById('editNickname').value = u.nickname || '';
  document.getElementById('editPhone').value  = u.phone || '';
  document.getElementById('editDept').value   = u.department || '';
  document.getElementById('editRole').value   = u.role || 'user';
  document.getElementById('editStatus').value = u.status || 'active';
  document.getElementById('editModal').classList.add('show');
}

async function saveUserEdit() {
  const uid      = document.getElementById('editUserId').value;
  const userData = {
    name:       document.getElementById('editName').value,
    nickname:   document.getElementById('editNickname').value.trim() || null,
    phone:      document.getElementById('editPhone').value,
    department: document.getElementById('editDept').value,
    role:       document.getElementById('editRole').value,
    status:     document.getElementById('editStatus').value
  };
  try {
    const res = await fetch('/admin-action', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'save', requestingUserId:adminId, userId:uid, userData }) });
    const d = await res.json();
    if (d.success) { closeModal('editModal'); showToast('บันทึกแล้ว ✅', 'success'); await loadAll(); }
  } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
}

async function toggleUser(uid) {
  const u = allData.userMap[uid];
  const label = u.status === 'active' ? 'ระงับ' : 'เปิดใช้งาน';
  showConfirm(`${label}ผู้ใช้ <strong>${u.name}</strong>?`, `ยืนยัน: ${label}`, u.status==='active'?'🚫':'✅',
    u.status==='active'?'btn-amber':'btn-primary', async () => {
    try {
      const res = await fetch('/admin-action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'toggle', requestingUserId:adminId, userId:uid }) });
      const d = await res.json();
      if (d.success) { showToast(`${label}แล้ว`, 'success'); await loadAll(); }
    } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
  });
}

/* ──────────────────────────────────────────
   RECORDS with PAGINATION
────────────────────────────────────────── */
let filteredRec = [];
let recPage     = 1;
const REC_PAGE  = 25;

function recFilter() {
  const search = document.getElementById('recSearch').value.toLowerCase();
  const status = document.getElementById('recStatusFilter').value;
  const car    = document.getElementById('recCarFilter').value.toLowerCase();
  const date   = document.getElementById('recDateFilter').value;
  filteredRec  = allData.records.filter(r => {
    if (status && r.returnStatus !== status) return false;
    if (car    && !(r.car||'').toLowerCase().includes(car)) return false;
    if (date   && r.timestamp && !r.timestamp.startsWith(date)) return false;
    if (search && !`${r.name} ${r.car} ${r.reason}`.toLowerCase().includes(search)) return false;
    return true;
  });
  recPage = 1;
  renderRecords();
}

function resetRecFilter() {
  ['recSearch','recCarFilter','recDateFilter'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('recStatusFilter').value = '';
  recFilter();
}

function renderRecords() {
  const total = filteredRec.length;
  document.getElementById('recTotalBadge').textContent = `${total} รายการ`;
  document.getElementById('exportBtn').style.display = total > 0 ? 'inline-flex' : 'none';

  if (total === 0) {
    document.getElementById('recordsBody').innerHTML = '<tr><td colspan="11"><div class="empty-state"><div class="icon">🔍</div><p>ไม่พบรายการ</p></div></td></tr>';
    document.getElementById('recPagination').style.display = 'none';
    return;
  }

  const start = (recPage - 1) * REC_PAGE;
  const page  = filteredRec.slice(start, start + REC_PAGE);

  document.getElementById('recordsBody').innerHTML = page.map(r => {
    const badge = r.returnStatus === 'returned'
      ? '<span class="badge b-green"><i class="fas fa-check"></i> คืนแล้ว</span>'
      : '<span class="badge b-amber"><i class="fas fa-key"></i> ใช้อยู่</span>';
    const photoCell = r.photo_key
      ? `<a href="/get-photo?key=${encodeURIComponent(r.photo_key)}" target="_blank"><img class="tbl-photo" src="/get-photo?key=${encodeURIComponent(r.photo_key)}" alt="รูปไมล์"></a>`
      : r.has_photo ? '<span class="badge b-gray">📸</span>' : '<span style="color:var(--c-text3)">—</span>';
    const forceBtn = r.returnStatus === 'pending'
      ? `<button class="btn btn-amber btn-xs" onclick="forceReturn('${r.id}','${esc(r.name||'')}')" title="บังคับคืนรถ"><i class="fas fa-flag-checkered"></i></button>`
      : '';
    return `<tr>
      <td><div class="u-cell">${avatar(r.pictureUrl, r.name)}<div>
        <div class="u-name">${esc(r.name||'—')}</div>
        ${r.department?`<div class="u-sub">${esc(r.department)}</div>`:''}
      </div></div></td>
      <td><span class="badge b-blue">🚗 ${esc(r.car||'—')}</span></td>
      <td style="color:var(--c-text2)">${esc(r.mileage||'—')}</td>
      <td style="font-size:13px;max-width:130px;color:var(--c-text2)">${esc((r.reason||'').slice(0,40))}${(r.reason||'').length>40?'…':''}</td>
      <td style="color:var(--c-green);font-weight:600">${r.total_distance ? r.total_distance.toFixed(1)+' กม.' : '—'}</td>
      <td style="text-align:center">${photoCell}</td>
      <td style="font-size:12px;white-space:nowrap;color:var(--c-text3)">${fmtDate(r.timestamp)}</td>
      <td>${badge}</td>
      <td style="font-size:12px;white-space:nowrap;color:var(--c-text3)">${r.returned_at ? fmtDate(r.returned_at) : '—'}</td>
      <td style="font-size:13px;color:var(--c-text2)">${r.duration_text || '—'}</td>
      <td><div class="row-actions">
        ${forceBtn}
        <button class="btn btn-secondary btn-icon btn-xs" onclick="openEditRecord('${r.id}')" title="แก้ไข"><i class="fas fa-pen"></i></button>
        <button class="btn btn-danger btn-icon btn-xs" onclick="deleteRecord('${r.id}','${esc(r.name||'')}')" title="ลบ"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`;
  }).join('');

  // pagination
  const pages = Math.ceil(total / REC_PAGE);
  const pag   = document.getElementById('recPagination');
  if (pages <= 1) { pag.style.display = 'none'; return; }
  pag.style.display = 'flex';
  let h = `<button class="pg-btn" onclick="goRecPage(${recPage-1})" ${recPage===1?'disabled':''}>‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (i===1 || i===pages || (i>=recPage-1 && i<=recPage+1))
      h += `<button class="pg-btn ${i===recPage?'active':''}" onclick="goRecPage(${i})">${i}</button>`;
    else if (i===recPage-2 || i===recPage+2)
      h += `<span class="pg-info">…</span>`;
  }
  h += `<button class="pg-btn" onclick="goRecPage(${recPage+1})" ${recPage===pages?'disabled':''}>›</button>`;
  h += `<span class="pg-info rec-count-badge">แสดง ${start+1}–${Math.min(start+REC_PAGE,total)} จาก ${total}</span>`;
  pag.innerHTML = h;
}

function goRecPage(p) {
  const pages = Math.ceil(filteredRec.length / REC_PAGE);
  if (p < 1 || p > pages) return;
  recPage = p; renderRecords();
  document.getElementById('page-records').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ──────────────────────────────────────────
   FORCE RETURN
────────────────────────────────────────── */
async function forceReturn(recordId, name) {
  showConfirm(`บังคับคืนรถให้ <strong>${name}</strong>?<br><small style="color:var(--c-text3)">สถานะจะเปลี่ยนเป็น "คืนแล้ว" ทันที</small>`,
    'บังคับคืนรถ (Admin)', '🚩', 'btn-amber', async () => {
    try {
      const res = await fetch('/admin-action', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'force-return', requestingUserId:adminId, recordId }) });
      const d = await res.json();
      if (d.success) { showToast('บังคับคืนรถสำเร็จ ✅', 'success'); await loadAll(); }
      else           { showToast('เกิดข้อผิดพลาด: ' + d.error, 'error'); }
    } catch(e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
  });
}

/* ──────────────────────────────────────────
   EXPORT CSV
────────────────────────────────────────── */
function exportCSV() {
  const data    = filteredRec.length ? filteredRec : allData.records;
  const headers = ['ชื่อ','เบอร์โทร','แผนก','ทะเบียนรถ','เลขไมล์','สาเหตุ','ระยะทาง(กม)','วันเริ่มใช้','สถานะ','วันคืนรถ','ระยะเวลา'];
  const rows    = data.map(r => [
    r.name||'', r.phone||'', r.department||'', r.car||'', r.mileage||'',
    r.reason||'', r.total_distance||0, r.timestamp||'',
    r.returnStatus==='returned'?'คืนแล้ว':'กำลังใช้',
    r.returned_at||'', r.duration_text||''
  ]);
  const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `car-records-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  showToast('ดาวน์โหลด CSV แล้ว ✅', 'success');
}

/* ──────────────────────────────────────────
   PAGE SWITCH
────────────────────────────────────────── */
const PAGE_TITLES = { dashboard:'แดชบอร์ด', requests:'คำขอสมัคร', users:'จัดการผู้ใช้', records:'ประวัติการใช้รถ', proxy:'บันทึกแทนพนักงาน' };
function switchPage(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('nav-'  + p).classList.add('active');
  const title = PAGE_TITLES[p] || p;
  document.getElementById('crumbPage').textContent = title;
  // show export only on records
  document.getElementById('exportBtn').style.display = (p === 'records' && filteredRec.length > 0) ? 'inline-flex' : 'none';
  if (p === 'proxy') { populateProxyUsers(); loadProxyActive(); }
  closeSidebar();
}

/* ──────────────────────────────────────────
   CUSTOM CONFIRM MODAL
────────────────────────────────────────── */
let _confirmCallback = null;
function showConfirm(msg, title, icon, btnClass, cb) {
  document.getElementById('confirmMsg').innerHTML   = msg;
  document.getElementById('confirmTitle').textContent = title || 'ยืนยัน';
  document.getElementById('confirmIcon').textContent  = icon  || '⚠️';
  const okBtn = document.getElementById('confirmOkBtn');
  okBtn.className = `btn ${btnClass || 'btn-primary'}`;
  _confirmCallback = cb;
  document.getElementById('confirmModal').classList.add('show');
}
function confirmOk() {
  closeModal('confirmModal');
  if (_confirmCallback) _confirmCallback();
  _confirmCallback = null;
}

/* ──────────────────────────────────────────
   MODALS
────────────────────────────────────────── */
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.getElementById('editModal').addEventListener('click', e => { if (e.target===e.currentTarget) closeModal('editModal'); });
document.getElementById('confirmModal').addEventListener('click', e => { if (e.target===e.currentTarget) closeModal('confirmModal'); });
document.getElementById('editRecordModal').addEventListener('click', e => { if (e.target===e.currentTarget) closeModal('editRecordModal'); });
document.addEventListener('keydown', e => { if (e.key==='Escape') { closeModal('editModal'); closeModal('editRecordModal'); closeModal('confirmModal'); } });

/* ──────────────────────────────────────────
   HELPERS
────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('th-TH', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso; }
}
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function avatar(url, name) {
  const initial = (name||'?').charAt(0).toUpperCase();
  return url
    ? `<img src="${esc(url)}" alt="${esc(name)}" class="u-av" onerror="this.outerHTML='<div class=\\'u-av\\'>${initial}</div>'">`
    : `<div class="u-av">${initial}</div>`;
}
function avatarLg(url, name) {
  const initial = (name||'?').charAt(0).toUpperCase();
  return url
    ? `<img src="${esc(url)}" alt="${esc(name)}" class="req-av-lg" onerror="this.outerHTML='<div class=\\'req-av-lg\\'>${initial}</div>'">`
    : `<div class="req-av-lg">${initial}</div>`;
}

/* ──────────────────────────────────────────
   EDIT RECORD
────────────────────────────────────────── */
function openEditRecord(id) {
  const r = allData.records.find(x => x.id === id);
  if (!r) { showToast('ไม่พบข้อมูล', 'error'); return; }
  document.getElementById('erRecordId').value   = r.id;
  document.getElementById('erCar').value        = r.car || '';
  document.getElementById('erMileage').value    = r.mileage || '';
  document.getElementById('erReason').value     = r.reason || '';
  document.getElementById('erDistance').value   = r.total_distance || 0;
  document.getElementById('erStatus').value     = r.returnStatus || 'pending';
  document.getElementById('erDuration').value   = r.duration_text || '';
  document.getElementById('editRecordModal').classList.add('show');
}

async function saveRecordEdit() {
  const recordId = document.getElementById('erRecordId').value;
  const data = {
    car:            document.getElementById('erCar').value.trim(),
    mileage:        document.getElementById('erMileage').value.trim(),
    reason:         document.getElementById('erReason').value.trim(),
    total_distance: document.getElementById('erDistance').value,
    return_status:  document.getElementById('erStatus').value,
    duration_text:  document.getElementById('erDuration').value.trim()
  };
  if (!data.car) { showToast('กรุณาระบุทะเบียนรถ', 'warning'); return; }
  try {
    const res = await fetch('/admin-action', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'edit-record', requestingUserId:adminId, recordId, data }) });
    const d = await res.json();
    if (d.success) { closeModal('editRecordModal'); showToast('แก้ไขข้อมูลสำเร็จ ✅', 'success'); await loadAll(); }
    else           { showToast('เกิดข้อผิดพลาด: ' + d.error, 'error'); }
  } catch(e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
}

/* ──────────────────────────────────────────
   DELETE RECORD
────────────────────────────────────────── */
async function deleteRecord(recordId, name) {
  showConfirm(
    `ลบรายการของ <strong>${name}</strong>?<br><small style="color:var(--c-red)">⚠️ ไม่สามารถกู้คืนได้</small>`,
    'ยืนยันการลบ', '🗑️', 'btn-danger',
    async () => {
      try {
        const res = await fetch('/admin-action', { method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ action:'delete-record', requestingUserId:adminId, recordId }) });
        const d = await res.json();
        if (d.success) { showToast('ลบรายการแล้ว', 'warning'); await loadAll(); }
        else           { showToast('เกิดข้อผิดพลาด: ' + d.error, 'error'); }
      } catch(e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    }
  );
}

/* ──────────────────────────────────────────
   PROXY: บันทึกแทนพนักงาน
────────────────────────────────────────── */
/* ── PROXY PHOTO ── */
let _proxyPhotoFile = null;
function onProxyPhotoChange(e) {
  const f = e.target.files[0];
  _proxyPhotoFile = null;
  if (!f) return;
  if (!['image/jpeg','image/png','image/gif','image/webp'].includes(f.type)) {
    showToast('รองรับ JPG, PNG, WEBP เท่านั้น', 'warning');
    e.target.value = ''; return;
  }
  if (f.size > 10 * 1024 * 1024) {
    showToast('ไฟล์ต้องไม่เกิน 10MB', 'warning');
    e.target.value = ''; return;
  }
  _proxyPhotoFile = f;
  const reader = new FileReader();
  reader.onloadend = () => {
    document.getElementById('proxyPhotoPreview').src = reader.result;
    document.getElementById('proxyPhotoPreviewWrap').style.display = 'block';
    document.getElementById('proxyPhotoLabelText').textContent = `✅ ${f.name} (${(f.size/1024/1024).toFixed(2)} MB)`;
    document.getElementById('proxyPhotoLabel').style.borderColor = 'var(--c-green)';
  };
  reader.readAsDataURL(f);
}
function clearProxyPhoto() {
  _proxyPhotoFile = null;
  document.getElementById('proxyPhoto').value = '';
  document.getElementById('proxyPhotoPreviewWrap').style.display = 'none';
  document.getElementById('proxyPhotoLabelText').textContent = 'แตะเพื่อเลือกรูป (JPG, PNG, WEBP ไม่เกิน 10MB)';
  document.getElementById('proxyPhotoLabel').style.borderColor = '';
}

function populateProxyUsers() {
  const sel = document.getElementById('proxyUser');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— เลือกพนักงาน —</option>';
  Object.entries(allData.userMap)
    .filter(([, u]) => u.status === 'active' && u.role !== 'admin')
    .sort((a, b) => (a[1].name || '').localeCompare(b[1].name || '', 'th'))
    .forEach(([id, u]) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${u.name || id} ${u.department ? `(${u.department})` : ''}`;
      sel.appendChild(opt);
    });
  if (current) sel.value = current;
}

function onProxyUserChange() {
  const uid = document.getElementById('proxyUser').value;
  const info = document.getElementById('proxyUserInfo');
  if (!uid || !allData.userMap[uid]) { info.style.display = 'none'; return; }
  const u = allData.userMap[uid];
  info.style.display = 'block';
  info.innerHTML = `📛 ${esc(u.name || '—')} &nbsp;|&nbsp; 📱 ${esc(u.phone || '—')} &nbsp;|&nbsp; 🏢 ${esc(u.department || '—')}`;
}

async function proxySubmit() {
  const targetUserId = document.getElementById('proxyUser').value;
  const car          = document.getElementById('proxyCar').value;
  const mileage      = document.getElementById('proxyMileage').value.trim();
  const reason       = document.getElementById('proxyReason').value.trim();
  const totalDistance = document.getElementById('proxyDistance').value || '0';
  if (!targetUserId) { showToast('กรุณาเลือกพนักงาน', 'warning'); return; }
  if (!car)          { showToast('กรุณาเลือกรถ', 'warning'); return; }
  if (!mileage)      { showToast('กรุณากรอกเลขไมล์', 'warning'); return; }
  if (!reason)       { showToast('กรุณากรอกสาเหตุ', 'warning'); return; }
  const u = allData.userMap[targetUserId];
  const hasPhoto = !!_proxyPhotoFile;
  showConfirm(
    `บันทึกการยืมรถ <strong>${esc(car)}</strong><br>แทน <strong>${esc(u?.name || targetUserId)}</strong>${hasPhoto ? '<br><span style="font-size:12px;color:var(--c-green)">📸 มีรูปไมล์แนบ</span>' : ''}?`,
    'ยืนยันบันทึกแทนพนักงาน', '📋', 'btn-primary',
    async () => {
      try {
        let photoKey = null;

        // อัปโหลดรูปก่อน (ถ้ามี)
        if (_proxyPhotoFile) {
          showToast('⏳ กำลังอัปโหลดรูปไมล์...', 'info');
          try {
            const fd = new FormData();
            fd.append('photo', _proxyPhotoFile);
            const ur = await fetch('/upload-photo', { method: 'POST', body: fd }).then(r => r.json());
            if (ur.success) { photoKey = ur.key; }
            else showToast('อัปโหลดรูปไม่สำเร็จ (ดำเนินการต่อโดยไม่มีรูป)', 'warning');
          } catch { showToast('อัปโหลดรูปไม่สำเร็จ (ดำเนินการต่อโดยไม่มีรูป)', 'warning'); }
        }

        const res = await fetch('/admin-action', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'proxy-save-record', requestingUserId: adminId, targetUserId, car, mileage, reason, totalDistance, photoKey })
        });
        const d = await res.json();
        if (d.success) {
          showToast(`✅ บันทึกสำเร็จ! รถ ${car} · ${u?.name}${photoKey ? ' 📸' : ''}`, 'success');
          document.getElementById('proxyUser').value = '';
          document.getElementById('proxyCar').value = '';
          document.getElementById('proxyMileage').value = '';
          document.getElementById('proxyReason').value = '';
          document.getElementById('proxyDistance').value = '';
          document.getElementById('proxyUserInfo').style.display = 'none';
          clearProxyPhoto();
          loadProxyActive();
          await loadAll();
        } else { showToast('เกิดข้อผิดพลาด: ' + (d.error || '?'), 'error'); }
      } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
    }
  );
}

async function loadProxyActive() {
  const el = document.getElementById('proxyActiveList');
  if (!el) return;
  el.innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>กำลังโหลด...</p></div>';
  try {
    const res = await fetch('/admin-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-active-records', requestingUserId: adminId })
    });
    const d = await res.json();
    const recs = d.records || [];
    if (recs.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="icon">✅</div><p>ทุกคันกลับแล้ว</p></div>';
      return;
    }
    el.innerHTML = recs.map(r => `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--c-border)">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--c-text)">${esc(r.car || '—')}</div>
          <div style="font-size:12px;color:var(--c-text2)">${esc(r.name || '—')} ${r.department ? `· ${esc(r.department)}` : ''}</div>
          <div style="font-size:11px;color:var(--c-text3)">${esc((r.reason || '').slice(0, 40))} · ${fmtDate(r.timestamp)}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="proxyReturn('${esc(r.id)}','${esc(r.name||'')}','${esc(r.car||'')}')">
          <i class="fas fa-rotate-left"></i> คืนรถ
        </button>
      </div>
    `).join('');
  } catch { el.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><p>โหลดไม่สำเร็จ</p></div>'; }
}

async function proxyReturn(recordId, name, car) {
  showConfirm(`คืนรถ <strong>${esc(car)}</strong> แทน <strong>${esc(name)}</strong>?`, 'ยืนยันคืนรถ', '🔑', 'btn-danger', async () => {
    try {
      const res = await fetch('/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'proxy-return', requestingUserId: adminId, recordId })
      });
      const d = await res.json();
      if (d.success) { showToast(`✅ คืนรถ ${car} สำเร็จ`, 'success'); loadProxyActive(); await loadAll(); }
      else showToast('เกิดข้อผิดพลาด', 'error');
    } catch { showToast('เกิดข้อผิดพลาด', 'error'); }
  });
}

let toastTimer;
function showToast(msg, type='info') {
  const t = document.getElementById('toast');
  const icons = { success:'fa-check-circle', error:'fa-times-circle', warning:'fa-exclamation-triangle', info:'fa-info-circle' };
  t.innerHTML = `<i class="fas ${icons[type]||'fa-info-circle'}"></i> ${msg}`;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}
