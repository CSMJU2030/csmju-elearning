"use client";

import { useState } from "react";

import CertificateView from "@/components/CertificateView";
import ConfirmModal from "@/components/ConfirmModal";
import Field, { describedBy } from "@/components/Field";
import { formErrorOf } from "@/components/forms";
import { Alert, EmptyState, ErrorState, PageSkeleton, Toast } from "@/components/states";
import {
  AddIcon,
  DeleteIcon,
  EditIcon,
  PageHeader,
  StatusBadge,
  cardClass,
  iconButtonClass,
  iconDangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/csmju";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { CertificateDetail, CertificateTemplate } from "@/lib/types";

interface Form {
  id: string | null;
  name: string;
  heading: string;
  bodyText: string;
  signerName: string;
  signerTitle: string;
  imageId: string;
  isDefault: boolean;
}

const NEW: Form = {
  id: null,
  name: "",
  heading: "เกียรติบัตร",
  bodyText: "ขอมอบเกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า {name} ได้ผ่านการเรียนรู้ครบทุกวิชาในสายงาน {track} เมื่อวันที่ {date}",
  signerName: "",
  signerTitle: "",
  imageId: "",
  isDefault: false,
};

const FIELDS: { key: "name" | "heading" | "signerName" | "signerTitle"; label: string }[] = [
  { key: "name", label: "ชื่อเทมเพลต" },
  { key: "heading", label: "หัวเกียรติบัตร" },
  { key: "signerName", label: "ชื่อผู้ลงนาม" },
  { key: "signerTitle", label: "ตำแหน่งผู้ลงนาม" },
];

/** เพิ่ม/แก้เทมเพลตเกียรติบัตร พร้อมตัวอย่างจริง — ชื่อผู้เรียนใส่ให้อัตโนมัติตอนออกเกียรติบัตร */
export default function TemplatesView() {
  const list = useApi<CertificateTemplate[]>("/certificate-templates?limit=100");
  const [form, setForm] = useState<Form | null>(null);
  const [deleting, setDeleting] = useState<CertificateTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (list.loading && !list.data) return <PageSkeleton rows={2} />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const rows = list.data ?? [];

  const preview: CertificateDetail | null = form
    ? {
        id: "preview",
        certificateNo: "CSMJU-EL-2569-0000ABCD",
        issuedAt: new Date().toISOString(),
        personCode: null,
        isMine: true,
        recipientName: "ชื่อ นามสกุล ผู้เรียน",
        track: { id: "preview", nameTh: "นักพัฒนาซอฟต์แวร์", nameEn: "Programmer / Software Developer", color: "BLUE" },
        template: { heading: form.heading, bodyText: form.bodyText, signerName: form.signerName, signerTitle: form.signerTitle, imageUrl: null },
      }
    : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    for (const f of [...FIELDS, { key: "bodyText" as const, label: "ข้อความ" }]) {
      if (!String(form[f.key]).trim()) {
        setFormError({ field: f.key, message: `กรุณากรอก${f.label}` });
        document.getElementById(`tpl-${f.key}`)?.focus();
        return;
      }
    }
    setSaving(true);
    setFormError(null);
    const body = {
      name: form.name.trim(),
      heading: form.heading.trim(),
      bodyText: form.bodyText.trim(),
      signerName: form.signerName.trim(),
      signerTitle: form.signerTitle.trim(),
      imageId: form.imageId.trim() || null,
      isDefault: form.isDefault,
    };
    try {
      if (form.id) await api.patch(`/certificate-templates/${form.id}`, body);
      else await api.post("/certificate-templates", body);
      setForm(null);
      setToast("บันทึกเทมเพลตแล้ว");
      list.reload();
    } catch (err) {
      setFormError(formErrorOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.del(`/certificate-templates/${deleting.id}`);
      setToast(`ลบเทมเพลต ${deleting.name} แล้ว`);
      list.reload();
    } catch (err) {
      setPageError(formErrorOf(err).message);
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  }

  const err = (field: string) => (formError?.field === field ? formError.message : null);

  return (
    <>
      <PageHeader title="เทมเพลตเกียรติบัตร" description="กำหนดข้อความและผู้ลงนาม ระบบใส่ชื่อผู้เรียนให้เมื่อเรียนจบสายงาน ผู้เรียนดาวน์โหลดได้ที่เมนูความสำเร็จ" />
      {pageError && <Alert tone="error">{pageError}</Alert>}

      {form && preview ? (
        <div className="grid gap-8 xl:grid-cols-2">
          <form onSubmit={save} noValidate className={`${cardClass} space-y-4 p-6`}>
            <h2 className="font-display text-headline-md text-on-surface">{form.id ? "แก้ไขเทมเพลต" : "เพิ่มเทมเพลต"}</h2>
            <p className="text-label-sm text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>
            {FIELDS.map((f) => (
              <Field key={f.key} id={`tpl-${f.key}`} label={f.label} required error={err(f.key)}>
                <input
                  id={`tpl-${f.key}`}
                  className={`${inputClass} ${err(f.key) ? "input-error" : ""}`}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  aria-required
                  aria-describedby={describedBy(`tpl-${f.key}`, err(f.key))}
                />
              </Field>
            ))}
            <Field id="tpl-bodyText" label="ข้อความ" required hint="ใช้ {name} {track} {date} {certificateNo} แทนชื่อผู้เรียน สายงาน วันที่ และเลขที่" error={err("bodyText")}>
              <textarea id="tpl-bodyText" rows={4} className={inputClass} value={form.bodyText} onChange={(e) => setForm({ ...form, bodyText: e.target.value })} aria-describedby={describedBy("tpl-bodyText", err("bodyText"), "hint")} />
            </Field>
            <Field id="tpl-imageId" label="รหัสรูปลายเซ็นหรือตรา (ไม่บังคับ)" hint="id ของรูปที่อัปโหลดไว้ใน CSMJU Portal" error={err("imageId")}>
              <input id="tpl-imageId" className={inputClass} value={form.imageId} onChange={(e) => setForm({ ...form, imageId: e.target.value })} aria-describedby={describedBy("tpl-imageId", err("imageId"), "hint")} />
            </Field>
            <label className="flex min-h-11 items-center gap-3 text-body-md text-on-surface">
              <input type="checkbox" className="custom-checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              ใช้เป็นเทมเพลตตั้งต้น (สายงานที่ไม่ได้เลือกเทมเพลต)
            </label>
            {formError && !formError.field && <p className="text-label-sm text-error">{formError.message}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setForm(null)} className={secondaryButtonClass}>
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
          <div className="space-y-3">
            <p className="text-label-md text-on-surface-variant">ตัวอย่าง</p>
            <CertificateView certificate={preview} />
          </div>
        </div>
      ) : (
        <div className={cardClass}>
          <div className="flex flex-col gap-3 border-b border-outline-variant/40 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <h2 className="font-display text-headline-md text-on-surface">เทมเพลต {rows.length} แบบ</h2>
            <button type="button" onClick={() => { setFormError(null); setForm(NEW); }} className={primaryButtonClass}>
              <AddIcon className="h-4 w-4" aria-hidden />
              เพิ่มเทมเพลต
            </button>
          </div>
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title="ยังไม่มีเทมเพลต" description="ระบบใช้ข้อความตั้งต้นไปก่อน เพิ่มเทมเพลตเพื่อกำหนดข้อความและผู้ลงนามเอง" />
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/40">
              {rows.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-body-md font-semibold text-on-surface">{t.name}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      ผู้ลงนาม {t.signerName} · ใช้กับ {t.trackCount ?? 0} สายงาน · ออกไปแล้ว {t.certificateCount ?? 0} ใบ
                    </p>
                  </div>
                  {t.isDefault && <StatusBadge tone="info" label="เทมเพลตตั้งต้น" />}
                  <button
                    type="button"
                    className={iconButtonClass}
                    aria-label={`แก้ไขเทมเพลต ${t.name}`}
                    onClick={() => {
                      setFormError(null);
                      setForm({ id: t.id, name: t.name, heading: t.heading, bodyText: t.bodyText, signerName: t.signerName, signerTitle: t.signerTitle, imageId: t.imageId ?? "", isDefault: t.isDefault });
                    }}
                  >
                    <EditIcon className="h-5 w-5" />
                  </button>
                  <button type="button" className={iconDangerButtonClass} aria-label={`ลบเทมเพลต ${t.name}`} onClick={() => setDeleting(t)}>
                    <DeleteIcon className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {deleting && (
        <ConfirmModal title={`ลบเทมเพลต "${deleting.name}"?`} confirmLabel="ลบเทมเพลต" danger busy={saving} onConfirm={remove} onClose={() => setDeleting(null)}>
          <p>สายงานที่ใช้เทมเพลตนี้และเกียรติบัตรที่ออกไปแล้วจะกลับไปใช้เทมเพลตตั้งต้นแทน</p>
        </ConfirmModal>
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
