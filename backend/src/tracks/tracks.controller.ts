import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, UserToken } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { CoreHubIdentity } from '../auth/core-hub-identity';
import { Permission } from '../auth/permissions';
import { UuidPipe } from '../common/pipes/uuid.pipe';
import { CreateTrackDto, ListTracksDto, UpdateTrackDto } from './track.dto';
import { TracksService } from './tracks.service';

@ApiTags('tracks')
@ApiBearerAuth()
@Controller('v1/tracks')
export class TracksController {
  constructor(private readonly tracks: TracksService) {}

  @Get()
  @RequirePermissions(Permission.TRACK_READ)
  @ApiOperation({ summary: 'สายงานทั้งหมด พร้อมจำนวนผู้เรียน/ผู้เรียนจบ และสถานะของผู้เรียก' })
  list(@CurrentUser() user: CoreHubIdentity, @Query() dto: ListTracksDto) {
    return this.tracks.list(user, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.TRACK_READ)
  @ApiOperation({ summary: 'รายละเอียดสายงาน วิชาที่ต้องเรียน และรายชื่อผู้เรียนจบล่าสุด' })
  findOne(@CurrentUser() user: CoreHubIdentity, @UserToken() token: string, @Param('id', UuidPipe) id: string) {
    return this.tracks.findOne(user, token, id);
  }

  @Get(':id/graduates')
  @RequirePermissions(Permission.TRACK_READ)
  @ApiOperation({ summary: 'ผู้เรียนจบสายงานนี้ (รหัสบุคคล · วันที่ได้เกียรติบัตร)' })
  graduates(@CurrentUser() user: CoreHubIdentity, @Param('id', UuidPipe) id: string, @Query() dto: ListTracksDto) {
    return this.tracks.graduates(user, id, dto);
  }

  @Post()
  @RequirePermissions(Permission.TRACK_CREATE)
  @ApiOperation({ summary: 'เพิ่มสายงาน' })
  create(@Body() dto: CreateTrackDto) {
    return this.tracks.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.TRACK_UPDATE)
  @ApiOperation({ summary: 'แก้ไขสายงาน' })
  update(@Param('id', UuidPipe) id: string, @Body() dto: UpdateTrackDto) {
    return this.tracks.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.TRACK_DELETE)
  @ApiOperation({ summary: 'ลบสายงาน (เฉพาะที่ยังไม่มีผู้สมัคร)' })
  remove(@Param('id', UuidPipe) id: string) {
    return this.tracks.remove(id);
  }
}
