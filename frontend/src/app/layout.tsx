import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_Thai } from "next/font/google";
import { CsmjuAppShell, type NavItem } from "@/csmju";
import LearnerBar from "@/components/LearnerBar";
import { SessionProvider } from "@/components/session";
import { loadSession } from "@/lib/server-session";
import { CORE_ROLE_LABEL, can, initialsOf, themeClass } from "@/lib/tracks";
import type { Me } from "@/lib/types";
import "./globals.css";
import "../styles/track-themes.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

// ต้องตรงกับ display_name ใน subsystem.yaml
const DISPLAY_NAME = "CSMJU E-Learning";

// Core Hub web origin for the "กลับ CSMJU Portal" link — from .env, never hardcoded.
const CORE_HUB_WEB_URL = process.env.CORE_HUB_WEB_URL;

// ข้อมูลขึ้นกับตัวตนผู้ใช้ — ห้าม cache (ui-design-system.md ข้อ 16.1.1)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    template: `%s · ${DISPLAY_NAME} · CSMJU`,
    default: `สายงาน · ${DISPLAY_NAME} · CSMJU`,
  },
  description: "เรียนออนไลน์ตามสายงานของสาขาวิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยแม่โจ้",
};

/** เมนูตามสิทธิ์ — สิทธิ์ที่ไม่มี = ไม่แสดง (ui-design-system.md ข้อ 10.1) */
function buildNav(me: Me | null): NavItem[] {
  const nav: NavItem[] = [
    { label: "สายงาน", labelEn: "Tracks", href: "/", icon: "school" },
  ];
  if (can(me, "enrollment:read:own")) {
    nav.push({ label: "การเรียนของฉัน", labelEn: "Learning", href: "/profile", icon: "menu-book" });
    nav.push({ label: "ความสำเร็จ", labelEn: "Achievements", href: "/achievements", icon: "receipt" });
  }
  if (can(me, "dashboard:read")) {
    nav.push({ label: "แดชบอร์ด", labelEn: "Dashboard", href: "/dashboard", icon: "dashboard" });
  }
  if (can(me, "content:manage:any", "content:manage:own")) {
    nav.push({ label: "จัดการหลักสูตร", labelEn: "Content", href: "/manage/tracks", icon: "settings" });
  }
  if (can(me, "certificate-template:manage")) {
    nav.push({ label: "เทมเพลตเกียรติบัตร", labelEn: "Certificates", href: "/manage/certificates", icon: "description" });
  }
  if (can(me, "assignment:manage")) {
    nav.push({ label: "ผู้ใช้และสิทธิ์", labelEn: "People", href: "/manage/people", icon: "group" });
  }
  return nav;
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { me, profile } = await loadSession();
  const activeTrack = profile?.activeEnrollment?.track ?? null;
  const user = me
    ? {
        initials: initialsOf(profile?.fullNameTh, me.email),
        roleLabel: activeTrack ? `${CORE_ROLE_LABEL[me.coreRole]} · ${activeTrack.nameEn}` : CORE_ROLE_LABEL[me.coreRole],
      }
    : { initials: "?", roleLabel: "ยังไม่เข้าสู่ระบบ" };

  return (
    <html
      lang="th"
      className={`${jakarta.variable} ${notoSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-on-surface">
        <CsmjuAppShell displayName={DISPLAY_NAME} nav={buildNav(me)} user={user} coreHubUrl={CORE_HUB_WEB_URL}>
          <SessionProvider me={me} profile={profile}>
            {/* เรียนสายงานใดอยู่ หน้าเว็บใช้สีของสายงานนั้น
                contain-inline-size: กันตารางกว้างดัน <main> ของ AppShell จนเกิด scroll แนวนอนที่ 360px
                (main ใน csmju/CsmjuAppShell.tsx ไม่มี min-w-0 — แจ้งแก้ที่ส่วนกลางตามข้อ 17.4) */}
            <div className={`${themeClass(activeTrack?.color)} contain-inline-size space-y-8`}>
              <LearnerBar />
              {children}
            </div>
          </SessionProvider>
        </CsmjuAppShell>
      </body>
    </html>
  );
}
