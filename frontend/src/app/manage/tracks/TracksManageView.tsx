"use client";

import Link from "next/link";
import { useState } from "react";

import ConfirmModal from "@/components/ConfirmModal";
import Field, { describedBy } from "@/components/Field";
import { formErrorOf } from "@/components/forms";
import { useSession } from "@/components/session";
import { Alert, EmptyState, ErrorState, PageSkeleton, Toast } from "@/components/states";
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  Modal,
  PageHeader,
  StatusBadge,
  cardClass,
  iconButtonClass,
  iconDangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  tdClass,
  thClass,
} from "@/csmju";
import { api } from "@/lib/api";
import { TRACK_COLORS, TRACK_COLOR_LABEL, can, themeClass } from "@/lib/tracks";
import { useApi } from "@/lib/use-api";
import type { CertificateTemplate, Track, TrackColor, TrackListItem } from "@/lib/types";

interface TrackForm {
  nameTh: string;
  nameEn: string;
  slug: string;
  summary: string;
  description: string;
  color: TrackColor;
  sortOrder: string;
  isPublished: boolean;
  certificateTemplateId: string;
}

const EMPTY: TrackForm = {
  nameTh: "",
  nameEn: "",
  slug: "",
  summary: "",
  description: "",
  color: "BLUE",
  sortOrder: "",
  isPublished: true,
  certificateTemplateId: "",
};

