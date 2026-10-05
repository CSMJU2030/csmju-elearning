import { Injectable } from '@nestjs/common';

import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission, hasPermission } from '../auth/permissions';
import { forbidden } from '../common/errors';
import { PeopleService } from '../core-hub/people.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ตรวจ ":own" ของเนื้อหา (authorization.md ข้อ 4) กับข้อมูลจริง
 *
 * - content:manage:any (STAFF · ADMIN) แก้ได้ทุกสายงาน
 * - content:manage:own (INSTRUCTOR) แก้ได้เฉพาะสายงาน/วิชาที่ instructor_assignments มอบให้
 *   ระบุตัวด้วย core_user_id = sub ก่อน · ถ้าการมอบหมายยังไม่มี core_user_id (บุคลากรที่ยังไม่มีบัญชีตอนมอบหมาย)
 *   เทียบ person_code กับ /people/me ของผู้เรียก (ไม่ cache)
 */
@Injectable()
export class ContentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
  ) {}

  canManageAny(user: CoreHubIdentity): boolean {
    return hasPermission(user.permissions, Permission.CONTENT_MANAGE_ANY);
  }

  /** สายงาน/วิชาที่ผู้เรียกได้รับมอบหมาย */
  async assignmentScope(user: CoreHubIdentity, userToken: string) {
    if (!hasPermission(user.permissions, Permission.CONTENT_MANAGE_OWN)) {
      return { trackIds: new Set<string>(), courseIds: new Set<string>() };
    }
    let rows = await this.prisma.instructorAssignment.findMany({
      where: { coreUserId: user.id },
      select: { trackId: true, courseId: true },
    });
    const unlinked = await this.prisma.instructorAssignment.count({ where: { coreUserId: null } });
    if (unlinked > 0) {
      const personCode = await this.people.personCodeOrNull(userToken);
      if (personCode) {
        rows = rows.concat(
          await this.prisma.instructorAssignment.findMany({
            where: { coreUserId: null, personCode },
            select: { trackId: true, courseId: true },
          }),
        );
      }
    }
    return {
      trackIds: new Set(rows.map((r) => r.trackId).filter((v): v is string => Boolean(v))),
      courseIds: new Set(rows.map((r) => r.courseId).filter((v): v is string => Boolean(v))),
    };
  }

  async canManageTrack(user: CoreHubIdentity, userToken: string, trackId: string): Promise<boolean> {
    if (this.canManageAny(user)) return true;
    const scope = await this.assignmentScope(user, userToken);
    return scope.trackIds.has(trackId);
  }

  async canManageCourse(user: CoreHubIdentity, userToken: string, course: { id: string; trackId: string }) {
    if (this.canManageAny(user)) return true;
    const scope = await this.assignmentScope(user, userToken);
    return scope.trackIds.has(course.trackId) || scope.courseIds.has(course.id);
  }

  async assertTrack(user: CoreHubIdentity, userToken: string, trackId: string) {
    if (!(await this.canManageTrack(user, userToken, trackId))) {
      throw forbidden('คุณไม่ได้รับมอบหมายให้ดูแลสายงานนี้');
    }
  }

  async assertCourse(user: CoreHubIdentity, userToken: string, course: { id: string; trackId: string }) {
    if (!(await this.canManageCourse(user, userToken, course))) {
      throw forbidden('คุณไม่ได้รับมอบหมายให้ดูแลวิชานี้');
    }
  }
}
