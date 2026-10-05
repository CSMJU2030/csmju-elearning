/**
 * รูปร่างข้อมูลจาก API ของระบบนี้ (backend/openapi.json) — field เป็น camelCase ตาม api-conventions ข้อ 6
 */
export type TrackColor = "BLUE" | "PURPLE" | "RED" | "YELLOW" | "TEAL";
export type ItemState = "LOCKED" | "AVAILABLE" | "COMPLETED";
export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "WITHDRAWN";

export interface Me {
  id: string;
  email: string | null;
  coreRole: "student" | "alumni" | "staff" | "lecturer" | "guest" | "admin";
  subsystemRole: "LEARNER" | "INSTRUCTOR" | "STAFF" | "ADMIN" | "VISITOR";
  permissions: string[];
  session: { expiresAt: string };
}

export interface TrackRef {
  id: string;
  nameTh: string;
  nameEn: string;
  color: TrackColor;
  slug?: string;
}

export interface Track extends TrackRef {
  slug: string;
  summary: string;
  description: string;
  sortOrder: number;
  isPublished: boolean;
  certificateTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrackListItem extends Track {
  courseCount: number;
  learnerCount: number;
  graduateCount: number;
  myStatus: "ACTIVE" | "COMPLETED" | null;
}

export interface TrackCourse {
  id: string;
  title: string;
  description: string;
  courseCode: string | null;
  curriculumName: string | null;
  credits: number | null;
  sortOrder: number;
  isPublished: boolean;
  topicCount: number;
  videoCount: number;
  totalDurationSeconds: number;
  questionCount: number;
  quizPassCount: number;
}

export interface Graduate {
  certificateId: string;
  personCode: string | null;
  issuedAt: string;
  isMe: boolean;
}

export interface TrackDetail extends Track {
  learnerCount: number;
  graduateCount: number;
  courses: TrackCourse[];
  graduates: Graduate[];
  myEnrollment: { id: string; status: EnrollmentStatus; enrolledAt: string; completedAt: string | null } | null;
}

export interface Enrollment {
  id: string;
  coreUserId: string;
  personCode: string | null;
  trackId: string;
  track: TrackRef;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  withdrawnAt: string | null;
  certificateId: string | null;
  percent: number;
  currentCourseId: string | null;
}

export interface EnrollmentDetail extends Enrollment {
  courses: {
    courseId: string;
    title: string;
    state: ItemState;
    videosTotal: number;
    videosCompleted: number;
    quizState: ItemState | "NONE";
  }[];
}

export interface LearnerProfile {
  id: string;
  email: string | null;
  coreRole: Me["coreRole"];
  subsystemRole: Me["subsystemRole"];
  personCode: string | null;
  fullNameTh: string | null;
  activeEnrollment: {
    enrollmentId: string;
    enrolledAt: string;
    track: TrackRef;
    percent: number;
    currentCourseId: string | null;
    coursesPassed: number;
    courseCount: number;
  } | null;
  completedTracks: {
    enrollmentId: string;
    completedAt: string | null;
    track: TrackRef;
    certificate: { id: string; certificateNo: string; issuedAt: string } | null;
  }[];
  withdrawnCount: number;
}

export interface OutlineVideo {
  id: string;
  title: string;
  durationSeconds: number;
  requiredSeconds: number;
  watchedSeconds: number;
  positionSeconds: number;
  state: ItemState;
  videoUrl: string | null;
}

export interface Outline {
  course: {
    id: string;
    title: string;
    description: string;
    courseCode: string | null;
    state: ItemState;
    position: number;
    courseCount: number;
    previousCourseId: string | null;
    nextCourseId: string | null;
  };
  track: TrackRef;
  enrollment: { id: string; status: EnrollmentStatus; percent: number } | null;
  minWatchPercent: number;
  topics: { id: string; title: string; description: string; videos: OutlineVideo[] }[];
  quiz: {
    state: ItemState | "NONE";
    questionCount: number;
    passCount: number;
    attempts: { id: string; correctCount: number; totalCount: number; passCount: number; isPassed: boolean; createdAt: string }[];
  };
}

export interface HeartbeatResult {
  videoId: string;
  watchedSeconds: number;
  requiredSeconds: number;
  durationSeconds: number;
  isCompleted: boolean;
  justCompleted: boolean;
  trackCompleted: boolean;
  certificateId: string | null;
}

export interface Quiz {
  courseId: string;
  courseTitle: string;
  enrollmentId: string;
  state: ItemState;
  passCount: number;
  questions: { id: string; prompt: string; choices: { id: string; label: string }[] }[];
}

export interface QuizResult {
  id: string;
  courseId: string;
  correctCount: number;
  totalCount: number;
  passCount: number;
  isPassed: boolean;
  results: { questionId: string; isCorrect: boolean; explanation: string | null }[];
  trackCompleted: boolean;
  certificateId: string | null;
}

export interface CertificateListItem {
  id: string;
  certificateNo: string;
  personCode: string | null;
  issuedAt: string;
  track: TrackRef;
  isMine: boolean;
}

export interface CertificateDetail {
  id: string;
  certificateNo: string;
  issuedAt: string;
  personCode: string | null;
  isMine: boolean;
  recipientName: string;
  track: TrackRef;
  template: { heading: string; bodyText: string; signerName: string; signerTitle: string; imageUrl: string | null };
}

export interface CertificateTemplate {
  id: string;
  name: string;
  heading: string;
  bodyText: string;
  signerName: string;
  signerTitle: string;
  imageId: string | null;
  imageUrl: string | null;
  isDefault: boolean;
  trackCount?: number;
  certificateCount?: number;
}

export interface CourseAdmin {
  id: string;
  trackId: string;
  courseCode: string | null;
  title: string;
  description: string;
  sortOrder: number;
  quizPassCount: number;
  isPublished: boolean;
  curriculumName: string | null;
  curriculumNameEn?: string | null;
  credits?: number | null;
  questionCount: number;
  canManage: boolean;
  track: TrackRef;
  topics: {
    id: string;
    title: string;
    description: string;
    sortOrder: number;
    videos: { id: string; title: string; durationSeconds: number; sortOrder: number; videoUrl?: string }[];
  }[];
}

export interface QuizQuestionAdmin {
  id: string;
  courseId: string;
  prompt: string;
  explanation: string;
  sortOrder: number;
  choices: { id: string; label: string; isCorrect: boolean }[];
}

export interface TrackStatistic {
  trackId: string;
  nameTh: string;
  nameEn: string;
  color: TrackColor;
  isPublished: boolean;
  enrollmentCount: number;
  activeCount: number;
  completedCount: number;
  withdrawnCount: number;
  completionRate: number;
  withdrawRate: number;
  averageDaysToComplete: number | null;
}

export interface Assignment {
  id: string;
  personCode: string;
  coreUserId: string | null;
  scope: "TRACK" | "COURSE";
  track: { id: string; nameTh: string; color: TrackColor } | null;
  course: { id: string; title: string } | null;
  createdAt: string;
}

export interface StaffPerson {
  personCode: string;
  fullNameTh: string;
  academicTitle: string | null;
  staffType: string | null;
  coreUserId: string | null;
}

export interface CurriculumCourse {
  code: string;
  nameTh: string;
  nameEn: string | null;
  credits: number;
}

export interface Page<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
