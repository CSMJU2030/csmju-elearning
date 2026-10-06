"use client";

import { useEffect, useState } from "react";

import Field, { describedBy } from "@/components/Field";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import { apiRequest } from "@/lib/api";
import type { CurriculumCourse } from "@/lib/types";

export interface CourseFormValue {
  title: string;
  courseCode: string;
  description: string;
  quizPassCount: string;
  sortOrder: string;
  isPublished: boolean;
}

export const EMPTY_COURSE: CourseFormValue = {
  title: "",
  courseCode: "",
  description: "",
  quizPassCount: "1",
  sortOrder: "",
  isPublished: true,
};

/** ฟอร์มวิชา — รหัสวิชาค้นจากรายวิชาของหลักสูตรใน Core Hub (ไม่พิมพ์รายชื่อเอง) */
export default function CourseForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  saving,
  error,
  questionCount,
}: {
  value: CourseFormValue;
  onChange: (v: CourseFormValue) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  error: { field?: string; message: string } | null;
  questionCount?: number;
}) {
  const [options, setOptions] = useState<CurriculumCourse[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const q = value.courseCode.trim();

  useEffect(() => {
    if (q.length < 2) return;
    const t = setTimeout(() => {
      apiRequest<CurriculumCourse[]>(`/curriculum-courses?limit=20&q=${encodeURIComponent(q)}`)
        .then((r) => {
          setOptions(r.data);
          setLookupError(null);
        })
        .catch(() => setLookupError("ค้นรายวิชาจาก CSMJU Portal ไม่ได้ในตอนนี้ — พิมพ์รหัสวิชาเต็มได้"));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const err = (field: string) => (error?.field === field ? error.message : null);
  const set = <K extends keyof CourseFormValue>(k: K, v: CourseFormValue[K]) => onChange({ ...value, [k]: v });
  const passOverflow = questionCount !== undefined && Number(value.quizPassCount) > questionCount && questionCount > 0;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      <p className="text-label-sm text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>
      <Field id="course-title" label="ชื่อวิชา (บทเรียนออนไลน์)" required error={err("title")}>
        <input id="course-title" className={`${inputClass} ${err("title") ? "input-error" : ""}`} value={value.title} onChange={(e) => set("title", e.target.value)} aria-required aria-describedby={describedBy("course-title", err("title"))} />
      </Field>
      <Field
        id="course-courseCode"
        label="รหัสวิชาในหลักสูตร"
        hint={lookupError ?? "พิมพ์รหัสหรือชื่อวิชาเพื่อค้นจากหลักสูตร เช่น 10301111-68 · เว้นว่างถ้าไม่ใช่วิชาในหลักสูตร"}
        error={err("courseCode")}
      >
        <input
          id="course-courseCode"
          list="curriculum-course-options"
          className={`${inputClass} ${err("courseCode") ? "input-error" : ""}`}
          value={value.courseCode}
          onChange={(e) => set("courseCode", e.target.value.toUpperCase().replace(/\s+/g, ""))}
          aria-describedby={describedBy("course-courseCode", err("courseCode"), "hint")}
        />
        <datalist id="curriculum-course-options">
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.nameTh}
            </option>
          ))}
        </datalist>
      </Field>
      <Field id="course-description" label="คำอธิบายวิชา" error={err("description")}>
        <textarea id="course-description" rows={3} className={inputClass} value={value.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <Field
        id="course-quizPassCount"
        label="จำนวนข้อที่ต้องตอบถูกจึงจะผ่าน"
        required
        hint={questionCount !== undefined ? `แบบทดสอบมีทั้งหมด ${questionCount} ข้อ` : "ตั้งได้หลังเพิ่มคำถาม"}
        error={err("quizPassCount") ?? (passOverflow ? "มากกว่าจำนวนคำถามที่มี ระบบจะใช้จำนวนคำถามทั้งหมดแทน" : null)}
      >
        <input id="course-quizPassCount" type="number" min={1} className={inputClass} value={value.quizPassCount} onChange={(e) => set("quizPassCount", e.target.value)} aria-describedby={describedBy("course-quizPassCount", err("quizPassCount"), "hint")} />
      </Field>
      <Field id="course-sortOrder" label="ลำดับในสายงาน" hint="เรียนตามลำดับนี้ เลขน้อยเรียนก่อน" error={err("sortOrder")}>
        <input id="course-sortOrder" type="number" min={0} className={inputClass} value={value.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} aria-describedby={describedBy("course-sortOrder", err("sortOrder"), "hint")} />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-body-md text-on-surface">
        <input type="checkbox" className="custom-checkbox" checked={value.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
        เผยแพร่ให้ผู้เรียนเห็น
      </label>
      {error && !error.field && <p className="text-label-sm text-error">{error.message}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          ยกเลิก
        </button>
        <button type="submit" disabled={saving} aria-busy={saving} className={`${primaryButtonClass} relative ${saving ? "btn-loading" : ""}`}>
          <span className="btn-text">บันทึก</span>
          <span className="dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>
    </form>
  );
}

export function courseBody(v: CourseFormValue) {
  return {
    title: v.title.trim(),
    courseCode: v.courseCode.trim() || null,
    description: v.description.trim(),
    quizPassCount: Math.max(1, Number(v.quizPassCount) || 1),
    sortOrder: v.sortOrder === "" ? undefined : Number(v.sortOrder),
    isPublished: v.isPublished,
  };
}
