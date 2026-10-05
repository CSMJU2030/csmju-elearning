import { Body, Controller, Delete, Get, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

import { CurrentUser, UserToken } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission, hasPermission } from '../auth/permissions';
import { PaginationDto, paginated, pageArgs } from '../common/dto/pagination.dto';
import { conflict, notFound, validation } from '../common/errors';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { PeopleService } from '../core-hub/people.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

class ListAssignmentsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'trackId ต้องเป็น UUID v4' })
  trackId?: string;
}

class CreateAssignmentDto {
  @ApiProperty({ description: 'รหัสบุคลากรใน Core Hub (personCode)' })
  @Matches(/^[A-Za-z0-9._-]{1,64}$/, { message: 'รหัสบุคลากรไม่ถูกต้อง' })
  personCode!: string;

  @ApiPropertyOptional({ description: 'อาจารย์ประจำสายงาน (ดูแลทุกวิชาในสายงาน)' })
  @IsOptional()
  @IsUUID('4', { message: 'trackId ต้องเป็น UUID v4' })
  trackId?: string;

  @ApiPropertyOptional({ description: 'ผู้รับผิดชอบวิชาเดียว' })
  @IsOptional()
  @IsUUID('4', { message: 'courseId ต้องเป็น UUID v4' })
  courseId?: string;
}

/**
 * มอบหมายอาจารย์ประจำสายงาน/วิชา — สิทธิ์ Layer 2 ของระบบนี้ (data-dictionary.md ข้อ 10)
 * ผู้ดูแลเลือกบุคลากรจาก Core Hub แล้ว backend ดึง coreUserId จาก Core Hub เอง (ไม่เชื่อค่าจาก body)
 * ระบบเก็บแค่ person_code + core_user_id ไม่เก็บชื่อ
 */
@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly people: PeopleService,
  ) {}

  async list(user: CoreHubIdentity, dto: ListAssignmentsDto) {
    const all = hasPermission(user.permissions, Permission.ASSIGNMENT_MANAGE, Permission.CONTENT_MANAGE_ANY);
    const where: Prisma.InstructorAssignmentWhereInput = {
      ...(all ? {} : { coreUserId: user.id }),
      ...(dto.trackId ? { OR: [{ trackId: dto.trackId }, { course: { trackId: dto.trackId } }] } : {}),
    };
    const { skip, take } = pageArgs(dto);
    const [rows, total] = await Promise.all([
      this.prisma.instructorAssignment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
        include: {
          track: { select: { id: true, nameTh: true, color: true } },
          course: { select: { id: true, title: true, track: { select: { id: true, nameTh: true, color: true } } } },
        },
      }),
      this.prisma.instructorAssignment.count({ where }),
    ]);
    return paginated(
      rows.map((a) => ({
        id: a.id,
        personCode: a.personCode,
        coreUserId: a.coreUserId,
        scope: a.trackId ? 'TRACK' : 'COURSE',
        track: a.track ?? a.course?.track ?? null,
        course: a.course ? { id: a.course.id, title: a.course.title } : null,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      total,
      dto,
    );
  }

  async create(user: CoreHubIdentity, token: string, dto: CreateAssignmentDto) {
    if (Boolean(dto.trackId) === Boolean(dto.courseId)) {
      throw validation('เลือกสายงาน หรือ วิชา อย่างใดอย่างหนึ่ง', { field: dto.trackId ? 'courseId' : 'trackId' });
    }
    if (dto.trackId && !(await this.prisma.track.findUnique({ where: { id: dto.trackId }, select: { id: true } }))) {
      throw validation('ไม่พบสายงานที่เลือก', { field: 'trackId' });
    }
    if (dto.courseId && !(await this.prisma.course.findUnique({ where: { id: dto.courseId }, select: { id: true } }))) {
      throw validation('ไม่พบวิชาที่เลือก', { field: 'courseId' });
    }
    const person = await this.people.byCode(token, dto.personCode);
    if (!person) throw validation(`ไม่พบบุคลากรรหัส ${dto.personCode} ในข้อมูลกลาง`, { field: 'personCode' });
    if (person.personType !== 'STAFF') {
      throw validation('มอบหมายได้เฉพาะบุคลากร (อาจารย์/เจ้าหน้าที่)', { field: 'personCode' });
    }
    const duplicate = await this.prisma.instructorAssignment.findFirst({
      where: { personCode: person.personCode, trackId: dto.trackId ?? null, courseId: dto.courseId ?? null },
    });
    if (duplicate) throw conflict('ALREADY_ASSIGNED', 'บุคลากรนี้ได้รับมอบหมายรายการนี้อยู่แล้ว');

    const a = await this.prisma.instructorAssignment.create({
      data: {
        personCode: person.personCode,
        coreUserId: person.coreUserId,
        trackId: dto.trackId ?? null,
        courseId: dto.courseId ?? null,
        assignedByCoreUserId: user.id,
      },
    });
    return {
      id: a.id,
      personCode: a.personCode,
      coreUserId: a.coreUserId,
      scope: a.trackId ? 'TRACK' : 'COURSE',
      trackId: a.trackId,
      courseId: a.courseId,
      // ชื่อส่งกลับไปแสดงตอนนี้เท่านั้น ไม่ได้เก็บลงฐาน
      fullNameTh: person.fullNameTh,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }

  async remove(id: string) {
    const found = await this.prisma.instructorAssignment.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw notFound('ไม่พบการมอบหมายที่ต้องการ');
    await this.prisma.instructorAssignment.delete({ where: { id } });
    return { id, deleted: true };
  }
}

@ApiTags('instructor-assignments')
@ApiBearerAuth()
@Controller('v1/instructor-assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  @RequirePermissions(Permission.ASSIGNMENT_READ, Permission.ASSIGNMENT_MANAGE)
  @ApiOperation({ summary: 'อาจารย์ประจำสายงาน/วิชา (อาจารย์เห็นเฉพาะของตัวเอง)' })
  list(@CurrentUser() user: CoreHubIdentity, @Query() dto: ListAssignmentsDto) {
    return this.assignments.list(user, dto);
  }

  @Post()
  @RequirePermissions(Permission.ASSIGNMENT_MANAGE)
  @ApiOperation({ summary: 'มอบหมายอาจารย์ให้ดูแลสายงานหรือวิชา' })
  create(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Body() dto: CreateAssignmentDto) {
    return this.assignments.create(user, token, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.ASSIGNMENT_MANAGE)
  @ApiOperation({ summary: 'ยกเลิกการมอบหมาย' })
  remove(@Param('id', UuidPipe) id: string) {
    return this.assignments.remove(id);
  }
}

@Module({ controllers: [AssignmentsController], providers: [AssignmentsService] })
export class AssignmentsModule {}
