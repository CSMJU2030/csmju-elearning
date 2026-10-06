import type { SubsystemRole } from './role-mapping';

/**
 * permission ของ CSMJU E-Learning — รูปแบบ <resource>:<action>[:own|:any] (authorization.md ข้อ 4)
 *
 * guard ตรวจแค่ว่ามี permission อย่างน้อยหนึ่งข้อ
 * การตรวจ ":own" ทำใน service กับข้อมูลจริงเสมอ
 *   - enrollment / progress / quiz-attempt / certificate ":own" = record.core_user_id === token.sub
 *   - content ":own" = ผู้เรียกถูกมอบหมายใน instructor_assignments ให้สายงานหรือวิชานั้น
 */
export const Permission = {
  TRACK_READ: 'track:read',
  TRACK_CREATE: 'track:create',
  TRACK_UPDATE: 'track:update',
  TRACK_DELETE: 'track:delete',

  /** วิชา · หัวข้อ · วิดีโอ · แบบทดสอบ */
  CONTENT_READ: 'content:read',
  CONTENT_MANAGE_ANY: 'content:manage:any',
  CONTENT_MANAGE_OWN: 'content:manage:own',

  ENROLLMENT_CREATE_OWN: 'enrollment:create:own',
  ENROLLMENT_READ_OWN: 'enrollment:read:own',
  ENROLLMENT_UPDATE_OWN: 'enrollment:update:own',
  ENROLLMENT_READ_ANY: 'enrollment:read:any',

  /** heartbeat เวลาเรียนและดูบทเรียน */
  LEARNING_UPDATE_OWN: 'learning:update:own',
  QUIZ_ATTEMPT_CREATE_OWN: 'quiz-attempt:create:own',

  CERTIFICATE_READ_OWN: 'certificate:read:own',
  CERTIFICATE_READ_ANY: 'certificate:read:any',
  CERTIFICATE_TEMPLATE_MANAGE: 'certificate-template:manage',

  DASHBOARD_READ: 'dashboard:read',
  ASSIGNMENT_READ: 'assignment:read',
  ASSIGNMENT_MANAGE: 'assignment:manage',
  /** ค้นบุคลากรจาก Core Hub ตอนมอบหมายอาจารย์ */
  PEOPLE_SEARCH: 'people:search',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const P = Permission;

const BROWSE: readonly Permission[] = [P.TRACK_READ, P.CONTENT_READ];

const LEARN: readonly Permission[] = [
  ...BROWSE,
  P.ENROLLMENT_CREATE_OWN,
  P.ENROLLMENT_READ_OWN,
  P.ENROLLMENT_UPDATE_OWN,
  P.LEARNING_UPDATE_OWN,
  P.QUIZ_ATTEMPT_CREATE_OWN,
  P.CERTIFICATE_READ_OWN,
];

const MANAGE: readonly Permission[] = [
  ...LEARN,
  P.TRACK_CREATE,
  P.TRACK_UPDATE,
  P.TRACK_DELETE,
  P.CONTENT_MANAGE_ANY,
  P.ENROLLMENT_READ_ANY,
  P.CERTIFICATE_READ_ANY,
  P.CERTIFICATE_TEMPLATE_MANAGE,
  P.DASHBOARD_READ,
  P.ASSIGNMENT_READ,
  P.PEOPLE_SEARCH,
];

/** เมทริกซ์สิทธิ์ที่เดียวของระบบ */
export const ROLE_PERMISSIONS: Record<SubsystemRole, readonly Permission[]> = {
  VISITOR: BROWSE,
  LEARNER: LEARN,
  INSTRUCTOR: [...LEARN, P.CONTENT_MANAGE_OWN, P.ASSIGNMENT_READ, P.DASHBOARD_READ],
  STAFF: MANAGE,
  ADMIN: [...MANAGE, P.ASSIGNMENT_MANAGE],
};

export function permissionsOf(role: SubsystemRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(perms: readonly Permission[], ...required: Permission[]): boolean {
  return required.some((p) => perms.includes(p));
}
