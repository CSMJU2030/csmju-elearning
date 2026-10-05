# csmju-elearning

CSMJU E-Learning — ระบบย่อยของโครงการ CSMJU2030 · เรียนออนไลน์ตามสายงานหลักของสาขาวิชาวิทยาการคอมพิวเตอร์

มาตรฐานกลางอยู่ใน `standards/` (submodule ของ CSMJU2030/csmju2030-standards) · ใช้ standards **v1.7.4** (`.standards-version`)

## ระบบนี้ทำอะไร

- **5 สายงาน** — Programmer (ฟ้า) · Data Scientist (ม่วง) · System Analyst (แดง) · UX/UI Developer (เหลือง) · Cybersecurity Analyst (เขียวน้ำทะเล)
- โครงสร้าง **สายงาน → วิชา → หัวข้อ → วิดีโอการสอน** · ท้ายวิชามีแบบทดสอบ ต้องตอบถูกตามจำนวนที่ผู้ดูแลกำหนด
- สมัครเรียนได้ทีละ 1 สายงาน · หน้าเว็บเปลี่ยนเป็นสีของสายงานที่กำลังเรียน · เรียนข้ามหัวข้อ/วิชาไม่ได้
- ตัวตรวจเวลาเรียน: หน้าเรียนส่ง heartbeat ทุก 10 วินาที server นับเวลาจริงเอง ต้องดูอย่างน้อย 90% ของความยาววิดีโอ
- เรียนจบทุกวิชา → ได้เกียรติบัตร (ดาวน์โหลด PNG / พิมพ์เป็น PDF ที่เมนูความสำเร็จ) และขึ้นในรายชื่อผู้เรียนจบของสายงาน แล้วสมัครสายงานอื่นต่อได้
- ออกจากสายงาน = ความคืบหน้าในสายงานนั้นกลับเป็น 0 · สายงานที่เรียนจบแล้วเก็บไว้ตลอด
- ผู้ดูแล: Dashboard (สายงานยอดนิยม · อัตราเรียนจบ · อัตราออก) · จัดการสายงาน/วิชา/หัวข้อ/วิดีโอ/แบบทดสอบ · เทมเพลตเกียรติบัตร · มอบหมายอาจารย์ประจำสายงาน/วิชา

| core role (Core Hub) | role ในระบบนี้ | ทำอะไรได้ |
|---|---|---|
| student · alumni | LEARNER | เรียน · ทำแบบทดสอบ · เกียรติบัตรของตัวเอง |
| lecturer | INSTRUCTOR | เรียนได้ + แก้เนื้อหาเฉพาะสายงาน/วิชาที่ได้รับมอบหมาย |
| staff | STAFF | จัดการเนื้อหาทั้งหมด · เทมเพลต · Dashboard |
| admin | ADMIN | ทุกอย่าง + มอบหมายอาจารย์ |
| guest | VISITOR | ดูสายงานและวิชาได้อย่างเดียว |

## พอร์ตและ Core Hub

| ส่วน | URL |
|---|---|
| หน้าเว็บ (ประตูเดียวของระบบ) | http://localhost:3212 |
| Callback ที่ลงทะเบียนใน Core Hub | **http://localhost:3212/auth/callback** |
| backend (NestJS) | http://127.0.0.1:4212 (หน้าเว็บ proxy `/api/*` และ `/auth/*` มาที่นี่) |
| Core Hub | https://csmju2030.jowave.com |

`CORE_HUB_WEB_URL` (ใน `backend/.env` และ `frontend/.env`) = เว็บของ Core Hub — backend ใช้ส่งเบราว์เซอร์ไป `/sso/authorize` และ `/logout`
ส่วนหน้าเว็บใช้แสดงปุ่ม "กลับ CSMJU Portal" ใน `CsmjuAppShell` · ไม่ตั้ง = ไม่มีปุ่ม

## เริ่มทำงาน

```bash
git submodule update --init standards/
cp backend/.env.example backend/.env        # ใส่รหัสผ่าน PostgreSQL จริงใน DATABASE_URL (ห้าม commit)
cp frontend/.env.example frontend/.env
pnpm install                                  # pnpm 12.3.4 (packageManager ในรากของ repo)
pnpm --filter backend db:deploy               # สร้างตาราง
pnpm --filter backend db:seed                 # 5 สายงาน + วิชาจากหมวดวิชาเฉพาะ + แบบทดสอบ (เครื่องพัฒนาเท่านั้น)
pnpm --filter backend start:dev               # :4212
pnpm --filter frontend dev                    # :3212 → เปิด http://localhost:3212 (localhost ไม่ใช่ 127.0.0.1)
```

ยังไม่มี PostgreSQL ในเครื่อง: `POSTGRES_PASSWORD=<รหัส> docker compose up -d db` (พอร์ต 5434)

วิดีโอใน seed เป็นวิดีโอตัวอย่าง (CC0) ยาว 5 วินาที — เปลี่ยนเป็นวิดีโอสอนจริงที่ "จัดการหลักสูตร"

## ทดสอบ

```bash
pnpm -r lint && pnpm -r typecheck && pnpm -r test && pnpm -r build
bash standards/scripts/run-all-checks.sh .                       # ชุดเดียวกับ CI
TEST_DATABASE_URL=postgresql://... pnpm --filter backend test    # + เส้นทางการเรียนจริงบน PostgreSQL
CONFORMANCE_ACCOUNTS_FILE=~/.csmju/conformance-accounts.json node standards/conformance/run.js
```

API ทั้งหมด: `backend/openapi.json` (สร้างใหม่ด้วย `pnpm --filter backend generate:openapi`) · หน้า Swagger ตอน dev: http://127.0.0.1:4212/docs

ก่อนเปิด PR อ่าน `standards/docs/github-workflow.md` ข้อ 1 และ `REPORT.md`
