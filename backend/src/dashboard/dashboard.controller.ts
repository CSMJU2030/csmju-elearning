import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { PaginationDto, paginated, pageArgs } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

function rate(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

/**
 * สถิติรายสายงานสำหรับ Dashboard ของผู้ดูแล
 *   - สายงานยอดนิยม = จำนวนผู้สมัครทั้งหมด (เรียงมาก → น้อย)
 *   - อัตราเรียนจบ = จบ ÷ ผู้สมัครทั้งหมด · เวลาเฉลี่ยที่ใช้เรียนจบ (วัน)
 *   - อัตราออกจากสายงาน = ออก ÷ ผู้สมัครทั้งหมด
 * นับจากแถว enrollments (การออกจากสายงานล้างความคืบหน้า แต่เก็บแถวไว้ให้นับสถิติได้)
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async trackStatistics(dto: PaginationDto) {
    const [tracks, grouped, completed] = await Promise.all([
      this.prisma.track.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.enrollment.groupBy({ by: ['trackId', 'status'], _count: true }),
      this.prisma.enrollment.findMany({
        where: { status: 'COMPLETED', completedAt: { not: null } },
        select: { trackId: true, enrolledAt: true, completedAt: true },
      }),
    ]);

    const rows = tracks
      .map((t) => {
        const count = (status: string) => grouped.find((g) => g.trackId === t.id && g.status === status)?._count ?? 0;
        const active = count('ACTIVE');
        const done = count('COMPLETED');
        const withdrawn = count('WITHDRAWN');
        const total = active + done + withdrawn;
        const durations = completed
          .filter((c) => c.trackId === t.id && c.completedAt)
          .map((c) => ((c.completedAt as Date).getTime() - c.enrolledAt.getTime()) / DAY_MS);
        return {
          trackId: t.id,
          nameTh: t.nameTh,
          nameEn: t.nameEn,
          color: t.color,
          isPublished: t.isPublished,
          enrollmentCount: total,
          activeCount: active,
          completedCount: done,
          withdrawnCount: withdrawn,
          completionRate: rate(done, total),
          withdrawRate: rate(withdrawn, total),
          averageDaysToComplete: durations.length
            ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
            : null,
        };
      })
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount || a.nameTh.localeCompare(b.nameTh, 'th'));

    const { skip, take } = pageArgs(dto);
    return paginated(rows.slice(skip, skip + take), rows.length, dto);
  }
}

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('v1/track-statistics')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RequirePermissions(Permission.DASHBOARD_READ)
  @ApiOperation({ summary: 'สถิติรายสายงาน: ยอดนิยม · อัตราเรียนจบ · อัตราออกจากสายงาน' })
  list(@Query() dto: PaginationDto) {
    return this.dashboard.trackStatistics(dto);
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
