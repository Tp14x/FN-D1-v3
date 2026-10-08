/* ─── CONFIG ─── */
const CONFIG={
  liffId:'2007130450-YVNvyNbL',
  googleMapsKey:'AIzaSyAw5sDr5qXKIpun2dp4jpu8NerbXy6Hfew',
  originLatLng:{lat:14.975719186601136,lng:102.1254756236624},
  autoDestination:{userId:'Uc8695dc6e2569a960fe8912809a2e2ff',startTime:{h:16,m:40},endTime:{h:17,m:20},location:{lat:14.975057297021436,lng:102.11365790021132}}
};

/* ─── STATE ─── */
let currentUser=null,map=null,markers=[],directionsRenderer,directionsService,mapInitialized=false,mapType='roadmap';
let autocomplete=null,cachedPhotoBase64=null,cachedPhotoFile=null,returnLocation=null,timerInterval=null;
const CAR_USAGE_KEY='car_usage_v2';

/* ─── UTILS ─── */
function loadUsage(){try{const s=localStorage.getItem(CAR_USAGE_KEY);if(!s)return null;const u=JSON.parse(s);if(u.startedAt&&(Date.now()-new Date(u.startedAt))>86400000){localStorage.removeItem(CAR_USAGE_KEY);return null;}return u.isUsing?u:null;}catch{return null;}}
function saveUsage(d){localStorage.setItem(CAR_USAGE_KEY,JSON.stringify(d));}
function clearUsage(){localStorage.removeItem(CAR_USAGE_KEY);}
function escapeHtml(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

/* ─── SCREENS ─── */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById(id);if(el)el.classList.add('active');
}

/* ─── TOAST ─── */
let _tt;
function showToast(msg,type='info'){
  const t=document.getElementById('toast');t.textContent=msg;t.className=`${type} show`;
  clearTimeout(_tt);_tt=setTimeout(()=>t.classList.remove('show'),3500);
}

/* ─── ERRORS ─── */
function showErr(id,msg){const e=document.getElementById(id+'-error');if(e){e.querySelector('span').textContent=msg;e.classList.add('show');}}
function clearErr(id){const e=document.getElementById(id+'-error');if(e)e.classList.remove('show');}

/* ─── STEP INDICATOR ─── */
function updateSteps(){
  const hasCar=document.getElementById('car').value;
  const hasMile=document.getElementById('mileage').value;
  const hasReason=document.getElementById('reason').value.trim();
  const hasMap=markers.length>0;
  const s=(n,done,active)=>{
    const el=document.getElementById('step'+n);
    el.classList.toggle('done',done);el.classList.toggle('active',active&&!done);
    const prev=document.getElementById('step'+(n-1));
    if(prev)prev.classList.toggle('done',done||active);
  };
  s(1,hasCar&&hasMile,true);
  s(2,hasReason,hasCar&&hasMile);
  s(3,hasMap,hasReason);
  s(4,false,hasMap);
}

/* ─── CAR PILLS ─── */
let _busyCarCache={ts:0,data:{}};
async function loadBusyCars(){
  try{
    const res=await fetch('/get-records?status=pending&limit=50');
    const d=await res.json();
    const m={};
    if(d.records)d.records.forEach(r=>{if(r.car)m[r.car]=r;});
    _busyCarCache={ts:Date.now(),data:m};
    return m;
  }catch{return {};}
}
function markBusyPills(busyMap){
  document.querySelectorAll('.car-pill').forEach(p=>{
    const v=p.querySelector('input')?.value||'';
    // remove old status badge
    p.querySelector('.car-pill-status')?.remove();
    if(busyMap[v]){
      p.classList.add('car-pill-busy');
    } else {
      p.classList.remove('car-pill-busy');
      const s=document.createElement('span');
      s.className='car-pill-status free';s.textContent='ว่าง';
      p.style.position='relative';p.appendChild(s);
    }
  });
}
async function refreshCarStatus(){
  const m=await loadBusyCars();
  markBusyPills(m);
}
function onCarPick(radio){
  const v=radio.value;
  document.getElementById('car').value=v;
  document.querySelectorAll('.car-pill').forEach(p=>p.classList.toggle('selected',p.querySelector('input')===radio));
  clearErr('car');updateSteps();
  // Check if this car is busy (use cache if fresh, else fetch)
  const now=Date.now();
  const doCheck=()=>{
    const rec=_busyCarCache.data[v];
    if(rec){
      // Deselect pill
      radio.checked=false;
      document.getElementById('car').value='';
      document.querySelectorAll('.car-pill').forEach(p=>p.classList.remove('selected'));
      updateSteps();
      showCarBusyModal(rec);
    }
  };
  if(now-_busyCarCache.ts<30000){doCheck();}
  else{loadBusyCars().then(m=>{_busyCarCache={ts:Date.now(),data:m};markBusyPills(m);doCheck();});}
}
function showCarBusyModal(r){
  document.getElementById('busyCar').textContent=r.car||'—';
  document.getElementById('busyUser').textContent=r.name||'—';
  document.getElementById('busyDept').textContent=r.department||'—';
  document.getElementById('busyTime').textContent=r.timestamp?new Date(r.timestamp).toLocaleString('th-TH'):'—';
  document.getElementById('carBusyModal').classList.add('show');
}
function closeCarBusyModal(){
  document.getElementById('carBusyModal').classList.remove('show');
}

