# REPORT — csmju-elearning

branch `feature/elearning/core-hub` · standards **1.7.4** · ตรวจเมื่อ 5 ต.ค. 2569 · งานตาม `create.md` (ไฟล์ของ AIE ไม่ได้ commit)

## ผลรัน

```
./standards/scripts/run-all-checks.sh .     (clean clone + pnpm install · lint/typecheck/test/build รันจริง)
  ✅ PASS  Convention Check            check-branch-name.sh / check-commit-messages.sh / check-ci-untouched.sh
  ✅ PASS  Standards Version Check     check-submodule-pointer.sh
  ✅ PASS  Security & Stack Scan       (6 สคริปต์)
  ✅ PASS  API Contract Sync           check-openapi-sync.sh   (API-01 รันจริง — backend/openapi.json ตรงกับโค้ด)
  ✅ PASS  API Contract Sync           check-api-conventions.sh
  ✅ PASS  Data Dictionary Compliance  (4 สคริปต์)
  ✅ PASS  UI Token Compliance         check-ui-tokens.sh
  ✅ PASS  Code Quality                check-qa.sh
  ✅ PASS  Exception Validation        check-exceptions.sh
✅ All 19 checks passed.
```

```
node standards/conformance/run.js --level L2
  (backend จริง + PostgreSQL จริง ผ่าน proxy ของ frontend :3212 · Core Hub จำลองในเครื่องที่ออก token RS256 + JWKS ตามสัญญา
   เพราะยังไม่มีบัญชีทดสอบของทีมและยังไม่ได้ลงทะเบียนระบบ)
RESULT: 48 passed · 0 failed · 0 skipped · 0 warnings · retries: 0
✅ CONFORMANT — csmju-elearning meets standard v1.2 L2
```

