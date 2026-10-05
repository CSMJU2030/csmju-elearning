import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission, hasPermission } from '../auth/permissions';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { paginated, pageArgs } from '../common/dto/pagination.dto';
import { conflict, forbidden, notFound, validation } from '../common/errors';
import { PeopleService } from '../core-hub/people.service';
import { Prisma } from '../generated/prisma/client';
import {
  computeTrackProgress,
  heartbeatCredit,
  requiredSeconds,
  type CourseNode,
  type TrackProgress,
} from '../learning-rules/progress';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto, CreateQuizAttemptDto, HeartbeatDto, ListEnrollmentsDto } from './learning.dto';

type Db = PrismaService | Prisma.TransactionClient;

interface TrackTree {
  courses: (CourseNode & { title: string; quizPassCount: number; sortOrder: number })[];
}

/**
 * การเรียนของผู้ใช้ — สมัครเรียน · ออกจากสายงาน · เรียนตามลำดับ · จับเวลาเรียน · แบบทดสอบ · จบสายงาน
 *
 * กติกาหลัก
 * - กำลังเรียนได้ทีละ 1 สายงาน (partial unique index ใน migration กันซ้ำอีกชั้น)
 * - ออกจากสายงาน = ล้างความคืบหน้าทั้งหมดของสายงานนั้น · สายงานที่เรียนจบแล้วออกไม่ได้และเก็บไว้ตลอด
 * - จบสายงาน = ผ่านทุกวิชา → ได้เกียรติบัตร 1 ใบ แล้วสมัครสายงานอื่นต่อได้
 */
