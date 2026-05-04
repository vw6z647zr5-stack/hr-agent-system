import { Body, Controller, Get, HttpCode, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_PHOTO_UPLOAD_SIZE_BYTES } from '../common/upload-limits';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../users/user.entity';
import { AuthService } from './auth.service';
import { CandidateRegisterDto, LoginDto } from './login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: '用户登录', description: '校验平台用户身份并返回访问令牌。' })
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Public()
  @Post('candidate-register')
  @ApiOperation({ summary: '候选人注册', description: '注册候选人门户账号并创建候选人档案。' })
  registerCandidate(@Body() payload: CandidateRegisterDto) {
    return this.authService.registerCandidate(payload);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户', description: '返回当前登录用户及其员工档案。' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: '注销', description: '注销当前访问令牌对应的服务端会话。' })
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @Post('me/photo')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传头像', description: '上传并保存当前用户的头像。' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_UPLOAD_SIZE_BYTES } }))
  uploadMyPhoto(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return this.authService.uploadMyPhoto(user, file);
  }
}
