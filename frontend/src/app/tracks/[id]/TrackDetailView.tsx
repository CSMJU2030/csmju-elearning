"use client";

import Link from "next/link";
import { useState } from "react";

import ConfirmModal from "@/components/ConfirmModal";
import { useSession } from "@/components/session";
import { Alert, ErrorState, PageSkeleton, ProgressBar, Toast } from "@/components/states";
import {
  ArrowBackIcon,
  ArrowForwardIcon,
  CheckIcon,
  LockIcon,
  MenuBookIcon,
  StatusBadge,
  cardClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/csmju";
import { ApiError, api, signInHref } from "@/lib/api";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";
import { TRACK_COLOR_LABEL, can, themeClass } from "@/lib/tracks";
import { useApi } from "@/lib/use-api";
import type { Enrollment, EnrollmentDetail, TrackDetail } from "@/lib/types";

export default function TrackDetailView({ id }: { id: string }) {
  const { me, profile, refresh } = useSession();
  const track = useApi<TrackDetail>(`/tracks/${id}`);
  const enrollmentId = track.data?.myEnrollment?.id ?? null;
  const progress = useApi<EnrollmentDetail>(enrollmentId ? `/enrollments/${enrollmentId}` : null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (track.loading && !track.data) return <PageSkeleton rows={3} />;
  if (track.error) return <ErrorState error={track.error} onRetry={track.reload} />;
  const t = track.data;
  if (!t) return null;

  const mine = t.myEnrollment;
  const otherActive = profile?.activeEnrollment && profile.activeEnrollment.track.id !== t.id ? profile.activeEnrollment : null;
  const canEnroll = can(me, "enrollment:create:own");
  const courseState = (courseId: string) => progress.data?.courses.find((c) => c.courseId === courseId);
  const currentCourseId = progress.data?.currentCourseId ?? t.courses[0]?.id;

  async function enroll() {
    setBusy(true);
    setError(null);
    try {
      await api.post<Enrollment>("/enrollments", { trackId: t!.id });
      setConfirming(false);
      setToast(`สมัครเรียนสายงาน ${t!.nameTh} แล้ว หน้าเว็บเปลี่ยนเป็นสีของสายงานนี้`);
      track.reload();
      refresh();
    } catch (e) {
      setConfirming(false);
      setError(e instanceof ApiError ? e.message : "สมัครเรียนไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${themeClass(t.color)} space-y-8`}>
      <Link href="/" className="inline-flex items-center gap-2 text-label-md text-primary-container hover:underline">
        <ArrowBackIcon className="h-4 w-4" aria-hidden />
        สายงานทั้งหมด
      </Link>

      <section className={`${cardClass} fade-slide-up`}>
        <div className="bg-btn-gradient px-6 py-8 text-white md:px-10">
          <p className="text-label-sm text-white/80">สายงาน · {TRACK_COLOR_LABEL[t.color]}</p>
          <h1 className="mt-1 font-display text-headline-lg" lang="en">
            {t.nameEn}
          </h1>
          <p className="text-body-lg text-white/90">{t.nameTh}</p>
        </div>
        <div className="grid gap-8 p-6 md:grid-cols-3 md:p-10">
          <div className="space-y-4 md:col-span-2">
            <p className="text-body-lg text-on-surface">{t.summary}</p>
            {t.description && <p className="max-w-prose text-body-md text-on-surface-variant">{t.description}</p>}
            <dl className="flex flex-wrap gap-6">
              <div>
                <dt className="text-label-sm text-on-surface-variant">วิชาที่ต้องเรียน</dt>
                <dd className="font-display text-headline-md tabular-nums text-primary-container">{formatNumber(t.courses.length)}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">กำลังเรียน</dt>
                <dd className="font-display text-headline-md tabular-nums text-primary-container">{formatNumber(t.learnerCount)}</dd>
              </div>
              <div>
                <dt className="text-label-sm text-on-surface-variant">เรียนจบแล้ว</dt>
                <dd className="font-display text-headline-md tabular-nums text-primary-container">{formatNumber(t.graduateCount)}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4 rounded-xl border border-outline-variant/40 bg-surface p-5">
            {!me ? (
              <>
                <p className="text-body-md text-on-surface-variant">เข้าสู่ระบบด้วยบัญชี CSMJU Portal เพื่อสมัครเรียน</p>
                <a href={signInHref()} className={`${primaryButtonClass} w-full`}>
                  เข้าสู่ระบบเพื่อสมัครเรียน
                </a>
              </>
            ) : mine?.status === "COMPLETED" ? (
              <>
                <StatusBadge tone="success" label="เรียนจบแล้ว" />
                <p className="text-body-md text-on-surface-variant">เรียนจบเมื่อ {formatDate(mine.completedAt, "long")}</p>
                <Link href="/achievements" className={`${primaryButtonClass} w-full`}>
                  ดูเกียรติบัตร
                </Link>
              </>
            ) : mine?.status === "ACTIVE" ? (
              <>
                <StatusBadge tone="info" label="กำลังเรียนสายงานนี้" />
                <ProgressBar percent={progress.data?.percent ?? 0} label="ความคืบหน้า" />
                {currentCourseId && (
                  <Link href={`/learn/${currentCourseId}`} className={`${primaryButtonClass} w-full`}>
                    เข้าเรียนต่อ
                    <ArrowForwardIcon className="h-4 w-4" aria-hidden />
                  </Link>
                )}
                <Link href="/profile" className="block text-center text-label-md text-primary-container hover:underline">
                  ดูความคืบหน้า หรือออกจากสายงาน
                </Link>
              </>
            ) : !canEnroll ? (
              <p className="text-body-md text-on-surface-variant">บัญชีผู้เยี่ยมชมดูรายละเอียดสายงานได้อย่างเดียว สมัครเรียนไม่ได้</p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={Boolean(otherActive) || t.courses.length === 0}
                  aria-describedby={otherActive || t.courses.length === 0 ? "enroll-reason" : undefined}
                  className={`${primaryButtonClass} w-full disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  สมัครเรียนสายงานนี้
                </button>
                {otherActive ? (
                  <p id="enroll-reason" className="text-label-sm text-on-surface-variant">
                    คุณกำลังเรียนสายงาน {otherActive.track.nameTh} อยู่ ต้องเรียนจบหรือออกจากสายงานนั้นก่อน
                  </p>
                ) : t.courses.length === 0 ? (
                  <p id="enroll-reason" className="text-label-sm text-on-surface-variant">สายงานนี้ยังไม่มีวิชาให้เรียน</p>
                ) : (
                  <p className="text-label-sm text-on-surface-variant">เรียนได้ทีละ 1 สายงาน · เรียนตามลำดับวิชา</p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-8 xl:grid-cols-3">
        <section className="space-y-4 xl:col-span-2" aria-labelledby="courses-heading">
          <h2 id="courses-heading" className="border-l-4 border-primary-container pl-3 font-display text-headline-md text-on-surface">
            หลักสูตรที่ต้องเรียน
          </h2>
          {t.courses.length === 0 ? (
            <div className={`${cardClass} px-6 py-10 text-center text-body-md text-on-surface-variant`}>ยังไม่มีวิชาในสายงานนี้</div>
          ) : (
            <ol className="space-y-3">
              {t.courses.map((c, i) => {
                const s = courseState(c.id);
                const open = mine && s && s.state !== "LOCKED";
                return (
                  <li key={c.id} className={`${cardClass} flex flex-col gap-4 p-5 md:flex-row md:items-center`}>
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-label-md tabular-nums ${
                        s?.state === "COMPLETED" ? "bg-primary-container text-white" : "bg-primary-container/10 text-primary-container"
                      }`}
                      aria-hidden
                    >
                      {s?.state === "COMPLETED" ? <CheckIcon className="h-5 w-5" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {c.courseCode && (
                          <span className="rounded-full bg-primary-container/10 px-2.5 py-1 text-label-sm text-primary-container tabular-nums">
                            {c.courseCode}
                          </span>
                        )}
                        <h3 className="text-body-lg font-semibold text-on-surface">{c.title}</h3>
                      </div>
                      {c.curriculumName && c.curriculumName !== c.title && (
                        <p className="text-body-md text-on-surface-variant">วิชาในหลักสูตร: {c.curriculumName}</p>
                      )}
                      <p className="mt-1 text-label-sm text-on-surface-variant">
                        {c.topicCount} หัวข้อ · {c.videoCount} วิดีโอ · {formatDuration(c.totalDurationSeconds)}
                        {c.questionCount > 0 ? ` · แบบทดสอบ ${c.questionCount} ข้อ (ผ่าน ${Math.min(c.quizPassCount, c.questionCount)} ข้อ)` : ""}
                        {c.credits ? ` · ${c.credits} หน่วยกิต` : ""}
                      </p>
                    </div>
                    {mine?.status === "ACTIVE" &&
                      (open ? (
                        <Link href={`/learn/${c.id}`} className={secondaryButtonClass} aria-label={`เข้าเรียนวิชา ${c.title}`}>
                          {s?.state === "COMPLETED" ? "ทบทวน" : "เข้าเรียน"}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                          <LockIcon className="h-4 w-4" aria-hidden />
                          ต้องผ่านวิชาก่อนหน้า
                        </span>
                      ))}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className={`${cardClass} h-fit`} aria-labelledby="graduates-heading">
          <div className="border-b border-outline-variant/40 px-6 py-5">
            <h2 id="graduates-heading" className="font-display text-headline-md text-on-surface">
              ผู้เรียนจบสายงานนี้
            </h2>
            <p className="text-body-md text-on-surface-variant">ทั้งหมด {formatNumber(t.graduateCount)} คน</p>
          </div>
          {t.graduates.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <MenuBookIcon className="mx-auto mb-3 h-10 w-10 text-outline" aria-hidden />
              <p className="text-body-md text-on-surface-variant">ยังไม่มีผู้เรียนจบ มาเป็นคนแรกของสายงานนี้</p>
            </div>
          ) : (
            <ul className="divide-y divide-outline-variant/40">
              {t.graduates.map((g) => (
                <li key={g.certificateId} className="flex items-center justify-between gap-3 px-6 py-3">
                  <span className="text-body-md text-on-surface tabular-nums">
                    {g.personCode ?? "ผู้เรียน"}
                    {g.isMe && <span className="ml-2 rounded-full bg-primary-container/10 px-2 py-0.5 text-label-sm text-primary-container">คุณ</span>}
                  </span>
                  <span className="text-caption text-secondary">{formatDate(g.issuedAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-outline-variant/40 px-6 py-3 text-caption text-on-surface-variant">
            แสดงรหัสนักศึกษา/บุคลากรจาก CSMJU Portal — ระบบนี้ไม่เก็บชื่อผู้เรียน
          </p>
        </section>
      </div>

      {confirming && (
        <ConfirmModal
          title={`สมัครเรียน ${t.nameEn}`}
          confirmLabel="สมัครเรียน"
          busy={busy}
          onConfirm={enroll}
          onClose={() => setConfirming(false)}
        >
          <p>
            เมื่อสมัครแล้วหน้าเว็บจะเปลี่ยนเป็น<strong className="text-on-surface">{TRACK_COLOR_LABEL[t.color]}</strong>ของสายงานนี้
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>เรียนได้ทีละ 1 สายงาน สมัครสายงานอื่นได้เมื่อเรียนจบ</li>
            <li>ต้องเรียนตามลำดับ ดูวิดีโอให้ครบเวลา แล้วทำแบบทดสอบท้ายวิชาให้ผ่าน</li>
            <li>ออกจากสายงานได้ แต่ความคืบหน้าทั้งหมดจะกลับเป็น 0</li>
          </ul>
        </ConfirmModal>
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
