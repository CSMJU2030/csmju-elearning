"use client";

import Link from "next/link";
import { useState } from "react";

import ConfirmModal from "@/components/ConfirmModal";
import CourseForm, { EMPTY_COURSE, courseBody, type CourseFormValue } from "@/components/CourseForm";
import { formErrorOf } from "@/components/forms";
import { useSession } from "@/components/session";
import { Alert, EmptyState, ErrorState, PageSkeleton, Toast } from "@/components/states";
import {
  AddIcon,
  ArrowBackIcon,
  DeleteIcon,
  Modal,
  PageHeader,
  StatusBadge,
  cardClass,
  iconDangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
  tdClass,
  thClass,
} from "@/csmju";
import { api } from "@/lib/api";
import { can, themeClass } from "@/lib/tracks";
import { useApi } from "@/lib/use-api";
import type { CourseAdmin, TrackDetail } from "@/lib/types";

interface CourseRow {
  id: string;
  title: string;
  courseCode: string | null;
  curriculumName: string | null;
  sortOrder: number;
  isPublished: boolean;
  topicCount: number;
  questionCount: number;
  quizPassCount: number;
}

export default function TrackCoursesView({ trackId }: { trackId: string }) {
  const { me } = useSession();
  const track = useApi<TrackDetail>(`/tracks/${trackId}`);
  const courses = useApi<CourseRow[]>(`/courses?trackId=${trackId}&includeUnpublished=true&limit=100`);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CourseFormValue>(EMPTY_COURSE);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);
  const [deleting, setDeleting] = useState<CourseRow | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if ((track.loading && !track.data) || (courses.loading && !courses.data)) return <PageSkeleton rows={2} />;
  if (track.error) return <ErrorState error={track.error} onRetry={track.reload} />;
  if (courses.error) return <ErrorState error={courses.error} onRetry={courses.reload} />;
  const t = track.data;
  const rows = courses.data ?? [];
  if (!t) return null;
  const manageAny = can(me, "content:manage:any");

  async function create() {
    if (!form.title.trim()) {
      setFormError({ field: "title", message: "กรุณากรอกชื่อวิชา" });
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.post<CourseAdmin>("/courses", { trackId, ...courseBody(form) });
      setCreating(false);
      setForm(EMPTY_COURSE);
      setToast("เพิ่มวิชาแล้ว");
      courses.reload();
    } catch (e) {
      setFormError(formErrorOf(e));
    } finally {
      setSaving(false);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const a = rows[index];
    const b = rows[index + dir];
    if (!a || !b) return;
    setPageError(null);
    try {
      // สลับลำดับ — ใช้ตำแหน่งในรายการเป็นลำดับใหม่ จึงไม่ชนกันแม้ค่าเดิมซ้ำ
      await api.patch(`/courses/${a.id}`, { sortOrder: index + dir });
      await api.patch(`/courses/${b.id}`, { sortOrder: index });
      courses.reload();
    } catch (e) {
      setPageError(formErrorOf(e).message);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.del(`/courses/${deleting.id}`);
      setToast(`ลบวิชา ${deleting.title} แล้ว`);
      courses.reload();
    } catch (e) {
      setPageError(formErrorOf(e).message);
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  }

  return (
    <div className={`${themeClass(t.color)} space-y-8`}>
      <Link href="/manage/tracks" className="inline-flex items-center gap-2 text-label-md text-primary-container hover:underline">
        <ArrowBackIcon className="h-4 w-4" aria-hidden />
        สายงานทั้งหมด
      </Link>
      <PageHeader title={`วิชาในสายงาน ${t.nameEn}`} description="ผู้เรียนต้องเรียนตามลำดับในตารางนี้ · กดชื่อวิชาเพื่อจัดการหัวข้อ วิดีโอ และแบบทดสอบ" />
      {pageError && <Alert tone="error">{pageError}</Alert>}

      <div className={cardClass}>
        <div className="flex flex-col gap-3 border-b border-outline-variant/40 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <h2 className="font-display text-headline-md text-on-surface">วิชา {rows.length} วิชา</h2>
          <button
            type="button"
            onClick={() => {
              setForm({ ...EMPTY_COURSE, sortOrder: String(rows.length) });
              setFormError(null);
              setCreating(true);
            }}
            className={primaryButtonClass}
          >
            <AddIcon className="h-4 w-4" aria-hidden />
            เพิ่มวิชา
          </button>
        </div>
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="ยังไม่มีวิชาในสายงานนี้" description="เพิ่มวิชาแรก แล้วเพิ่มหัวข้อ วิดีโอการสอน และแบบทดสอบท้ายวิชา" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                  <th className={thClass}>ลำดับ</th>
                  <th className={thClass}>วิชา</th>
                  <th className={`${thClass} text-right`}>หัวข้อ</th>
                  <th className={`${thClass} text-right`}>แบบทดสอบ</th>
                  <th className={thClass}>สถานะ</th>
                  <th className={`${thClass} text-right`}>จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {rows.map((c, i) => (
                  <tr key={c.id} className="border-b border-outline-variant/40 last:border-0 hover:bg-surface/50">
                    <td className={`${tdClass} whitespace-nowrap`}>
                      <span className="mr-2 tabular-nums">{i + 1}</span>
                      {manageAny && (
                        <>
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg px-2 py-1 text-label-md text-on-surface-variant hover:bg-surface-variant/50 disabled:opacity-40" aria-label={`เลื่อน ${c.title} ขึ้น`}>
                            ขึ้น
                          </button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="rounded-lg px-2 py-1 text-label-md text-on-surface-variant hover:bg-surface-variant/50 disabled:opacity-40" aria-label={`เลื่อน ${c.title} ลง`}>
                            ลง
                          </button>
                        </>
                      )}
                    </td>
                    <td className={`${tdClass} font-medium text-on-surface`}>
                      <Link href={`/manage/courses/${c.id}`} className="text-primary-container hover:underline">
                        {c.title}
                      </Link>
                      <span className="block text-label-sm text-on-surface-variant tabular-nums">
                        {c.courseCode ? `${c.courseCode}${c.curriculumName ? ` · ${c.curriculumName}` : ""}` : "ไม่ได้ผูกรหัสวิชาในหลักสูตร"}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{c.topicCount}</td>
                    <td className={`${tdClass} text-right tabular-nums`}>
                      {c.questionCount > 0 ? `${Math.min(c.quizPassCount, c.questionCount)}/${c.questionCount} ข้อ` : "ยังไม่มี"}
                    </td>
                    <td className={tdClass}>
                      {c.isPublished ? <StatusBadge tone="success" label="เผยแพร่" /> : <StatusBadge tone="neutral" label="ซ่อนอยู่" />}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      <Link href={`/manage/courses/${c.id}`} className={`${secondaryButtonClass} mr-2 inline-block`}>
                        จัดการเนื้อหา
                      </Link>
                      <button type="button" onClick={() => setDeleting(c)} className={iconDangerButtonClass} aria-label={`ลบวิชา ${c.title}`}>
                        <DeleteIcon className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && (
        <Modal title="เพิ่มวิชา" onClose={() => setCreating(false)}>
          <div className="max-h-96 overflow-y-auto pr-1">
            <CourseForm value={form} onChange={setForm} onSubmit={create} onCancel={() => setCreating(false)} saving={saving} error={formError} />
          </div>
        </Modal>
      )}
      {deleting && (
        <ConfirmModal title={`ลบวิชา "${deleting.title}"?`} confirmLabel="ลบวิชา" danger busy={saving} onConfirm={remove} onClose={() => setDeleting(null)}>
          <p>หัวข้อ วิดีโอ แบบทดสอบ และความคืบหน้าของผู้เรียนในวิชานี้จะถูกลบถาวร</p>
        </ConfirmModal>
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