export default function TracksManageView() {
  const { me } = useSession();
  const tracks = useApi<TrackListItem[]>("/tracks?limit=100&includeUnpublished=true");
  const canEditTracks = can(me, "track:update");
  const templates = useApi<CertificateTemplate[]>(can(me, "certificate-template:manage") ? "/certificate-templates?limit=100" : null);
  const [editing, setEditing] = useState<{ id: string | null; form: TrackForm } | null>(null);
  const [deleting, setDeleting] = useState<TrackListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (tracks.loading && !tracks.data) return <PageSkeleton rows={3} />;
  if (tracks.error) return <ErrorState error={tracks.error} onRetry={tracks.reload} />;
  const rows = tracks.data ?? [];

  const open = (t?: TrackListItem) => {
    setFormError(null);
    setEditing({
      id: t?.id ?? null,
      form: t
        ? {
            nameTh: t.nameTh,
            nameEn: t.nameEn,
            slug: t.slug,
            summary: t.summary,
            description: t.description,
            color: t.color,
            sortOrder: String(t.sortOrder),
            isPublished: t.isPublished,
            certificateTemplateId: t.certificateTemplateId ?? "",
          }
        : EMPTY,
    });
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const f = editing.form;
    if (!f.nameTh.trim()) {
      setFormError({ field: "nameTh", message: "กรุณากรอกชื่อสายงาน" });
      document.getElementById("track-nameTh")?.focus();
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = {
      nameTh: f.nameTh.trim(),
      nameEn: f.nameEn.trim() || undefined,
      slug: f.slug.trim() || undefined,
      summary: f.summary.trim(),
      description: f.description.trim(),
      color: f.color,
      sortOrder: f.sortOrder === "" ? undefined : Number(f.sortOrder),
      isPublished: f.isPublished,
      certificateTemplateId: f.certificateTemplateId || (editing.id ? null : undefined),
    };
    try {
      if (editing.id) await api.patch<Track>(`/tracks/${editing.id}`, body);
      else await api.post<Track>("/tracks", body);
      setEditing(null);
      setToast("บันทึกสายงานแล้ว");
      tracks.reload();
    } catch (err) {
      const fe = formErrorOf(err);
      setFormError(fe);
      if (fe.field) document.getElementById(`track-${fe.field}`)?.focus();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.del(`/tracks/${deleting.id}`);
      setToast(`ลบสายงาน ${deleting.nameTh} แล้ว`);
      tracks.reload();
    } catch (err) {
      setPageError(formErrorOf(err).message);
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  }

  const set = <K extends keyof TrackForm>(key: K, value: TrackForm[K]) =>
    setEditing((cur) => (cur ? { ...cur, form: { ...cur.form, [key]: value } } : cur));
  const err = (field: string) => (formError?.field === field ? formError.message : null);

  return (
    <>
      <PageHeader title="จัดการหลักสูตร" description="สายงาน → วิชา → หัวข้อ → วิดีโอการสอน และแบบทดสอบท้ายวิชา" />
      {pageError && <Alert tone="error">{pageError}</Alert>}

      <div className={cardClass}>
        <div className="flex flex-col gap-3 border-b border-outline-variant/40 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <h2 className="font-display text-headline-md text-on-surface">สายงานทั้งหมด</h2>
          {can(me, "track:create") && (
            <button type="button" onClick={() => open()} className={primaryButtonClass}>
              <AddIcon className="h-4 w-4" aria-hidden />
              เพิ่มสายงาน
            </button>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="ยังไม่มีสายงาน" description="เริ่มต้นด้วยการเพิ่มสายงานแรกของสาขา" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                  <th className={thClass}>ลำดับ</th>
                  <th className={thClass}>สายงาน</th>
                  <th className={thClass}>สี</th>
                  <th className={`${thClass} text-right`}>วิชา</th>
                  <th className={thClass}>สถานะ</th>
                  <th className={`${thClass} text-right`}>จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-body-md">
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-outline-variant/40 last:border-0 hover:bg-surface/50">
                    <td className={`${tdClass} tabular-nums`}>{t.sortOrder + 1}</td>
                    <td className={`${tdClass} font-medium text-on-surface`}>
                      <span className="block" lang="en">
                        {t.nameEn}
                      </span>
                      <span className="block text-label-sm text-on-surface-variant">{t.nameTh}</span>
                    </td>
                    <td className={tdClass}>
                      <span className={`${themeClass(t.color)} inline-flex items-center gap-2`}>
                        <span className="h-3 w-3 rounded-full bg-primary-container" aria-hidden />
                        {TRACK_COLOR_LABEL[t.color]}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{t.courseCount}</td>
                    <td className={tdClass}>
                      {t.isPublished ? <StatusBadge tone="success" label="เผยแพร่" /> : <StatusBadge tone="neutral" label="ซ่อนอยู่" />}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-right`}>
                      <Link href={`/manage/tracks/${t.id}`} className={`${secondaryButtonClass} mr-2 inline-block`}>
                        จัดการวิชา
                      </Link>
                      {canEditTracks && (
                        <button type="button" onClick={() => open(t)} className={iconButtonClass} aria-label={`แก้ไขสายงาน ${t.nameTh}`}>
                          <EditIcon className="h-5 w-5" />
                        </button>
                      )}
                      {can(me, "track:delete") && (
                        <button type="button" onClick={() => setDeleting(t)} className={iconDangerButtonClass} aria-label={`ลบสายงาน ${t.nameTh}`}>
                          <DeleteIcon className="h-5 w-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? "แก้ไขสายงาน" : "เพิ่มสายงาน"} onClose={() => setEditing(null)}>
          <form onSubmit={save} noValidate className="max-h-96 space-y-4 overflow-y-auto pr-1">
            <p className="text-label-sm text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>
            <Field id="track-nameTh" label="ชื่อสายงาน (ไทย)" required error={err("nameTh")}>
              <input id="track-nameTh" className={`${inputClass} ${err("nameTh") ? "input-error" : ""}`} value={editing.form.nameTh} onChange={(e) => set("nameTh", e.target.value)} aria-required aria-describedby={describedBy("track-nameTh", err("nameTh"))} />
            </Field>
            <Field id="track-nameEn" label="ชื่อสายงาน (อังกฤษ)" error={err("nameEn")}>
              <input id="track-nameEn" className={inputClass} value={editing.form.nameEn} onChange={(e) => set("nameEn", e.target.value)} lang="en" />
            </Field>
            <Field id="track-slug" label="ตัวระบุใน URL" hint="a-z 0-9 และ - · เว้นว่างให้ระบบสร้างให้" error={err("slug")}>
              <input id="track-slug" className={inputClass} value={editing.form.slug} onChange={(e) => set("slug", e.target.value)} aria-describedby={describedBy("track-slug", err("slug"), "x")} />
            </Field>
            <Field id="track-summary" label="คำอธิบายสั้นบนการ์ด" error={err("summary")}>
              <textarea id="track-summary" rows={2} className={inputClass} value={editing.form.summary} onChange={(e) => set("summary", e.target.value)} />
            </Field>
            <Field id="track-description" label="รายละเอียดสายงาน" error={err("description")}>
              <textarea id="track-description" rows={4} className={inputClass} value={editing.form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <Field id="track-color" label="สีของสายงาน" required error={err("color")}>
              <select id="track-color" className={inputClass} value={editing.form.color} onChange={(e) => set("color", e.target.value as TrackColor)}>
                {TRACK_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {TRACK_COLOR_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="track-sortOrder" label="ลำดับการแสดง" hint="เลขน้อยแสดงก่อน" error={err("sortOrder")}>
              <input id="track-sortOrder" type="number" min={0} className={inputClass} value={editing.form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} />
            </Field>
            {templates.data && (
              <Field id="track-certificateTemplateId" label="เทมเพลตเกียรติบัตร" hint="ไม่เลือก = ใช้เทมเพลตตั้งต้น" error={err("certificateTemplateId")}>
                <select id="track-certificateTemplateId" className={inputClass} value={editing.form.certificateTemplateId} onChange={(e) => set("certificateTemplateId", e.target.value)}>
                  <option value="">ใช้เทมเพลตตั้งต้น</option>
                  {templates.data.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <label className="flex min-h-11 items-center gap-3 text-body-md text-on-surface">
              <input type="checkbox" className="custom-checkbox" checked={editing.form.isPublished} onChange={(e) => set("isPublished", e.target.checked)} />
              เผยแพร่ให้ผู้เรียนเห็น
            </label>
            {formError && !formError.field && <p className="text-label-sm text-error">{formError.message}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditing(null)} className={secondaryButtonClass}>
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
        </Modal>
      )}

      {deleting && (
        <ConfirmModal title={`ลบสายงาน "${deleting.nameTh}"?`} confirmLabel="ลบสายงาน" danger busy={saving} onConfirm={remove} onClose={() => setDeleting(null)}>
          <p>วิชา หัวข้อ วิดีโอ และแบบทดสอบในสายงานนี้จะถูกลบถาวร สายงานที่มีผู้เคยสมัครเรียนลบไม่ได้ ให้ปิดการเผยแพร่แทน</p>
        </ConfirmModal>
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
