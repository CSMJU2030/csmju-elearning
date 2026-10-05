import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaginationDto } from '../common/dto/pagination.dto';

export const ENROLLMENT_STATUSES = ['ACTIVE', 'COMPLETED', 'WITHDRAWN'] as const;

export class ListEnrollmentsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ENROLLMENT_STATUSES })
  @IsOptional()
  @IsIn(ENROLLMENT_STATUSES as unknown as string[], { message: 'status ต้องเป็น ACTIVE COMPLETED หรือ WITHDRAWN' })
  status?: (typeof ENROLLMENT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'trackId ต้องเป็น UUID v4' })
  trackId?: string;

  @ApiPropertyOptional({ enum: ['own', 'any'], description: 'any = ของทุกคน (ผู้ดูแลเท่านั้น)' })
  @IsOptional()
  @IsIn(['own', 'any'], { message: 'scope ต้องเป็น own หรือ any' })
  scope?: 'own' | 'any';
}

export class CreateEnrollmentDto {
  @ApiProperty()
  @IsUUID('4', { message: 'trackId ต้องเป็น UUID v4' })
  trackId!: string;
}

export class HeartbeatDto {
  @ApiProperty({ description: 'ตำแหน่งที่กำลังดู (วินาที)' })
  @Type(() => Number)
  @IsInt({ message: 'positionSeconds ต้องเป็นจำนวนเต็ม' })
  @Min(0)
  @Max(6 * 60 * 60)
  positionSeconds!: number;

  @ApiProperty({ description: 'วิดีโอเล่นอยู่ตลอดช่วงตั้งแต่ heartbeat ครั้งก่อนหรือไม่ (false = เริ่มจับเวลารอบใหม่)' })
  @IsBoolean({ message: 'playing ต้องเป็น true หรือ false' })
  playing!: boolean;
}

export class QuizAnswerInput {
  @ApiProperty()
  @IsUUID('4', { message: 'questionId ต้องเป็น UUID v4' })
  questionId!: string;

  @ApiProperty()
  @IsUUID('4', { message: 'choiceId ต้องเป็น UUID v4' })
  choiceId!: string;
}

export class CreateQuizAttemptDto {
  @ApiProperty()
  @IsUUID('4', { message: 'courseId ต้องเป็น UUID v4' })
  courseId!: string;

  @ApiProperty({ type: [QuizAnswerInput] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerInput)
  answers!: QuizAnswerInput[];
}
