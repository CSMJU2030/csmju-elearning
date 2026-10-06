"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { DescriptionIcon, LockIcon, cardClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import { ApiError, signInHref } from "@/lib/api";

/**
 * สถานะหน้าจอมาตรฐาน (ui-design-system.md ข้อ 9) — local component ชั่วคราวจนกว่า design system จะมี
 * EmptyState / ErrorState / Skeleton ของกลาง
 */

export function Skeleton({ className = "h-6" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-surface-container ${className}`} />;
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-8">
      <span className="sr-only">กำลังโหลดข้อมูล...</span>
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`${cardClass} space-y-4 p-6`}>
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={`${cardClass} px-6 py-12 text-center`}>
      <DescriptionIcon className="mx-auto mb-3 h-10 w-10 text-outline" aria-hidden />
      <p className="text-body-lg text-on-surface">{title}</p>
      <p className="mt-1 text-body-md text-on-surface-variant">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/** แปลง error.code เป็นหน้าจอตามตารางข้อ 9.3 — ห้ามแสดงข้อความดิบจาก exception */
export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  if (error.code === "UNAUTHORIZED") {
    return (
      <div role="alert" className={`${cardClass} px-6 py-12 text-center`}>
        <LockIcon className="mx-auto mb-3 h-10 w-10 text-outline" aria-hidden />
        <h2 className="font-display text-headline-md text-on-surface">กรุณาเข้าสู่ระบบ</h2>
        <p className="mt-2 text-body-md text-on-surface-variant">เข้าสู่ระบบด้วยบัญชีของ CSMJU Portal เพื่อเรียนต่อ</p>
        <a href={signInHref()} className={`${primaryButtonClass} mx-auto mt-6 w-fit`}>
          เข้าสู่ระบบอีกครั้ง
        </a>
      </div>
    );
  }
  if (error.code === "FORBIDDEN") {
    return (
      <div role="alert" className={`${cardClass} px-6 py-12 text-center`}>
        <LockIcon className="mx-auto mb-3 h-10 w-10 text-outline" aria-hidden />
        <h2 className="font-display text-headline-md text-on-surface">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="mt-2 text-body-md text-on-surface-variant">
          คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลระบบย่อยนี้
        </p>
        <Link href="/" className={`${secondaryButtonClass} mt-6 inline-block`}>
          กลับหน้าหลัก
        </Link>
      </div>
    );
  }
  if (error.code === "NOT_FOUND") {
    return (
      <EmptyState
        title="ไม่พบข้อมูลที่คุณกำลังค้นหา"
        description="อาจถูกลบไปแล้วหรือลิงก์ไม่ถูกต้อง"
        action={
          <Link href="/" className={secondaryButtonClass}>
            กลับหน้าหลัก
          </Link>
        }
      />
    );
  }
  const message =
    error.code === "NETWORK"
      ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง"
      : error.code === "TOO_MANY_REQUESTS"
        ? "มีการใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
        : error.code === "SERVICE_UNAVAILABLE"
          ? "ระบบกลางไม่พร้อมใช้งานชั่วคราว กรุณาลองอีกครั้งในอีกสักครู่"
          : "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง หากยังพบปัญหา กรุณาแจ้งผู้ดูแลระบบ";
  return (
    <div role="alert" className={`${cardClass} px-6 py-12 text-center`}>
      <h2 className="font-display text-headline-md text-on-surface">โหลดข้อมูลไม่สำเร็จ</h2>
      <p className="mt-2 text-body-md text-on-surface-variant">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${primaryButtonClass} mx-auto mt-6`}>
          ลองอีกครั้ง
        </button>
      )}
    </div>
  );
}

/** ข้อความแจ้งผลแบบ inline (ข้อ 8.4) */
export function Alert({ tone, children }: { tone: "error" | "success" | "info" | "warning"; children: ReactNode }) {
  const style = {
    error: "bg-error-container text-on-error-container",
    success: "bg-success/10 text-emerald-700",
    info: "bg-primary-container/10 text-primary-container",
    warning: "bg-amber-100 text-amber-800",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-body-md ${style}`}>
      {children}
    </div>
  );
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-label-sm text-on-surface-variant">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-container"
      >
        <div
          className="progress-fill h-full rounded-full bg-btn-gradient"
          style={{ "--progress": `${value}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

/** ข้อความแจ้งสำเร็จที่หายเองใน 4 วินาที (ข้อ 8.4) */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  return (
    <div className="fixed right-4 top-20 z-50 max-w-sm" role="status" aria-live="polite">
      <div className="fade-slide-up flex items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 shadow-xl">
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden />
        <p className="text-body-md text-on-surface">{message}</p>
        <ToastTimer onDone={onDone} />
      </div>
    </div>
  );
}


function ToastTimer({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return null;
}
