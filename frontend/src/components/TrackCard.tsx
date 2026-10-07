import Link from "next/link";

import { ArrowForwardIcon, SchoolIcon, StatusBadge, cardClass } from "@/csmju";
import { formatNumber } from "@/lib/format";
import { TRACK_COLOR_LABEL, themeClass } from "@/lib/tracks";
import type { TrackListItem } from "@/lib/types";

/** การ์ดสายงาน — แต่ละใบใช้สีของสายงานตัวเอง */
export default function TrackCard({ track }: { track: TrackListItem }) {
  return (
    <article className={`${themeClass(track.color)} ${cardClass} flex flex-col transition-shadow hover:shadow-md`}>
      <div className="bg-btn-gradient flex items-start justify-between gap-4 px-6 py-5 text-white">
        <div className="min-w-0">
          <p className="text-label-sm text-white/80">
            {TRACK_COLOR_LABEL[track.color]}
            {!track.isPublished && " · ยังไม่เผยแพร่"}
          </p>
          <h2 className="mt-1 font-display text-headline-md" lang="en">
            {track.nameEn}
          </h2>
          <p className="text-body-md text-white/90">{track.nameTh}</p>
        </div>
        <span className="rounded-lg bg-white/15 p-2.5" aria-hidden>
          <SchoolIcon className="h-6 w-6" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <p className="text-body-md text-on-surface-variant">{track.summary}</p>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface px-2 py-3">
            <dt className="text-label-sm text-on-surface-variant">วิชา</dt>
            <dd className="font-display text-headline-md tabular-nums text-primary-container">{formatNumber(track.courseCount)}</dd>
          </div>
          <div className="rounded-lg bg-surface px-2 py-3">
            <dt className="text-label-sm text-on-surface-variant">กำลังเรียน</dt>
            <dd className="font-display text-headline-md tabular-nums text-primary-container">{formatNumber(track.learnerCount)}</dd>
          </div>
          <div className="rounded-lg bg-surface px-2 py-3">
            <dt className="text-label-sm text-on-surface-variant">เรียนจบ</dt>
            <dd className="font-display text-headline-md tabular-nums text-primary-container">{formatNumber(track.graduateCount)}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
          {track.myStatus === "ACTIVE" ? (
            <StatusBadge tone="info" label="กำลังเรียนอยู่" />
          ) : track.myStatus === "COMPLETED" ? (
            <StatusBadge tone="success" label="เรียนจบแล้ว" />
          ) : (
            <span />
          )}
          <Link
            href={`/tracks/${track.id}`}
            aria-label={`ดูรายละเอียดสายงาน ${track.nameTh}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-container/10 px-4 py-2.5 text-label-md text-primary-container transition-colors hover:bg-primary-container/20"
          >
            ดูรายละเอียด
            <ArrowForwardIcon className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
