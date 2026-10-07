"use client";

import Link from "next/link";
import { useState } from "react";

import ConfirmModal from "@/components/ConfirmModal";
import CourseForm, { courseBody, type CourseFormValue } from "@/components/CourseForm";
import Field, { describedBy } from "@/components/Field";
import { formErrorOf } from "@/components/forms";
import { Alert, ErrorState, PageSkeleton, Toast } from "@/components/states";
import {
  AddIcon,
  ArrowBackIcon,
  DeleteIcon,
  EditIcon,
  Modal,
  PageHeader,
  Tabs,
  cardClass,
  iconButtonClass,
  iconDangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/csmju";
import { ApiError, api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { themeClass } from "@/lib/tracks";
import { useApi } from "@/lib/use-api";
import type { CourseAdmin, QuizQuestionAdmin } from "@/lib/types";

type Tab = "content" | "quiz" | "settings";
type Dialog =
  | { kind: "topic"; id: string | null; title: string; description: string }
  | { kind: "video"; id: string | null; topicId: string; title: string; videoUrl: string; minutes: string; seconds: string }
  | { kind: "question"; id: string | null; prompt: string; explanation: string; choices: { label: string; isCorrect: boolean }[] };

function durationOf(d: { minutes: string; seconds: string }) {
  return (Number(d.minutes) || 0) * 60 + (Number(d.seconds) || 0);
}

type Deleting = { kind: "topic" | "video" | "question"; id: string; label: string };

const SaveButton = ({ saving, label = "บันทึก" }: { saving: boolean; label?: string }) => (
  <button type="submit" disabled={saving} aria-busy={saving} className={`${primaryButtonClass} relative ${saving ? "btn-loading" : ""}`}>
    <span className="btn-text">{label}</span>
    <span className="dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  </button>
);

export default function CourseEditorView({ courseId }: { courseId: string }) {
  const course = useApi<CourseAdmin>(`/courses/${courseId}`);
  const questions = useApi<QuizQuestionAdmin[]>(`/quiz-questions?courseId=${courseId}&limit=100`);
  const [tab, setTab] = useState<Tab>("content");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const [settings, setSettings] = useState<CourseFormValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (course.loading && !course.data) return <PageSkeleton rows={2} />;
  if (course.error) return <ErrorState error={course.error} onRetry={course.reload} />;
  if (questions.error && questions.error.code !== "FORBIDDEN") return <ErrorState error={questions.error} onRetry={questions.reload} />;
  const c = course.data;
  if (!c) return null;
  if (!c.canManage) return <ErrorState error={new ApiError(403, "FORBIDDEN", "")} />;
  const qs = questions.data ?? [];

  const settingsValue: CourseFormValue = settings ?? {
    title: c.title,
    courseCode: c.courseCode ?? "",
    description: c.description,
    quizPassCount: String(c.quizPassCount),
    sortOrder: String(c.sortOrder),
    isPublished: c.isPublished,
  };

  const done = (message: string) => {
    setDialog(null);
    setFormError(null);
    setToast(message);
    course.reload();
    questions.reload();
  };

  function validate(d: Dialog): { field: string; message: string } | null {
    if (d.kind === "topic") return d.title.trim() ? null : { field: "title", message: "กรุณากรอกชื่อหัวข้อ" };
    if (d.kind === "video") {
      if (!d.title.trim()) return { field: "title", message: "กรุณากรอกชื่อวิดีโอ" };
      if (!/^https:\/\//i.test(d.videoUrl.trim())) return { field: "videoUrl", message: "ลิงก์วิดีโอต้องขึ้นต้นด้วย https://" };
      if (durationOf(d) < 1) return { field: "durationSeconds", message: "กรุณากรอกความยาววิดีโอ" };
      return null;
    }
    const choices = d.choices.filter((ch) => ch.label.trim());
    if (!d.prompt.trim()) return { field: "prompt", message: "กรุณากรอกคำถาม" };
    if (choices.length < 2) return { field: "choices", message: "ต้องมีตัวเลือกอย่างน้อย 2 ข้อ" };
    if (choices.filter((ch) => ch.isCorrect).length !== 1) return { field: "choices", message: "เลือกคำตอบที่ถูกต้อง 1 ข้อ (ตัวเลือกที่มีข้อความ)" };
    return null;
  }

  async function saveDialog(e: React.FormEvent) {
    e.preventDefault();
    if (!dialog) return;
    const invalid = validate(dialog);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (dialog.kind === "topic") {
        const body = { title: dialog.title.trim(), description: dialog.description.trim() };
        if (dialog.id) await api.patch(`/topics/${dialog.id}`, body);
        else await api.post("/topics", { courseId, ...body });
        done("บันทึกหัวข้อแล้ว");
      } else if (dialog.kind === "video") {
        const body = { title: dialog.title.trim(), videoUrl: dialog.videoUrl.trim(), durationSeconds: durationOf(dialog) };
        if (dialog.id) await api.patch(`/videos/${dialog.id}`, body);
        else await api.post("/videos", { topicId: dialog.topicId, ...body });
        done("บันทึกวิดีโอแล้ว");
      } else {
        const choices = dialog.choices.filter((ch) => ch.label.trim());
        const body = { prompt: dialog.prompt.trim(), explanation: dialog.explanation.trim(), choices: choices.map((ch) => ({ label: ch.label.trim(), isCorrect: ch.isCorrect })) };
        if (dialog.id) await api.patch(`/quiz-questions/${dialog.id}`, body);
        else await api.post("/quiz-questions", { courseId, ...body });
        done("บันทึกคำถามแล้ว");
      }
    } catch (err) {
      setFormError(formErrorOf(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    if (!settingsValue.title.trim()) {
      setFormError({ field: "title", message: "กรุณากรอกชื่อวิชา" });
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await api.patch(`/courses/${courseId}`, courseBody(settingsValue));
      setSettings(null);
      done("บันทึกการตั้งค่าวิชาแล้ว");
    } catch (e) {
      setFormError(formErrorOf(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      const path = deleting.kind === "topic" ? "topics" : deleting.kind === "video" ? "videos" : "quiz-questions";
      await api.del(`/${path}/${deleting.id}`);
      done(`ลบ ${deleting.label} แล้ว`);
    } catch (e) {
      setToast(null);
      setFormError(formErrorOf(e));
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  }

  const err = (field: string) => (formError?.field === field ? formError.message : null);

  return (
    <div className={`${themeClass(c.track.color)} space-y-8`}>
      <Link href={`/manage/tracks/${c.trackId}`} className="inline-flex items-center gap-2 text-label-md text-primary-container hover:underline">
        <ArrowBackIcon className="h-4 w-4" aria-hidden />
        วิชาในสายงาน {c.track.nameTh}
      </Link>
      <PageHeader title={c.title} description={c.courseCode ? `${c.courseCode}${c.curriculumName ? ` · ${c.curriculumName}` : ""}` : "วิชาเสริม (ไม่ได้ผูกรหัสวิชาในหลักสูตร)"} />

      <Tabs<Tab>
        tabs={[
          { id: "content", label: "หัวข้อและวิดีโอ", count: c.topics.length },
          { id: "quiz", label: "แบบทดสอบ", count: qs.length },
          { id: "settings", label: "ตั้งค่าวิชา" },
        ]}
        active={tab}
        onChange={(t) => {
          setTab(t);
          setFormError(null);
        }}
      />
      {formError && !dialog && tab !== "settings" && <Alert tone="error">{formError.message}</Alert>}

      {tab === "content" && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => setDialog({ kind: "topic", id: null, title: "", description: "" })} className={primaryButtonClass}>
              <AddIcon className="h-4 w-4" aria-hidden />
              เพิ่มหัวข้อ
            </button>
          </div>
          {c.topics.length === 0 && (
            <div className={`${cardClass} px-6 py-10 text-center text-body-md text-on-surface-variant`}>ยังไม่มีหัวข้อ — เพิ่มหัวข้อแรก แล้วเพิ่มวิดีโอการสอนในหัวข้อ</div>
          )}
          {c.topics.map((t, ti) => (
            <div key={t.id} className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/40 px-6 py-4">
                <div>
                  <p className="text-label-sm text-on-surface-variant tabular-nums">หัวข้อที่ {ti + 1}</p>
                  <h2 className="text-body-lg font-semibold text-on-surface">{t.title}</h2>
                  {t.description && <p className="text-body-md text-on-surface-variant">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={secondaryButtonClass}
                    onClick={() => setDialog({ kind: "video", id: null, topicId: t.id, title: "", videoUrl: "", minutes: "", seconds: "" })}
                  >
                    เพิ่มวิดีโอ
                  </button>
                  <button type="button" className={iconButtonClass} aria-label={`แก้ไขหัวข้อ ${t.title}`} onClick={() => setDialog({ kind: "topic", id: t.id, title: t.title, description: t.description })}>
                    <EditIcon className="h-5 w-5" />
                  </button>
                  <button type="button" className={iconDangerButtonClass} aria-label={`ลบหัวข้อ ${t.title}`} onClick={() => setDeleting({ kind: "topic", id: t.id, label: `หัวข้อ ${t.title}` })}>
                    <DeleteIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-outline-variant/40">
                {t.videos.length === 0 && <li className="px-6 py-4 text-body-md text-on-surface-variant">ยังไม่มีวิดีโอในหัวข้อนี้</li>}
                {t.videos.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-md text-on-surface">{v.title}</span>
                      <span className="block break-words text-label-sm text-on-surface-variant">{v.videoUrl}</span>
                    </span>
                    <span className="text-label-sm text-on-surface-variant tabular-nums">{formatDuration(v.durationSeconds)}</span>
                    <button
                      type="button"
                      className={iconButtonClass}
                      aria-label={`แก้ไขวิดีโอ ${v.title}`}
                      onClick={() =>
                        setDialog({
                          kind: "video",
                          id: v.id,
                          topicId: t.id,
                          title: v.title,
                          videoUrl: v.videoUrl ?? "",
                          minutes: String(Math.floor(v.durationSeconds / 60)),
                          seconds: String(v.durationSeconds % 60),
                        })
                      }
                    >
                      <EditIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className={iconDangerButtonClass} aria-label={`ลบวิดีโอ ${v.title}`} onClick={() => setDeleting({ kind: "video", id: v.id, label: `วิดีโอ ${v.title}` })}>
                      <DeleteIcon className="h-5 w-5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {tab === "quiz" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-body-md text-on-surface-variant">
              ผู้เรียนต้องตอบถูกอย่างน้อย <strong className="text-on-surface tabular-nums">{Math.min(c.quizPassCount, qs.length || c.quizPassCount)}</strong> จาก{" "}
              <span className="tabular-nums">{qs.length}</span> ข้อ จึงจะผ่านและเรียนวิชาถัดไปได้ (แก้ได้ที่แท็บตั้งค่าวิชา)
            </p>
            <button
              type="button"
              onClick={() => setDialog({ kind: "question", id: null, prompt: "", explanation: "", choices: [0, 1, 2, 3].map((i) => ({ label: "", isCorrect: i === 0 })) })}
              className={primaryButtonClass}
            >
              <AddIcon className="h-4 w-4" aria-hidden />
              เพิ่มคำถาม
            </button>
          </div>
          {qs.length === 0 ? (
            <div className={`${cardClass} px-6 py-10 text-center text-body-md text-on-surface-variant`}>
              ยังไม่มีคำถาม — วิชาที่ไม่มีแบบทดสอบจะผ่านเมื่อดูวิดีโอครบ
            </div>
          ) : (
            <ol className="space-y-3">
              {qs.map((q, i) => (
                <li key={q.id} className={`${cardClass} p-5`}>
                  <div className="flex items-start gap-3">
                    <p className="min-w-0 flex-1 text-body-md text-on-surface">
                      <span className="tabular-nums">{i + 1}.</span> {q.prompt}
                    </p>
                    <button
                      type="button"
                      className={iconButtonClass}
                      aria-label={`แก้ไขคำถามข้อ ${i + 1}`}
                      onClick={() => setDialog({ kind: "question", id: q.id, prompt: q.prompt, explanation: q.explanation, choices: q.choices.map((ch) => ({ label: ch.label, isCorrect: ch.isCorrect })) })}
                    >
                      <EditIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className={iconDangerButtonClass} aria-label={`ลบคำถามข้อ ${i + 1}`} onClick={() => setDeleting({ kind: "question", id: q.id, label: `คำถามข้อ ${i + 1}` })}>
                      <DeleteIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <ul className="mt-3 grid gap-2 md:grid-cols-2">
                    {q.choices.map((ch) => (
                      <li key={ch.id} className={`rounded-lg px-3 py-2 text-body-md ${ch.isCorrect ? "bg-success/10 text-emerald-700" : "bg-surface text-on-surface-variant"}`}>
                        {ch.isCorrect ? "คำตอบที่ถูก: " : ""}
                        {ch.label}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {tab === "settings" && (
        <section className={`${cardClass} max-w-2xl p-6`}>
          <CourseForm
            value={settingsValue}
            onChange={setSettings}
            onSubmit={saveSettings}
            onCancel={() => {
              setSettings(null);
              setFormError(null);
            }}
            saving={saving}
            error={formError}
            questionCount={qs.length}
          />
        </section>
      )}

      {dialog && (
        <Modal
          title={
            dialog.kind === "topic" ? (dialog.id ? "แก้ไขหัวข้อ" : "เพิ่มหัวข้อ") : dialog.kind === "video" ? (dialog.id ? "แก้ไขวิดีโอ" : "เพิ่มวิดีโอการสอน") : dialog.id ? "แก้ไขคำถาม" : "เพิ่มคำถาม"
          }
          onClose={() => setDialog(null)}
        >
          <form onSubmit={saveDialog} noValidate className="max-h-96 space-y-4 overflow-y-auto pr-1">
            <p className="text-label-sm text-on-surface-variant">ช่องที่มี * จำเป็นต้องกรอก</p>
            {dialog.kind === "topic" && (
              <>
                <Field id="topic-title" label="ชื่อหัวข้อ" required error={err("title")}>
                  <input id="topic-title" className={inputClass} value={dialog.title} onChange={(e) => setDialog({ ...dialog, title: e.target.value })} aria-required aria-describedby={describedBy("topic-title", err("title"))} />
                </Field>
                <Field id="topic-description" label="คำอธิบาย" error={err("description")}>
                  <textarea id="topic-description" rows={3} className={inputClass} value={dialog.description} onChange={(e) => setDialog({ ...dialog, description: e.target.value })} />
                </Field>
              </>
            )}
            {dialog.kind === "video" && (
              <>
                <Field id="video-title" label="ชื่อวิดีโอ" required error={err("title")}>
                  <input id="video-title" className={inputClass} value={dialog.title} onChange={(e) => setDialog({ ...dialog, title: e.target.value })} aria-required aria-describedby={describedBy("video-title", err("title"))} />
                </Field>
                <Field id="video-url" label="ลิงก์วิดีโอ" required hint="ลิงก์ YouTube หรือไฟล์วิดีโอ (.mp4) ที่ขึ้นต้นด้วย https://" error={err("videoUrl")}>
                  <input id="video-url" type="url" inputMode="url" className={inputClass} value={dialog.videoUrl} onChange={(e) => setDialog({ ...dialog, videoUrl: e.target.value })} aria-required aria-describedby={describedBy("video-url", err("videoUrl"), "hint")} />
                </Field>
                <Field id="video-minutes" label="ความยาววิดีโอ" required hint="ใช้คิดเวลาเรียนขั้นต่ำ — ผู้เรียนต้องดูจริงตามเวลานี้" error={err("durationSeconds")}>
                  <div className="flex items-center gap-2">
                    <input id="video-minutes" type="number" min={0} aria-label="นาที" className={inputClass} value={dialog.minutes} onChange={(e) => setDialog({ ...dialog, minutes: e.target.value })} aria-describedby={describedBy("video-minutes", err("durationSeconds"), "hint")} />
                    <span className="text-body-md text-on-surface-variant">นาที</span>
                    <input type="number" min={0} max={59} aria-label="วินาที" className={inputClass} value={dialog.seconds} onChange={(e) => setDialog({ ...dialog, seconds: e.target.value })} />
                    <span className="text-body-md text-on-surface-variant">วินาที</span>
                  </div>
                </Field>
              </>
            )}
            {dialog.kind === "question" && (
              <>
                <Field id="question-prompt" label="คำถาม" required error={err("prompt")}>
                  <textarea id="question-prompt" rows={3} className={inputClass} value={dialog.prompt} onChange={(e) => setDialog({ ...dialog, prompt: e.target.value })} aria-required aria-describedby={describedBy("question-prompt", err("prompt"))} />
                </Field>
                <fieldset className="space-y-2" aria-describedby={err("choices") ? "choices-error" : undefined}>
                  <legend className="mb-2 text-label-md text-on-surface">
                    ตัวเลือก (เลือกคำตอบที่ถูก 1 ข้อ) <span className="text-error" aria-hidden>*</span>
                  </legend>
                  {dialog.choices.map((ch, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct-choice"
                        checked={ch.isCorrect}
                        aria-label={`ตัวเลือกที่ ${i + 1} เป็นคำตอบที่ถูก`}
                        onChange={() => setDialog({ ...dialog, choices: dialog.choices.map((x, j) => ({ ...x, isCorrect: j === i })) })}
                        className="h-4 w-4 shrink-0 accent-primary-container"
                      />
                      <input
                        aria-label={`ตัวเลือกที่ ${i + 1}`}
                        className={inputClass}
                        value={ch.label}
                        onChange={(e) => setDialog({ ...dialog, choices: dialog.choices.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                      />
                    </div>
                  ))}
                  {err("choices") && (
                    <p id="choices-error" className="text-label-sm text-error">
                      {err("choices")}
                    </p>
                  )}
                </fieldset>
                <Field id="question-explanation" label="คำอธิบายเฉลย" hint="แสดงให้ผู้เรียนเห็นหลังทำแบบทดสอบผ่าน" error={err("explanation")}>
                  <textarea id="question-explanation" rows={2} className={inputClass} value={dialog.explanation} onChange={(e) => setDialog({ ...dialog, explanation: e.target.value })} />
                </Field>
              </>
            )}
            {formError && !formError.field && <p className="text-label-sm text-error">{formError.message}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setDialog(null)} className={secondaryButtonClass}>
                ยกเลิก
              </button>
              <SaveButton saving={saving} />
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal title={`ลบ${deleting.label}?`} confirmLabel="ลบ" danger busy={saving} onConfirm={remove} onClose={() => setDeleting(null)}>
          <p>
            {deleting.kind === "topic"
              ? "วิดีโอทั้งหมดในหัวข้อนี้และเวลาเรียนของผู้เรียนจะถูกลบถาวร"
              : deleting.kind === "video"
                ? "เวลาเรียนของผู้เรียนในวิดีโอนี้จะถูกลบถาวร"
                : "คำถามนี้จะถูกลบถาวร ผลสอบเดิมของผู้เรียนยังอยู่"}
          </p>
        </ConfirmModal>
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
