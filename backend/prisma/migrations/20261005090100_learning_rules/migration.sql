-- ═══════════════════════════════════════════════════════════════════════
--  CSMJU E-Learning · migration 2 — กติกาการเรียนที่บังคับที่ชั้นฐานข้อมูล
--
--  API ตรวจกติกาเหล่านี้อยู่แล้ว แต่ข้ามได้ด้วย psql / สคริปต์ import / คำขอที่มาพร้อมกัน
--  กติกาที่ "ผิดแล้วข้อมูลพัง" จึงต้องอยู่ที่ฐานข้อมูลด้วย
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────── 1. กำลังเรียนได้ทีละ 1 สายงาน · จบสายงานเดิมซ้ำไม่ได้ ───────────────

-- กดสมัครสองแท็บพร้อมกัน → แถวที่สองชน index นี้ (API ตอบ 409)
CREATE UNIQUE INDEX "enrollments_one_active_per_user_uniq"
  ON "enrollments" ("core_user_id")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "enrollments_completed_once_uniq"
  ON "enrollments" ("core_user_id", "track_id")
  WHERE "status" = 'COMPLETED';

-- สถานะกับวันที่ต้องสอดคล้องกัน
ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_status_dates_chk"
  CHECK (
    ("status" = 'ACTIVE' AND "completed_at" IS NULL AND "withdrawn_at" IS NULL)
    OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "withdrawn_at" IS NULL)
    OR ("status" = 'WITHDRAWN' AND "withdrawn_at" IS NOT NULL AND "completed_at" IS NULL)
  );

-- core_user_id เป็น text ทึบ ≤ 64 ตัว (ไม่ใช่ UUID) — reference-data.md ข้อ 8
ALTER TABLE "enrollments"
  ADD CONSTRAINT "enrollments_core_user_id_len_chk" CHECK (length("core_user_id") BETWEEN 1 AND 64);
ALTER TABLE "certificates"
  ADD CONSTRAINT "certificates_core_user_id_len_chk" CHECK (length("core_user_id") BETWEEN 1 AND 64);

-- ─────────────── 2. เนื้อหา ───────────────

ALTER TABLE "videos"
  ADD CONSTRAINT "videos_duration_positive_chk" CHECK ("duration_seconds" > 0);

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_quiz_pass_count_positive_chk" CHECK ("quiz_pass_count" >= 1);

-- ─────────────── 3. เวลาเรียน ───────────────

ALTER TABLE "video_progress"
  ADD CONSTRAINT "video_progress_seconds_chk"
  CHECK ("watched_seconds" >= 0 AND "position_seconds" >= 0);

ALTER TABLE "quiz_attempts"
  ADD CONSTRAINT "quiz_attempts_score_chk"
  CHECK ("correct_count" >= 0 AND "correct_count" <= "total_count" AND "pass_count" >= 0);

-- ─────────────── 4. การมอบหมายอาจารย์ — ระบุสายงาน หรือ วิชา อย่างใดอย่างหนึ่ง ───────────────

ALTER TABLE "instructor_assignments"
  ADD CONSTRAINT "instructor_assignments_scope_chk"
  CHECK (("track_id" IS NULL) <> ("course_id" IS NULL));

-- เทมเพลตตั้งต้นมีได้ใบเดียว
CREATE UNIQUE INDEX "certificate_templates_one_default_uniq"
  ON "certificate_templates" ("is_default")
  WHERE "is_default" = true;
