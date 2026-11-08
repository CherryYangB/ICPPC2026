import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { InstitutionsService } from './institutions.service'
import { QueryInstitutionsDto } from './dto/query-institutions.dto'
import { InstitutionDto } from './dto/institution.dto'
import { InstitutionStatsDto } from './dto/institution-stats.dto'
import { CheckinResponseDto } from './dto/checkin-response.dto'
import { CreateInstitutionDto } from './dto/create-institution.dto'
import { UpdateInstitutionDto } from './dto/update-institution.dto'
import { SetInstitutionLitDto } from './dto/set-institution-lit.dto'
import { InstitutionLitResponseDto } from './dto/institution-lit-response.dto'

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
  @ApiOkResponse({
    type: CheckinResponseDto,
    description:
      'alreadyLit=true 表示该机构已点亮或处于 10s 防刷窗口内（未重复广播）；两种情况下都返回机构信息与实时统计',
  })
  checkin(@Param('id', ParseIntPipe) id: number): Promise<CheckinResponseDto> {
    return this.institutionsService.checkin(id)
  }

  /** 后台新增机构（仅 admin / super_admin） */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增机构（后台）' })
  @ApiCreatedResponse({ type: InstitutionDto })
  create(@Body() dto: CreateInstitutionDto): Promise<InstitutionDto> {
    return this.institutionsService.create(dto)
  }

  /** 后台编辑机构（仅 admin / super_admin） */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '编辑机构（后台）' })
  @ApiParam({ name: 'id', type: Number, example: 12 })
  @ApiOkResponse({ type: InstitutionDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInstitutionDto,
  ): Promise<InstitutionDto> {
    return this.institutionsService.update(id, dto)
  }

  /** 后台手动设置打卡状态（仅 admin / super_admin） */
  @Patch(':id/lit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '手动设置机构点亮 / 撤销（后台）' })
  @ApiParam({ name: 'id', type: Number, example: 12 })
  @ApiOkResponse({ type: InstitutionLitResponseDto })
  setLit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetInstitutionLitDto,
  ): Promise<InstitutionLitResponseDto> {
    return this.institutionsService.setLit(id, dto)
  }

  /** 后台删除机构（仅 admin / super_admin） */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: '删除机构（后台）' })
  @ApiParam({ name: 'id', type: Number, example: 12 })
  @ApiOkResponse({
    description: '删除成功；若机构已点亮，会广播 checkinRevoked',
    schema: { example: { success: true } },
  })
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ success: boolean }> {
    return this.institutionsService.remove(id)
  }
}