- `pnpm --filter backend test` → 45 tests ผ่าน (มี `TEST_DATABASE_URL`) · ไม่มีฐานข้อมูล (CI) → 41 ผ่าน + 4 ข้าม
- `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → **No difference detected**
- เปิดหน้าเว็บจริงด้วย Chromium: สมัครเรียน → ธีมเปลี่ยนสี → เรียนวิดีโอ → สอบไม่ผ่าน/ผ่าน → จบสายงาน → เกียรติบัตร ·
  ทุกหน้าที่ 360px ไม่มี scroll แนวนอน
- **L3 ยังไม่ได้รัน** — ต้องลงทะเบียนระบบใน Core Hub ก่อน (ดูหัวข้อสุดท้าย)

## ไฟล์ที่สร้าง/แก้ไข

commit แยก 3 ชุด

1. `chore(elearning): bump standards to v1.7.4` — `.standards-version` + submodule `standards` (standards-versioning ข้อ 2.2)
2. `feat(elearning): integrate elearning module with PM repository structure` — `backend/` `frontend/` (โมดูล e-learning ทั้งหมด)
3. `feat(elearning): integrate elearning module with core hub` — ไฟล์ราก: ค่า Core Hub · พอร์ต · probes · pnpm · เอกสาร

| path | ทำอะไร |
|---|---|
| `backend/prisma/` | schema 11 ตาราง (tracks · courses · topics · videos · quiz_questions · quiz_choices · enrollments · video_progress · quiz_attempts · certificates · certificate_templates · instructor_assignments) · migration 2 ชุด (`init` + `learning_rules`: partial unique "กำลังเรียนได้ทีละ 1 สายงาน" · CHECK สถานะ/วันที่/คะแนน) · seed 5 สายงาน 29 วิชา |
| `backend/src/auth/` `common/` `core-hub/` `config/` `health/` | ชั้น auth/envelope/ตัวเรียก Core Hub ชุดเดียวกับ `csmju-cloudflow` (เขียนตาม auth-contract 1.2 · ตรวจ token 10 ขั้น) · แก้เฉพาะชื่อระบบ พอร์ต role mapping permission และ allowlist ของ Core Hub (`/people` · `/people/:code`) |
| `backend/src/learning-rules/progress.ts` | กติกาเรียนตามลำดับ + ตัวนับเวลาเรียน (ฟังก์ชันล้วน ทดสอบตรง) |
| `backend/src/{tracks,content,learning,certificates,dashboard,assignments,access}` | API ใต้ `/api/v1` — สายงาน · วิชา/หัวข้อ/วิดีโอ/คำถาม · สมัคร/ออก/heartbeat/แบบทดสอบ/โปรไฟล์ · เกียรติบัตร+เทมเพลต · สถิติ · มอบหมายอาจารย์ |
| `backend/openapi.json` · `scripts/generate-openapi.ts` | สัญญา API (CI กฎ API-01) |
| `backend/test/` | ตัวตรวจ token · SSO/401/403 · กติกาการเรียน · เส้นทางการเรียนจริงบน PostgreSQL |
| `frontend/` | จาก `standards/templates/csmju-subsystem-web` (ไม่แก้ `src/csmju/` และ `globals.css`) · พอร์ต 3212 · 14 หน้า · ทุก segment มี `loading.tsx`/`error.tsx` |
| `frontend/src/styles/track-themes.css` | ธีมสีสายงาน: ชี้ token กลาง (`--color-primary-container` · `--color-accent` · `--color-primary`) ไปที่ palette มาตรฐานของ Tailwind ภายในกล่อง — ไม่มี hex ดิบ |
| `subsystem.yaml` · `.env.example` · `package.json` · `pnpm-workspace.yaml` · `pnpm-lock.yaml` · `README.md` · `docker-compose.yml` | **ไฟล์ PM** — base_url :3212 · `core_hub_web_url` · `public_endpoints` ของ `/auth/*` · probes `/api/v1/tracks` · pnpm 12.3.4 + `allowBuilds` · Postgres สำหรับเครื่องพัฒนา (**DevOps/PM ต้อง approve เพราะแตะ `subsystem.yaml`**) |

## ชั้น auth ที่คัดลอกมา

- คัดลอกจาก demo-student-subsystem: **ไม่ได้คัดลอก** — repo demo เป็น private (เข้าไม่ได้จาก cloud และ GitHub ไม่ให้สิทธิ์)
- ใช้ชั้น auth ของ `csmju-cloudflow` branch `feature/cloudflow/core-hub` (ทีมเดียวกัน เขียนตาม auth-contract 1.2 และผ่าน conformance L1–L2 กับ Core Hub จริงแล้ว)
- แก้ไข: ชื่อคุกกี้/ชื่อระบบในหน้า "เข้าสู่ระบบอีกครั้ง" · `role-mapping.ts` (ค่า) · `permissions.ts` (โดเมนนี้) · allowlist ใน `core-hub.client.ts`
- **ควรขอสิทธิ์อ่าน demo แล้วเทียบ `backend/src/auth/` `backend/src/common/`** ตาม AGENTS.md ข้อ 2

## Role mapping ที่ประกาศ (ต้องตรงกับ default_role_mapping ในทะเบียน)

| core role | subsystem role |
|---|---|
| student | LEARNER |
| alumni | LEARNER |
| lecturer | INSTRUCTOR |
| staff | STAFF |
| admin | ADMIN |
| guest | VISITOR |

## ข้อสมมติที่ตั้งเอง (เพราะมาตรฐานหรือ create.md ไม่ได้ระบุ)

1. **5 สายงาน** (create.md เขียน 4 เมนูแต่รายการมี 5) · Cybersecurity ใช้สี **เขียวน้ำทะเล** เพื่อไม่ซ้ำกับ UX/UI (สีเหลือง) — AIE ยืนยันแล้ว
2. **เกียรติบัตรออกครั้งเดียวเมื่อจบสายงาน** (ผ่านทุกวิชาและทุกแบบทดสอบ) — AIE ยืนยันแล้ว
3. **ออกจากสายงาน = ล้างทุกอย่างของสายงานนั้น** · สายงานที่เรียนจบแล้วออกไม่ได้ เก็บไว้ตลอด — AIE ยืนยันแล้ว
4. "ชื่อคนที่เรียนจบ" บนการ์ดสายงานแสดง **รหัสนักศึกษา/บุคลากร** (`person_code`) — มาตรฐานห้ามเก็บชื่อและห้ามเรียก Core Hub ทีละแถว
   (reference-data ข้อ 7.2, 8) · ชื่อจริงแสดงในเกียรติบัตรของเจ้าของ (ดึงจาก `/people/me` ตอนเปิดดู ไม่เก็บ)
5. วิชาของสายงานเลือกจากหมวดวิชาเฉพาะ (กลุ่มวิชาแกน · เฉพาะด้าน · วิชาชีพ) ของหลักสูตร 2570 ใน csmju.com · เก็บแค่ `course_code`
   ชื่อในหลักสูตรดึงจาก Core Hub `/courses` (cache 10 นาที) · `title` เป็นชื่อบทเรียนออนไลน์ของระบบนี้เอง
6. วิดีโอเก็บเป็นลิงก์ (YouTube หรือไฟล์ https) — Core Hub รับอัปโหลดแค่รูป · ความยาววิดีโอผู้ดูแลกรอกเอง
7. ตัวตรวจเวลาเรียน: server นับจาก `last_heartbeat_at` เอง ≤ 15 วินาทีต่อ heartbeat · ห่างเกิน 45 วินาทีเริ่มนับใหม่ · ต้องดู ≥ 90% ·
   ไฟล์วิดีโอนับเฉพาะตอนเล่น + กรอข้ามไม่ได้ + ซ่อนแท็บแล้วหยุด · YouTube นับตอนหน้าแสดงอยู่ (เบราว์เซอร์รู้สถานะการเล่นของ iframe ไม่ได้โดยไม่โหลด script ภายนอก)
8. staff = ผู้จัดการเนื้อหา (conformance ต้องให้ `allowed_role: staff` สร้างข้อมูลได้) · การมอบหมายอาจารย์เป็นของ admin เท่านั้น
9. เกียรติบัตรวาดด้วย SVG ดาวน์โหลดเป็น PNG หรือพิมพ์เป็น PDF — ไม่มีไลบรารี PDF ใน whitelist
10. โปรไฟล์มุมบนขวาเป็นแถบในพื้นที่เนื้อหา — ปุ่มผู้ใช้ใน `CsmjuAppShell` ของ template ยังไม่มีเมนูให้ต่อ (ห้ามแก้ `src/csmju/`)
11. type ของ API ฝั่งหน้าเว็บเขียนใน `frontend/src/lib/types.ts` — `openapi.json` ยังไม่มี schema ของ response (ไม่มี response DTO) จึง generate ไม่ได้

## สิ่งที่ยังทำไม่ได้ / เคสที่ยังไม่ผ่าน

- **L3-01..** — PL ลงทะเบียน `csmju-elearning` ใน Core Hub (บัญชี `.admin` ของทีม) · Callback `http://localhost:3212/auth/callback` ·
  role mapping ตามตารางด้านบน → รอ admin อนุมัติ + เปิดใช้งาน → รัน conformance ครบ L3 ด้วยไฟล์บัญชีนอก repo
- ยังไม่ได้ทดสอบ login ผ่าน SSO จริง (ต้องลงทะเบียนก่อน) · ทดสอบ SSO ด้วย e2e test (`backend/test/app.e2e.spec.ts`) และ Core Hub จำลองแล้ว
- template `CsmjuAppShell`: `<main>` ไม่มี `min-w-0` ทำให้ตารางกว้างดันหน้าจอที่ 360px — แก้ฝั่งระบบนี้ด้วย `contain-inline-size` ใน `layout.tsx` · ควรแจ้งแก้ที่ส่วนกลาง (ui-design-system ข้อ 17.4) พร้อมเมนูของปุ่มผู้ใช้
- ยังไม่มี `Dockerfile` ของ backend/frontend (มีแค่ `docker-compose.yml` สำหรับ PostgreSQL ในเครื่อง)
