"use client";

import Link from "next/link";
import { useState } from "react";

import ConfirmModal from "@/components/ConfirmModal";
import { useSession } from "@/components/session";
import { Alert, EmptyState, ErrorState, PageSkeleton, ProgressBar, Toast } from "@/components/states";
import { CheckIcon, LockIcon, PageHeader, StatusBadge, cardClass, dangerButtonClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import { ApiError, api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { CORE_ROLE_LABEL, can, themeClass } from "@/lib/tracks";
import { useApi } from "@/lib/use-api";
import type { EnrollmentDetail, LearnerProfile } from "@/lib/types";

const STATE_LABEL = { COMPLETED: "ผ่านแล้ว", AVAILABLE: "กำลังเรียน", LOCKED: "ยังไม่เปิด" } as const;

export default function ProfileView() {
  const { me, refresh } = useSession();
  const profile = useApi<LearnerProfile>("/learner-profile");
  const activeId = profile.data?.activeEnrollment?.enrollmentId ?? null;
  const detail = useApi<EnrollmentDetail>(activeId ? `/enrollments/${activeId}` : null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (profile.loading && !profile.data) return <PageSkeleton rows={2} />;
  if (profile.error) return <ErrorState error={profile.error} onRetry={profile.reload} />;
  const p = profile.data;
  if (!p) return null;
  const active = p.activeEnrollment;

  async function withdraw() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/enrollments/${active.enrollmentId}/withdraw`);
      setConfirming(false);
      setToast(`ออกจากสายงาน ${active.track.nameTh} แล้ว เลือกสายงานใหม่ได้เลย`);
      profile.reload();
      refresh();
    } catch (e) {
      setConfirming(false);
      setError(e instanceof ApiError ? e.message : "ออกจากสายงานไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="การเรียนของฉัน" description="สถานะสายงานที่กำลังเรียน และสายงานที่เรียนจบแล้ว" />

      <section className={`${cardClass} flex flex-col gap-4 p-6 md:flex-row md:items-center`}>
        <div className="flex-1">
          <p className="font-display text-headline-md text-on-surface">{p.fullNameTh ?? p.email ?? "ผู้ใช้"}</p>
          <p className="text-body-md text-on-surface-variant">
            {CORE_ROLE_LABEL[p.coreRole]}
            {p.personCode ? ` · รหัส ${p.personCode}` : ""}
          </p>
        </div>
        <dl className="flex gap-8">
          <div>
            <dt className="text-label-sm text-on-surface-variant">เรียนจบ</dt>
            <dd className="font-display text-headline-md tabular-nums text-primary-container">{p.completedTracks.length} สายงาน</dd>
          </div>
          <div>
            <dt className="text-label-sm text-on-surface-variant">กำลังเรียน</dt>
            <dd className="font-display text-headline-md tabular-nums text-primary-container">{active ? 1 : 0} สายงาน</dd>
          </div>
        </dl>
      </section>

      {error && <Alert tone="error">{error}</Alert>}

      <section aria-labelledby="active-heading" className="space-y-4">
        <h2 id="active-heading" className="border-l-4 border-primary-container pl-3 font-display text-headline-md text-on-surface">
          สายงานที่กำลังเรียน
        </h2>
        {!active ? (
          <EmptyState
            title="ยังไม่ได้เลือกสายงาน"
            description={
              can(me, "enrollment:create:own")
                ? "เลือกสายงานที่สนใจแล้วกดสมัครเรียน หน้าเว็บจะเปลี่ยนเป็นสีของสายงานนั้น"
                : "บัญชีผู้เยี่ยมชมดูสายงานได้อย่างเดียว"
            }
            action={
              <Link href="/" className={primaryButtonClass}>
                เลือกสายงาน
              </Link>
            }
          />
        ) : (
          <div className={`${themeClass(active.track.color)} ${cardClass}`}>
            <div className="bg-btn-gradient flex flex-wrap items-center justify-between gap-4 px-6 py-5 text-white">
              <div>
                <p className="text-label-sm text-white/80">สมัครเมื่อ {formatDate(active.enrolledAt, "long")}</p>
                <p className="font-display text-headline-md" lang="en">
                  {active.track.nameEn}
                </p>
                <p className="text-body-md text-white/90">{active.track.nameTh}</p>
              </div>
              <StatusBadge tone="info" label="กำลังเรียน" />
            </div>
            <div className="space-y-6 p-6">
              <ProgressBar percent={active.percent} label={`ผ่านแล้ว ${active.coursesPassed} จาก ${active.courseCount} วิชา`} />
              {detail.data && (
                <ol className="space-y-2">
                  {detail.data.courses.map((c, i) => (
                    <li key={c.courseId} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-4 py-3">
                      <span className="w-6 text-label-md text-on-surface-variant tabular-nums">{i + 1}.</span>
                      <span className="min-w-0 flex-1 text-body-md text-on-surface">{c.title}</span>
                      <span className="text-label-sm text-on-surface-variant tabular-nums">
                        วิดีโอ {c.videosCompleted}/{c.videosTotal}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-label-sm ${
                          c.state === "COMPLETED" ? "text-emerald-700" : c.state === "LOCKED" ? "text-on-surface-variant" : "text-primary-container"
                        }`}
                      >
                        {c.state === "COMPLETED" ? <CheckIcon className="h-4 w-4" aria-hidden /> : c.state === "LOCKED" ? <LockIcon className="h-4 w-4" aria-hidden /> : null}
                        {STATE_LABEL[c.state]}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setConfirming(true)} className={dangerButtonClass}>
                  ออกจากสายงาน
                </button>
                {active.currentCourseId && (
                  <Link href={`/learn/${active.currentCourseId}`} className={primaryButtonClass}>
                    เรียนต่อ
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="done-heading" className="space-y-4">
        <h2 id="done-heading" className="border-l-4 border-primary-container pl-3 font-display text-headline-md text-on-surface">
          สายงานที่เรียนจบแล้ว
        </h2>
        {p.completedTracks.length === 0 ? (
          <EmptyState title="ยังไม่มีสายงานที่เรียนจบ" description="เรียนครบทุกวิชาและทำแบบทดสอบผ่าน จะได้เกียรติบัตรของสายงานนั้น" />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {p.completedTracks.map((c) => (
              <li key={c.enrollmentId} className={`${themeClass(c.track.color)} ${cardClass} flex items-center gap-4 p-5`}>
                <span className="rounded-lg bg-btn-gradient p-2.5 text-white" aria-hidden>
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-md font-semibold text-on-surface">{c.track.nameEn}</p>
                  <p className="text-label-sm text-on-surface-variant">เรียนจบ {formatDate(c.completedAt)}</p>
                </div>
                {c.certificate && (
                  <Link href={`/certificates/${c.certificate.id}`} className={secondaryButtonClass} aria-label={`ดูเกียรติบัตรสายงาน ${c.track.nameTh}`}>
                    เกียรติบัตร
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirming && active && (
        <ConfirmModal
          title={`ออกจากสายงาน "${active.track.nameTh}"?`}
          confirmLabel="ออกจากสายงาน"
          danger
          busy={busy}
          onConfirm={withdraw}
          onClose={() => setConfirming(false)}
        >
          <p>
            ความคืบหน้าทั้งหมดในสายงานนี้ (<strong className="text-on-surface tabular-nums">{active.percent}%</strong>) จะถูกล้างเป็น 0
            และสถานะในโปรไฟล์จะหายไป ถ้ากลับมาเรียนต้องสมัครและเริ่มใหม่ตั้งแต่วิชาแรก
          </p>
          <p>สายงานที่เรียนจบแล้วและเกียรติบัตรจะยังอยู่ตามเดิม</p>
        </ConfirmModal>
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