/* ─── PHOTO ─── */
document.getElementById('mileagePhoto').addEventListener('change',e=>{
  const f=e.target.files[0];cachedPhotoBase64=null;cachedPhotoFile=null;
  const prev=document.getElementById('photoPreview'),wrap=document.getElementById('photoPreviewWrap'),info=document.getElementById('photoInfo'),area=document.getElementById('photoArea');
  const prog=document.getElementById('uploadProgress'),bar=document.getElementById('uploadProgressBar'),lbl=document.getElementById('uploadProgressLabel');
  if(!f){wrap.classList.remove('show');area.classList.remove('has-file');prog.classList.remove('show');return;}
  if(!['image/jpeg','image/png','image/gif','image/webp'].includes(f.type)){showToast('รองรับ JPG, PNG, WEBP เท่านั้น','warning');e.target.value='';return;}
  if(f.size>10*1024*1024){showToast('ไฟล์ต้องไม่เกิน 10MB','warning');e.target.value='';return;}
  cachedPhotoFile=f;
  prog.classList.add('show');bar.style.width='0%';lbl.textContent='กำลังอ่านไฟล์...';
  let pct=0;const iv=setInterval(()=>{pct=Math.min(pct+Math.random()*18+5,90);bar.style.width=pct+'%';lbl.textContent=`กำลังโหลด... ${Math.round(pct)}%`;},80);
  const r=new FileReader();
  r.onloadend=()=>{
    clearInterval(iv);bar.style.width='100%';lbl.textContent='✅ โหลดสำเร็จ!';
    cachedPhotoBase64=r.result;prev.src=r.result;wrap.classList.add('show');area.classList.add('has-file');
    info.textContent=`✅ ${f.name} (${(f.size/1024/1024).toFixed(2)} MB)`;
    setTimeout(()=>prog.classList.remove('show'),1200);
  };
  r.readAsDataURL(f);
});
function clearPhoto(){document.getElementById('mileagePhoto').value='';cachedPhotoBase64=null;cachedPhotoFile=null;document.getElementById('photoPreviewWrap').classList.remove('show');document.getElementById('photoArea').classList.remove('has-file');document.getElementById('photoInfo').textContent='';}

/* ─── MAP ─── */
function initMap(){
  if(mapInitialized)return;
  try{
    map=new google.maps.Map(document.getElementById('map'),{center:CONFIG.originLatLng,zoom:12,mapTypeId:'roadmap',mapTypeControl:false,fullscreenControl:false,streetViewControl:false,zoomControl:true});
    directionsRenderer=new google.maps.DirectionsRenderer({map,suppressMarkers:true,polylineOptions:{strokeColor:'#18a857',strokeWeight:4}});
    directionsService=new google.maps.DirectionsService();
    new google.maps.Marker({position:CONFIG.originLatLng,map,title:'บริษัท (จุดเริ่มต้น)',icon:{url:'https://maps.google.com/mapfiles/ms/icons/green-dot.png',scaledSize:new google.maps.Size(40,40)}});
    autocomplete=new google.maps.places.Autocomplete(document.getElementById('searchInput'),{types:['establishment','geocode'],componentRestrictions:{country:'th'}});
    autocomplete.bindTo('bounds',map);
    autocomplete.addListener('place_changed',()=>{const p=autocomplete.getPlace();if(!p.geometry?.location)return;if(markers.length>=3){showToast('เลือกได้สูงสุด 3 จุด','warning');return;}addMarker(p.geometry.location);map.panTo(p.geometry.location);document.getElementById('searchInput').value='';});
    map.addListener('click',e=>{if(markers.length>=3){showToast('เลือกได้สูงสุด 3 จุด','warning');return;}addMarker(e.latLng);});
    mapInitialized=true;
    setTimeout(()=>{if(currentUser&&!loadUsage())checkAutoDestination();},1500);
  }catch{document.getElementById('map').innerHTML='<div style="padding:40px;text-align:center;color:var(--text-muted)"><i class="fas fa-map" style="font-size:32px;display:block;margin-bottom:8px"></i>ไม่สามารถโหลดแผนที่ได้</div>';}
}
function addMarker(pos){
  const m=new google.maps.Marker({position:pos,map,icon:{url:'https://maps.google.com/mapfiles/ms/icons/red-dot.png',scaledSize:new google.maps.Size(32,32)},animation:google.maps.Animation.DROP});
  m.addListener('click',()=>{m.setMap(null);markers=markers.filter(x=>x!==m);updateDest();calcRoute();updateSteps();});
  markers.push(m);updateDest();calcRoute();clearErr('destinations');updateSteps();
}
function updateDest(){
  const el=document.getElementById('selectedDestinations');
  el.textContent=markers.length===0?'📍 แตะบนแผนที่เพื่อปักหมุดปลายทาง':markers.map((m,i)=>`📍 จุดที่ ${i+1}: ${m.getPosition().lat().toFixed(5)}, ${m.getPosition().lng().toFixed(5)}`).join('\n');
}
function calcRoute(){
  const el=document.getElementById('routeInfo');
  if(markers.length===0){directionsRenderer?.set('directions',null);el.innerHTML='<i class="fas fa-route"></i><span>เลือกปลายทางเพื่อคำนวณระยะทาง</span>';return;}
  const wp=markers.slice(0,-1).map(m=>({location:m.getPosition(),stopover:true}));
  directionsService.route({origin:CONFIG.originLatLng,destination:markers[markers.length-1].getPosition(),waypoints:wp,travelMode:google.maps.TravelMode.DRIVING},(res,st)=>{
    if(st==='OK'){
      directionsRenderer.setDirections(res);let d=0,t=0;
      res.routes[0].legs.forEach(l=>{d+=l.distance.value;t+=l.duration.value;});
      el.innerHTML=`<i class="fas fa-route"></i><span>🛣️ <strong>${(d/1000).toFixed(2)} กม.</strong> &nbsp;·&nbsp; ⏱ <strong>${Math.round(t/60)} นาที</strong></span>`;
    }
  });
}
function clearAllMarkers(){markers.forEach(m=>m.setMap(null));markers=[];updateDest();calcRoute();updateSteps();showToast('ล้างหมุดแล้ว','info');}
function centerMap(){if(map){map.panTo(CONFIG.originLatLng);map.setZoom(12);}}
function toggleMapType(){if(!map)return;mapType=mapType==='roadmap'?'satellite':'roadmap';map.setMapTypeId(mapType);}
function checkAutoDestination(){
  if(!currentUser||currentUser.userId!==CONFIG.autoDestination.userId)return;
  const now=new Date(),tot=now.getHours()*60+now.getMinutes(),s=CONFIG.autoDestination.startTime.h*60+CONFIG.autoDestination.startTime.m,e=CONFIG.autoDestination.endTime.h*60+CONFIG.autoDestination.endTime.m;
  if(tot>=s&&tot<=e&&markers.length===0){const l=CONFIG.autoDestination.location;addMarker(new google.maps.LatLng(l.lat,l.lng));map.panTo(l);showToast('📍 เพิ่มปลายทางอัตโนมัติ','info');}
}

