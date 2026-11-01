import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common'
import { ApiOkResponse, ApiParam, ApiQuery } from '@nestjs/swagger'
import { InstitutionsService } from './institutions.service'
import { QueryInstitutionsDto } from './dto/query-institutions.dto'
import { InstitutionDto } from './dto/institution.dto'
import { InstitutionStatsDto } from './dto/institution-stats.dto'
import { CheckinResponseDto } from './dto/checkin-response.dto'

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Get('stats')
  @ApiOkResponse({ type: InstitutionStatsDto })
  getStats(): Promise<InstitutionStatsDto> {
    return this.institutionsService.getStats()
  }

  @Get('checked-in')
  @ApiOkResponse({ type: [InstitutionDto] })
  findCheckedIn(): Promise<InstitutionDto[]> {
    return this.institutionsService.findCheckedIn()
  }

  @Get()
  @ApiQuery({ name: 'type', required: false, enum: ['ward', 'clinic'], description: 'ward=有合作病房，clinic=有舒缓门诊' })
  @ApiQuery({ name: 'province', required: false, example: '广东', description: '省份短名，全名（广东省）也可' })
  @ApiQuery({ name: 'keyword', required: false, example: '儿童医院', description: '机构中英文名包含匹配' })
  @ApiOkResponse({ type: [InstitutionDto] })
  findAll(@Query() query: QueryInstitutionsDto): Promise<InstitutionDto[]> {
    return this.institutionsService.findAll(query)
  }

  @Post(':id/checkin')
  @HttpCode(200)
  @ApiParam({ name: 'id', type: Number, example: 12 })
  @ApiOkResponse({ type: CheckinResponseDto, description: 'alreadyLit=true 表示已点亮或在 10s 防刷窗口内，未重复广播' })
  checkin(@Param('id', ParseIntPipe) id: number): Promise<CheckinResponseDto> {
    return this.institutionsService.checkin(id)
  }
}
