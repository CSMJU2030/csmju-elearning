"use client";

import TrackCard from "@/components/TrackCard";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/states";
import { PageHeader } from "@/csmju";
import { useApi } from "@/lib/use-api";
import type { TrackListItem } from "@/lib/types";

// หน้าแรก: สายงานหลักยอดนิยม 5 สายงาน — เลือกสายงานเพื่อดูวิชาที่ต้องเรียนและสมัครเรียน
export default function TracksPage() {
  const { data, error, loading, reload } = useApi<TrackListItem[]>("/tracks?limit=100");

  return (
    <>
      <PageHeader
        title="สายงานหลักยอดนิยม"
        description="เลือกสายงานในสาขาวิทยาการคอมพิวเตอร์ที่สนใจ เรียนวิชาตามลำดับ ทำแบบทดสอบให้ผ่าน แล้วรับเกียรติบัตร"
      />
      {loading && !data ? (
        <PageSkeleton rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data || data.length === 0 ? (
        <EmptyState title="ยังไม่มีสายงานให้เลือก" description="ผู้ดูแลระบบยังไม่ได้เผยแพร่สายงาน กรุณากลับมาใหม่ภายหลัง" />
      ) : (
        <div className="fade-slide-up stagger-1 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {data.map((t) => (
            <TrackCard key={t.id} track={t} />
          ))}
        </div>
      )}
    </>
  );
}