/* ─── FLEX MSG ─── */
function buildFlexMessage(name,phone,car,mileage,reason,markerList,routeText,hasPhoto){
  const dm=String(routeText).match(/([\d.]+)\s*กม/),tm=String(routeText).match(/(\d+)\s*นาที/);
  const now=new Date(),ds=now.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}),ts=now.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  const dests=markerList.length>0?markerList.map((m,i)=>({type:'text',size:'sm',wrap:true,color:'#6b7280',text:`• จุดที่ ${i+1}: ${m.getPosition().lat().toFixed(5)}, ${m.getPosition().lng().toFixed(5)}`})):[{type:'text',size:'sm',color:'#9ca3af',text:'• ไม่ได้ระบุปลายทาง'}];
  return{type:'flex',altText:`🚗 ${name} ขอใช้รถ ${car} เลขไมล์ ${mileage}`,contents:{type:'bubble',size:'mega',header:{type:'box',layout:'vertical',backgroundColor:'#16a34a',paddingAll:'16px',contents:[{type:'text',text:'บันทึกการใช้รถ',weight:'bold',size:'xl',color:'#FFFFFF',align:'center'},{type:'text',text:`${ds}  ${ts} น.`,size:'xs',color:'#d1fae5',align:'center',margin:'sm'}]},body:{type:'box',layout:'vertical',spacing:'sm',contents:[{type:'text',text:`ชื่อ : ${name}`,size:'md',wrap:true},{type:'text',text:`เบอร์โทร : ${phone}`,size:'md',wrap:true,color:'#374151'},{type:'text',text:`ทะเบียนรถ : ${car}`,size:'md',wrap:true,weight:'bold'},{type:'text',text:`ไมล์รถ : ${mileage}`,size:'md',wrap:true},{type:'text',text:`สาเหตุ : ${reason}`,size:'sm',wrap:true,color:'#6b7280',margin:'md'},{type:'separator',margin:'md'},{type:'text',text:'ปลายทาง',weight:'bold',size:'sm',margin:'md'},...dests,{type:'separator',margin:'md'},{type:'box',layout:'horizontal',spacing:'lg',margin:'md',contents:[{type:'box',layout:'vertical',alignItems:'center',contents:[{type:'text',text:dm?`${dm[1]} กม.`:'-',size:'lg',weight:'bold',color:'#16a34a'},{type:'text',text:'ระยะทาง',size:'xs',color:'#9ca3af'}]},{type:'box',layout:'vertical',alignItems:'center',contents:[{type:'text',text:tm?`${tm[1]} นาที`:'-',size:'lg',weight:'bold',color:'#16a34a'},{type:'text',text:'เวลาประมาณ',size:'xs',color:'#9ca3af'}]}]},{type:'text',text:hasPhoto?'แนบรูปเลขไมล์แล้ว ✓':'ไม่มีรูปเลขไมล์',size:'sm',align:'center',margin:'sm',color:hasPhoto?'#16a34a':'#ef4444'}]},footer:{type:'box',layout:'vertical',contents:[{type:'button',action:{type:'uri',label:'ดูประวัติการใช้งานรถ',uri:`${window.location.origin}/history`},style:'primary',color:'#16a34a',height:'sm'}]}}};
}
function buildReturnFlexMessage(carPlate,userName,returnTime,durationText,returnLoc){
  const ml=`https://www.google.com/maps?q=${returnLoc.lat},${returnLoc.lng}`;
  const ds=returnTime.toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}),ts=returnTime.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
  return{type:'flex',altText:`🔑 คืนรถแล้ว: ${carPlate} โดย ${userName}`,contents:{type:'bubble',header:{type:'box',layout:'vertical',backgroundColor:'#dc2626',paddingAll:'16px',contents:[{type:'text',text:'แจ้งคืนรถแล้ว',weight:'bold',size:'xl',color:'#FFFFFF',align:'center'},{type:'text',text:`${ds}  ${ts} น.`,size:'xs',color:'#fecaca',align:'center',margin:'sm'}]},body:{type:'box',layout:'vertical',spacing:'sm',contents:[{type:'text',text:`ทะเบียนรถ : ${carPlate}`,size:'xl',weight:'bold',wrap:true},{type:'text',text:`ชื่อ : ${userName}`,size:'md',wrap:true,margin:'sm'},{type:'separator',margin:'md'},{type:'box',layout:'vertical',margin:'md',backgroundColor:'#fff1f2',cornerRadius:'10px',paddingAll:'12px',contents:[{type:'text',text:'ระยะเวลาใช้งาน',size:'xs',color:'#9ca3af'},{type:'text',text:durationText,size:'xl',weight:'bold',color:'#dc2626',margin:'sm'}]},{type:'text',text:`พิกัดคืนรถ : ${returnLoc.lat.toFixed(5)}, ${returnLoc.lng.toFixed(5)}`,size:'xs',wrap:true,color:'#9ca3af',margin:'md'}]},footer:{type:'box',layout:'vertical',spacing:'sm',contents:[{type:'button',action:{type:'uri',label:'ดูตำแหน่งคืนรถ',uri:ml},style:'link',color:'#2563eb',height:'sm'},{type:'button',action:{type:'uri',label:'ดูประวัติการใช้รถ',uri:`${window.location.origin}/history`},style:'primary',color:'#16a34a',height:'sm'}]}}};
}

