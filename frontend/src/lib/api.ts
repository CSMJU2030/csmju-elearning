"use client";

/**
 * เรียก API ของระบบนี้ (ผ่าน proxy /api/* ของ next.config.ts) — คุกกี้ session HttpOnly ไปเอง
 * ไม่มี token ใน JavaScript (auth-contract ข้อ 6.1)
 *
 * 401 = session หมด → พาทั้งหน้าไป /auth/login?next=<หน้าปัจจุบัน> (silent re-SSO · auth-contract ข้อ 7)
 * กันวน: ถ้าเพิ่งกลับจาก re-SSO ไม่ถึง 30 วินาทีแล้วยังได้ 401 อีก ไม่ redirect ซ้ำ (หน้าแสดงปุ่มเข้าสู่ระบบอีกครั้งแทน)
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get reason(): string | undefined {
    const d = this.details as { reason?: unknown } | undefined;
    return typeof d?.reason === "string" ? d.reason : undefined;
  }

  get field(): string | undefined {
    const d = this.details as { field?: unknown } | undefined;
    return typeof d?.field === "string" ? d.field : undefined;
  }
}

const RESSO_KEY = "csmju-elearning:resso-at";
const LOOP_WINDOW_MS = 30_000;

export function signInHref(next?: string): string {
  const target = next ?? (typeof window === "undefined" ? "/" : window.location.pathname + window.location.search);
  return `/auth/login?next=${encodeURIComponent(target)}`;
}

/** true = กำลังพาไป SSO แล้ว · false = เพิ่งไปมา ให้แสดงปุ่มแทน */
export function reSignIn(): boolean {
  let last = 0;
  try {
    last = Number(window.sessionStorage.getItem(RESSO_KEY) ?? 0);
  } catch {
    last = 0;
  }
  if (Date.now() - last < LOOP_WINDOW_MS) return false;
  try {
    window.sessionStorage.setItem(RESSO_KEY, String(Date.now()));
  } catch {
    // ไม่มี storage ก็ไปต่อได้
  }
  window.location.assign(signInHref());
  return true;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
  error?: { code: string; message: string; details?: unknown };
}

export async function apiRequest<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ data: T; meta?: Envelope<T>["meta"] }> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body !== undefined ? { "content-type": "application/json", accept: "application/json" } : { accept: "application/json" },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
  }

  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (res.status === 401) {
    reSignIn();
    throw new ApiError(401, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบอีกครั้ง");
  }
  if (!res.ok || !body || body.success !== true) {
    const retry = Number(res.headers.get("retry-after")) || undefined;
    throw new ApiError(
      res.status,
      body?.error?.code ?? "INTERNAL_ERROR",
      body?.error?.message ?? "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง",
      body?.error?.details,
      retry,
    );
  }
  return { data: body.data, meta: body.meta };
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path).then((r) => r.data),
  page: <T>(path: string) => apiRequest<T[]>(path) as Promise<{ data: T[]; meta: NonNullable<Envelope<T>["meta"]> }>,
  post: <T>(path: string, body: unknown = {}) => apiRequest<T>(path, { method: "POST", body }).then((r) => r.data),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: "PATCH", body }).then((r) => r.data),
  del: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }).then((r) => r.data),
};
