"use client";

import { useEffect, useState } from "react";

import ConfirmModal from "@/components/ConfirmModal";
import Field from "@/components/Field";
import { formErrorOf } from "@/components/forms";
import { Alert, EmptyState, ErrorState, PageSkeleton, Toast } from "@/components/states";
import {
  DeleteIcon,
  PageHeader,
  SearchIcon,
  cardClass,
  iconDangerButtonClass,
  inputClass,
  primaryButtonClass,
  tdClass,
  thClass,
} from "@/csmju";
import { apiRequest, api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { themeClass } from "@/lib/tracks";
import { useApi } from "@/lib/use-api";
import type { Assignment, StaffPerson, TrackDetail, TrackListItem } from "@/lib/types";

/**
 * มอบหมายอาจารย์ประจำสายงานหรือผู้รับผิดชอบวิชา — อาจารย์แก้ไขได้เฉพาะเนื้อหาที่ได้รับมอบหมาย
 * ค้นบุคลากรจาก CSMJU Portal (Core Hub) · ระบบนี้เก็บแค่รหัสบุคลากร ไม่เก็บชื่อ
 */
export default function PeopleView() {
  const assignments = useApi<Assignment[]>("/instructor-assignments?limit=100");
  const tracks = useApi<TrackListItem[]>("/tracks?limit=100&includeUnpublished=true");
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<StaffPerson[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StaffPerson | null>(null);
  const [trackId, setTrackId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState<TrackDetail["courses"]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Assignment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => {
      apiRequest<StaffPerson[]>(`/staff-people?limit=10&q=${encodeURIComponent(term)}`)
        .then((r) => {
          setPeople(r.data);
          setSearchError(null);
        })
        .catch((e) => setSearchError(formErrorOf(e).message));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!trackId) return;
    apiRequest<TrackDetail>(`/tracks/${trackId}`)
      .then((r) => setCourses(r.data.courses))
      .catch(() => setCourses([]));
  }, [trackId]);

  if ((assignments.loading && !assignments.data) || (tracks.loading && !tracks.data)) return <PageSkeleton rows={2} />;
  if (assignments.error) return <ErrorState error={assignments.error} onRetry={assignments.reload} />;
  if (tracks.error) return <ErrorState error={tracks.error} onRetry={tracks.reload} />;
  const rows = assignments.data ?? [];

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setFormError("กรุณาเลือกบุคลากรจากผลการค้นหา");
      return;
    }
    if (!trackId) {
      setFormError("กรุณาเลือกสายงาน");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/instructor-assignments", { personCode: selected.personCode, ...(courseId ? { courseId } : { trackId }) });
      setToast(`มอบหมาย ${selected.fullNameTh} แล้ว`);
      setSelected(null);
      setQ("");
      setPeople([]);
      setCourseId("");
      assignments.reload();
    } catch (err) {
      setFormError(formErrorOf(err).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.del(`/instructor-assignments/${deleting.id}`);
      setToast("ยกเลิกการมอบหมายแล้ว");
      assignments.reload();
    } catch (err) {
      setFormError(formErrorOf(err).message);
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  }

  return (
    <>
      <PageHeader title="ผู้ใช้และสิทธิ์" description="กำหนดอาจารย์ประจำสายงาน หรือผู้รับผิดชอบวิชา ให้แก้ไขและเพิ่มเนื้อหาในส่วนที่ตัวเองดูแลได้" />

      <form onSubmit={assign} noValidate className={`${cardClass} space-y-4 p-6`}>
        <h2 className="font-display text-headline-md text-on-surface">มอบหมายอาจารย์</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field id="person-search" label="ค้นหาบุคลากร" required hint={searchError ?? "พิมพ์ชื่อหรือรหัสบุคลากรอย่างน้อย 2 ตัวอักษร"}>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-outline" />
              <input
                id="person-search"
                type="search"
                className={`${inputClass} pl-10`}
                value={selected ? `${selected.academicTitle ?? ""}${selected.fullNameTh} (${selected.personCode})` : q}
                onChange={(e) => {
                  setSelected(null);
                  setQ(e.target.value);
                }}
                aria-describedby="person-search-hint"
              />
            </div>
            {!selected && people.length > 0 && q.trim().length >= 2 && (
              <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-outline-variant/40 bg-surface-container-lowest" role="listbox" aria-label="ผลการค้นหาบุคลากร">
                {people.map((p) => (
                  <li key={p.personCode}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => setSelected(p)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-body-md hover:bg-surface-variant/50"
                    >
                      <span>
                        {p.academicTitle ?? ""}
                        {p.fullNameTh}
                      </span>
                      <span className="text-label-sm text-on-surface-variant">{p.personCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
          <Field id="assign-track" label="สายงาน" required>
            <select
              id="assign-track"
              className={inputClass}
              value={trackId}
              onChange={(e) => {
                setTrackId(e.target.value);
                setCourseId("");
              }}
            >
              <option value="">เลือกสายงาน</option>
              {(tracks.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nameEn}
                </option>
              ))}
            </select>
          </Field>
          <Field id="assign-course" label="วิชาที่รับผิดชอบ" hint="ไม่เลือก = อาจารย์ประจำสายงาน (ดูแลทุกวิชา)">
            <select id="assign-course" className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!trackId} aria-describedby="assign-course-hint">
              <option value="">ทุกวิชาในสายงาน</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} aria-busy={saving} className={`${primaryButtonClass} relative ${saving ? "btn-loading" : ""}`}>
            <span className="btn-text">มอบหมาย</span>
            <span className="dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </form>

      <div className={cardClass}>
        <div className="border-b border-outline-variant/40 px-6 py-5">
          <h2 className="font-display text-headline-md text-on-surface">อาจารย์ที่ได้รับมอบหมาย</h2>
        </div>
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="ยังไม่มีการมอบหมาย" description="ค้นหาบุคลากรด้านบน แล้วเลือกสายงานหรือวิชาที่ให้ดูแล" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                  <th className={thClass}>รหัสบุคลากร</th>
                  <th className={thClass}>สายงาน</th>
                  <th className={thClass}>ขอบเขต</th>
                  <th className={thClass}>มอบหมายเมื่อ</th>
                  <th className={`${thClass} text-right`}>จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-outline-variant/40 last:border-0 hover:bg-surface/50">
                    <td className={`${tdClass} font-medium text-on-surface`}>
                      {a.personCode}
                      {!a.coreUserId && <span className="block text-label-sm text-on-surface-variant">ยังไม่มีบัญชีใน CSMJU Portal</span>}
                    </td>
                    <td className={tdClass}>
                      {a.track && (
                        <span className={`${themeClass(a.track.color)} inline-flex items-center gap-2`}>
                          <span className="h-3 w-3 rounded-full bg-primary-container" aria-hidden />
                          {a.track.nameTh}
                        </span>
                      )}
                    </td>
                    <td className={tdClass}>{a.scope === "TRACK" ? "ทุกวิชาในสายงาน" : `วิชา ${a.course?.title ?? ""}`}</td>
                    <td className={`${tdClass} text-on-surface-variant`}>{formatDate(a.createdAt)}</td>
                    <td className={`${tdClass} text-right`}>
                      <button type="button" className={iconDangerButtonClass} aria-label={`ยกเลิกการมอบหมาย ${a.personCode}`} onClick={() => setDeleting(a)}>
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

      {deleting && (
        <ConfirmModal title={`ยกเลิกการมอบหมาย ${deleting.personCode}?`} confirmLabel="ยกเลิกการมอบหมาย" danger busy={saving} onConfirm={remove} onClose={() => setDeleting(null)}>
          <p>บุคลากรนี้จะแก้ไขเนื้อหาของ{deleting.scope === "TRACK" ? "สายงาน" : "วิชา"}นี้ไม่ได้อีก</p>
        </ConfirmModal>
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