/* ─── VALIDATION ─── */
function validateForm(){
  let ok=true;
  const car=document.getElementById('car').value,mile=document.getElementById('mileage').value,reason=document.getElementById('reason').value.trim();
  if(!car){showErr('car','กรุณาเลือกทะเบียนรถ');ok=false;}else clearErr('car');
  if(!mile||isNaN(mile)||Number(mile)<0){showErr('mileage','กรุณากรอกเลขไมล์ให้ถูกต้อง');ok=false;}else clearErr('mileage');
  if(!reason){showErr('reason','กรุณากรอกสาเหตุการใช้รถ');ok=false;}else clearErr('reason');
  if(markers.length===0){showErr('destinations','กรุณาเลือกปลายทางอย่างน้อย 1 จุด');ok=false;}else clearErr('destinations');
  return ok;
}

/* ─── SUBMIT ─── */
let _ps=null;
document.getElementById('mainForm').addEventListener('submit',async function(e){
  e.preventDefault();
  if(loadUsage()){showCarInUseScreen(loadUsage());return;}
  if(!currentUser){showToast('กรุณาเข้าสู่ระบบก่อน','warning');return;}
  if(!validateForm())return;
  const car=document.getElementById('car').value,mile=document.getElementById('mileage').value,reason=document.getElementById('reason').value.trim();
  const rt=document.getElementById('routeInfo').innerText||'';
  const name=currentUser.name||currentUser.displayName||'ไม่ระบุ',phone=currentUser.phone||'-';
  _ps={car,mile,reason,rt,name,phone};
  const dm=rt.match(/[\d.]+\s*กม/),tm=rt.match(/\d+\s*นาที/);
  document.getElementById('confirmSummaryContent').innerHTML=`
    <div class="conf-row"><span class="conf-l">👤 ชื่อ</span><span class="conf-v">${escapeHtml(name)}</span></div>
    <div class="conf-row"><span class="conf-l">🚗 ทะเบียน</span><span class="conf-v">${escapeHtml(car)}</span></div>
    <div class="conf-row"><span class="conf-l">📍 เลขไมล์</span><span class="conf-v">${escapeHtml(mile)}</span></div>
    <div class="conf-row"><span class="conf-l">📝 ภารกิจ</span><span class="conf-v">${escapeHtml(reason)}</span></div>
    <div class="conf-row"><span class="conf-l">🛣️ ระยะทาง</span><span class="conf-v">${dm?dm[0]:'ไม่ระบุ'}</span></div>
    <div class="conf-row"><span class="conf-l">📸 รูปไมล์</span><span class="conf-v">${cachedPhotoFile?'✅ มีรูปแนบ':'—'}</span></div>`;
  document.getElementById('confirmSubmitModal').classList.add('show');
  showConfirmMiniMap();
});
function closeConfirmSubmit(){document.getElementById('confirmSubmitModal').classList.remove('show');}

