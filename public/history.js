let allRecords = [], filteredRecords = [], currentPage = 1;
const PAGE = 20;
let chartInstance = null;

// ─── FETCH ───
async function loadData() {
  try {
    const res = await fetch('/get-records');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    allRecords = data.records || [];

    calcStats(allRecords);
    buildChart(allRecords);
    filteredRecords = [...allRecords];
    renderTable();
    document.getElementById('loadState').style.display = 'none';
  } catch(e) {
    document.getElementById('loadState').innerHTML = `
      <span style="font-size:36px;display:block;margin-bottom:8px">⚠️</span>
      <div style="color:var(--muted)">โหลดไม่สำเร็จ: ${e.message}</div>
      <button onclick="loadData()" style="margin-top:12px;padding:8px 18px;background:var(--g600);color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:Kanit,sans-serif">ลองอีกครั้ง</button>
    `;
  }
}

// ─── CALC STATS ───
function calcStats(records) {
  const now  = new Date();
  const thisY = now.getFullYear();
  const thisM = now.getMonth();

  const monthly = records.filter(r => {
    if (!r.timestamp) return false;
    const d = new Date(r.timestamp);
    return d.getFullYear() === thisY && d.getMonth() === thisM;
  });

  // กม. เดือนนี้
  const km = monthly.reduce((s,r) => s + (r.totalDistance||0), 0);
  document.getElementById('sKm').textContent = km.toFixed(0);
  document.getElementById('sKmSub').textContent = `${monthly.length} เที่ยวเดือนนี้`;

  // รถออกอยู่
  const active = records.filter(r => r.returnStatus === 'pending').length;
  document.getElementById('sActive').textContent = active;
  document.getElementById('sActiveSub').className = `stat-sub ${active > 0 ? 'warn' : 'up'}`;
  document.getElementById('sActiveSub').textContent = active > 0 ? '⚠️ ยังไม่คืนรถ' : '✅ ทุกคันกลับแล้ว';

  // คืนแล้วเดือนนี้
  const returned = monthly.filter(r => r.returnStatus === 'returned').length;
  document.getElementById('sReturned').textContent = returned;
  document.getElementById('sReturnedSub').textContent = `จาก ${monthly.length} เที่ยว`;

  // ผู้ใช้เดือนนี้
  const users = new Set(monthly.map(r => r.userId)).size;
  document.getElementById('sUsers').textContent = users;
  document.getElementById('sUsersSub').textContent = `คน (ใช้รถเดือนนี้)`;
}

// ─── BUILD 12-MONTH CHART (ม.ค. → ธ.ค. ของปีปัจจุบัน) ───
function buildChart(records) {
  const now = new Date();
  const curYear = now.getFullYear();
  const months = [];
  const tripsData  = [];
  const kmData     = [];
  const labels     = [];

  // เรียงจากเดือน 0 (ม.ค.) ถึง 11 (ธ.ค.) — ถ้ายังไม่ถึงเดือนนั้นก็แสดง 0
  for (let m = 0; m <= 11; m++) {
    const d = new Date(curYear, m, 1);
    months.push({ y: curYear, m });
    labels.push(d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }));
  }

  months.forEach(({ y, m }) => {
    const recs = records.filter(r => {
      if (!r.timestamp) return false;
      const d = new Date(r.timestamp);
      return d.getFullYear() === y && d.getMonth() === m;
    });
    tripsData.push(recs.length);
    kmData.push(parseFloat(recs.reduce((s, r) => s + (r.totalDistance || 0), 0).toFixed(1)));
  });

  document.getElementById('chartSub').textContent =
    `รวม ${records.length} เที่ยว · ${records.reduce((s,r)=>s+(r.totalDistance||0),0).toFixed(0)} กม. ตลอดเวลา`;

  if (chartInstance) chartInstance.destroy();

  const ctx = document.getElementById('monthChart').getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'จำนวนเที่ยว',
          data: tripsData,
          backgroundColor: 'rgba(22,163,74,0.75)',
          borderColor: 'rgba(22,163,74,1)',
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
          yAxisID: 'y',
        },
        {
          label: 'ระยะทาง (กม.)',
          data: kmData,
          type: 'line',
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.08)',
          pointBackgroundColor: '#f59e0b',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2.5,
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: 'Kanit', size: 12 }, padding: 16, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: 'rgba(20,83,45,0.92)',
          titleFont: { family: 'Kanit', size: 13 },
          bodyFont:  { family: 'Kanit', size: 12 },
          padding: 12, cornerRadius: 10,
          callbacks: {
            label: ctx => ctx.datasetIndex === 0
              ? ` ${ctx.parsed.y} เที่ยว`
              : ` ${ctx.parsed.y} กม.`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Kanit', size: 11 } }
        },
        y: {
          position: 'left',
          beginAtZero: true,
          grid: { color: 'rgba(22,163,74,0.08)' },
          ticks: { font: { family: 'Kanit', size: 11 }, precision: 0 },
          title: { display: true, text: 'จำนวนเที่ยว', font: { family: 'Kanit', size: 11 }, color: '#16a34a' }
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { family: 'Kanit', size: 11 } },
          title: { display: true, text: 'กม.', font: { family: 'Kanit', size: 11 }, color: '#f59e0b' }
        }
      }
    }
  });
}

