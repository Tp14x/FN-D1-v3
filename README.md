# 🚗 ระบบบันทึกการใช้รถ v2.0
> Cloudflare Pages + D1 + LINE LIFF

---

## 📁 โครงสร้างไฟล์

```
car-system/
├── public/
│   ├── index.html       ← LIFF App หลัก (บันทึกการใช้รถ)
│   ├── history.html     ← หน้าประวัติสาธารณะ
│   └── admin.html       ← หน้าจัดการ Admin
├── functions/
│   ├── _shared.js           ← CORS + utilities
│   ├── get-user.js          ← GET /get-user
│   ├── user-request.js      ← POST /user-request
│   ├── save-record.js       ← POST /save-record
│   ├── update-return-status.js ← POST /update-return-status
│   ├── update-user.js       ← POST/GET /update-user
│   ├── log-login.js         ← POST /log-login
│   ├── get-records.js       ← GET /get-records
│   └── admin-action.js      ← POST /admin-action
├── schema.sql           ← สร้าง D1 tables
├── wrangler.toml        ← Cloudflare config
└── package.json
```

---

## 🚀 ขั้นตอนการ Deploy

### 1. สร้าง D1 Database
```bash
npx wrangler d1 create car-tracker-db
```
คัดลอก `database_id` ที่ได้ไปใส่ใน `wrangler.toml`

### 2. รัน Schema
```bash
npx wrangler d1 execute car-tracker-db --file=./schema.sql
```

### 3. แก้ไข wrangler.toml
```toml
[vars]
ADMIN_USER_ID = "Uxxxxxxxxxxxxxxxxx"   ← LINE User ID ของ Admin
ALLOWED_ORIGIN = "https://your-project.pages.dev"
```

### 4. แก้ไข index.html
```js
const CONFIG = {
  liffId: '2007130450-YVNvyNbL',        ← LIFF ID เดิม (ไม่ต้องเปลี่ยน)
  googleMapsKey: 'YOUR_GOOGLE_MAPS_KEY', ← Google Maps API Key
  originLatLng: { lat: 14.975..., lng: 102.125... }, ← พิกัดบริษัท
}
```

### 5. Deploy ขึ้น Cloudflare Pages
```bash
npx wrangler pages deploy public
```
หรือ push ขึ้น GitHub แล้วเชื่อม Cloudflare Pages

### 6. ตั้งค่า Cloudflare Pages
- ไปที่ Pages → Settings → Environment Variables
- เพิ่ม: `ADMIN_USER_ID`, `ALLOWED_ORIGIN`
- ไปที่ Pages → Settings → Functions → D1 bindings
- เพิ่ม: binding = `DB` → database = `car-tracker-db`

---

## ✅ ฟีเจอร์ทั้งหมด

### หน้า LIFF (index.html)
- [x] สมัครใช้งาน + รอ Admin อนุมัติ
- [x] บันทึกการใช้รถ (รถ, ไมล์, สาเหตุ)
- [x] แผนที่ Google Maps เลือกปลายทาง 3 จุด
- [x] คำนวณระยะทาง + เวลา
- [x] ถ่ายรูปเลขไมล์ (preview ก่อน)
- [x] **shareTargetPicker ที่แก้แล้ว** (ไม่มี await ก่อน)
- [x] หน้าคืนรถ + ดึง GPS
- [x] Timer นับเวลาใช้รถ
- [x] Flex Message แจ้งกลุ่มตอนออกรถ + คืนรถ

### หน้า History (history.html)
- [x] แสดงรายการใช้รถทั้งหมด
- [x] Stats summary
- [x] ค้นหา + กรองตาม รถ / สถานะ / วันที่
- [x] Export CSV
- [x] Responsive (มือถือ + desktop)
- [x] Auto refresh ทุก 2 นาที

### Admin Panel (admin.html)
- [x] Login ด้วย LINE User ID
- [x] แดชบอร์ด stats
- [x] อนุมัติ / ปฏิเสธ คำขอสมัคร
- [x] จัดการผู้ใช้ (แก้ไข, ระงับ, เปิดใช้)
- [x] ดูประวัติการใช้รถ (Admin view)

---

## 🔑 สาเหตุที่ shareTargetPicker ทำงานได้แล้ว

ปัญหาเดิม: มี `await FileReader` (อ่านรูป) **ก่อน** เรียก `shareTargetPicker`
→ LINE ตัด user gesture chain ทำให้เปิดไม่ได้

วิธีแก้ในโค้ดใหม่:
1. รูปภาพถูก **โหลดและแปลงเป็น base64 ตอนเลือกรูป** (event: `change`) ไม่ใช่ตอน submit
2. ตอนกด submit: **validate → สร้าง message → เรียก shareTargetPicker ทันที** (ไม่มี await ใดๆ นำหน้า)
3. หลังจาก share สำเร็จ **ค่อย** fetch บันทึก DB

---

## 📞 URL ที่ใช้งาน

| URL | คำอธิบาย |
|-----|---------|
| `https://your-project.pages.dev/` | LIFF App หลัก |
| `https://your-project.pages.dev/history` | ประวัติสาธารณะ |
| `https://your-project.pages.dev/admin` | Admin Panel |
