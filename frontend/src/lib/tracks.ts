import type { Me, TrackColor } from "./types";

/** class ธีมของแต่ละสายงาน (src/styles/track-themes.css) */
export const TRACK_THEME_CLASS: Record<TrackColor, string> = {
  BLUE: "",
  PURPLE: "track-theme-purple",
  RED: "track-theme-red",
  YELLOW: "track-theme-yellow",
  TEAL: "track-theme-teal",
};

/** ชื่อสีภาษาไทย — แสดงคู่กับสีเสมอ ไม่สื่อความหมายด้วยสีอย่างเดียว */
export const TRACK_COLOR_LABEL: Record<TrackColor, string> = {
  BLUE: "สีฟ้า",
  PURPLE: "สีม่วง",
  RED: "สีแดง",
  YELLOW: "สีเหลือง",
  TEAL: "สีเขียวน้ำทะเล",
};

export const TRACK_COLORS = Object.keys(TRACK_THEME_CLASS) as TrackColor[];

export function themeClass(color: TrackColor | null | undefined): string {
  return color ? TRACK_THEME_CLASS[color] : "";
}

/** คำเรียก core role มาตรฐาน (ui-design-system.md ข้อ 10.3) */
export const CORE_ROLE_LABEL: Record<Me["coreRole"], string> = {
  student: "นักศึกษา",
  alumni: "ศิษย์เก่า",
  staff: "บุคลากร/อาจารย์",
  lecturer: "บุคลากร/อาจารย์",
  guest: "ผู้เยี่ยมชม",
  admin: "ผู้ดูแลระบบ",
};

export function can(me: Pick<Me, "permissions"> | null | undefined, ...permissions: string[]): boolean {
  return Boolean(me && permissions.some((p) => me.permissions.includes(p)));
}

export function initialsOf(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name ?? email ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
