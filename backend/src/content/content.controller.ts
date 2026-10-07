import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, UserToken } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import {
  CreateCourseDto,
  CreateQuestionDto,
  CreateTopicDto,
  CreateVideoDto,
  ListCoursesDto,
  ListQuestionsDto,
  UpdateCourseDto,
  UpdateQuestionDto,
  UpdateTopicDto,
  UpdateVideoDto,
} from './content.dto';
import { ContentService } from './content.service';

const MANAGE = [Permission.CONTENT_MANAGE_ANY, Permission.CONTENT_MANAGE_OWN] as const;

@ApiTags('courses')
@ApiBearerAuth()
@Controller('v1/courses')
export class CoursesController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @RequirePermissions(Permission.CONTENT_READ)
  @ApiOperation({ summary: 'วิชาในสายงาน' })
  list(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Query() dto: ListCoursesDto) {
    return this.content.listCourses(user, token, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.CONTENT_READ)
  @ApiOperation({ summary: 'โครงวิชา (หัวข้อ · วิดีโอ) · ลิงก์วิดีโอเฉพาะผู้ดูแล' })
  findOne(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Param('id', UuidPipe) id: string) {
    return this.content.getCourse(user, token, id);
  }

  @Post()
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'เพิ่มวิชาในสายงาน' })
  create(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Body() dto: CreateCourseDto) {
    return this.content.createCourse(user, token, dto);
  }

  @Patch(':id')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'แก้ไขวิชา (รวมจำนวนข้อที่ต้องตอบถูก)' })
  update(
    @CurrentUser() user: CoreHubIdentity,
    @UserToken() token: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.content.updateCourse(user, token, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'ลบวิชา' })
  remove(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Param('id', UuidPipe) id: string) {
    return this.content.removeCourse(user, token, id);
  }
}

@ApiTags('topics')
@ApiBearerAuth()
@Controller('v1/topics')
export class TopicsController {
  constructor(private readonly content: ContentService) {}

  @Post()
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'เพิ่มหัวข้อในวิชา' })
  create(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Body() dto: CreateTopicDto) {
    return this.content.createTopic(user, token, dto);
  }

  @Patch(':id')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'แก้ไขหัวข้อ' })
  update(
    @CurrentUser() user: CoreHubIdentity,
    @UserToken() token: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateTopicDto,
  ) {
    return this.content.updateTopic(user, token, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'ลบหัวข้อ (และวิดีโอในหัวข้อ)' })
  remove(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Param('id', UuidPipe) id: string) {
    return this.content.removeTopic(user, token, id);
  }
}

@ApiTags('videos')
@ApiBearerAuth()
@Controller('v1/videos')
export class VideosController {
  constructor(private readonly content: ContentService) {}

  @Post()
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'เพิ่มวิดีโอการสอนในหัวข้อ' })
  create(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Body() dto: CreateVideoDto) {
    return this.content.createVideo(user, token, dto);
  }

  @Patch(':id')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'แก้ไขวิดีโอ' })
  update(
    @CurrentUser() user: CoreHubIdentity,
    @UserToken() token: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateVideoDto,
  ) {
    return this.content.updateVideo(user, token, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'ลบวิดีโอ' })
  remove(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Param('id', UuidPipe) id: string) {
    return this.content.removeVideo(user, token, id);
  }
}

@ApiTags('quiz-questions')
@ApiBearerAuth()
@Controller('v1/quiz-questions')
export class QuizQuestionsController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'คำถามแบบทดสอบของวิชา (มีเฉลย — ผู้ดูแลเท่านั้น)' })
  list(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Query() dto: ListQuestionsDto) {
    return this.content.listQuestions(user, token, dto);
  }

  @Post()
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'เพิ่มคำถามแบบทดสอบท้ายวิชา' })
  create(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Body() dto: CreateQuestionDto) {
    return this.content.createQuestion(user, token, dto);
  }

  @Patch(':id')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'แก้ไขคำถาม (ส่ง choices มา = แทนที่ตัวเลือกทั้งหมด)' })
  update(
    @CurrentUser() user: CoreHubIdentity,
    @UserToken() token: string,
    @Param('id', UuidPipe) id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.content.updateQuestion(user, token, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(...MANAGE)
  @ApiOperation({ summary: 'ลบคำถาม' })
  remove(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Param('id', UuidPipe) id: string) {
    return this.content.removeQuestion(user, token, id);
  }
}
