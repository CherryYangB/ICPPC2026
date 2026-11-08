import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { DashboardService } from './dashboard.service'
import { DashboardOverviewDto } from './dto/dashboard-overview.dto'

/** 总览监控：只读，super_admin / admin / viewer 均可访问 */
@ApiTags('admin-dashboard')
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin', 'viewer')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: '总览监控统计' })
  @ApiOkResponse({ type: DashboardOverviewDto })
  getOverview(): Promise<DashboardOverviewDto> {
    return this.dashboardService.getOverview()
  }
}
