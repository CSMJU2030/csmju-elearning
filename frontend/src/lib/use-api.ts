"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "./api";

type Meta = { total: number; page: number; limit: number; totalPages: number };

interface Loaded<T> {
  key: string;
  path: string;
  data: T | null;
  meta?: Meta;
  error: ApiError | null;
}

/**
 * โหลดข้อมูลหนึ่งก้อนพร้อมสถานะ loading / error / success ให้หน้าใช้ร่วมกัน
 * loading = ยังไม่ได้คำตอบของคำขอล่าสุด (เทียบด้วย key) — ข้อมูลเดิมยังแสดงอยู่ระหว่างโหลดใหม่
 */
export function useApi<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const key = path ? `${path}#${version}` : null;

  useEffect(() => {
    if (!path || !key) return;
    let cancelled = false;
    apiRequest<T>(path)
      .then((r) => {
        if (!cancelled) setLoaded({ key, path, data: r.data, meta: r.meta, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const error = e instanceof ApiError ? e : new ApiError(0, "INTERNAL_ERROR", "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง");
        setLoaded((prev) => ({ key, path, data: prev?.path === path ? prev.data : null, meta: prev?.meta, error }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, key]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const fresh = loaded?.key === key;
  const samePath = Boolean(path) && loaded?.path === path;
  return {
    data: samePath ? (loaded?.data ?? null) : null,
    meta: loaded?.meta,
    error: fresh ? (loaded?.error ?? null) : null,
    loading: Boolean(path) && !fresh,
    reload,
  };
}
