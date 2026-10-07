import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { PaginationDto } from '../common/dto/pagination.dto';
import { QueryBoolean } from '../common/dto/query-boolean';

const ORDER = () => [Type(() => Number), IsInt({ message: 'sortOrder ต้องเป็นจำนวนเต็ม' }), Min(0), Max(9999)];
function SortOrder(): PropertyDecorator {
  return (target, key) => ORDER().forEach((d) => d(target, key));
}

// ─────────────── วิชา ───────────────

export class ListCoursesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'trackId ต้องเป็น UUID v4' })
  trackId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @QueryBoolean()
  @IsBoolean({ message: 'includeUnpublished ต้องเป็น true หรือ false' })
  includeUnpublished?: boolean;
}

export class CreateCourseDto {
  @ApiProperty()
  @IsUUID('4', { message: 'trackId ต้องเป็น UUID v4' })
  trackId!: string;

  @ApiProperty({ example: 'พื้นฐานการเขียนโปรแกรม' })
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกชื่อวิชา' })
  @MaxLength(160, { message: 'ชื่อวิชายาวได้ไม่เกิน 160 ตัวอักษร' })
  title!: string;

  @ApiPropertyOptional({ description: 'รหัสวิชาของ Core Hub (code เต็มรวมรุ่น) เช่น 10301111-68' })
  @IsOptional()
  @Matches(/^[A-Z0-9-]{1,50}$/, { message: 'รหัสวิชาใช้ได้เฉพาะ A-Z 0-9 และ - (ไม่เกิน 50 ตัว)' })
  courseCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'จำนวนข้อที่ต้องตอบถูกจึงจะผ่านแบบทดสอบ', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quizPassCount ต้องเป็นจำนวนเต็ม' })
  @Min(1, { message: 'จำนวนข้อที่ต้องผ่านต้องอย่างน้อย 1 ข้อ' })
  @Max(200)
  quizPassCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @SortOrder()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateCourseDto extends PartialType(OmitType(CreateCourseDto, ['trackId'] as const)) {}

// ─────────────── หัวข้อ ───────────────

export class CreateTopicDto {
  @ApiProperty()
  @IsUUID('4', { message: 'courseId ต้องเป็น UUID v4' })
  courseId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกชื่อหัวข้อ' })
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @SortOrder()
  sortOrder?: number;
}

export class UpdateTopicDto extends PartialType(OmitType(CreateTopicDto, ['courseId'] as const)) {}

// ─────────────── วิดีโอ ───────────────

export class CreateVideoDto {
  @ApiProperty()
  @IsUUID('4', { message: 'topicId ต้องเป็น UUID v4' })
  topicId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกชื่อวิดีโอ' })
  @MaxLength(160)
  title!: string;

  @ApiProperty({ description: 'ลิงก์ YouTube หรือไฟล์วิดีโอ https' })
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'ลิงก์วิดีโอต้องขึ้นต้นด้วย https://' })
  @MaxLength(1000)
  videoUrl!: string;

  @ApiProperty({ description: 'ความยาว (วินาที)' })
  @Type(() => Number)
  @IsInt({ message: 'ความยาววิดีโอต้องเป็นจำนวนเต็ม (วินาที)' })
  @Min(1, { message: 'ความยาววิดีโออย่างน้อย 1 วินาที' })
  @Max(6 * 60 * 60, { message: 'ความยาววิดีโอไม่เกิน 6 ชั่วโมง' })
  durationSeconds!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @SortOrder()
  sortOrder?: number;
}

export class UpdateVideoDto extends PartialType(OmitType(CreateVideoDto, ['topicId'] as const)) {}

// ─────────────── แบบทดสอบ ───────────────

export class QuizChoiceInput {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกตัวเลือก' })
  @MaxLength(500)
  label!: string;

  @ApiProperty()
  @IsBoolean()
  isCorrect!: boolean;
}

export class ListQuestionsDto extends PaginationDto {
  @ApiProperty()
  @IsUUID('4', { message: 'courseId ต้องเป็น UUID v4' })
  courseId!: string;
}

export class CreateQuestionDto {
  @ApiProperty()
  @IsUUID('4', { message: 'courseId ต้องเป็น UUID v4' })
  courseId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกคำถาม' })
  @MaxLength(2000)
  prompt!: string;

  @ApiPropertyOptional({ description: 'คำอธิบายเฉลย (แสดงหลังทำแบบทดสอบผ่าน)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string;

  @ApiProperty({ type: [QuizChoiceInput] })
  @IsArray()
  @ArrayMinSize(2, { message: 'ต้องมีตัวเลือกอย่างน้อย 2 ข้อ' })
  @ArrayMaxSize(8, { message: 'ตัวเลือกไม่เกิน 8 ข้อ' })
  @ValidateNested({ each: true })
  @Type(() => QuizChoiceInput)
  choices!: QuizChoiceInput[];

  @ApiPropertyOptional()
  @IsOptional()
  @SortOrder()
  sortOrder?: number;
}

export class UpdateQuestionDto extends PartialType(OmitType(CreateQuestionDto, ['courseId'] as const)) {}
