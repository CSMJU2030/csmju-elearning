import { Inject, Injectable } from '@nestjs/common';

import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission, hasPermission } from '../auth/permissions';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { paginated, pageArgs, PaginationDto } from '../common/dto/pagination.dto';
import { forbidden, notFound } from '../common/errors';
import { PeopleService } from '../core-hub/people.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCertificateTemplateDto, ListCertificatesDto, UpdateCertificateTemplateDto } from './certificate.dto';

/** ข้อความตั้งต้นเมื่อสายงานไม่มีเทมเพลตและยังไม่ได้ตั้งเทมเพลตตั้งต้น */
const FALLBACK_TEMPLATE = {
  id: null,
  name: 'ตั้งต้นของระบบ',
  heading: 'เกียรติบัตร',
  bodyText: 'ขอมอบเกียรติบัตรฉบับนี้ให้ไว้เพื่อแสดงว่า {name} ได้ผ่านการเรียนรู้ครบทุกวิชาในสายงาน {track}',
  signerName: 'สาขาวิชาวิทยาการคอมพิวเตอร์',
  signerTitle: 'คณะวิทยาศาสตร์ มหาวิทยาลัยแม่โจ้',
  imageId: null,
};

@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(user: CoreHubIdentity, dto: ListCertificatesDto) {
    const any = dto.scope === 'any';
    if (any && !hasPermission(user.permissions, Permission.CERTIFICATE_READ_ANY)) {
      throw forbidden('คุณไม่มีสิทธิ์ดูเกียรติบัตรของผู้อื่น');
    }
    const where: Prisma.CertificateWhereInput = {
      ...(any ? {} : { coreUserId: user.id }),
      ...(dto.trackId ? { trackId: dto.trackId } : {}),
    };
    const { skip, take } = pageArgs(dto);
    const [rows, total] = await Promise.all([
      this.prisma.certificate.findMany({
        where,
        orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
        include: { track: { select: { id: true, nameTh: true, nameEn: true, color: true } } },
      }),
      this.prisma.certificate.count({ where }),
    ]);
    return paginated(
      rows.map((c) => ({
        id: c.id,
        certificateNo: c.certificateNo,
        personCode: c.personCode,
        issuedAt: c.issuedAt,
        track: c.track,
        isMine: c.coreUserId === user.id,
      })),
      total,
      dto,
    );
  }

  /**
   * เกียรติบัตรพร้อมข้อมูลสำหรับวาด — ชื่อผู้รับดึงจาก Core Hub ตอนเปิดดู (ไม่เก็บในระบบ)
   *   เจ้าของ: /people/me → fullNameTh (ไม่มีก็ใช้อีเมลจาก token)
   *   ผู้ดูแล: /people/:personCode
   */
  async findOne(user: CoreHubIdentity, userToken: string, id: string) {
    const c = await this.prisma.certificate.findUnique({
      where: { id },
      include: { track: { select: { id: true, nameTh: true, nameEn: true, color: true } }, template: true },
    });
    if (!c) throw notFound('ไม่พบเกียรติบัตรที่ต้องการ');
    const isMine = c.coreUserId === user.id;
    if (!isMine && !hasPermission(user.permissions, Permission.CERTIFICATE_READ_ANY)) {
      throw forbidden('คุณดูเกียรติบัตรของผู้อื่นไม่ได้');
    }

    let displayName: string | null = null;
    try {
      if (isMine) {
        if (user.coreRole !== 'guest') displayName = (await this.people.me(userToken))?.fullNameTh ?? null;
      } else if (c.personCode) {
        displayName = (await this.people.byCode(userToken, c.personCode))?.fullNameTh ?? null;
      }
    } catch {
      displayName = null; // Core Hub ล่ม → ใช้ค่าสำรองด้านล่าง
    }
    displayName = displayName ?? (isMine ? emailName(user.email) : null) ?? c.personCode ?? 'ผู้เรียน';

    const template =
      c.template ??
      (await this.prisma.certificateTemplate.findFirst({ where: { isDefault: true } })) ??
      FALLBACK_TEMPLATE;

    return {
      id: c.id,
      certificateNo: c.certificateNo,
      issuedAt: c.issuedAt,
      personCode: c.personCode,
      isMine,
      recipientName: displayName,
      track: c.track,
      template: {
        heading: template.heading,
        bodyText: template.bodyText,
        signerName: template.signerName,
        signerTitle: template.signerTitle,
        // ไฟล์รูปของ Core Hub เป็น URL สาธารณะที่ <img> เรียกตรงได้ (reference-data.md ข้อ 6)
        imageUrl: template.imageId ? `${this.config.coreHubUrl}/api/v1/images/${template.imageId}/file` : null,
      },
    };
  }

  // ─────────────── เทมเพลต ───────────────

  async listTemplates(dto: PaginationDto) {
    const { skip, take } = pageArgs(dto);
    const [rows, total] = await Promise.all([
      this.prisma.certificateTemplate.findMany({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        skip,
        take,
        include: { _count: { select: { tracks: true, certificates: true } } },
      }),
      this.prisma.certificateTemplate.count(),
    ]);
    return paginated(
      rows.map((t) => ({ ...this.templateView(t), trackCount: t._count.tracks, certificateCount: t._count.certificates })),
      total,
      dto,
    );
  }

  async getTemplate(id: string) {
    const t = await this.prisma.certificateTemplate.findUnique({ where: { id } });
    if (!t) throw notFound('ไม่พบเทมเพลตเกียรติบัตร');
    return this.templateView(t);
  }

  async createTemplate(dto: CreateCertificateTemplateDto) {
    const created = await this.prisma.$transaction(async (tx) => {
      const isDefault = dto.isDefault ?? (await tx.certificateTemplate.count()) === 0;
      if (isDefault) await tx.certificateTemplate.updateMany({ data: { isDefault: false } });
      return tx.certificateTemplate.create({
        data: {
          name: dto.name.trim(),
          heading: dto.heading.trim(),
          bodyText: dto.bodyText.trim(),
          signerName: dto.signerName.trim(),
          signerTitle: dto.signerTitle.trim(),
          imageId: dto.imageId ?? null,
          isDefault,
        },
      });
    });
    return this.templateView(created);
  }

  async updateTemplate(id: string, dto: UpdateCertificateTemplateDto) {
    await this.getTemplate(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.certificateTemplate.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
      return tx.certificateTemplate.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          heading: dto.heading?.trim(),
          bodyText: dto.bodyText?.trim(),
          signerName: dto.signerName?.trim(),
          signerTitle: dto.signerTitle?.trim(),
          imageId: dto.imageId,
          isDefault: dto.isDefault,
        },
      });
    });
    return this.templateView(updated);
  }

  async removeTemplate(id: string) {
    await this.getTemplate(id);
    // เกียรติบัตรที่ออกไปแล้วกลับไปใช้เทมเพลตตั้งต้น (template_id = NULL)
    await this.prisma.certificateTemplate.delete({ where: { id } });
    return { id, deleted: true };
  }

  private templateView(t: Prisma.CertificateTemplateGetPayload<object>) {
    return {
      id: t.id,
      name: t.name,
      heading: t.heading,
      bodyText: t.bodyText,
      signerName: t.signerName,
      signerTitle: t.signerTitle,
      imageId: t.imageId,
      imageUrl: t.imageId ? `${this.config.coreHubUrl}/api/v1/images/${t.imageId}/file` : null,
      isDefault: t.isDefault,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}

function emailName(email: string | null): string | null {
  if (!email) return null;
  return email.split('@')[0] || null;
}
