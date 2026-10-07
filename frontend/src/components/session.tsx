"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, type ReactNode } from "react";

import type { LearnerProfile, Me } from "@/lib/types";

interface SessionValue {
  me: Me | null;
  profile: LearnerProfile | null;
  /** โหลด layout ใหม่ (ธีมสี · เมนู · สถานะในโปรไฟล์) หลังสมัคร/ออก/จบสายงาน */
  refresh: () => void;
}

const SessionContext = createContext<SessionValue>({ me: null, profile: null, refresh: () => undefined });

export function SessionProvider({
  me,
  profile,
  children,
}: {
  me: Me | null;
  profile: LearnerProfile | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  return <SessionContext.Provider value={{ me, profile, refresh }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
