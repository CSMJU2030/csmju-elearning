"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { useSession } from "@/components/session";
import { Alert, ErrorState, PageSkeleton } from "@/components/states";
import { ArrowBackIcon, CheckIcon, CloseIcon, PageHeader, cardClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import { ApiError, api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { Outline, Quiz, QuizResult } from "@/lib/types";
import { themeClass } from "@/lib/tracks";

export default function QuizView({ courseId }: { courseId: string }) {
  const { refresh } = useSession();
  const quiz = useApi<Quiz>(`/courses/${courseId}/quiz`);
  const outline = useApi<Outline>(`/courses/${courseId}/outline`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);

  if ((quiz.loading && !quiz.data) || (outline.loading && !outline.data)) return <PageSkeleton rows={2} />;
  if (quiz.error) {
    if (quiz.error.reason === "QUIZ_LOCKED") {
      return (
        <div className="space-y-6">
          <Alert tone="warning">ต้องเรียนวิดีโอในวิชานี้ให้ครบก่อนทำแบบทดสอบ</Alert>
          <Link href={`/learn/${courseId}`} className={secondaryButtonClass}>
            กลับไปห้องเรียน
          </Link>
        </div>
      );
    }
    return <ErrorState error={quiz.error} onRetry={quiz.reload} />;
  }
  const q = quiz.data;
  if (!q) return null;
  const color = outline.data?.track.color;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const unanswered = q!.questions.filter((x) => !answers[x.id]).map((x) => x.id);
    setMissing(unanswered);
    if (unanswered.length > 0) {
      setError(`ยังไม่ได้ตอบ ${unanswered.length} ข้อ กรุณาตอบให้ครบทุกข้อ`);
      document.getElementById(`q-${unanswered[0]}`)?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.post<QuizResult>("/quiz-attempts", {
        courseId,
        answers: Object.entries(answers).map(([questionId, choiceId]) => ({ questionId, choiceId })),
      });
      setResult(r);
      if (r.isPassed) refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ส่งคำตอบไม่สำเร็จ กรุณาลองอีกครั้ง");
      errorRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div className={`${themeClass(color)} space-y-8`}>
      <Link href={`/learn/${courseId}`} className="inline-flex items-center gap-2 text-label-md text-primary-container hover:underline">
        <ArrowBackIcon className="h-4 w-4" aria-hidden />
        กลับไปห้องเรียน
      </Link>
      <PageHeader title={`แบบทดสอบ: ${q.courseTitle}`} description={`ตอบถูกอย่างน้อย ${q.passCount} จาก ${q.questions.length} ข้อจึงจะผ่าน`} />

      {result && (
        <div className={`${cardClass} p-6`} role="status" aria-live="polite">
          <p className="font-display text-headline-md text-on-surface">
            {result.isPassed ? "ผ่านแบบทดสอบแล้ว" : "ยังไม่ผ่าน ลองทบทวนแล้วทำใหม่ได้"}
          </p>
          <p className="mt-1 text-body-lg text-on-surface-variant tabular-nums">
            ตอบถูก {result.correctCount} จาก {result.totalCount} ข้อ (ต้องถูก {result.passCount} ข้อ)
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {result.trackCompleted && result.certificateId ? (
              <Link href={`/certificates/${result.certificateId}?new=1`} className={primaryButtonClass}>
                ดูเกียรติบัตรของคุณ
              </Link>
            ) : result.isPassed ? (
              outline.data?.course.nextCourseId ? (
                <Link href={`/learn/${outline.data.course.nextCourseId}`} className={primaryButtonClass}>
                  เรียนวิชาถัดไป
                </Link>
              ) : (
                <Link href="/profile" className={primaryButtonClass}>
                  ดูความคืบหน้า
                </Link>
              )
            ) : (
              <button
                type="button"
                className={primaryButtonClass}
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
              >
                ทำแบบทดสอบอีกครั้ง
              </button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-4">
        {q.questions.map((question, i) => {
          const r = result?.results.find((x) => x.questionId === question.id);
          return (
            <fieldset
              key={question.id}
              id={`q-${question.id}`}
              tabIndex={-1}
              aria-describedby={missing.includes(question.id) ? `q-${question.id}-error` : undefined}
              className={`${cardClass} p-6 ${missing.includes(question.id) ? "border-error" : ""}`}
            >
              <legend className="sr-only">คำถามข้อ {i + 1}</legend>
              <p className="text-body-lg text-on-surface">
                <span className="tabular-nums">{i + 1}.</span> {question.prompt}
              </p>
              <div className="mt-4 space-y-2">
                {question.choices.map((c) => (
                  <label
                    key={c.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 transition-colors ${
                      answers[question.id] === c.id
                        ? "border-primary-container bg-primary-container/10"
                        : "border-outline-variant hover:bg-surface-variant/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      value={c.id}
                      checked={answers[question.id] === c.id}
                      disabled={Boolean(result)}
                      onChange={() => {
                        setAnswers((a) => ({ ...a, [question.id]: c.id }));
                        setMissing((m) => m.filter((x) => x !== question.id));
                      }}
                      className="h-4 w-4 accent-primary-container"
                    />
                    <span className="text-body-md text-on-surface">{c.label}</span>
                  </label>
                ))}
              </div>
              {missing.includes(question.id) && (
                <p id={`q-${question.id}-error`} className="mt-2 text-label-sm text-error">
                  กรุณาเลือกคำตอบข้อนี้
                </p>
              )}
              {r && (
                <p className={`mt-3 inline-flex items-center gap-2 text-label-md ${r.isCorrect ? "text-emerald-700" : "text-error"}`}>
                  {r.isCorrect ? <CheckIcon className="h-4 w-4" aria-hidden /> : <CloseIcon className="h-4 w-4" aria-hidden />}
                  {r.isCorrect ? "ตอบถูก" : "ตอบผิด"}
                  {r.explanation ? ` — ${r.explanation}` : ""}
                </p>
              )}
            </fieldset>
          );
        })}

        {error && (
          <div ref={errorRef} tabIndex={-1}>
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        {!result && (
          <div className="flex justify-end gap-3 pt-2">
            <Link href={`/learn/${courseId}`} className={secondaryButtonClass}>
              ยกเลิก
            </Link>
            <button type="submit" disabled={submitting} aria-busy={submitting} className={`${primaryButtonClass} relative ${submitting ? "btn-loading" : ""}`}>
              <span className="btn-text">ส่งคำตอบ</span>
              <span className="dots" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
