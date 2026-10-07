import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { PaginationDto } from '../common/dto/pagination.dto';
import { QueryBoolean } from '../common/dto/query-boolean';

export const TRACK_COLORS = ['BLUE', 'PURPLE', 'RED', 'YELLOW', 'TEAL'] as const;
export type TrackColorValue = (typeof TRACK_COLORS)[number];

export class ListTracksDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'ผู้ดูแลเห็นสายงานที่ยังไม่เผยแพร่ด้วย' })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean({ message: 'includeUnpublished ต้องเป็น true หรือ false' })
  includeUnpublished?: boolean;
}

export class CreateTrackDto {
  @ApiProperty({ example: 'นักพัฒนาซอฟต์แวร์' })
  @IsString({ message: 'nameTh ต้องเป็นข้อความ' })
  @MinLength(1, { message: 'กรุณากรอกชื่อสายงาน' })
  @MaxLength(120, { message: 'ชื่อสายงานยาวได้ไม่เกิน 120 ตัวอักษร' })
  nameTh!: string;

  @ApiPropertyOptional({ example: 'Programmer / Software Developer' })
  @IsOptional()
  @IsString()
  @MaxLength(120, { message: 'ชื่อภาษาอังกฤษยาวได้ไม่เกิน 120 ตัวอักษร' })
  nameEn?: string;

  @ApiPropertyOptional({ description: 'ตัวระบุใน URL (a-z 0-9 -) · ไม่ส่งมาระบบสร้างให้' })
  @IsOptional()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'slug ใช้ได้เฉพาะ a-z 0-9 และ -' })
  @MaxLength(60)
  slug?: string;

  @ApiPropertyOptional({ description: 'คำอธิบายสั้นบนการ์ด' })
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'คำอธิบายสั้นยาวได้ไม่เกิน 300 ตัวอักษร' })
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ enum: TRACK_COLORS })
  @IsIn(TRACK_COLORS as unknown as string[], { message: 'color ต้องเป็น BLUE PURPLE RED YELLOW หรือ TEAL' })
  color!: TrackColorValue;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'เทมเพลตเกียรติบัตรของสายงาน · ไม่ระบุใช้เทมเพลตตั้งต้น' })
  @IsOptional()
  @IsUUID('4', { message: 'certificateTemplateId ต้องเป็น UUID v4' })
  certificateTemplateId?: string | null;
}

export class UpdateTrackDto extends PartialType(CreateTrackDto) {}
