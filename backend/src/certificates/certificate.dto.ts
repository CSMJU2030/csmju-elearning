import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { PaginationDto } from '../common/dto/pagination.dto';

export class ListCertificatesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'trackId ต้องเป็น UUID v4' })
  trackId?: string;

  @ApiPropertyOptional({ enum: ['own', 'any'] })
  @IsOptional()
  @IsIn(['own', 'any'], { message: 'scope ต้องเป็น own หรือ any' })
  scope?: 'own' | 'any';
}

export class CreateCertificateTemplateDto {
  @ApiProperty({ example: 'เทมเพลตมาตรฐาน' })
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกชื่อเทมเพลต' })
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'เกียรติบัตร' })
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกหัวเกียรติบัตร' })
  @MaxLength(120)
  heading!: string;

  @ApiProperty({ description: 'ใช้ {name} {track} {date} {certificateNo} แทนค่าได้' })
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกข้อความในเกียรติบัตร' })
  @MaxLength(1000)
  bodyText!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกชื่อผู้ลงนาม' })
  @MaxLength(120)
  signerName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'กรุณากรอกตำแหน่งผู้ลงนาม' })
  @MaxLength(160)
  signerTitle!: string;

  @ApiPropertyOptional({ description: 'id ของรูปที่อัปโหลดไว้ใน Core Hub (POST /api/v1/images)' })
  @IsOptional()
  @IsUUID('4', { message: 'imageId ต้องเป็น UUID v4' })
  imageId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCertificateTemplateDto extends PartialType(CreateCertificateTemplateDto) {}
