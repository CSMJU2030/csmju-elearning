import { Injectable } from '@nestjs/common';

import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission, hasPermission } from '../auth/permissions';
import { paginated, pageArgs } from '../common/dto/pagination.dto';
import { conflict, notFound, validation } from '../common/errors';
import { ReferenceDataService } from '../core-hub/reference-data.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrackDto, ListTracksDto, UpdateTrackDto } from './track.dto';

const GRADUATES_ON_CARD = 12;

type TrackRow = Prisma.TrackGetPayload<object>;

@Injectable()
export class TracksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reference: ReferenceDataService,
  ) {}

  private canSeeUnpublished(user: CoreHubIdentity) {
    return hasPermission(user.permissions, Permission.TRACK_UPDATE, Permission.CONTENT_MANAGE_OWN);
  }

  async list(user: CoreHubIdentity, dto: ListTracksDto) {
    const where: Prisma.TrackWhereInput =
      dto.includeUnpublished && this.canSeeUnpublished(user) ? {} : { isPublished: true };
    const { skip, take } = pageArgs(dto);
    const [rows, total] = await Promise.all([
      this.prisma.track.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], skip, take }),
      this.prisma.track.count({ where }),
    ]);
    const ids = rows.map((r) => r.id);

    const [courseCounts, statusCounts, mine] = await Promise.all([
      this.prisma.course.groupBy({ by: ['trackId'], where: { trackId: { in: ids }, isPublished: true }, _count: true }),
      this.prisma.enrollment.groupBy({ by: ['trackId', 'status'], where: { trackId: { in: ids } }, _count: true }),
      this.prisma.enrollment.findMany({
        where: { coreUserId: user.id, trackId: { in: ids }, status: { in: ['ACTIVE', 'COMPLETED'] } },
        select: { trackId: true, status: true },
      }),
    ]);

    const countOf = (trackId: string, status: string) =>
      statusCounts.find((c) => c.trackId === trackId && c.status === status)?._count ?? 0;

    return paginated(
      rows.map((t) => ({
        ...this.view(t),
        courseCount: courseCounts.find((c) => c.trackId === t.id)?._count ?? 0,
        learnerCount: countOf(t.id, 'ACTIVE'),
        graduateCount: countOf(t.id, 'COMPLETED'),
        myStatus: mine.find((m) => m.trackId === t.id && m.status === 'COMPLETED')
          ? 'COMPLETED'
          : mine.find((m) => m.trackId === t.id)
            ? 'ACTIVE'
            : null,
      })),
      total,
      dto,
    );
  }

  async findOne(user: CoreHubIdentity, userToken: string, id: string) {
    const track = await this.prisma.track.findUnique({
      where: { id },
      include: {
        courses: {
          where: this.canSeeUnpublished(user) ? {} : { isPublished: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            topics: { include: { videos: { select: { durationSeconds: true } } } },
            _count: { select: { questions: true } },
          },
        },
      },
    });
    if (!track || (!track.isPublished && !this.canSeeUnpublished(user))) {
      throw notFound('ไม่พบสายงานที่ต้องการ');
    }

    const names = await this.reference.courseNames(userToken);
    const [graduates, graduateCount, learnerCount, myEnrollment] = await Promise.all([
      this.prisma.certificate.findMany({
        where: { trackId: id },
        orderBy: { issuedAt: 'desc' },
        take: GRADUATES_ON_CARD,
        select: { id: true, personCode: true, coreUserId: true, issuedAt: true },
      }),
      this.prisma.enrollment.count({ where: { trackId: id, status: 'COMPLETED' } }),
      this.prisma.enrollment.count({ where: { trackId: id, status: 'ACTIVE' } }),
      this.prisma.enrollment.findFirst({
        where: { coreUserId: user.id, trackId: id, status: { in: ['ACTIVE', 'COMPLETED'] } },
        orderBy: { enrolledAt: 'desc' },
        select: { id: true, status: true, enrolledAt: true, completedAt: true },
      }),
    ]);

    return {
      ...this.view(track),
      learnerCount,
      graduateCount,
      courses: track.courses.map((c) => {
        const ref = c.courseCode ? names.get(c.courseCode) : undefined;
        const videos = c.topics.flatMap((t) => t.videos);
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          courseCode: c.courseCode,
          curriculumName: ref?.nameTh ?? null,
          credits: ref?.credits ?? null,
          sortOrder: c.sortOrder,
          isPublished: c.isPublished,
          topicCount: c.topics.length,
          videoCount: videos.length,
          totalDurationSeconds: videos.reduce((sum, v) => sum + v.durationSeconds, 0),
          questionCount: c._count.questions,
          quizPassCount: c.quizPassCount,
        };
      }),
      // ชื่อผู้เรียนจบไม่เก็บในระบบนี้ (reference-data.md ข้อ 8) — แสดงรหัสบุคคลจาก Core Hub
      graduates: graduates.map((g) => ({
        certificateId: g.id,
        personCode: g.personCode,
        issuedAt: g.issuedAt,
        isMe: g.coreUserId === user.id,
      })),
      myEnrollment,
    };
  }

  async graduates(user: CoreHubIdentity, id: string, dto: ListTracksDto) {
    await this.mustExist(id);
    const { skip, take } = pageArgs(dto);
    const where = { trackId: id };
    const [rows, total] = await Promise.all([
      this.prisma.certificate.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip,
        take,
        select: { id: true, personCode: true, coreUserId: true, issuedAt: true, certificateNo: true },
      }),
      this.prisma.certificate.count({ where }),
    ]);
    return paginated(
      rows.map((g) => ({
        certificateId: g.id,
        certificateNo: g.certificateNo,
        personCode: g.personCode,
        issuedAt: g.issuedAt,
        isMe: g.coreUserId === user.id,
      })),
      total,
      dto,
    );
  }

  async create(dto: CreateTrackDto) {
    await this.assertTemplate(dto.certificateTemplateId);
    const slug = await this.uniqueSlug(dto.slug ?? slugify(dto.nameEn ?? '') ?? 'track');
    const track = await this.prisma.track.create({
      data: {
        slug,
        nameTh: dto.nameTh.trim(),
        nameEn: dto.nameEn?.trim() ?? '',
        summary: dto.summary?.trim() ?? '',
        description: dto.description?.trim() ?? '',
        color: dto.color,
        sortOrder: dto.sortOrder ?? (await this.prisma.track.count()),
        isPublished: dto.isPublished ?? true,
        certificateTemplateId: dto.certificateTemplateId ?? null,
      },
    });
    return this.view(track);
  }

  async update(id: string, dto: UpdateTrackDto) {
    await this.mustExist(id);
    await this.assertTemplate(dto.certificateTemplateId);
    if (dto.nameTh !== undefined && dto.nameTh.trim().length === 0) {
      throw validation('กรุณากรอกชื่อสายงาน', { field: 'nameTh' });
    }
    if (dto.slug) {
      const other = await this.prisma.track.findUnique({ where: { slug: dto.slug } });
      if (other && other.id !== id) throw conflict('SLUG_TAKEN', 'slug นี้ถูกใช้แล้ว');
    }
    const track = await this.prisma.track.update({
      where: { id },
      data: {
        nameTh: dto.nameTh?.trim(),
        nameEn: dto.nameEn?.trim(),
        slug: dto.slug,
        summary: dto.summary?.trim(),
        description: dto.description?.trim(),
        color: dto.color,
        sortOrder: dto.sortOrder,
        isPublished: dto.isPublished,
        certificateTemplateId: dto.certificateTemplateId,
      },
    });
    return this.view(track);
  }

  async remove(id: string) {
    await this.mustExist(id);
    const enrollments = await this.prisma.enrollment.count({ where: { trackId: id } });
    if (enrollments > 0) {
      throw conflict('TRACK_HAS_LEARNERS', 'ลบสายงานที่มีผู้เคยสมัครเรียนไม่ได้ ให้ปิดการเผยแพร่แทน', {
        enrollments,
      });
    }
    await this.prisma.track.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async mustExist(id: string) {
    const track = await this.prisma.track.findUnique({ where: { id }, select: { id: true } });
    if (!track) throw notFound('ไม่พบสายงานที่ต้องการ');
  }

  private async assertTemplate(templateId: string | null | undefined) {
    if (!templateId) return;
    const found = await this.prisma.certificateTemplate.findUnique({ where: { id: templateId }, select: { id: true } });
    if (!found) throw validation('ไม่พบเทมเพลตเกียรติบัตรที่เลือก', { field: 'certificateTemplateId' });
  }

  private async uniqueSlug(base: string) {
    const root = base || 'track';
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? root : `${root}-${i + 1}`;
      const taken = await this.prisma.track.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!taken) return candidate;
    }
    return `${root}-${Date.now().toString(36)}`;
  }

  view(t: TrackRow) {
    return {
      id: t.id,
      slug: t.slug,
      nameTh: t.nameTh,
      nameEn: t.nameEn,
      summary: t.summary,
      description: t.description,
      color: t.color,
      sortOrder: t.sortOrder,
      isPublished: t.isPublished,
      certificateTemplateId: t.certificateTemplateId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}

export function slugify(text: string): string | null {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : null;
}
