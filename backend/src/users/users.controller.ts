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
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { CreateUserDto } from './dto/create-user.dto'
import { QueryUsersDto } from './dto/query-users.dto'
import { ResetUserPasswordDto } from './dto/reset-password.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import {
  PaginatedUsersDto,
  UserActionResponseDto,
  UserDto,
} from './dto/user.dto'
import { UsersService } from './users.service'

/** 账号管理：所有接口仅 super_admin 可操作 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: '账号列表（role / keyword 筛选 + 分页）' })
  @ApiOkResponse({ type: PaginatedUsersDto })
  findAll(@Query() query: QueryUsersDto): Promise<PaginatedUsersDto> {
    return this.usersService.findAll(query)
  }

  @Post()
  @ApiOperation({ summary: '新增账号' })
  @ApiCreatedResponse({ type: UserDto })
  create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.usersService.create(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: '修改账号资料 / 角色 / 启停状态' })
  @ApiParam({ name: 'id', type: Number, example: 2 })
  @ApiOkResponse({ type: UserDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') currentUserId: number,
  ): Promise<UserDto> {
    return this.usersService.update(id, dto, currentUserId)
  }

  @Patch(':id/password')
  @HttpCode(200)
  @ApiOperation({ summary: '重置账号密码（目标账号下次登录须改密）' })
  @ApiParam({ name: 'id', type: Number, example: 2 })
  @ApiOkResponse({ type: UserActionResponseDto })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetUserPasswordDto,
  ): Promise<{ success: boolean }> {
    return this.usersService.resetPassword(id, dto)
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '删除账号' })
  @ApiParam({ name: 'id', type: Number, example: 2 })
  @ApiOkResponse({ type: UserActionResponseDto })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentUserId: number,
  ): Promise<{ success: boolean }> {
    return this.usersService.remove(id, currentUserId)
  }
}