async function doSubmit(){
  closeConfirmSubmit();
  if(!_ps)return;
  const{car,mile,reason,rt,name,phone}=_ps;_ps=null;
  const message=buildFlexMessage(name,phone,car,mile,reason,markers,rt,!!cachedPhotoBase64);
  const btn=document.getElementById('submitBtn');let ok=false;
  ok=true;
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
  try{
    const dm=rt.match(/([\d.]+)\s*กม/),tm=rt.match(/(\d+)\s*นาที/);let pk=null;
    if(cachedPhotoFile){
      btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> กำลังอัปโหลดรูป...';
      try{const fd=new FormData();fd.append('photo',cachedPhotoFile);const ur=await fetch('/upload-photo',{method:'POST',body:fd}).then(r=>r.json());if(ur.success)pk=ur.key;else showToast('อัปโหลดรูปไม่สำเร็จ','warning');}catch{showToast('อัปโหลดรูปไม่สำเร็จ','warning');}
      btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> กำลังบันทึก...';
    }
    const saveRes=await fetch('/save-record',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:currentUser.userId,name,phone,car,mileage:mile,reason,routeText:rt,totalDistance:dm?parseFloat(dm[1]):0,totalTime:tm?parseInt(tm[1]):0,hasPhoto:!!(pk||cachedPhotoBase64),photoKey:pk,destinations:markers.map((m,i)=>({point:i+1,lat:m.getPosition().lat(),lng:m.getPosition().lng()})),timestamp:new Date().toISOString()})});
    const saveData=await saveRes.json();
    if(!saveRes.ok){
      if(saveRes.status===403){
        showModal('🚫','ไม่สามารถบันทึกได้',saveData.error||'บัญชีของคุณถูกระงับการใช้งาน\nกรุณาติดต่อผู้ดูแลระบบ');
      }else{
        showToast(saveData.error||'เกิดข้อผิดพลาด กรุณาลองใหม่','error');
      }
      return;
    }
    const ud={isUsing:true,carPlate:car,carModel:car.split(':')[0].trim(),startedAt:new Date().toISOString(),userName:name,userId:currentUser.userId,mileage:mile};
    saveUsage(ud);
    launchConfetti();
    showCarInUseScreen(ud);showToast(`✅ บันทึกสำเร็จ! ใช้รถ ${car}`,'success');
  }catch{showToast('เกิดข้อผิดพลาด กรุณาลองใหม่','error');}
  finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-share-nodes"></i> บันทึก & แชร์ไปกลุ่ม LINE';}
}

/* ─── CONFETTI ─── */
function launchConfetti(){
  const colors=['#4ade80','#22c55e','#86efac','#fde68a','#60a5fa','#f472b6'];
  for(let i=0;i<52;i++){
    const el=document.createElement('div');
    el.className='confetti-piece';
    el.style.cssText=`left:${Math.random()*100}vw;background:${colors[Math.floor(Math.random()*colors.length)]};width:${6+Math.random()*6}px;height:${6+Math.random()*6}px;animation-delay:${Math.random()*0.6}s;animation-duration:${1+Math.random()*0.8}s;border-radius:${Math.random()>0.5?'50%':'2px'};`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),2500);
  }
}

