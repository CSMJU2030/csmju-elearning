"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { CheckIcon, SchoolIcon, primaryButtonClass } from "@/csmju";
import { signInHref } from "@/lib/api";
import { CORE_ROLE_LABEL, initialsOf, themeClass } from "@/lib/tracks";
import { ProgressBar } from "./states";
import { useSession } from "./session";

/**
 * โปรไฟล์ผู้ใช้มุมบนขวาของพื้นที่เนื้อหา — กดแล้วเห็นสายงานที่กำลังเรียน สายงานที่จบแล้ว และทางไปเมนูความสำเร็จ
 * (ปุ่มผู้ใช้ใน CsmjuAppShell ยังไม่มีเมนูให้ต่อ — ทำเป็น local component ตาม ui-design-system ข้อ 17.0)
 */
export default function LearnerBar() {
  const { me, profile } = useSession();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!me) {
    return (
      <div className="flex justify-end">
        <a href={signInHref()} className={primaryButtonClass}>
          เข้าสู่ระบบ
        </a>
      </div>
    );
  }

  const active = profile?.activeEnrollment ?? null;
  const completed = profile?.completedTracks ?? [];
  const name = profile?.fullNameTh ?? me.email ?? "ผู้ใช้";

  return (
    <div ref={wrapRef} className="relative flex flex-wrap items-center justify-end gap-3">
      {active ? (
        <Link
          href={`/tracks/${active.track.id}`}
          className="inline-flex items-center gap-2 rounded-full bg-primary-container/10 px-3 py-1.5 text-label-md text-primary-container transition-colors hover:bg-primary-container/20"
        >
          <span className="h-2 w-2 rounded-full bg-primary-container" aria-hidden />
          กำลังเรียน: {active.track.nameEn}
          <span className="tabular-nums">{active.percent}%</span>
        </Link>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full bg-surface-variant px-3 py-1.5 text-label-md text-on-surface-variant">
          <span className="h-2 w-2 rounded-full bg-outline" aria-hidden />
          ยังไม่ได้เลือกสายงาน
        </span>
      )}

      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="เปิดโปรไฟล์ของฉัน"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full p-1 pr-3 transition-colors hover:bg-surface-variant/50"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-label-md text-white shadow-sm">
          {initialsOf(profile?.fullNameTh, me.email)}
        </span>
        <span className="hidden text-left md:block">
          <span className="block text-label-md text-on-surface">{name}</span>
          <span className="block text-caption text-on-surface-variant">{CORE_ROLE_LABEL[me.coreRole]}</span>
        </span>
      </button>

      {open && (
        <div
          id={panelId}
          className="fade-slide-up absolute right-0 top-full z-30 mt-2 w-80 max-w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-5 shadow-xl"
        >
          <p className="text-label-md text-on-surface">{name}</p>
          <p className="text-caption text-on-surface-variant">
            {CORE_ROLE_LABEL[me.coreRole]}
            {profile?.personCode ? ` · ${profile.personCode}` : ""}
          </p>

          <div className="mt-4 border-t border-outline-variant/40 pt-4">
            <p className="mb-2 text-label-sm text-on-surface-variant">สถานะการเรียน</p>
            {active ? (
              <div className={`${themeClass(active.track.color)} space-y-2`}>
                <p className="text-body-md text-on-surface">{active.track.nameTh}</p>
                <ProgressBar
                  percent={active.percent}
                  label={`ผ่านแล้ว ${active.coursesPassed} จาก ${active.courseCount} วิชา`}
                />
              </div>
            ) : (
              <p className="text-body-md text-on-surface-variant">ยังไม่ได้สมัครเรียนสายงานใด</p>
            )}
          </div>

          {completed.length > 0 && (
            <div className="mt-4 border-t border-outline-variant/40 pt-4">
              <p className="mb-2 text-label-sm text-on-surface-variant">เรียนจบแล้ว {completed.length} สายงาน</p>
              <ul className="space-y-1.5">
                {completed.map((c) => (
                  <li key={c.enrollmentId} className={`${themeClass(c.track.color)} flex items-center gap-2 text-body-md`}>
                    <CheckIcon className="h-4 w-4 shrink-0 text-primary-container" aria-hidden />
                    <span className="text-on-surface">{c.track.nameEn}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 border-t border-outline-variant/40 pt-4">
            <Link href="/profile" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-label-md text-on-surface hover:bg-surface-variant/50">
              <SchoolIcon className="h-4 w-4" aria-hidden />
              การเรียนของฉัน
            </Link>
            <Link href="/achievements" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-2 text-label-md text-on-surface hover:bg-surface-variant/50">
              <CheckIcon className="h-4 w-4" aria-hidden />
              ความสำเร็จ ({completed.length})
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
