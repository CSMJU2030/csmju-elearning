"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { useSession } from "@/components/session";
import { Alert, ErrorState, PageSkeleton, ProgressBar, Toast } from "@/components/states";
import VideoPlayer from "@/components/VideoPlayer";
import { ArrowBackIcon, ArrowForwardIcon, CheckIcon, LockIcon, cardClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import { formatDuration } from "@/lib/format";
import { themeClass } from "@/lib/tracks";
import { useApi } from "@/lib/use-api";
import type { HeartbeatResult, Outline, OutlineVideo } from "@/lib/types";

/** ห้องเรียนของวิชา: วิดีโอตามลำดับ + แบบทดสอบท้ายวิชา */
export default function ClassroomView({ courseId }: { courseId: string }) {
  const router = useRouter();
  const { refresh } = useSession();
  const outline = useApi<Outline>(`/courses/${courseId}/outline`);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const videos = useMemo(() => outline.data?.topics.flatMap((t) => t.videos) ?? [], [outline.data]);
  const fallback = videos.find((v) => v.state === "AVAILABLE") ?? videos.find((v) => v.state === "COMPLETED") ?? null;
  const current: OutlineVideo | null = videos.find((v) => v.id === selectedId && v.state !== "LOCKED") ?? fallback;

  const reload = outline.reload;
  const onProgress = useCallback(
    (r: HeartbeatResult) => {
      if (r.trackCompleted && r.certificateId) {
        refresh();
        router.push(`/certificates/${r.certificateId}?new=1`);
        return;
      }
      if (r.justCompleted) {
        setToast("เรียนวิดีโอนี้จบแล้ว บทเรียนถัดไปเปิดให้เรียนแล้ว");
        reload();
        refresh();
      }
    },
    [refresh, reload, router],
  );

  if (outline.loading && !outline.data) return <PageSkeleton rows={2} />;
  if (outline.error) return <ErrorState error={outline.error} onRetry={outline.reload} />;
  const o = outline.data;
  if (!o) return null;

  const enrolled = Boolean(o.enrollment);
  const active = o.enrollment?.status === "ACTIVE";
  const nextVideo = current ? videos[videos.findIndex((v) => v.id === current.id) + 1] : undefined;

  return (
    <div className={`${themeClass(o.track.color)} space-y-8`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/tracks/${o.track.id}`} className="inline-flex items-center gap-2 text-label-md text-primary-container hover:underline">
          <ArrowBackIcon className="h-4 w-4" aria-hidden />
          {o.track.nameEn}
        </Link>
        <span className="text-label-md text-on-surface-variant tabular-nums">
          วิชาที่ {o.course.position} จาก {o.course.courseCount}
        </span>
      </div>

      <div className="fade-slide-up">
        {o.course.courseCode && <p className="text-label-md text-primary-container tabular-nums">{o.course.courseCode}</p>}
        <h1 className="font-display text-headline-lg text-on-surface">{o.course.title}</h1>
        {o.course.description && <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">{o.course.description}</p>}
      </div>

      {!enrolled && (
        <Alert tone="info">
          ต้องสมัครเรียนสายงาน {o.track.nameTh} ก่อนจึงจะเริ่มเรียนได้{" "}
          <Link href={`/tracks/${o.track.id}`} className="font-semibold underline">
            ไปหน้าสมัครเรียน
          </Link>
        </Alert>
      )}
      {enrolled && o.course.state === "LOCKED" && (
        <Alert tone="warning">วิชานี้ยังล็อกอยู่ ต้องผ่านวิชาก่อนหน้าก่อน เรียนข้ามวิชาไม่ได้</Alert>
      )}
      {o.enrollment?.status === "COMPLETED" && <Alert tone="success">คุณเรียนจบสายงานนี้แล้ว ทบทวนบทเรียนได้ตลอด</Alert>}

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {current && current.videoUrl ? (
            <div className={`${cardClass} p-4 md:p-6`}>
              <VideoPlayer
                key={current.id}
                video={{ ...current, videoUrl: current.videoUrl }}
                canTrack={active}
                onProgress={onProgress}
              />
              {nextVideo && (
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedId(nextVideo.id)}
                    disabled={nextVideo.state === "LOCKED"}
                    aria-describedby={nextVideo.state === "LOCKED" ? "next-reason" : undefined}
                    className={`${secondaryButtonClass} inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    วิดีโอถัดไป
                    <ArrowForwardIcon className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
              {nextVideo?.state === "LOCKED" && (
                <p id="next-reason" className="mt-2 text-right text-label-sm text-on-surface-variant">
                  ดูวิดีโอนี้ให้ครบเวลาก่อนจึงจะไปวิดีโอถัดไปได้
                </p>
              )}
            </div>
          ) : (
            <div className={`${cardClass} px-6 py-12 text-center`}>
              <LockIcon className="mx-auto mb-3 h-10 w-10 text-outline" aria-hidden />
              <p className="text-body-md text-on-surface-variant">
                {videos.length === 0 ? "วิชานี้ยังไม่มีวิดีโอการสอน" : "บทเรียนยังล็อกอยู่"}
              </p>
            </div>
          )}

          {o.quiz.state !== "NONE" && (
            <section className={`${cardClass} p-6`} aria-labelledby="quiz-heading">
              <h2 id="quiz-heading" className="font-display text-headline-md text-on-surface">
                แบบทดสอบท้ายวิชา
              </h2>
              <p className="mt-1 text-body-md text-on-surface-variant">
                {o.quiz.questionCount} ข้อ · ต้องตอบถูกอย่างน้อย {o.quiz.passCount} ข้อจึงจะผ่านและเรียนวิชาถัดไปได้
              </p>
              {o.quiz.attempts.length > 0 && (
                <ul className="mt-3 space-y-1 text-label-sm text-on-surface-variant">
                  {o.quiz.attempts.slice(0, 3).map((a) => (
                    <li key={a.id} className="tabular-nums">
                      ทำได้ {a.correctCount}/{a.totalCount} ข้อ — {a.isPassed ? "ผ่าน" : "ยังไม่ผ่าน"}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                {o.quiz.state === "COMPLETED" ? (
                  <>
                    <span className="inline-flex items-center gap-2 text-label-md text-emerald-700">
                      <CheckIcon className="h-4 w-4" aria-hidden />
                      ทำแบบทดสอบผ่านแล้ว
                    </span>
                    {o.course.nextCourseId && active && (
                      <Link href={`/learn/${o.course.nextCourseId}`} className={primaryButtonClass}>
                        เรียนวิชาถัดไป
                        <ArrowForwardIcon className="h-4 w-4" aria-hidden />
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    <Link
                      href={`/learn/${o.course.id}/quiz`}
                      aria-disabled={o.quiz.state === "LOCKED" || !active}
                      className={`${primaryButtonClass} ${o.quiz.state === "LOCKED" || !active ? "pointer-events-none opacity-40" : ""}`}
                      tabIndex={o.quiz.state === "LOCKED" || !active ? -1 : undefined}
                    >
                      ทำแบบทดสอบ
                    </Link>
                    {o.quiz.state === "LOCKED" && (
                      <p className="self-center text-label-sm text-on-surface-variant">ดูวิดีโอในวิชานี้ให้ครบก่อน</p>
                    )}
                  </>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className={`${cardClass} h-fit`} aria-labelledby="outline-heading">
          <div className="border-b border-outline-variant/40 px-6 py-5">
            <h2 id="outline-heading" className="font-display text-headline-md text-on-surface">
              บทเรียน
            </h2>
            {o.enrollment && (
              <div className="mt-3">
                <ProgressBar percent={o.enrollment.percent} label="ความคืบหน้าทั้งสายงาน" />
              </div>
            )}
          </div>
          <ol className="divide-y divide-outline-variant/40">
            {o.topics.map((topic, ti) => (
              <li key={topic.id} className="px-6 py-4">
                <p className="text-label-md text-on-surface">
                  หัวข้อที่ {ti + 1} · {topic.title}
                </p>
                <ul className="mt-2 space-y-1">
                  {topic.videos.map((v) => {
                    const selected = current?.id === v.id;
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(v.id)}
                          disabled={v.state === "LOCKED"}
                          aria-current={selected ? "true" : undefined}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed ${
                            selected ? "bg-primary-container/10 text-primary-container" : "text-on-surface hover:bg-surface-variant/50"
                          } ${v.state === "LOCKED" ? "opacity-60" : ""}`}
                        >
                          {v.state === "COMPLETED" ? (
                            <CheckIcon className="h-5 w-5 shrink-0 text-primary-container" aria-label="เรียนจบแล้ว" />
                          ) : v.state === "LOCKED" ? (
                            <LockIcon className="h-5 w-5 shrink-0 text-outline" aria-label="ล็อก" />
                          ) : (
                            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-primary-container" aria-label="เรียนได้" />
                          )}
                          <span className="min-w-0 flex-1 text-body-md">{v.title}</span>
                          <span className="text-caption text-on-surface-variant tabular-nums">{formatDuration(v.durationSeconds)}</span>
                        </button>
                      </li>
                    );
                  })}
                  {topic.videos.length === 0 && <li className="px-3 text-label-sm text-on-surface-variant">ยังไม่มีวิดีโอ</li>}
                </ul>
              </li>
            ))}
          </ol>
        </aside>
      </div>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
