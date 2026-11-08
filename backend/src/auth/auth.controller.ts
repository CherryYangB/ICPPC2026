import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { LOGIN_THROTTLE } from './auth.constants'
import { AuthService } from './auth.service'
import { CurrentUser } from './decorators/current-user.decorator'
import {
  ChangePasswordResponseDto,
  LoginResponseDto,
  UserProfileDto,
} from './dto/auth-user.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { LoginDto } from './dto/login.dto'
import { JwtAuthGuard } from './guards/jwt-auth.guard'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 后台登录：登录成功后更新 lastLoginAt；mustChangePassword 为 true 时前端应强制跳转改密页 */
  @Post('login')
  @HttpCode(200)
  @Throttle(LOGIN_THROTTLE)
  @ApiOperation({ summary: '后台登录' })
  @ApiOkResponse({ type: LoginResponseDto })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto)
  }

  /** 当前登录用户（含 mustChangePassword，供路由守卫/刷新页面使用） */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '当前登录用户' })
  @ApiOkResponse({ type: UserProfileDto })
  me(@CurrentUser('id') userId: number): Promise<UserProfileDto> {
    return this.authService.me(userId)
  }

  /** 修改自己的密码；首次登录必须调用后才能继续使用后台写操作 */
  @Post('password')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '修改密码（首次登录强制改密）' })
  @ApiOkResponse({ type: ChangePasswordResponseDto })
  changePassword(
    @CurrentUser('id') userId: number,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: boolean }> {
    return this.authService.changePassword(userId, dto)
  }
}
