import { Injectable } from '@nestjs/common';

import { CoreHubClient } from './core-hub.client';

export interface MyPerson {
  personCode: string;
  personType: string;
  /** ใช้แสดงผลเท่านั้น (เกียรติบัตร · หน้าโปรไฟล์) — ห้ามเก็บลงฐาน */
  fullNameTh: string | null;
}

export interface StaffPerson {
  personCode: string;
  fullNameTh: string;
  academicTitle: string | null;
  staffType: string | null;
  coreUserId: string | null;
}

/**
 * ข้อมูลบุคคลจาก Core Hub — ห้าม cache ทุกแบบ (reference-data.md ข้อ 5)
 * ระบบนี้เก็บลงฐานได้แค่ personCode / coreUserId ตอนเกิดรายการ
 * ชื่อใช้แสดงผลตอนนั้นเท่านั้น · guest เรียก /people/me ไม่ได้ (403) · บัญชีที่ยังไม่ผูกกับบุคคลได้ null
 */
@Injectable()
export class PeopleService {
  constructor(private readonly coreHub: CoreHubClient) {}

  async me(userToken: string): Promise<MyPerson | null> {
    try {
      const body = await this.coreHub.get<{
        personCode?: unknown;
        personType?: unknown;
        fullNameTh?: unknown;
      } | null>('/people/me', userToken);
      const data = body?.data;
      if (!data || typeof data.personCode !== 'string') return null;
      return {
        personCode: data.personCode,
        personType: typeof data.personType === 'string' ? data.personType : 'STUDENT',
        fullNameTh: typeof data.fullNameTh === 'string' ? data.fullNameTh : null,
      };
    } catch (e) {
      return CoreHubClient.toHttp(e);
    }
  }

  /** personCode ของผู้เรียก — Core Hub ล่มหรือไม่มีสิทธิ์ (guest) ให้ null แทนการทำรายการไม่สำเร็จ */
  async personCodeOrNull(userToken: string): Promise<string | null> {
    try {
      return (await this.me(userToken))?.personCode ?? null;
    } catch {
      return null;
    }
  }

  /** บุคคลเดียวตาม personCode (staff · lecturer · admin) — null = ไม่พบ · ใช้แสดงผล/ตรวจตอนทำรายการเท่านั้น */
  async byCode(userToken: string, personCode: string): Promise<(StaffPerson & { personType: string }) | null> {
    try {
      const body = await this.coreHub.get<{
        personCode?: unknown;
        personType?: unknown;
        fullNameTh?: unknown;
        academicTitle?: unknown;
        staffType?: unknown;
        coreUserId?: unknown;
      }>(`/people/${encodeURIComponent(personCode)}`, userToken);
      const p = body?.data;
      if (!p || typeof p.personCode !== 'string') return null;
      return {
        personCode: p.personCode,
        personType: typeof p.personType === 'string' ? p.personType : 'STUDENT',
        fullNameTh: typeof p.fullNameTh === 'string' ? p.fullNameTh : p.personCode,
        academicTitle: typeof p.academicTitle === 'string' ? p.academicTitle : null,
        staffType: typeof p.staffType === 'string' ? p.staffType : null,
        coreUserId: typeof p.coreUserId === 'string' ? p.coreUserId : null,
      };
    } catch (e) {
      return CoreHubClient.toHttp(e);
    }
  }

  /** ค้นบุคลากรตอนมอบหมายอาจารย์ (staff · lecturer · admin เรียกได้ — reference-data.md ข้อ 2.2) */
  async searchStaff(userToken: string, q: string, page: number, limit: number) {
    try {
      const body = await this.coreHub.get<
        { personCode?: unknown; fullNameTh?: unknown; academicTitle?: unknown; staffType?: unknown; coreUserId?: unknown }[]
      >('/people', userToken, { personType: 'STAFF', page: String(page), limit: String(limit), ...(q ? { q } : {}) });
      const rows = Array.isArray(body?.data) ? body.data : [];
      const people: StaffPerson[] = rows
        .filter((p) => typeof p?.personCode === 'string')
        .map((p) => ({
          personCode: p.personCode as string,
          fullNameTh: typeof p.fullNameTh === 'string' ? p.fullNameTh : (p.personCode as string),
          academicTitle: typeof p.academicTitle === 'string' ? p.academicTitle : null,
          staffType: typeof p.staffType === 'string' ? p.staffType : null,
          coreUserId: typeof p.coreUserId === 'string' ? p.coreUserId : null,
        }));
      return { people, total: body?.meta?.total ?? people.length };
    } catch (e) {
      return CoreHubClient.toHttp(e);
    }
  }
}
