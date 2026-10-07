import { cookies } from "next/headers";

import type { LearnerProfile, Me } from "./types";

/**
 * อ่านตัวตนของผู้ใช้ฝั่ง server (layout) จาก backend ของระบบนี้ — ส่งต่อคุกกี้ session ของผู้ใช้ไปตรง ๆ
 * ไม่อ่าน token เอง ไม่เรียก Core Hub ตรง · ไม่สำเร็จ (ยังไม่ login / backend ล่ม) = null แล้วหน้าเว็บจัดการเอง
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:4212";

async function get<T>(path: string, cookieHeader: string): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
      headers: { cookie: cookieHeader, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { success?: boolean; data?: T };
    return body.success ? (body.data ?? null) : null;
  } catch {
    return null;
  }
}

export async function loadSession(): Promise<{ me: Me | null; profile: LearnerProfile | null }> {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
  if (!cookieHeader) return { me: null, profile: null };
  const me = await get<Me>("/me", cookieHeader);
  if (!me) return { me: null, profile: null };
  const profile = await get<LearnerProfile>("/learner-profile", cookieHeader);
  return { me, profile };
}