/* ─── REVERSE GEOCODE ─── */
async function reverseGeocode(lat,lng){
  try{
    const r=await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=th&key=${CONFIG.googleMapsKey}`);
    const d=await r.json();
    return d.results?.[0]?.formatted_address||`${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }catch{return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;}
}

/* ─── MINI MAP IN CONFIRM SHEET ─── */
let confirmMiniMapInstance=null;
function showConfirmMiniMap(){
  if(!markers.length||!window.google){return;}
  const wrap=document.getElementById('confirmMapWrap');
  wrap.style.display='block';
  setTimeout(()=>{
    if(!confirmMiniMapInstance){
      confirmMiniMapInstance=new google.maps.Map(document.getElementById('confirmMiniMap'),{
        zoom:12,mapTypeControl:false,streetViewControl:false,fullscreenControl:false,zoomControl:false,
        center:markers[0].getPosition(),styles:[{featureType:'poi',elementType:'labels',stylers:[{visibility:'off'}]}]
      });
    }
    const bounds=new google.maps.LatLngBounds();
    bounds.extend(CONFIG.originLatLng);
    markers.forEach(m=>bounds.extend(m.getPosition()));
    confirmMiniMapInstance.fitBounds(bounds,{top:20,right:20,bottom:20,left:20});
    // draw markers on mini map
    new google.maps.Marker({position:CONFIG.originLatLng,map:confirmMiniMapInstance,icon:{url:'https://maps.google.com/mapfiles/ms/icons/green-dot.png',scaledSize:new google.maps.Size(28,28)}});
    markers.forEach((m,i)=>new google.maps.Marker({position:m.getPosition(),map:confirmMiniMapInstance,label:{text:String(i+1),color:'#fff',fontSize:'11px',fontWeight:'bold'}}));
  },100);
}

/* ─── SWIPE TO CLOSE SHEET ─── */
function initSwipeSheet(overlayId){
  const overlay=document.getElementById(overlayId);
  if(!overlay)return;
  const sheet=overlay.querySelector('.sheet');
  if(!sheet)return;
  let startY=0,isDragging=false;
  sheet.addEventListener('touchstart',e=>{startY=e.touches[0].clientY;isDragging=true;},{passive:true});
  sheet.addEventListener('touchmove',e=>{
    if(!isDragging)return;
    const dy=e.touches[0].clientY-startY;
    if(dy>0)sheet.style.transform=`translateY(${dy}px)`;
  },{passive:true});
  sheet.addEventListener('touchend',e=>{
    isDragging=false;
    const dy=e.changedTouches[0].clientY-startY;
    sheet.style.transform='';
    if(dy>80){overlay.classList.remove('show');}
  });
}

/* ─── CAR IN USE ─── */
function showCarInUseScreen(u){
  if(!u)u=loadUsage();if(!u)return;
  document.getElementById('infoCarPlate').textContent=u.carPlate||'-';
  document.getElementById('infoUserName').textContent=u.userName||'-';
  document.getElementById('infoMileage').textContent=u.mileage?`${u.mileage} กม.`:'-';
  document.getElementById('infoStartTime').textContent=u.startedAt?new Date(u.startedAt).toLocaleString('th-TH'):'-';
  returnLocation=null;
  document.getElementById('returnCarBtn').innerHTML='<i class="fas fa-rotate-left"></i> คืนรถ & แจ้งกลุ่ม LINE';
  document.getElementById('locationStatus').className='loc-bar';
  document.getElementById('locationStatus').innerHTML='<i class="fas fa-location-dot"></i> ยังไม่ได้ดึงตำแหน่ง (ไม่บังคับ)';
  document.getElementById('locationDetail').style.display='none';
  showScreen('screen-car-in-use');startTimer(u.startedAt);
}
function startTimer(s){
  clearInterval(timerInterval);const st=new Date(s);
  const u=()=>{
    const d=Date.now()-st,h=Math.floor(d/3600000),m=Math.floor((d%3600000)/60000),sc=Math.floor((d%60000)/1000);
    document.getElementById('timerDisplay').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`;
    // warn red at 23h+
    const panel=document.querySelector('.timer-panel');
    if(panel){panel.classList.toggle('warn',h>=23);}
  };
  u();timerInterval=setInterval(u,1000);
}
async function getReturnLocation(){
  const btn=document.getElementById('getLocationBtn'),st=document.getElementById('locationStatus'),det=document.getElementById('locationDetail');
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> กำลังดึงตำแหน่ง...';
  st.className='loc-bar loading';st.innerHTML='⏳ กำลังรับสัญญาณ GPS...';det.style.display='none';
  if(!navigator.geolocation){st.className='loc-bar err';st.innerHTML='❌ เบราว์เซอร์ไม่รองรับ GPS';btn.disabled=false;btn.innerHTML='<i class="fas fa-redo"></i> ลองใหม่';return;}
  const rds=[];
  await new Promise(res=>{
    const w=navigator.geolocation.watchPosition(p=>{
      rds.push({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});
      const a=p.coords.accuracy,cl=a<=20?'acc-tag hi':a<=60?'acc-tag mid':'acc-tag lo',lb=a<=20?'🎯 แม่นมาก':a<=60?'👍 พอใช้':'⚠️ อ่อน';
      st.innerHTML=`⏳ ปรับความแม่นยำ... (${rds.length} pts)<br><span class="${cl}">±${a.toFixed(0)} ม. — ${lb}</span>`;
      if(a<=15){navigator.geolocation.clearWatch(w);res();}
    },()=>{navigator.geolocation.clearWatch(w);res();},{enableHighAccuracy:true,timeout:20000,maximumAge:0});
    setTimeout(()=>{navigator.geolocation.clearWatch(w);res();},8000);
  });
  if(!rds.length){st.className='loc-bar err';st.innerHTML='❌ ดึงตำแหน่งไม่ได้ กรุณาอนุญาต GPS';btn.disabled=false;btn.innerHTML='<i class="fas fa-redo"></i> ลองใหม่';return;}
  const best=rds.reduce((a,b)=>a.accuracy<b.accuracy?a:b);returnLocation=best;
  const a=best.accuracy,cl=a<=20?'acc-tag hi':a<=60?'acc-tag mid':'acc-tag lo',lb=a<=20?'🎯 แม่นมาก':a<=60?'👍 พอใช้':'⚠️ อ่อน';
  st.className='loc-bar ok';st.innerHTML=`✅ ได้ตำแหน่งแล้ว (${rds.length} pts)<br><span class="${cl}">±${a.toFixed(0)} ม. — ${lb}</span>`;
  det.style.display='block';det.innerHTML=`📍 ${best.lat.toFixed(6)}, ${best.lng.toFixed(6)} &nbsp;<a href="https://www.google.com/maps?q=${best.lat},${best.lng}" target="_blank" style="color:var(--blue)"><i class="fas fa-external-link-alt"></i> แผนที่</a>`;
  btn.innerHTML='<i class="fas fa-check-circle"></i> ดึงตำแหน่งสำเร็จ';btn.style.background='linear-gradient(135deg,#148543,#25c96e)';
}
async function handleReturnCar(){
  const u=loadUsage();if(!u){showToast('ไม่พบข้อมูลการใช้รถ','error');return;}

  // ตรวจสอบว่าดึงตำแหน่งแล้วหรือยัง
  if(!returnLocation){
    showToast('⚠️ กรุณากดดึงตำแหน่ง GPS ก่อนคืนรถ','warning');
    document.getElementById('getLocationBtn').style.animation='pulse 0.5s ease 3';
    return;
  }

  const rt=new Date(),st=new Date(u.startedAt),ms=Math.max(0,rt-st),ts=Math.floor(ms/1000),tm=Math.floor(ts/60),h=Math.floor(tm/60),mn=tm%60,sc=ts%60;
  let dur=h>0?`${h} ชั่วโมง ${mn} นาที`:tm>0?`${tm} นาที ${sc} วินาที`:`${sc} วินาที`;
  const msg=buildReturnFlexMessage(u.carPlate,u.userName,rt,dur,returnLocation||{lat:0,lng:0});
  const btn=document.getElementById('returnCarBtn');let ok=false;
  ok=true;
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> บันทึก...';clearInterval(timerInterval);
  try{
    const retRes=await fetch('/update-return-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({carPlate:u.carPlate,returnedAt:rt.toISOString(),durationText:dur,returnLocation,userId:u.userId})});
    const retData=await retRes.json();
    if(!retRes.ok){
      btn.disabled=false;btn.innerHTML='<i class="fas fa-rotate-left"></i> คืนรถ & แจ้งกลุ่ม LINE';
      showModal('🚫','ไม่สามารถคืนรถได้',retData.error||'บัญชีถูกระงับเนื่องจากลืมคืนรถภายใน 24 ชั่วโมง กรุณาติดต่อ พี่เอ๋/พี่เอ็ม/พี่หน่อย');
      return;
    }
  }catch(e){
    btn.disabled=false;btn.innerHTML='<i class="fas fa-rotate-left"></i> คืนรถ & แจ้งกลุ่ม LINE';
    showToast('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่','error');
    return;
  }
  clearUsage();showToast(`✅ คืนรถ ${u.carPlate} สำเร็จ!`,'success');
  showModal('✅','คืนรถสำเร็จ!',`คืนรถ ${u.carPlate} เรียบร้อยแล้ว\nระยะเวลา: ${dur}`);
  setTimeout(()=>{if(typeof liff!=='undefined'&&liff.isInClient())liff.closeWindow();else location.reload();},2500);
}
function handleCancelUsage(){if(!confirm('ยืนยันยกเลิกการใช้รถ?'))return;clearUsage();clearInterval(timerInterval);showToast('ยกเลิกการใช้รถแล้ว','info');location.reload();}

/* ─── MODAL ─── */
function showModal(ico,h,msg){
  document.getElementById('modalIcon').textContent=ico;document.getElementById('modalTitle').textContent=h;
  document.getElementById('modalMessage').innerHTML=msg.replace(/\n/g,'<br>');document.getElementById('successModal').classList.add('show');
}
function closeModal(){document.getElementById('successModal').classList.remove('show');}

/* ─── USER UI ─── */
function setUserCard(name,pic,dept){
  const hr=new Date().getHours(),g=hr<12?'อรุณสวัสดิ์':hr<18?'สวัสดีตอนบ่าย':'สวัสดีตอนเย็น';
  document.getElementById('userGreeting').textContent=`${g} คุณ`;
  document.getElementById('userName').textContent=name;
  document.getElementById('userDept').innerHTML=`<i class="fas fa-building" style="font-size:9px"></i> ${escapeHtml(dept||'')}`;
  const av=document.getElementById('userAvatar'),tb=document.getElementById('topbarAvatar');
  if(pic){
    const i=document.createElement('img');i.src=pic;i.alt=name;i.addEventListener('error',()=>av.textContent=name.charAt(0));av.innerHTML='';av.appendChild(i);
    const i2=document.createElement('img');i2.src=pic;i2.alt=name;i2.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:50%';tb.innerHTML='';tb.appendChild(i2);
  }else{av.textContent=name.charAt(0);tb.textContent=name.charAt(0);tb.style.fontWeight='700';}
}

async function loadUserHistory(uid){
  const el=document.getElementById('userHistorySection');if(!el)return;
  try{
    const data=await fetch(`/get-records?userId=${encodeURIComponent(uid)}&limit=5`).then(r=>r.json());
    const recs=data.records||[];
    if(!recs.length){el.innerHTML='<div class="hist-empty"><i class="fas fa-inbox" style="font-size:20px;color:var(--mint-300);display:block;margin-bottom:6px"></i>ยังไม่มีประวัติการใช้รถ</div>';return;}
    el.innerHTML=recs.map(r=>{
      const ok=r.returnStatus==='returned';
      const cs=escapeHtml(r.car||'—'),rs=escapeHtml(r.reason?r.reason.slice(0,30)+(r.reason.length>30?'…':''):'—');
      const d=r.timestamp?new Date(r.timestamp).toLocaleDateString('th-TH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
      return`<div class="hist-row">
        <div class="hist-pip ${ok?'green':'amber'}"></div>
        <div class="hist-body"><div class="hist-car">🚗 ${cs}</div><div class="hist-meta">${rs} · ${d}</div></div>
        <div class="hist-tail"><div class="hist-tag ${ok?'green':'amber'}">${ok?'✅ คืนแล้ว':'🔑 ใช้อยู่'}</div><div class="hist-km">${r.totalDistance?r.totalDistance.toFixed(1)+' กม.':''}</div></div>
      </div>`;
    }).join('');
  }catch{el.innerHTML='<div class="hist-empty">โหลดประวัติไม่ได้</div>';}
}

/* ─── REGISTER ─── */
function showRegisterScreen(u){
  const av=document.getElementById('regAvatar');
  if(u.pictureUrl){const i=document.createElement('img');i.id='regAvatar';i.src=u.pictureUrl;i.alt=u.displayName||'';i.style.cssText='width:84px;height:84px;border-radius:50%;object-fit:cover;border:2.5px solid var(--mint-300);margin:0 auto 12px;display:block;box-shadow:0 0 0 6px rgba(37,201,110,.09)';av.replaceWith(i);}
  else av.textContent=u.displayName?.charAt(0)||'👤';
  document.getElementById('regName').value=u.displayName||'';
  showScreen('screen-register');
}
document.getElementById('regDept').addEventListener('change',function(){document.getElementById('otherDeptGroup').style.display=this.value==='อื่นๆ'?'block':'none';});
document.getElementById('regForm').addEventListener('submit',async function(e){
  e.preventDefault();const btn=document.getElementById('regSubmitBtn');
  const name=document.getElementById('regName').value.trim(),nickname=document.getElementById('regNickname')?.value.trim()||'',phone=document.getElementById('regPhone').value.trim(),dept=document.getElementById('regDept').value,od=document.getElementById('regOtherDept').value.trim();
  let v=true;
  if(!name){showErr('regName','กรุณากรอกชื่อ-นามสกุล');v=false;}
  if(!phone||!/^[0-9]{9,10}$/.test(phone)){showErr('regPhone','กรุณากรอกเบอร์โทร 9-10 หลัก');v=false;}
  if(!dept){showErr('regDept','กรุณาเลือกแผนก');v=false;}
  if(dept==='อื่นๆ'&&!od){showErr('regOtherDept','กรุณาระบุแผนก');v=false;}
  if(!v)return;
  btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> กำลังส่ง...';
  try{
    const res=await fetch('/user-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submit',userId:currentUser.userId,displayName:currentUser.displayName,pictureUrl:currentUser.pictureUrl,formData:{fullName:name,nickname,phone,department:dept==='อื่นๆ'?od:dept}})}).then(r=>r.json());
    if(res.duplicate){showToast('คุณส่งคำขอไปแล้ว','warning');showPendingScreen(currentUser.displayName,true);return;}
    if(res.success){showModal('📨','ส่งคำขอสำเร็จ!',`ขอบคุณคุณ ${name}\nรอแอดมินยืนยันภายใน 24 ชั่วโมง`);setTimeout(()=>{closeModal();showPendingScreen(name,false);},3000);}
  }catch{showToast('เกิดข้อผิดพลาด','error');}
  finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> ส่งคำขอสมัคร';}
});
function showPendingScreen(name,had){
  document.getElementById('pendingTitle').textContent=had?'⏳ รอการอนุมัติ':'📨 ส่งคำขอแล้ว';
  document.getElementById('pendingMsg').innerHTML=had?`สวัสดีคุณ ${name}<br>กำลังรออนุมัติจากแอดมิน`:`ขอบคุณคุณ ${name}<br>คำขอได้รับแล้ว รอแอดมินยืนยัน`;
  showScreen('screen-pending');
}

/* ─── INIT ─── */
async function initApp(){
  try{
    const ms=document.createElement('script');ms.src=`https://maps.googleapis.com/maps/api/js?key=${CONFIG.googleMapsKey}&libraries=places&loading=async&callback=initMap`;ms.async=true;document.head.appendChild(ms);
    const usage=loadUsage();
    await liff.init({liffId:CONFIG.liffId});
    if(!liff.isLoggedIn()){liff.login({redirectUri:location.href});return;}
    const profile=await liff.getProfile();
    const um=await fetch(`/get-user?userId=${encodeURIComponent(profile.userId)}`).then(r=>r.json()).catch(()=>({}));
    const db=um[profile.userId];
    currentUser={userId:profile.userId,displayName:profile.displayName,pictureUrl:profile.pictureUrl,name:db?.name||profile.displayName,phone:db?.phone||'',department:db?.department||'รออนุมัติ',role:db?.role||'pending',status:db?.status||'pending'};
    if(db&&profile.pictureUrl!==db.pictureUrl)fetch('/update-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:profile.userId,pictureUrl:profile.pictureUrl})}).catch(()=>{});
    fetch('/log-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:profile.userId})}).catch(()=>{});
    document.getElementById('appLoading').style.display='none';
    // ✅ เช็ค pending record จาก DB ทุกครั้ง ไม่พึ่งแค่ localStorage
    const pendingRes=await fetch('/get-pending-record?userId='+encodeURIComponent(profile.userId)).then(r=>r.json()).catch(()=>({}));
    if(pendingRes.record){
      const rec=pendingRes.record;
      if(!usage){saveUsage({isUsing:true,carPlate:rec.car,carModel:rec.car.split(':')[0].trim(),startedAt:rec.timestamp,userName:rec.name,userId:profile.userId,mileage:rec.mileage});}
      showCarInUseScreen(loadUsage());
      return;
    }
    if(usage){clearUsage();}
    const role=currentUser.role,status=currentUser.status;
    if(role==='inactive'||status==='inactive'||status==='blocked'||role==='rejected'){
      const sm=document.getElementById('suspendedMsg');sm.textContent='';
      const s1=document.createElement('span');s1.textContent=`คุณ ${profile.displayName}`;sm.appendChild(s1);sm.appendChild(document.createElement('br'));sm.appendChild(document.createTextNode('บัญชีถูกระงับ'));sm.appendChild(document.createElement('br'));sm.appendChild(document.createTextNode('กรุณาติดต่อผู้ดูแลระบบ'));
      showScreen('screen-suspended');
    }else if(role==='pending'){
      const cr=await fetch('/user-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'check',userId:profile.userId})}).then(r=>r.json()).catch(()=>({exists:false}));
      if(cr.exists)showPendingScreen(profile.displayName,true);else showRegisterScreen(currentUser);
    }else{
      setUserCard(currentUser.name,profile.pictureUrl,currentUser.department);
      showScreen('screen-main');loadUserHistory(profile.userId);
      refreshCarStatus(); // โหลดสถานะรถ (ไม่ว่าง/ว่าง)
      // live step update on input
      ['mileage','reason'].forEach(id=>document.getElementById(id).addEventListener('input',updateSteps));
    }
  }catch(err){
    console.error(err);document.getElementById('appLoading').style.display='none';
    showToast('เกิดข้อผิดพลาดในการเริ่มต้น','error');showScreen('screen-main');
  }
}
window.addEventListener('load',initApp);
document.addEventListener('DOMContentLoaded',()=>{
  initSwipeSheet('confirmSubmitModal');
});
