import { Injectable } from '@nestjs/common';

import { ContentAccessService } from '../access/content-access.service';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { paginated, pageArgs } from '../common/dto/pagination.dto';
import { notFound, validation } from '../common/errors';
import { CoreHubClient } from '../core-hub/core-hub.client';
import { ReferenceDataService } from '../core-hub/reference-data.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCourseDto,
  CreateQuestionDto,
  CreateTopicDto,
  CreateVideoDto,
  ListCoursesDto,
  ListQuestionsDto,
  QuizChoiceInput,
  UpdateCourseDto,
  UpdateQuestionDto,
  UpdateTopicDto,
  UpdateVideoDto,
} from './content.dto';

/**
 * เนื้อหาของสายงาน: วิชา → หัวข้อ → วิดีโอ และแบบทดสอบท้ายวิชา
 * ทุกการแก้ไขผ่าน ContentAccessService (content:manage:any หรืออาจารย์ที่ได้รับมอบหมาย)
 */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ContentAccessService,
    private readonly reference: ReferenceDataService,
  ) {}

  // ─────────────── วิชา ───────────────

  async listCourses(user: CoreHubIdentity, token: string, dto: ListCoursesDto) {
    let manage = false;
    if (dto.includeUnpublished) {
      manage =
        this.access.canManageAny(user) ||
        (dto.trackId ? await this.access.canManageTrack(user, token, dto.trackId) : false);
    }
    const where: Prisma.CourseWhereInput = {
      ...(dto.trackId ? { trackId: dto.trackId } : {}),
      ...(manage ? {} : { isPublished: true, track: { isPublished: true } }),
    };
    const { skip, take } = pageArgs(dto);
    const [rows, total, names] = await Promise.all([
      this.prisma.course.findMany({
        where,
        orderBy: [{ trackId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        skip,
        take,
        include: { _count: { select: { topics: true, questions: true } } },
      }),
      this.prisma.course.count({ where }),
      this.reference.courseNames(token),
    ]);
    return paginated(
      rows.map((c) => ({
        ...this.courseView(c),
        curriculumName: c.courseCode ? (names.get(c.courseCode)?.nameTh ?? null) : null,
        topicCount: c._count.topics,
        questionCount: c._count.questions,
      })),
      total,
      dto,
    );
  }

  async getCourse(user: CoreHubIdentity, token: string, id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        track: { select: { id: true, nameTh: true, color: true, isPublished: true } },
        topics: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { videos: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
        },
        _count: { select: { questions: true } },
      },
    });
    if (!course) throw notFound('ไม่พบวิชาที่ต้องการ');
    const canManage = await this.access.canManageCourse(user, token, course);
    if (!canManage && (!course.isPublished || !course.track.isPublished)) throw notFound('ไม่พบวิชาที่ต้องการ');

    const names = await this.reference.courseNames(token);
    const ref = course.courseCode ? names.get(course.courseCode) : undefined;
    return {
      ...this.courseView(course),
      curriculumName: ref?.nameTh ?? null,
      curriculumNameEn: ref?.nameEn ?? null,
      credits: ref?.credits ?? null,
      track: { id: course.track.id, nameTh: course.track.nameTh, color: course.track.color },
      questionCount: course._count.questions,
      canManage,
      topics: course.topics.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        sortOrder: t.sortOrder,
        videos: t.videos.map((v) => ({
          id: v.id,
          title: v.title,
          durationSeconds: v.durationSeconds,
          sortOrder: v.sortOrder,
          // ลิงก์วิดีโอส่งให้ผู้ดูแลเท่านั้น — ผู้เรียกได้ลิงก์จากหน้าเรียนเมื่อปลดล็อกแล้ว
          ...(canManage ? { videoUrl: v.videoUrl } : {}),
        })),
      })),
    };
  }

  async createCourse(user: CoreHubIdentity, token: string, dto: CreateCourseDto) {
    const track = await this.prisma.track.findUnique({ where: { id: dto.trackId }, select: { id: true } });
    if (!track) throw validation('ไม่พบสายงานที่เลือก', { field: 'trackId' });
    await this.access.assertTrack(user, token, track.id);
    await this.assertCourseCode(dto.courseCode, token);
    const count = await this.prisma.course.count({ where: { trackId: track.id } });
    const course = await this.prisma.course.create({
      data: {
        trackId: track.id,
        title: dto.title.trim(),
        courseCode: dto.courseCode ?? null,
        description: dto.description?.trim() ?? '',
        quizPassCount: dto.quizPassCount ?? 1,
        sortOrder: dto.sortOrder ?? count,
        isPublished: dto.isPublished ?? true,
      },
    });
    return this.courseView(course);
  }

  async updateCourse(user: CoreHubIdentity, token: string, id: string, dto: UpdateCourseDto) {
    const course = await this.mustCourse(id);
    await this.access.assertCourse(user, token, course);
    if (dto.courseCode !== undefined && dto.courseCode !== course.courseCode) {
      await this.assertCourseCode(dto.courseCode, token);
    }
    const updated = await this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        courseCode: dto.courseCode,
        description: dto.description?.trim(),
        quizPassCount: dto.quizPassCount,
        sortOrder: dto.sortOrder,
        isPublished: dto.isPublished,
      },
    });
    return this.courseView(updated);
  }

  async removeCourse(user: CoreHubIdentity, token: string, id: string) {
    const course = await this.mustCourse(id);
    await this.access.assertTrack(user, token, course.trackId);
    await this.prisma.course.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ─────────────── หัวข้อ ───────────────

  async createTopic(user: CoreHubIdentity, token: string, dto: CreateTopicDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw validation('ไม่พบวิชาที่เลือก', { field: 'courseId' });
    await this.access.assertCourse(user, token, course);
    const count = await this.prisma.topic.count({ where: { courseId: course.id } });
    const topic = await this.prisma.topic.create({
      data: {
        courseId: course.id,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        sortOrder: dto.sortOrder ?? count,
      },
    });
    return this.topicView(topic);
  }

  async updateTopic(user: CoreHubIdentity, token: string, id: string, dto: UpdateTopicDto) {
    const topic = await this.prisma.topic.findUnique({ where: { id }, include: { course: true } });
    if (!topic) throw notFound('ไม่พบหัวข้อที่ต้องการ');
    await this.access.assertCourse(user, token, topic.course);
    const updated = await this.prisma.topic.update({
      where: { id },
      data: { title: dto.title?.trim(), description: dto.description?.trim(), sortOrder: dto.sortOrder },
    });
    return this.topicView(updated);
  }

  async removeTopic(user: CoreHubIdentity, token: string, id: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id }, include: { course: true } });
    if (!topic) throw notFound('ไม่พบหัวข้อที่ต้องการ');
    await this.access.assertCourse(user, token, topic.course);
    await this.prisma.topic.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ─────────────── วิดีโอ ───────────────

  async createVideo(user: CoreHubIdentity, token: string, dto: CreateVideoDto) {
    const topic = await this.prisma.topic.findUnique({ where: { id: dto.topicId }, include: { course: true } });
    if (!topic) throw validation('ไม่พบหัวข้อที่เลือก', { field: 'topicId' });
    await this.access.assertCourse(user, token, topic.course);
    const count = await this.prisma.video.count({ where: { topicId: topic.id } });
    const video = await this.prisma.video.create({
      data: {
        topicId: topic.id,
        title: dto.title.trim(),
        videoUrl: dto.videoUrl.trim(),
        durationSeconds: dto.durationSeconds,
        sortOrder: dto.sortOrder ?? count,
      },
    });
    return this.videoView(video);
  }

  async updateVideo(user: CoreHubIdentity, token: string, id: string, dto: UpdateVideoDto) {
    const video = await this.prisma.video.findUnique({ where: { id }, include: { topic: { include: { course: true } } } });
    if (!video) throw notFound('ไม่พบวิดีโอที่ต้องการ');
    await this.access.assertCourse(user, token, video.topic.course);
    const updated = await this.prisma.video.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        videoUrl: dto.videoUrl?.trim(),
        durationSeconds: dto.durationSeconds,
        sortOrder: dto.sortOrder,
      },
    });
    return this.videoView(updated);
  }

  async removeVideo(user: CoreHubIdentity, token: string, id: string) {
    const video = await this.prisma.video.findUnique({ where: { id }, include: { topic: { include: { course: true } } } });
    if (!video) throw notFound('ไม่พบวิดีโอที่ต้องการ');
    await this.access.assertCourse(user, token, video.topic.course);
    await this.prisma.video.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ─────────────── แบบทดสอบ (มุมมองผู้ดูแล — มีเฉลย) ───────────────

  async listQuestions(user: CoreHubIdentity, token: string, dto: ListQuestionsDto) {
    const course = await this.mustCourse(dto.courseId);
    await this.access.assertCourse(user, token, course);
    const where = { courseId: course.id };
    const { skip, take } = pageArgs(dto);
    const [rows, total] = await Promise.all([
      this.prisma.quizQuestion.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        skip,
        take,
        include: { choices: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
      }),
      this.prisma.quizQuestion.count({ where }),
    ]);
    return paginated(rows.map((q) => this.questionView(q)), total, dto);
  }

  async createQuestion(user: CoreHubIdentity, token: string, dto: CreateQuestionDto) {
    const course = await this.prisma.course.findUnique({ where: { id: dto.courseId } });
    if (!course) throw validation('ไม่พบวิชาที่เลือก', { field: 'courseId' });
    await this.access.assertCourse(user, token, course);
    assertChoices(dto.choices);
    const count = await this.prisma.quizQuestion.count({ where: { courseId: course.id } });
    const question = await this.prisma.quizQuestion.create({
      data: {
        courseId: course.id,
        prompt: dto.prompt.trim(),
        explanation: dto.explanation?.trim() ?? '',
        sortOrder: dto.sortOrder ?? count,
        choices: { create: dto.choices.map((c, i) => ({ label: c.label.trim(), isCorrect: c.isCorrect, sortOrder: i })) },
      },
      include: { choices: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.questionView(question);
  }

  async updateQuestion(user: CoreHubIdentity, token: string, id: string, dto: UpdateQuestionDto) {
    const question = await this.prisma.quizQuestion.findUnique({ where: { id }, include: { course: true } });
    if (!question) throw notFound('ไม่พบคำถามที่ต้องการ');
    await this.access.assertCourse(user, token, question.course);
    if (dto.choices) assertChoices(dto.choices);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.choices) {
        await tx.quizChoice.deleteMany({ where: { questionId: id } });
        await tx.quizChoice.createMany({
          data: dto.choices.map((c, i) => ({ questionId: id, label: c.label.trim(), isCorrect: c.isCorrect, sortOrder: i })),
        });
      }
      return tx.quizQuestion.update({
        where: { id },
        data: { prompt: dto.prompt?.trim(), explanation: dto.explanation?.trim(), sortOrder: dto.sortOrder },
        include: { choices: { orderBy: { sortOrder: 'asc' } } },
      });
    });
    return this.questionView(updated);
  }

  async removeQuestion(user: CoreHubIdentity, token: string, id: string) {
    const question = await this.prisma.quizQuestion.findUnique({ where: { id }, include: { course: true } });
    if (!question) throw notFound('ไม่พบคำถามที่ต้องการ');
    await this.access.assertCourse(user, token, question.course);
    await this.prisma.quizQuestion.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ─────────────── helpers ───────────────

  private async mustCourse(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw notFound('ไม่พบวิชาที่ต้องการ');
    return course;
  }

  /** code ต้องมีจริงและเปิดใช้ใน Core Hub (reference-data.md ข้อ 8) */
  private async assertCourseCode(code: string | null | undefined, token: string) {
    if (!code) return;
    let ok: boolean;
    try {
      ok = await this.reference.isActiveCourse(code, token);
    } catch (e) {
      return CoreHubClient.toHttp(e);
    }
    if (!ok) throw validation(`ไม่พบรายวิชา ${code} ในข้อมูลกลางของ Core Hub`, { field: 'courseCode' });
  }

  courseView(c: Prisma.CourseGetPayload<object>) {
    return {
      id: c.id,
      trackId: c.trackId,
      courseCode: c.courseCode,
      title: c.title,
      description: c.description,
      sortOrder: c.sortOrder,
      quizPassCount: c.quizPassCount,
      isPublished: c.isPublished,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private topicView(t: Prisma.TopicGetPayload<object>) {
    return { id: t.id, courseId: t.courseId, title: t.title, description: t.description, sortOrder: t.sortOrder, createdAt: t.createdAt, updatedAt: t.updatedAt };
  }

  private videoView(v: Prisma.VideoGetPayload<object>) {
    return {
      id: v.id,
      topicId: v.topicId,
      title: v.title,
      videoUrl: v.videoUrl,
      durationSeconds: v.durationSeconds,
      sortOrder: v.sortOrder,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  }

  private questionView(q: Prisma.QuizQuestionGetPayload<{ include: { choices: true } }>) {
    return {
      id: q.id,
      courseId: q.courseId,
      prompt: q.prompt,
      explanation: q.explanation,
      sortOrder: q.sortOrder,
      choices: q.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: c.isCorrect })),
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };
  }
}

function assertChoices(choices: QuizChoiceInput[]) {
  const correct = choices.filter((c) => c.isCorrect).length;
  if (correct !== 1) {
    throw validation('ต้องเลือกคำตอบที่ถูกต้อง 1 ข้อ', { field: 'choices' });
  }
}
