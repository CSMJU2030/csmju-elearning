"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";

import CertificateView, { downloadCertificatePng } from "@/components/CertificateView";
import { Alert, ErrorState, PageSkeleton } from "@/components/states";
import { ArrowBackIcon, cardClass, primaryButtonClass, secondaryButtonClass } from "@/csmju";
import { themeClass } from "@/lib/tracks";
import { useApi } from "@/lib/use-api";
import type { CertificateDetail } from "@/lib/types";

export default function CertificatePageView({ id }: { id: string }) {
  const params = useSearchParams();
  const isNew = params.get("new") === "1";
  const cert = useApi<CertificateDetail>(`/certificates/${id}`);
  const svgRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cert.loading && !cert.data) return <PageSkeleton rows={1} />;
  if (cert.error) return <ErrorState error={cert.error} onRetry={cert.reload} />;
  const c = cert.data;
  if (!c) return null;

  async function download() {
    if (!svgRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await downloadCertificatePng(svgRef.current, `${c!.certificateNo}.png`);
    } catch {
      setError("สร้างไฟล์รูปไม่สำเร็จ ลองใช้ปุ่มพิมพ์ / บันทึกเป็น PDF แทน");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${themeClass(c.track.color)} space-y-8`}>
      <Link href="/achievements" className="inline-flex items-center gap-2 text-label-md text-primary-container hover:underline">
        <ArrowBackIcon className="h-4 w-4" aria-hidden />
        ความสำเร็จ
      </Link>

      {isNew && (
        <Alert tone="success">
          ยินดีด้วย คุณเรียนจบสายงาน {c.track.nameTh} แล้ว คุณถูกเพิ่มในรายชื่อผู้เรียนจบของสายงานนี้ และสมัครเรียนสายงานอื่นต่อได้
        </Alert>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-lg text-on-surface">เกียรติบัตร</h1>
          <p className="text-body-md text-on-surface-variant">
            {c.track.nameEn} · เลขที่ <span className="tabular-nums">{c.certificateNo}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => window.print()} className={secondaryButtonClass}>
            พิมพ์ / บันทึกเป็น PDF
          </button>
          <button type="button" onClick={download} disabled={busy} aria-busy={busy} className={`${primaryButtonClass} relative ${busy ? "btn-loading" : ""}`}>
            <span className="btn-text">ดาวน์โหลด PNG</span>
            <span className="dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className={`${cardClass} print-area p-4 md:p-8`}>
        <CertificateView ref={svgRef} certificate={c} />
      </div>
      {!c.isMine && (
        <p className="text-label-sm text-on-surface-variant">คุณกำลังดูเกียรติบัตรของผู้เรียนรหัส {c.personCode ?? "—"} ในฐานะผู้ดูแล</p>
      )}
    </div>
  );
}
