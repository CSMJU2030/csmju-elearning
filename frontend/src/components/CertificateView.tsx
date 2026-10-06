"use client";

import { forwardRef } from "react";

import { formatDate } from "@/lib/format";
import { themeClass } from "@/lib/tracks";
import type { CertificateDetail } from "@/lib/types";

/** แทนค่า {name} {track} {date} {certificateNo} ในข้อความของเทมเพลต */
export function fillTemplate(text: string, c: Pick<CertificateDetail, "recipientName" | "certificateNo" | "issuedAt" | "track">) {
  return text
    .replaceAll("{name}", c.recipientName)
    .replaceAll("{track}", `${c.track.nameTh} (${c.track.nameEn})`)
    .replaceAll("{date}", formatDate(c.issuedAt, "long"))
    .replaceAll("{certificateNo}", c.certificateNo);
}

/** ตัดข้อความยาวเป็นหลายบรรทัดสำหรับ SVG (ภาษาไทยไม่มีเว้นวรรคทุกคำ จึงตัดตามช่องว่างก่อน แล้วค่อยตามความยาว) */
function wrap(text: string, max = 58): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
    while (line.length > max) {
      lines.push(line.slice(0, max));
      line = line.slice(max);
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/**
 * เกียรติบัตร A4 แนวนอน วาดด้วย SVG — สีจาก token ของระบบ (fill-* / stroke-*) และใช้สีของสายงาน
 * ใช้ทั้งหน้าดาวน์โหลดของผู้เรียนและตัวอย่างในหน้าจัดการเทมเพลต
 */
const CertificateView = forwardRef<SVGSVGElement, { certificate: CertificateDetail; logoHref?: string | null }>(
  function CertificateView({ certificate: c, logoHref = "/csmju-logo.png" }, ref) {
    const body = wrap(fillTemplate(c.template.bodyText, c));
    return (
      <div className={themeClass(c.track.color)}>
        <svg
          ref={ref}
          viewBox="0 0 1123 794"
          role="img"
          aria-label={`เกียรติบัตรของ ${c.recipientName} สายงาน ${c.track.nameTh}`}
          className="h-auto w-full rounded-xl shadow-sm"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="1123" height="794" className="fill-surface-container-lowest" />
          <rect x="24" y="24" width="1075" height="746" fill="none" className="stroke-primary-container" strokeWidth="6" rx="12" />
          <rect x="44" y="44" width="1035" height="706" fill="none" className="stroke-accent" strokeWidth="1.5" rx="8" />
          <rect x="24" y="24" width="1075" height="14" className="fill-primary-container" />

          {logoHref && <image href={logoHref} x="461" y="70" width="200" height="141" preserveAspectRatio="xMidYMid meet" />}

          <text x="561.5" y="270" textAnchor="middle" fontSize="54" fontWeight="700" className="fill-primary-container font-display">
            {c.template.heading}
          </text>
          <text x="561.5" y="318" textAnchor="middle" fontSize="20" className="fill-on-surface-variant font-body">
            สาขาวิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้
          </text>
          <text x="561.5" y="392" textAnchor="middle" fontSize="40" fontWeight="700" className="fill-on-surface font-body">
            {c.recipientName}
          </text>
          <line x1="311" y1="410" x2="812" y2="410" className="stroke-outline-variant" strokeWidth="1.5" />
          {body.map((line, i) => (
            <text key={i} x="561.5" y={452 + i * 34} textAnchor="middle" fontSize="21" className="fill-on-surface-variant font-body">
              {line}
            </text>
          ))}
          <text x="561.5" y="600" textAnchor="middle" fontSize="18" className="fill-secondary font-body">
            ให้ไว้ ณ วันที่ {formatDate(c.issuedAt, "long")}
          </text>

          {c.template.imageUrl && (
            <image href={c.template.imageUrl} x="701" y="614" width="220" height="56" preserveAspectRatio="xMidYMid meet" />
          )}
          <line x1="681" y1="676" x2="941" y2="676" className="stroke-outline" strokeWidth="1" />
          <text x="811" y="704" textAnchor="middle" fontSize="18" className="fill-on-surface font-body">
            {c.template.signerName}
          </text>
          <text x="811" y="730" textAnchor="middle" fontSize="15" className="fill-on-surface-variant font-body">
            {c.template.signerTitle}
          </text>

          <text x="90" y="704" fontSize="15" className="fill-on-surface-variant font-body">
            เลขที่ {c.certificateNo}
          </text>
          <text x="90" y="730" fontSize="15" className="fill-on-surface-variant font-body">
            CSMJU E-Learning
          </text>
        </svg>
      </div>
    );
  },
);

export default CertificateView;

/**
 * ดาวน์โหลดเป็น PNG วาดลง canvas · รูปจากโดเมนอื่น (ลายเซ็นใน Core Hub) ถูกตัดออกเพราะ canvas ส่งออกไม่ได้
 * (ใช้ปุ่มพิมพ์ / บันทึกเป็น PDF ถ้าต้องการรูปนั้นด้วย)
 */
export async function downloadCertificatePng(svg: SVGSVGElement, fileName: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // รูป SVG แยกไฟล์อ่าน CSS ของหน้าไม่ได้ — คัดลอกสี/ฟอนต์ที่คำนวณแล้วลงเป็น attribute
  const source = [svg, ...svg.querySelectorAll<SVGElement>("*")];
  const target = [clone, ...clone.querySelectorAll<SVGElement>("*")];
  source.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const t = target[i];
    if (!t) return;
    t.setAttribute("fill", cs.fill);
    t.setAttribute("stroke", cs.stroke);
    if (el.tagName === "text") {
      t.setAttribute("font-family", cs.fontFamily);
      t.setAttribute("font-weight", cs.fontWeight);
    }
    t.removeAttribute("class");
  });
  for (const img of clone.querySelectorAll("image")) {
    const href = img.getAttribute("href") ?? "";
    if (/^https?:/i.test(href) && !href.startsWith(window.location.origin)) {
      img.remove();
      continue;
    }
    try {
      const blob = await (await fetch(href)).blob();
      const dataUrl = await new Promise<string>((ok, fail) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result));
        r.onerror = fail;
        r.readAsDataURL(blob);
      });
      img.setAttribute("href", dataUrl);
    } catch {
      img.remove();
    }
  }
  clone.setAttribute("width", "2246");
  clone.setAttribute("height", "1588");

  const markup = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((ok, fail) => {
      image.onload = () => ok();
      image.onerror = () => fail(new Error("render failed"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 2246;
    canvas.height = 1588;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
    if (!png) throw new Error("no png");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(png);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