@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ─────────────── โครงสายงาน + ความคืบหน้า ───────────────

  async loadTree(trackId: string, db: Db = this.prisma): Promise<TrackTree> {
    const courses = await db.course.findMany({
      where: { trackId, isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        sortOrder: true,
        quizPassCount: true,
        _count: { select: { questions: true } },
        topics: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            videos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, durationSeconds: true } },
          },
        },
      },
    });
    return {
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        sortOrder: c.sortOrder,
        quizPassCount: c.quizPassCount,
        questionCount: c._count.questions,
        topics: c.topics,
      })),
    };
  }

  async progressOf(enrollmentId: string, tree: TrackTree, db: Db = this.prisma): Promise<TrackProgress> {
    const [videos, quizzes] = await Promise.all([
      db.videoProgress.findMany({ where: { enrollmentId, isCompleted: true }, select: { videoId: true } }),
      db.quizAttempt.findMany({
        where: { enrollmentId, isPassed: true },
        select: { courseId: true },
        distinct: ['courseId'],
      }),
    ]);
    return computeTrackProgress(tree.courses, {
      completedVideos: new Set(videos.map((v) => v.videoId)),
      passedQuizzes: new Set(quizzes.map((q) => q.courseId)),
    });
  }

  // ─────────────── สมัครเรียน / ออกจากสายงาน ───────────────

  async listEnrollments(user: CoreHubIdentity, dto: ListEnrollmentsDto) {
    const any = dto.scope === 'any';
    if (any && !hasPermission(user.permissions, Permission.ENROLLMENT_READ_ANY)) {
      throw forbidden('คุณไม่มีสิทธิ์ดูการสมัครเรียนของผู้อื่น');
    }
    const where: Prisma.EnrollmentWhereInput = {
      ...(any ? {} : { coreUserId: user.id }),
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.trackId ? { trackId: dto.trackId } : {}),
    };
    const { skip, take } = pageArgs(dto);
    const [rows, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        orderBy: [{ enrolledAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
        include: {
          track: { select: { id: true, nameTh: true, nameEn: true, color: true, slug: true } },
          certificate: { select: { id: true } },
        },
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    const trees = new Map<string, TrackTree>();
    const data = [];
    for (const e of rows) {
      let percent = e.status === 'COMPLETED' ? 100 : 0;
      let currentCourseId: string | null = null;
      if (e.status === 'ACTIVE') {
        if (!trees.has(e.trackId)) trees.set(e.trackId, await this.loadTree(e.trackId));
        const progress = await this.progressOf(e.id, trees.get(e.trackId) as TrackTree);
        percent = progress.percent;
        currentCourseId = progress.currentCourseId;
      }
      data.push({ ...this.enrollmentView(e), percent, currentCourseId });
    }
    return paginated(data, total, dto);
  }

  async getEnrollment(user: CoreHubIdentity, id: string) {
    const e = await this.prisma.enrollment.findUnique({
      where: { id },
      include: {
        track: { select: { id: true, nameTh: true, nameEn: true, color: true, slug: true } },
        certificate: { select: { id: true } },
      },
    });
    if (!e) throw notFound('ไม่พบการสมัครเรียนที่ต้องการ');
    this.assertOwnOrAny(user, e.coreUserId, Permission.ENROLLMENT_READ_ANY);

    const tree = await this.loadTree(e.trackId);
    const progress = e.status === 'WITHDRAWN' ? null : await this.progressOf(e.id, tree);
    return {
      ...this.enrollmentView(e),
      percent: e.status === 'COMPLETED' ? 100 : (progress?.percent ?? 0),
      currentCourseId: progress?.currentCourseId ?? null,
      courses: tree.courses.map((c) => {
        const p = progress?.courses.find((x) => x.courseId === c.id);
        return {
          courseId: c.id,
          title: c.title,
          state: e.status === 'COMPLETED' ? 'COMPLETED' : (p?.state ?? 'LOCKED'),
          videosTotal: p?.videosTotal ?? c.topics.reduce((n, t) => n + t.videos.length, 0),
          videosCompleted: p?.videosCompleted ?? 0,
          quizState: p?.quizState ?? (c.questionCount > 0 ? 'LOCKED' : 'NONE'),
        };
      }),
    };
  }

  async enroll(user: CoreHubIdentity, userToken: string, dto: CreateEnrollmentDto) {
    const track = await this.prisma.track.findUnique({ where: { id: dto.trackId } });
    if (!track || !track.isPublished) throw validation('ไม่พบสายงานที่เลือก', { field: 'trackId' });

    const active = await this.prisma.enrollment.findFirst({
      where: { coreUserId: user.id, status: 'ACTIVE' },
      include: { track: { select: { id: true, nameTh: true } } },
    });
    if (active) {
      throw conflict(
        active.trackId === track.id ? 'ALREADY_ENROLLED' : 'ACTIVE_ENROLLMENT_EXISTS',
        active.trackId === track.id
          ? 'คุณกำลังเรียนสายงานนี้อยู่แล้ว'
          : `คุณกำลังเรียนสายงาน "${active.track.nameTh}" อยู่ ต้องเรียนจบหรือออกจากสายงานนั้นก่อน`,
        { enrollmentId: active.id, trackId: active.trackId },
      );
    }
    const completed = await this.prisma.enrollment.findFirst({
      where: { coreUserId: user.id, trackId: track.id, status: 'COMPLETED' },
      select: { id: true },
    });
    if (completed) {
      throw conflict('TRACK_ALREADY_COMPLETED', 'คุณเรียนจบสายงานนี้แล้ว เลือกสายงานอื่นเพื่อเรียนต่อได้', {
        enrollmentId: completed.id,
      });
    }
    const tree = await this.loadTree(track.id);
    if (tree.courses.length === 0) {
      throw conflict('TRACK_HAS_NO_COURSES', 'สายงานนี้ยังไม่มีวิชาให้เรียน');
    }

    // person_code จาก /people/me ตอนเกิดรายการ (reference-data.md ข้อ 8) — ไม่ได้ก็เก็บ null
    const personCode = await this.people.personCodeOrNull(userToken);
    try {
      const e = await this.prisma.enrollment.create({
        data: { coreUserId: user.id, personCode, trackId: track.id },
        include: {
          track: { select: { id: true, nameTh: true, nameEn: true, color: true, slug: true } },
          certificate: { select: { id: true } },
        },
      });
      return { ...this.enrollmentView(e), percent: 0, currentCourseId: tree.courses[0].id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw conflict('ACTIVE_ENROLLMENT_EXISTS', 'คุณมีสายงานที่กำลังเรียนอยู่แล้ว');
      }
      throw err;
    }
  }

  async withdraw(user: CoreHubIdentity, id: string) {
    const e = await this.prisma.enrollment.findUnique({ where: { id } });
    if (!e) throw notFound('ไม่พบการสมัครเรียนที่ต้องการ');
    if (e.coreUserId !== user.id) throw forbidden('ออกจากสายงานแทนผู้อื่นไม่ได้');
    if (e.status === 'COMPLETED') {
      throw conflict('ENROLLMENT_COMPLETED', 'สายงานที่เรียนจบแล้วไม่ต้องออก — สมัครสายงานอื่นได้เลย');
    }
    if (e.status === 'WITHDRAWN') throw conflict('ENROLLMENT_WITHDRAWN', 'ออกจากสายงานนี้ไปแล้ว');

    const updated = await this.prisma.$transaction(async (tx) => {
      // ล้างความคืบหน้าทั้งหมดของสายงานนี้ — สมัครใหม่ต้องเริ่มจาก 0
      await tx.videoProgress.deleteMany({ where: { enrollmentId: id } });
      await tx.quizAttempt.deleteMany({ where: { enrollmentId: id } });
      const changed = await tx.enrollment.updateMany({
        where: { id, status: 'ACTIVE' },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
      });
      if (changed.count !== 1) throw conflict('ENROLLMENT_CHANGED', 'สถานะการเรียนเปลี่ยนไปแล้ว กรุณารีเฟรช');
      return tx.enrollment.findUniqueOrThrow({
        where: { id },
        include: {
          track: { select: { id: true, nameTh: true, nameEn: true, color: true, slug: true } },
          certificate: { select: { id: true } },
        },
      });
    });
    return { ...this.enrollmentView(updated), percent: 0, currentCourseId: null };
  }

  // ─────────────── หน้าเรียน ───────────────

  /** โครงวิชาพร้อมสถานะของผู้เรียก — ลิงก์วิดีโอส่งเฉพาะตัวที่ปลดล็อกแล้ว */
  async outline(user: CoreHubIdentity, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        track: { select: { id: true, nameTh: true, nameEn: true, color: true, isPublished: true } },
        topics: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { videos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
        },
        _count: { select: { questions: true } },
      },
    });
    if (!course || !course.isPublished || !course.track.isPublished) throw notFound('ไม่พบวิชาที่ต้องการ');

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { coreUserId: user.id, trackId: course.trackId, status: { in: ['ACTIVE', 'COMPLETED'] } },
      orderBy: { enrolledAt: 'desc' },
    });
    const tree = await this.loadTree(course.trackId);
    const index = tree.courses.findIndex((c) => c.id === course.id);
    const progress = enrollment ? await this.progressOf(enrollment.id, tree) : null;
    const cp = progress?.courses.find((c) => c.courseId === course.id);
    const completedTrack = enrollment?.status === 'COMPLETED';

    const watched = enrollment
      ? await this.prisma.videoProgress.findMany({
          where: { enrollmentId: enrollment.id, video: { topic: { courseId: course.id } } },
        })
      : [];
    const attempts = enrollment
      ? await this.prisma.quizAttempt.findMany({
          where: { enrollmentId: enrollment.id, courseId: course.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
      : [];

    const stateOf = (videoId: string) => {
      if (!enrollment) return 'LOCKED';
      if (completedTrack) return 'COMPLETED';
      return cp?.videoStates.get(videoId) ?? 'LOCKED';
    };

    return {
      course: {
        id: course.id,
        title: course.title,
        description: course.description,
        courseCode: course.courseCode,
        state: completedTrack ? 'COMPLETED' : (cp?.state ?? 'LOCKED'),
        position: index + 1,
        courseCount: tree.courses.length,
        previousCourseId: index > 0 ? tree.courses[index - 1].id : null,
        nextCourseId: index >= 0 && index < tree.courses.length - 1 ? tree.courses[index + 1].id : null,
      },
      track: { id: course.track.id, nameTh: course.track.nameTh, nameEn: course.track.nameEn, color: course.track.color },
      enrollment: enrollment
        ? { id: enrollment.id, status: enrollment.status, percent: completedTrack ? 100 : (progress?.percent ?? 0) }
        : null,
      minWatchPercent: this.config.minWatchPercent,
      topics: course.topics.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        videos: t.videos.map((v) => {
          const state = stateOf(v.id);
          const p = watched.find((w) => w.videoId === v.id);
          return {
            id: v.id,
            title: v.title,
            durationSeconds: v.durationSeconds,
            requiredSeconds: requiredSeconds(v.durationSeconds, this.config.minWatchPercent),
            watchedSeconds: p?.watchedSeconds ?? 0,
            positionSeconds: p?.positionSeconds ?? 0,
            state,
            videoUrl: state === 'LOCKED' ? null : v.videoUrl,
          };
        }),
      })),
      quiz: {
        state: completedTrack && course._count.questions > 0 ? 'COMPLETED' : (cp?.quizState ?? (course._count.questions > 0 ? 'LOCKED' : 'NONE')),
        questionCount: course._count.questions,
        passCount: Math.min(course.quizPassCount, course._count.questions),
        attempts: attempts.map((a) => ({
          id: a.id,
          correctCount: a.correctCount,
          totalCount: a.totalCount,
          passCount: a.passCount,
          isPassed: a.isPassed,
          createdAt: a.createdAt,
        })),
      },
    };
  }

  /**
   * ตัวตรวจเวลาเรียน — เบราว์เซอร์ส่ง heartbeat ทุก ~10 วินาทีระหว่างวิดีโอเล่นและหน้าจอเปิดอยู่
   * server นับเวลาจริงจาก last_heartbeat_at เอง (heartbeatCredit) ไม่เชื่อตัวเลขเวลาจากเบราว์เซอร์
   * วิดีโอจบเมื่อเวลาที่ดูจริง ≥ LEARNING_MIN_WATCH_PERCENT ของความยาว
   */
  async heartbeat(user: CoreHubIdentity, videoId: string, dto: HeartbeatDto) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      include: { topic: { include: { course: { include: { track: true } } } } },
    });
    const course = video?.topic.course;
    if (!video || !course || !course.isPublished || !course.track.isPublished) throw notFound('ไม่พบวิดีโอที่ต้องการ');

    const enrollment = await this.prisma.enrollment.findFirst({
      where: { coreUserId: user.id, trackId: course.trackId, status: 'ACTIVE' },
    });
    if (!enrollment) {
      throw conflict('NOT_ENROLLED', 'ต้องสมัครเรียนสายงานนี้ก่อน (หรือเรียนจบไปแล้ว)');
    }

    const tree = await this.loadTree(course.trackId);
    const progress = await this.progressOf(enrollment.id, tree);
    const state = progress.courses.find((c) => c.courseId === course.id)?.videoStates.get(video.id) ?? 'LOCKED';
    if (state === 'LOCKED') {
      throw conflict('VIDEO_LOCKED', 'ต้องเรียนบทเรียนก่อนหน้าให้จบก่อน เรียนข้ามไม่ได้');
    }

    const required = requiredSeconds(video.durationSeconds, this.config.minWatchPercent);
    const now = new Date();
    let row = await this.prisma.videoProgress.upsert({
      where: { enrollmentId_videoId: { enrollmentId: enrollment.id, videoId: video.id } },
      create: { enrollmentId: enrollment.id, videoId: video.id, lastHeartbeatAt: now, positionSeconds: Math.min(dto.positionSeconds, video.durationSeconds) },
      update: {},
    });

    let justCompleted = false;
    if (!row.isCompleted && row.lastHeartbeatAt && row.lastHeartbeatAt.getTime() !== now.getTime()) {
      const credit = heartbeatCredit(
        row.lastHeartbeatAt,
        now,
        dto.playing,
        this.config.heartbeatMaxCreditSec,
        this.config.heartbeatGapSec,
      );
      const watchedSeconds = Math.min(video.durationSeconds, row.watchedSeconds + credit);
      const isCompleted = watchedSeconds >= required;
      // optimistic: แท็บอื่นอัปเดตไปก่อนแล้ว = ไม่นับซ้ำ
      const changed = await this.prisma.videoProgress.updateMany({
        where: { id: row.id, lastHeartbeatAt: row.lastHeartbeatAt, isCompleted: false },
        data: {
          watchedSeconds,
          positionSeconds: Math.min(dto.positionSeconds, video.durationSeconds),
          lastHeartbeatAt: now,
          isCompleted,
          completedAt: isCompleted ? now : null,
        },
      });
      if (changed.count === 1) justCompleted = isCompleted;
      row = await this.prisma.videoProgress.findUniqueOrThrow({ where: { id: row.id } });
    } else if (row.isCompleted) {
      await this.prisma.videoProgress.update({
        where: { id: row.id },
        data: { positionSeconds: Math.min(dto.positionSeconds, video.durationSeconds) },
      });
    }

    const completion = justCompleted ? await this.completeIfDone(enrollment.id) : null;
    return {
      videoId: video.id,
      watchedSeconds: row.watchedSeconds,
      requiredSeconds: required,
      durationSeconds: video.durationSeconds,
      isCompleted: row.isCompleted,
      justCompleted,
      trackCompleted: completion?.completed ?? false,
      certificateId: completion?.certificateId ?? null,
    };
  }

  /** คำถามแบบทดสอบสำหรับผู้เรียน — ไม่มีเฉลย · เปิดเมื่อดูวิดีโอในวิชาครบ */
  async quiz(user: CoreHubIdentity, courseId: string) {
    const { course, enrollment, quizState } = await this.quizContext(user, courseId);
    if (quizState === 'NONE') throw notFound('วิชานี้ไม่มีแบบทดสอบ');
    if (quizState === 'LOCKED') throw conflict('QUIZ_LOCKED', 'ต้องเรียนวิดีโอในวิชานี้ให้ครบก่อนทำแบบทดสอบ');
    const questions = await this.prisma.quizQuestion.findMany({
      where: { courseId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { choices: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, label: true } } },
    });
    return {
      courseId,
      courseTitle: course.title,
      enrollmentId: enrollment.id,
      state: quizState,
      passCount: Math.min(course.quizPassCount, questions.length),
      questions: questions.map((q) => ({ id: q.id, prompt: q.prompt, choices: q.choices })),
    };
  }

  async submitQuiz(user: CoreHubIdentity, dto: CreateQuizAttemptDto) {
    const { course, enrollment, quizState } = await this.quizContext(user, dto.courseId, true);
    if (quizState === 'NONE') throw validation('วิชานี้ไม่มีแบบทดสอบ', { field: 'courseId' });
    if (quizState === 'LOCKED') throw conflict('QUIZ_LOCKED', 'ต้องเรียนวิดีโอในวิชานี้ให้ครบก่อนทำแบบทดสอบ');
    if (quizState === 'COMPLETED') throw conflict('QUIZ_ALREADY_PASSED', 'คุณทำแบบทดสอบวิชานี้ผ่านแล้ว');

    const questions = await this.prisma.quizQuestion.findMany({
      where: { courseId: course.id },
      include: { choices: true },
    });
    const byQuestion = new Map(dto.answers.map((a) => [a.questionId, a.choiceId]));
    const unknown = dto.answers.find((a) => !questions.some((q) => q.id === a.questionId));
    if (unknown) throw validation('มีคำตอบของคำถามที่ไม่อยู่ในแบบทดสอบนี้', { field: 'answers' });

    const results = questions.map((q) => {
      const chosen = byQuestion.get(q.id);
      const correct = q.choices.find((c) => c.isCorrect);
      return { questionId: q.id, isCorrect: Boolean(chosen && correct && chosen === correct.id) };
    });
    const correctCount = results.filter((r) => r.isCorrect).length;
    const passCount = Math.min(course.quizPassCount, questions.length);
    const isPassed = correctCount >= passCount;

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        enrollmentId: enrollment.id,
        courseId: course.id,
        correctCount,
        totalCount: questions.length,
        passCount,
        isPassed,
        answers: dto.answers.map((a) => ({ questionId: a.questionId, choiceId: a.choiceId })),
      },
    });
    const completion = isPassed ? await this.completeIfDone(enrollment.id) : null;

    return {
      id: attempt.id,
      courseId: course.id,
      correctCount,
      totalCount: questions.length,
      passCount,
      isPassed,
      // บอกว่าข้อไหนผิดได้ แต่ไม่เฉลยคำตอบจนกว่าจะผ่าน
      results: results.map((r) => ({
        ...r,
        explanation: isPassed ? (questions.find((q) => q.id === r.questionId)?.explanation ?? '') : null,
      })),
      trackCompleted: completion?.completed ?? false,
      certificateId: completion?.certificateId ?? null,
      createdAt: attempt.createdAt,
    };
  }

  // ─────────────── โปรไฟล์ผู้เรียน ───────────────

  async profile(user: CoreHubIdentity, userToken: string) {
    let person: { personCode: string; fullNameTh: string | null } | null = null;
    if (user.coreRole !== 'guest') {
      try {
        person = await this.people.me(userToken);
      } catch {
        person = null; // Core Hub ล่ม → แสดงจาก token แทน
      }
    }
    const [active, completed, withdrawnCount] = await Promise.all([
      this.prisma.enrollment.findFirst({
        where: { coreUserId: user.id, status: 'ACTIVE' },
        include: { track: { select: { id: true, nameTh: true, nameEn: true, color: true, slug: true } } },
      }),
      this.prisma.enrollment.findMany({
        where: { coreUserId: user.id, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        include: {
          track: { select: { id: true, nameTh: true, nameEn: true, color: true, slug: true } },
          certificate: { select: { id: true, certificateNo: true, issuedAt: true } },
        },
      }),
      this.prisma.enrollment.count({ where: { coreUserId: user.id, status: 'WITHDRAWN' } }),
    ]);

    let activeView = null;
    if (active) {
      const tree = await this.loadTree(active.trackId);
      const progress = await this.progressOf(active.id, tree);
      activeView = {
        enrollmentId: active.id,
        enrolledAt: active.enrolledAt,
        track: active.track,
        percent: progress.percent,
        currentCourseId: progress.currentCourseId,
        coursesPassed: progress.courses.filter((c) => c.isPassed).length,
        courseCount: progress.courses.length,
      };
    }
    return {
      id: user.id,
      email: user.email,
      coreRole: user.coreRole,
      subsystemRole: user.subsystemRole,
      personCode: person?.personCode ?? null,
      // ชื่อจาก Core Hub ใช้แสดงผลเท่านั้น ไม่เก็บ (reference-data.md ข้อ 5)
      fullNameTh: person?.fullNameTh ?? null,
      activeEnrollment: activeView,
      completedTracks: completed.map((e) => ({
        enrollmentId: e.id,
        completedAt: e.completedAt,
        track: e.track,
        certificate: e.certificate,
      })),
      withdrawnCount,
    };
  }

  // ─────────────── ภายใน ───────────────

  private async quizContext(user: CoreHubIdentity, courseId: string, requireActive = false) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, include: { track: true } });
    if (!course || !course.isPublished || !course.track.isPublished) {
      if (requireActive) throw validation('ไม่พบวิชาที่เลือก', { field: 'courseId' });
      throw notFound('ไม่พบวิชาที่ต้องการ');
    }
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        coreUserId: user.id,
        trackId: course.trackId,
        status: requireActive ? 'ACTIVE' : { in: ['ACTIVE', 'COMPLETED'] },
      },
      orderBy: { enrolledAt: 'desc' },
    });
    if (!enrollment) throw conflict('NOT_ENROLLED', 'ต้องสมัครเรียนสายงานนี้ก่อน');
    if (enrollment.status === 'COMPLETED') {
      return { course, enrollment, quizState: 'COMPLETED' as const };
    }
    const tree = await this.loadTree(course.trackId);
    const progress = await this.progressOf(enrollment.id, tree);
    const cp = progress.courses.find((c) => c.courseId === course.id);
    return { course, enrollment, quizState: cp?.quizState ?? 'LOCKED' };
  }

  /**
   * ผ่านครบทุกวิชาแล้ว → ปิดการเรียน (COMPLETED) + ออกเกียรติบัตร ในธุรกรรมเดียว
   * updateMany ที่มีเงื่อนไข status = ACTIVE กันการออกเกียรติบัตรซ้ำเมื่อมีคำขอพร้อมกัน
   */
  async completeIfDone(enrollmentId: string): Promise<{ completed: boolean; certificateId: string | null }> {
    return this.prisma.$transaction(async (tx) => {
      const e = await tx.enrollment.findUnique({ where: { id: enrollmentId }, include: { track: true } });
      if (!e || e.status !== 'ACTIVE') return { completed: false, certificateId: null };
      const tree = await this.loadTree(e.trackId, tx);
      const progress = await this.progressOf(e.id, tree, tx);
      if (!progress.isCompleted) return { completed: false, certificateId: null };

      const now = new Date();
      const changed = await tx.enrollment.updateMany({
        where: { id: e.id, status: 'ACTIVE' },
        data: { status: 'COMPLETED', completedAt: now },
      });
      if (changed.count !== 1) return { completed: false, certificateId: null };

      const template =
        e.track.certificateTemplateId ??
        (await tx.certificateTemplate.findFirst({ where: { isDefault: true }, select: { id: true } }))?.id ??
        null;
      const id = randomUUID();
      const certificate = await tx.certificate.create({
        data: {
          id,
          certificateNo: certificateNumber(id, now),
          coreUserId: e.coreUserId,
          personCode: e.personCode,
          trackId: e.trackId,
          enrollmentId: e.id,
          templateId: template,
          issuedAt: now,
        },
      });
      return { completed: true, certificateId: certificate.id };
    });
  }

  private assertOwnOrAny(user: CoreHubIdentity, ownerId: string, anyPermission: Permission) {
    if (ownerId === user.id) return;
    if (hasPermission(user.permissions, anyPermission)) return;
    throw forbidden('คุณดูข้อมูลการเรียนของผู้อื่นไม่ได้');
  }

  private enrollmentView(
    e: Prisma.EnrollmentGetPayload<{
      include: {
        track: { select: { id: true; nameTh: true; nameEn: true; color: true; slug: true } };
        certificate: { select: { id: true } };
      };
    }>,
  ) {
    return {
      id: e.id,
      coreUserId: e.coreUserId,
      personCode: e.personCode,
      trackId: e.trackId,
      track: e.track,
      status: e.status,
      enrolledAt: e.enrolledAt,
      completedAt: e.completedAt,
      withdrawnAt: e.withdrawnAt,
      certificateId: e.certificate?.id ?? null,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  }
}

/** เลขที่เกียรติบัตร: CSMJU-EL-<ปี พ.ศ.>-<8 ตัวแรกของ id> */
export function certificateNumber(id: string, issuedAt: Date): string {
  const yearBe = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(issuedAt),
  ) + 543;
  return `CSMJU-EL-${yearBe}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
