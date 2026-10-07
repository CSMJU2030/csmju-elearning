"use client";

import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { PageHeader, StatusBadge, cardClass, tdClass, thClass } from "@/csmju";
import { formatNumber } from "@/lib/format";
import { themeClass } from "@/lib/tracks";
import { useApi } from "@/lib/use-api";
import type { TrackStatistic } from "@/lib/types";

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={`${cardClass} flex h-40 flex-col justify-between p-6`}>
      <p className="text-label-md text-on-surface-variant">{label}</p>
      <p className="font-display text-display-lg tabular-nums text-primary-container">{value}</p>
      <p className="text-label-sm text-secondary">{note}</p>
    </div>
  );
}

/** แผนภูมิแท่งแนวนอน — ตัวเลขกำกับทุกแท่ง ไม่สื่อด้วยสีอย่างเดียว */
function Bars({ rows, value, label }: { rows: TrackStatistic[]; value: (r: TrackStatistic) => number; label: (r: TrackStatistic) => string }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.trackId} className={themeClass(r.color)}>
          <div className="mb-1 flex items-center justify-between gap-3 text-body-md">
            <span className="text-on-surface" lang="en">
              {r.nameEn}
            </span>
            <span className="text-label-md text-on-surface-variant tabular-nums">{label(r)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container" aria-hidden>
            <div
              className="progress-fill h-full rounded-full bg-btn-gradient"
              style={{ "--progress": `${(value(r) / max) * 100}%` } as React.CSSProperties}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardView() {
  const { data, error, loading, reload } = useApi<TrackStatistic[]>("/track-statistics?limit=100");

  if (loading && !data) return <PageSkeleton rows={3} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const rows = data ?? [];
  const total = rows.reduce((n, r) => n + r.enrollmentCount, 0);
  const active = rows.reduce((n, r) => n + r.activeCount, 0);
  const completed = rows.reduce((n, r) => n + r.completedCount, 0);
  const withdrawn = rows.reduce((n, r) => n + r.withdrawnCount, 0);
  const pct = (part: number) => (total === 0 ? "0%" : `${Math.round((part / total) * 1000) / 10}%`);

  return (
    <>
      <PageHeader title="แดชบอร์ด" description="สายงานยอดนิยม อัตราเรียนจบ และอัตราออกจากสายงาน นับจากการสมัครเรียนทั้งหมด" />

      <div className="fade-slide-up stagger-1 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="การสมัครเรียนทั้งหมด" value={formatNumber(total)} note={`กำลังเรียน ${formatNumber(active)} คน`} />
        <StatCard label="เรียนจบ" value={formatNumber(completed)} note={`อัตราเรียนจบเฉลี่ย ${pct(completed)}`} />
        <StatCard label="ออกจากสายงาน" value={formatNumber(withdrawn)} note={`อัตราออกเฉลี่ย ${pct(withdrawn)}`} />
        <StatCard label="สายงาน" value={formatNumber(rows.length)} note={`เผยแพร่อยู่ ${rows.filter((r) => r.isPublished).length} สายงาน`} />
      </div>

      {total === 0 ? (
        <EmptyState title="ยังไม่มีผู้สมัครเรียน" description="สถิติจะแสดงเมื่อมีผู้เรียนสมัครสายงานแรก" />
      ) : (
        <div className="grid gap-8 xl:grid-cols-2">
          <section className={`${cardClass} p-6`} aria-labelledby="popular-heading">
            <h2 id="popular-heading" className="mb-6 font-display text-headline-md text-on-surface">
              สายงานยอดนิยม
            </h2>
            <Bars rows={rows} value={(r) => r.enrollmentCount} label={(r) => `${formatNumber(r.enrollmentCount)} คน`} />
          </section>
          <section className={`${cardClass} p-6`} aria-labelledby="completion-heading">
            <h2 id="completion-heading" className="mb-6 font-display text-headline-md text-on-surface">
              อัตราเรียนจบ
            </h2>
            <Bars
              rows={[...rows].sort((a, b) => b.completionRate - a.completionRate)}
              value={(r) => r.completionRate}
              label={(r) => `${r.completionRate}% (${formatNumber(r.completedCount)} คน)`}
            />
          </section>
        </div>
      )}

      <section className={cardClass} aria-labelledby="table-heading">
        <div className="border-b border-outline-variant/40 px-6 py-5">
          <h2 id="table-heading" className="font-display text-headline-md text-on-surface">
            รายละเอียดรายสายงาน
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface text-label-md text-on-surface-variant">
                <th className={thClass}>สายงาน</th>
                <th className={`${thClass} text-right`}>สมัคร</th>
                <th className={`${thClass} text-right`}>กำลังเรียน</th>
                <th className={`${thClass} text-right`}>เรียนจบ</th>
                <th className={`${thClass} text-right`}>ออก</th>
                <th className={`${thClass} text-right`}>อัตราเรียนจบ</th>
                <th className={`${thClass} text-right`}>อัตราออก</th>
                <th className={`${thClass} text-right`}>เวลาเฉลี่ยที่ใช้เรียนจบ</th>
              </tr>
            </thead>
            <tbody className="text-body-md">
              {rows.map((r) => (
                <tr key={r.trackId} className="border-b border-outline-variant/40 last:border-0 hover:bg-surface/50">
                  <td className={`${tdClass} font-medium text-on-surface`}>
                    <span className="block" lang="en">
                      {r.nameEn}
                    </span>
                    {!r.isPublished && <StatusBadge tone="neutral" label="ยังไม่เผยแพร่" />}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatNumber(r.enrollmentCount)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatNumber(r.activeCount)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatNumber(r.completedCount)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{formatNumber(r.withdrawnCount)}</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{r.completionRate}%</td>
                  <td className={`${tdClass} text-right tabular-nums`}>{r.withdrawRate}%</td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    {r.averageDaysToComplete === null ? "—" : `${r.averageDaysToComplete} วัน`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