// ─── PARSE COORDS ───
function parseRouteCoords(routeText) {
  if (!routeText) return [];
  // JSON format (ใหม่)
  try {
    const arr = JSON.parse(routeText);
    if (Array.isArray(arr) && arr.length && arr[0].lat !== undefined)
      return arr.map(p => ({ lat: parseFloat(p.lat), lng: parseFloat(p.lng) }));
  } catch(_) {}
  // regex fallback (เก่า)
  const re = /จุดที่\s*\d+[^:]*:\s*([-\d.]+),\s*([-\d.]+)/g;
  const out = []; let m;
  while ((m = re.exec(routeText)) !== null)
    out.push({ lat: parseFloat(m[1]), lng: parseFloat(m[2]) });
  return out;
}

// ─── RENDER TABLE ───
function renderTable() {
  const total = filteredRecords.length;
  const start = (currentPage - 1) * PAGE;
  const page  = filteredRecords.slice(start, start + PAGE);

  document.getElementById('recCount').textContent = `${total} รายการ`;

  if (total === 0) {
    document.getElementById('tblWrap').style.display   = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('pagination').style.display = 'none';
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('tblWrap').style.display    = 'block';

  document.getElementById('tblBody').innerHTML = page.map((r, i) => {
    const gi = start + i;
    const av = r.pictureUrl
      ? `<img src="${r.pictureUrl}" alt="" onerror="this.style.display='none'">`
      : `<div class="u-av">${(r.name||'?').charAt(0)}</div>`;

    const statusBadge = r.returnStatus === 'returned'
      ? '<span class="badge b-green"><i class="fas fa-check"></i> คืนแล้ว</span>'
      : '<span class="badge b-yellow"><i class="fas fa-clock"></i> ใช้อยู่</span>';

    return `<tr>
      <td>
        <div class="u-cell">${av}
          <div>
            <div class="u-name">${esc(r.name||'-')}</div>
            <div class="u-dept">${esc(r.department||'')}${r.phone?' · '+r.phone:''}</div>
          </div>
        </div>
      </td>
      <td><span class="car-badge">🚗 ${esc(r.car||'-')}</span></td>
      <td><span class="reason-cell" title="${esc(r.reason||'-')}">${esc(r.reason||'-')}</span></td>
      <td class="date-start">${fmtDate(r.timestamp)}</td>
      <td>${statusBadge}</td>
      <td class="date-end">${r.returnedAt ? fmtDate(r.returnedAt) : '-'}</td>
      <td style="text-align:center">
        <button class="btn-eye" onclick="openDetail(${gi})" title="ดูรายละเอียด">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>`;
  }).join('');

  renderPagination(total);
}

// ─── DETAIL MODAL ───
function openDetail(idx) {
  const r = filteredRecords[idx];
  if (!r) return;

  const coords = parseRouteCoords(r.routeText);
  const retLoc = r.returnLocation;

  const av = r.pictureUrl
    ? `<img src="${r.pictureUrl}" alt="" onerror="this.style.display='none'">`
    : `<div class="m-uav">${(r.name||'?').charAt(0)}</div>`;

  const statusBadge = r.returnStatus === 'returned'
    ? '<span class="badge b-green">✅ คืนรถแล้ว</span>'
    : '<span class="badge b-yellow">🔑 กำลังใช้อยู่</span>';

  // destinations
  const destHtml = coords.length === 0
    ? '<div class="no-loc">📍 ไม่มีข้อมูลปลายทาง</div>'
    : coords.map((c, i) => `
        <div class="loc-card">
          <div>
            <div class="lc-lbl">📍 จุดที่ ${i+1}</div>
            <div class="lc-coord">${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}</div>
          </div>
          <a href="https://www.google.com/maps?q=${c.lat},${c.lng}" target="_blank" class="btn-map">
            <i class="fas fa-map-marker-alt"></i> เปิดแผนที่
          </a>
        </div>`).join('');

  // return location
  const retLocHtml = (!retLoc || !retLoc.lat)
    ? '<div class="no-loc">🚩 ไม่มีข้อมูลตำแหน่งคืนรถ</div>'
    : `<div class="loc-card">
        <div>
          <div class="lc-lbl">🚩 ตำแหน่งที่คืนรถ</div>
          <div class="lc-coord">${retLoc.lat.toFixed(6)}, ${retLoc.lng.toFixed(6)}</div>
          ${retLoc.accuracy ? `<div class="lc-acc">ความแม่นยำ ±${Math.round(retLoc.accuracy)} เมตร</div>` : ''}
        </div>
        <a href="https://www.google.com/maps?q=${retLoc.lat},${retLoc.lng}" target="_blank" class="btn-map red">
          <i class="fas fa-flag"></i> เปิดแผนที่
        </a>
      </div>`;

  document.getElementById('modalBd').innerHTML = `
    <div class="m-user">
      ${av}
      <div>
        <div class="m-uname">${esc(r.name||'-')}</div>
        <div class="m-usub">${esc(r.department||'')}${r.phone?' · '+r.phone:''}</div>
        <div style="margin-top:8px">${statusBadge}</div>
      </div>
    </div>

    <div class="m-sec">
      <div class="m-sec-title"><i class="fas fa-car"></i> ข้อมูลการใช้รถ</div>
      <div class="m-grid">
        <div class="m-item"><div class="m-lbl">ทะเบียนรถ</div><div class="m-val">🚗 ${esc(r.car||'-')}</div></div>
        <div class="m-item"><div class="m-lbl">เลขไมล์เริ่มต้น</div><div class="m-val">${esc(r.mileage||'-')}</div></div>
        <div class="m-item"><div class="m-lbl">ระยะทางรวม</div><div class="m-val green">${r.totalDistance ? r.totalDistance.toFixed(2)+' กม.' : '-'}</div></div>
        <div class="m-item"><div class="m-lbl">ระยะเวลาใช้งาน</div><div class="m-val green">⏱ ${esc(r.durationText||'-')}</div></div>
        <div class="m-item full"><div class="m-lbl">สาเหตุการใช้รถ</div><div class="m-val">${esc(r.reason||'-')}</div></div>
        <div class="m-item"><div class="m-lbl">🟢 เริ่มใช้รถ</div><div class="m-val green">${fmtDate(r.timestamp)}</div></div>
        <div class="m-item"><div class="m-lbl">🔴 คืนรถเมื่อ</div><div class="m-val red">${r.returnedAt ? fmtDate(r.returnedAt) : '-'}</div></div>
        <div class="m-item full"><div class="m-lbl">รูปเลขไมล์</div><div class="m-val">${
          r.photoKey
            ? `<div style="margin-top:6px"><img src="/get-photo?key=${encodeURIComponent(r.photoKey)}" alt="รูปเลขไมล์" loading="lazy" onclick="this.classList.toggle('photo-zoom')" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid #e2e8f0;cursor:zoom-in;display:block"></div><div style="font-size:11px;color:#64748b;margin-top:4px">📸 แตะรูปเพื่อขยาย</div>`
            : r.hasPhoto ? '📸 มีรูปแนบ (อัปโหลดก่อนเปิดใช้ R2)' : '—'
        }</div></div>
      </div>
    </div>

    <div class="m-sec">
      <div class="m-sec-title"><i class="fas fa-map-marked-alt"></i> ปลายทางที่เลือก</div>
      ${destHtml}
    </div>

    <div class="m-sec">
      <div class="m-sec-title"><i class="fas fa-flag-checkered"></i> ตำแหน่งคืนรถ</div>
      ${retLocHtml}
    </div>
  `;

  document.getElementById('detailOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('detailOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function handleOverlay(e) { if (e.target === e.currentTarget) closeModal(); }

// ─── FILTER ───
function applyFilter() {
  const s  = document.getElementById('searchInput').value.toLowerCase().trim();
  const c  = document.getElementById('filterCar').value.toLowerCase();
  const st = document.getElementById('filterStatus').value;
  const dt = document.getElementById('filterDate').value;
  filteredRecords = allRecords.filter(r => {
    if (s  && !`${r.name} ${r.car} ${r.reason} ${r.phone}`.toLowerCase().includes(s)) return false;
    if (c  && !r.car?.toLowerCase().includes(c))              return false;
    if (st && r.returnStatus !== st)                          return false;
    if (dt && r.timestamp && !r.timestamp.startsWith(dt))    return false;
    return true;
  });
  currentPage = 1; renderTable();
}
function resetFilter() {
  ['searchInput','filterCar','filterStatus','filterDate'].forEach(id => document.getElementById(id).value = '');
  filteredRecords = [...allRecords]; currentPage = 1; renderTable();
}
document.getElementById('searchInput').addEventListener('input', applyFilter);

// ─── PAGINATION ───
function renderPagination(total) {
  const pages = Math.ceil(total / PAGE);
  const pag = document.getElementById('pagination');
  if (pages <= 1) { pag.style.display = 'none'; return; }
  pag.style.display = 'flex';
  let h = `<button class="pg-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
  for (let i = 1; i <= pages; i++) {
    if (i===1||i===pages||(i>=currentPage-1&&i<=currentPage+1))
      h += `<button class="pg-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
    else if (i===currentPage-2||i===currentPage+2)
      h += `<span class="pg-info">...</span>`;
  }
  h += `<button class="pg-btn" onclick="goPage(${currentPage+1})" ${currentPage===pages?'disabled':''}>›</button>`;
  h += `<span class="pg-info">${currentPage}/${pages}</span>`;
  pag.innerHTML = h;
}
function goPage(p) {
  const pages = Math.ceil(filteredRecords.length / PAGE);
  if (p < 1 || p > pages) return;
  currentPage = p; renderTable();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── CSV ───
function exportCSV() {
  const data = filteredRecords.length ? filteredRecords : allRecords;
  const headers = ['ชื่อ','เบอร์โทร','แผนก','ทะเบียนรถ','ไมล์','สาเหตุ','ระยะทาง(กม)','เริ่มใช้','สถานะ','คืนเมื่อ','ระยะเวลา'];
  const rows = data.map(r => [
    r.name||'',r.phone||'',r.department||'',r.car||'',r.mileage||'',
    r.reason||'',r.totalDistance||0,r.timestamp||'',
    r.returnStatus==='returned'?'คืนแล้ว':'กำลังใช้',
    r.returnedAt||'',r.durationText||''
  ]);
  const csv = '\uFEFF'+[headers,...rows].map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download = `car-history-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ─── HELPERS ───
function fmtDate(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('th-TH',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
  catch { return iso; }
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── INIT ───
loadData();
setInterval(loadData, 120000);
document.addEventListener('keydown', e => { if (e.key==='Escape') closeModal(); });
