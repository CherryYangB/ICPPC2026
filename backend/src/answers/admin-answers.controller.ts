import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AdminAnswersService } from './admin-answers.service'
import {
  AdminAnswerActionResponseDto,
  AdminAnswerDto,
  BatchDeleteAnswersResponseDto,
  BatchHideAnswersResponseDto,
  PaginatedAdminAnswersDto,
} from './dto/admin-answer.dto'
import { BatchAnswerIdsDto } from './dto/batch-answer-ids.dto'
import { QueryAdminAnswersDto } from './dto/query-admin-answers.dto'
import { UpdateAnswerDto } from './dto/update-answer.dto'
import { UpdateAnswerVisibilityDto } from './dto/update-answer-visibility.dto'

/** 八问回答管理：读操作含 viewer，写操作仅 admin / super_admin */
@ApiTags('admin-answers')
@ApiBearerAuth()
@Controller('admin/answers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminAnswersController {
  constructor(private readonly adminAnswersService: AdminAnswersService) {}

  @Get()
  @Roles('super_admin', 'admin', 'viewer')
  @ApiOperation({ summary: '回答列表（questionId / identityTag / isHidden / keyword + 分页）' })
  @ApiOkResponse({ type: PaginatedAdminAnswersDto })
  findAll(@Query() query: QueryAdminAnswersDto): Promise<PaginatedAdminAnswersDto> {
    return this.adminAnswersService.findAll(query)
  }

  @Patch(':id/visibility')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: '设置回答显示 / 隐藏（隐藏时广播 answerHidden）' })
  @ApiParam({ name: 'id', type: String, example: 'clx1234567890' })
  @ApiOkResponse({ type: AdminAnswerDto })
  setVisibility(
    @Param('id') id: string,
    @Body() dto: UpdateAnswerVisibilityDto,
  ): Promise<AdminAnswerDto> {
    return this.adminAnswersService.setVisibility(id, dto)
  }

  @Post('batch-hide')
  @Roles('super_admin', 'admin')
  @HttpCode(200)
  @ApiOperation({ summary: '批量隐藏回答' })
  @ApiOkResponse({ type: BatchHideAnswersResponseDto })
  batchHide(@Body() dto: BatchAnswerIdsDto): Promise<{ updated: number }> {
    return this.adminAnswersService.batchHide(dto)
  }

  @Post('batch-delete')
  @Roles('super_admin', 'admin')
  @HttpCode(200)
  @ApiOperation({ summary: '批量删除回答' })
  @ApiOkResponse({ type: BatchDeleteAnswersResponseDto })
  batchDelete(@Body() dto: BatchAnswerIdsDto): Promise<{ deleted: number }> {
    return this.adminAnswersService.batchDelete(dto)
  }

  @Patch(':id')
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: '修改回答内容' })
  @ApiParam({ name: 'id', type: String, example: 'clx1234567890' })
  @ApiOkResponse({ type: AdminAnswerDto })
  updateAnswer(
    @Param('id') id: string,
    @Body() dto: UpdateAnswerDto,
  ): Promise<AdminAnswerDto> {
    return this.adminAnswersService.updateAnswer(id, dto)
  }

  @Delete(':id')
  @Roles('super_admin', 'admin')
  @HttpCode(200)
  @ApiOperation({ summary: '删除回答（广播 answerDeleted）' })
  @ApiParam({ name: 'id', type: String, example: 'clx1234567890' })
  @ApiOkResponse({ type: AdminAnswerActionResponseDto })
  remove(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.adminAnswersService.remove(id)
  }
}
