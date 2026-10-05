import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, UserToken } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { CreateCertificateTemplateDto, ListCertificatesDto, UpdateCertificateTemplateDto } from './certificate.dto';
import { CertificatesService } from './certificates.service';

@ApiTags('certificates')
@ApiBearerAuth()
@Controller('v1/certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  @RequirePermissions(Permission.CERTIFICATE_READ_OWN, Permission.CERTIFICATE_READ_ANY)
  @ApiOperation({ summary: 'เกียรติบัตรของผู้เรียก (เมนูความสำเร็จ) · scope=any สำหรับผู้ดูแล' })
  list(@CurrentUser() user: CoreHubIdentity, @Query() dto: ListCertificatesDto) {
    return this.certificates.list(user, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.CERTIFICATE_READ_OWN, Permission.CERTIFICATE_READ_ANY)
  @ApiOperation({ summary: 'ข้อมูลเกียรติบัตรสำหรับแสดงและดาวน์โหลด' })
  findOne(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Param('id', UuidPipe) id: string) {
    return this.certificates.findOne(user, token, id);
  }
}

@ApiTags('certificate-templates')
@ApiBearerAuth()
@Controller('v1/certificate-templates')
export class CertificateTemplatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  @RequirePermissions(Permission.CERTIFICATE_TEMPLATE_MANAGE)
  @ApiOperation({ summary: 'เทมเพลตเกียรติบัตร' })
  list(@Query() dto: PaginationDto) {
    return this.certificates.listTemplates(dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.CERTIFICATE_TEMPLATE_MANAGE)
  findOne(@Param('id', UuidPipe) id: string) {
    return this.certificates.getTemplate(id);
  }

  @Post()
  @RequirePermissions(Permission.CERTIFICATE_TEMPLATE_MANAGE)
  @ApiOperation({ summary: 'เพิ่มเทมเพลตเกียรติบัตร' })
  create(@Body() dto: CreateCertificateTemplateDto) {
    return this.certificates.createTemplate(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.CERTIFICATE_TEMPLATE_MANAGE)
  update(@Param('id', UuidPipe) id: string, @Body() dto: UpdateCertificateTemplateDto) {
    return this.certificates.updateTemplate(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.CERTIFICATE_TEMPLATE_MANAGE)
  remove(@Param('id', UuidPipe) id: string) {
    return this.certificates.removeTemplate(id);
  }
}
