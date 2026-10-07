import { ApiError } from "@/lib/api";

/** แปลง error จาก API เป็นข้อความของฟอร์ม — VALIDATION_ERROR ที่มี details.field แสดงใต้ช่องนั้น */
export function formErrorOf(e: unknown): { field?: string; message: string } {
  if (e instanceof ApiError) {
    if (e.code === "VALIDATION_ERROR") {
      const d = e.details as unknown;
      const first = Array.isArray(d) && typeof d[0] === "string" ? d[0] : null;
      return { field: e.field, message: first ?? e.message };
    }
    return { message: e.message };
  }
  return { message: "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง" };
}
