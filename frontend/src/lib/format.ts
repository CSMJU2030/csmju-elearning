/**
 * รูปแบบแสดงผลภาษาไทย (ui-design-system.md ข้อ 11.3) — วันที่เป็น พ.ศ. · timezone Asia/Bangkok เสมอ
 * (ยังไม่มี util ของ @csmju2030/design-system — local util ชั่วคราว)
 */
const TZ = "Asia/Bangkok";

export function formatDate(value: string | Date | null | undefined, style: "short" | "long" = "short"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: TZ,
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const date = formatDate(d);
  const time = new Intl.DateTimeFormat("th-TH", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${date} ${time} น.`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

/** ความยาวเวลา เช่น 1 ชม. 5 นาที · 3 นาที 20 วินาที */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  if (m > 0) return sec > 0 ? `${m} นาที ${sec} วินาที` : `${m} นาที`;
  return `${sec} วินาที`;
}
