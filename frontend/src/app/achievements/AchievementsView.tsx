"use client";

import Link from "next/link";

import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { CheckIcon, PageHeader, cardClass, primaryButtonClass } from "@/csmju";
import { formatDate } from "@/lib/format";
import { themeClass } from "@/lib/tracks";
import { useApi } from "@/lib/use-api";
import type { CertificateListItem } from "@/lib/types";

/** เมนูความสำเร็จ — เกียรติบัตรของสายงานที่เรียนจบ ดาวน์โหลดได้ */
export default function AchievementsView() {
  const { data, error, loading, reload } = useApi<CertificateListItem[]>("/certificates?limit=100");

  return (
    <>
      <PageHeader title="ความสำเร็จ" description="เกียรติบัตรจากสายงานที่คุณเรียนจบ เปิดดูและดาวน์โหลดได้ทุกเมื่อ" />
      {loading && !data ? (
        <PageSkeleton rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="ยังไม่มีเกียรติบัตร"
          description="เรียนครบทุกวิชาในสายงานและทำแบบทดสอบผ่าน แล้วเกียรติบัตรจะมาอยู่ที่นี่"
          action={
            <Link href="/" className={primaryButtonClass}>
              เลือกสายงาน
            </Link>
          }
        />
      ) : (
        <ul className="fade-slide-up grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <li key={c.id} className={`${themeClass(c.track.color)} ${cardClass} flex flex-col`}>
              <div className="bg-btn-gradient flex items-center gap-3 px-6 py-5 text-white">
                <span className="rounded-lg bg-white/15 p-2" aria-hidden>
                  <CheckIcon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-label-sm text-white/80">เกียรติบัตรสายงาน</p>
                  <p className="font-display text-headline-md" lang="en">
                    {c.track.nameEn}
                  </p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-6">
                <p className="text-body-md text-on-surface">{c.track.nameTh}</p>
                <p className="text-label-sm text-on-surface-variant">ได้รับเมื่อ {formatDate(c.issuedAt, "long")}</p>
                <p className="text-caption text-on-surface-variant tabular-nums">เลขที่ {c.certificateNo}</p>
                <Link href={`/certificates/${c.id}`} className={`${primaryButtonClass} mt-4`}>
                  เปิดดูและดาวน์โหลด
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
