import { Body, Controller, Get, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_PHOTO_UPLOAD_SIZE_BYTES } from '../common/upload-limits';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../users/user.entity';
import { AuthService } from './auth.service';
import { CandidateRegisterDto, LoginDto } from './login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** 校验平台用户身份并返回访问令牌。 */
  @Public()
  @Post('login')
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  /** 注册候选人门户账号并创建候选人档案。 */
  @Public()
  @Post('candidate-register')
  registerCandidate(@Body() payload: CandidateRegisterDto) {
    return this.authService.registerCandidate(payload);
  }

  /** 返回当前登录用户及其员工档案。 */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  /** 注销当前访问令牌对应的服务端会话。 */
  @Post('logout')
  @HttpCode(204)
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  /** 上传并保存当前用户的头像。 */
  @Post('me/photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_UPLOAD_SIZE_BYTES } }))
  uploadMyPhoto(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return this.authService.uploadMyPhoto(user, file);
  }
}
