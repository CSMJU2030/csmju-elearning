import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, UserToken } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { CreateEnrollmentDto, CreateQuizAttemptDto, HeartbeatDto, ListEnrollmentsDto } from './learning.dto';
import { LearningService } from './learning.service';

@ApiTags('enrollments')
@ApiBearerAuth()
@Controller('v1/enrollments')
export class EnrollmentsController {
  constructor(private readonly learning: LearningService) {}

  @Get()
  @RequirePermissions(Permission.ENROLLMENT_READ_OWN, Permission.ENROLLMENT_READ_ANY)
  @ApiOperation({ summary: 'การสมัครเรียนของผู้เรียก (scope=any = ของทุกคน สำหรับผู้ดูแล)' })
  list(@CurrentUser() user: CoreHubIdentity, @Query() dto: ListEnrollmentsDto) {
    return this.learning.listEnrollments(user, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.ENROLLMENT_READ_OWN, Permission.ENROLLMENT_READ_ANY)
  @ApiOperation({ summary: 'ความคืบหน้ารายวิชาของการสมัครเรียน' })
  findOne(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidPipe) id: string) {
    return this.learning.getEnrollment(user, id);
  }

  @Post()
  @RequirePermissions(Permission.ENROLLMENT_CREATE_OWN)
  @ApiOperation({ summary: 'สมัครเรียนสายงาน (กำลังเรียนได้ทีละ 1 สายงาน · 409 ถ้ามีสายงานที่ยังเรียนไม่จบ)' })
  create(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Body() dto: CreateEnrollmentDto) {
    return this.learning.enroll(user, token, dto);
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  @RequirePermissions(Permission.ENROLLMENT_UPDATE_OWN)
  @ApiOperation({ summary: 'ออกจากสายงาน — ความคืบหน้าในสายงานนี้ถูกล้างเป็น 0' })
  withdraw(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidPipe) id: string) {
    return this.learning.withdraw(user, id);
  }
}

@ApiTags('learning')
@ApiBearerAuth()
@Controller('v1')
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('courses/:id/outline')
  @RequirePermissions(Permission.CONTENT_READ)
  @ApiOperation({ summary: 'บทเรียนของวิชาพร้อมสถานะ (ล็อก/เรียนได้/จบแล้ว) ของผู้เรียก' })
  outline(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidPipe) id: string) {
    return this.learning.outline(user, id);
  }

  @Post('videos/:id/heartbeats')
  @HttpCode(200)
  @RequirePermissions(Permission.LEARNING_UPDATE_OWN)
  @ApiOperation({ summary: 'บันทึกเวลาเรียนจริง (heartbeat ทุก ~10 วินาทีระหว่างวิดีโอเล่น)' })
  heartbeat(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidPipe) id: string, @Body() dto: HeartbeatDto) {
    return this.learning.heartbeat(user, id, dto);
  }

  @Get('courses/:id/quiz')
  @RequirePermissions(Permission.QUIZ_ATTEMPT_CREATE_OWN)
  @ApiOperation({ summary: 'คำถามแบบทดสอบท้ายวิชา (ไม่มีเฉลย)' })
  quiz(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidPipe) id: string) {
    return this.learning.quiz(user, id);
  }

  @Post('quiz-attempts')
  @RequirePermissions(Permission.QUIZ_ATTEMPT_CREATE_OWN)
  @ApiOperation({ summary: 'ส่งคำตอบแบบทดสอบ — ผ่านวิชาสุดท้าย = จบสายงาน + ได้เกียรติบัตร' })
  submit(@CurrentUser() user: CoreHubIdentity, @Body() dto: CreateQuizAttemptDto) {
    return this.learning.submitQuiz(user, dto);
  }

  @Get('learner-profile')
  @RequirePermissions(Permission.TRACK_READ)
  @ApiOperation({ summary: 'โปรไฟล์ผู้เรียก: สายงานที่กำลังเรียน · สายงานที่จบแล้ว (ชื่อจาก Core Hub ไม่เก็บ)' })
  profile(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string) {
    return this.learning.profile(user, token);
  }
}
