import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { MAX_RESUME_UPLOAD_SIZE_BYTES } from '../common/upload-limits';
import { buildAttachmentContentDisposition } from '../common/utils/content-disposition';
import { AuthenticatedUser, Role } from '../users/user.entity';
import { CandidatePortalApplicationDto, CandidatePortalChatDto } from './recruitment.dto';
import { RecruitmentService } from './recruitment.service';

@Controller('career')
export class CareerController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Public()
  @Get('job-postings')
  listPublicJobPostings(@Query() query: ListQueryDto) {
    return this.recruitmentService.listPublicJobPostings(query);
  }

  @Public()
  @Post('applications')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RESUME_UPLOAD_SIZE_BYTES } }))
  applyForJob(@Body() payload: CandidatePortalApplicationDto, @UploadedFile() file?: Express.Multer.File) {
    return this.recruitmentService.applyForJob(payload, file);
  }

  @Roles(Role.CANDIDATE)
  @Get('me')
  getCandidatePortalProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.recruitmentService.getCandidatePortalProfile(user);
  }

  @Roles(Role.CANDIDATE)
  @Post('me/resumes')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RESUME_UPLOAD_SIZE_BYTES } }))
  uploadOwnResume(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return this.recruitmentService.uploadCandidatePortalResume(user, file);
  }

  @Roles(Role.CANDIDATE)
  @Get('me/job-matches')
  listMyJobMatches(@CurrentUser() user: AuthenticatedUser) {
    return this.recruitmentService.getCandidatePortalJobMatches(user);
  }

  @Roles(Role.CANDIDATE)
  @Post('me/applications/:jobPostingId')
  applyToJobFromPortal(@CurrentUser() user: AuthenticatedUser, @Param('jobPostingId') jobPostingId: string) {
    return this.recruitmentService.applyCandidatePortalJob(user, jobPostingId);
  }

  @Roles(Role.CANDIDATE)
  @Post('me/chat')
  candidatePortalChat(@CurrentUser() user: AuthenticatedUser, @Body() payload: CandidatePortalChatDto) {
    return this.recruitmentService.candidatePortalChat(user, payload.message);
  }

  @Roles(Role.CANDIDATE)
  @Get('resumes/:id/download')
  async downloadOwnResume(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const file = await this.recruitmentService.getResumeDownload(id, user);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', buildAttachmentContentDisposition(file.fileName));
    response.setHeader('Cache-Control', 'no-store');
    response.send(file.buffer);
  }
}
