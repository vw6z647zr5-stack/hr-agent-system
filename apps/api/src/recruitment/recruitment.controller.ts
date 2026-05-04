import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { MAX_RESUME_UPLOAD_SIZE_BYTES } from '../common/upload-limits';
import { buildAttachmentContentDisposition } from '../common/utils/content-disposition';
import { AuthenticatedUser, Role } from '../users/user.entity';
import {
  CreateCandidateDto,
  CreateInterviewDto,
  CreateJobPostingDto,
  CreateOfferDto,
  CreateResumeDto,
  UpdateCandidateDto,
  UpdateInterviewDto,
  UpdateJobPostingDto,
  UpdateOfferDto,
  UpdateResumeDto,
} from './recruitment.dto';
import { RecruitmentService } from './recruitment.service';

@Controller()
@Roles(Role.ADMIN, Role.HR, Role.MANAGER)
export class RecruitmentController {
  constructor(private readonly recruitmentService: RecruitmentService) {}

  @Get('recruitment/dashboard')
  getRecruitmentDashboard() {
    return this.recruitmentService.getRecruitmentDashboard();
  }

  @Get('job-postings')
  listJobPostings(@Query() query: ListQueryDto) {
    return this.recruitmentService.listJobPostings(query);
  }

  @Get('job-postings/:id')
  getJobPosting(@Param('id') id: string) {
    return this.recruitmentService.getJobPosting(id);
  }

  @Post('job-postings')
  createJobPosting(@Body() payload: CreateJobPostingDto) {
    return this.recruitmentService.createJobPosting(payload);
  }

  @Patch('job-postings/:id')
  updateJobPosting(@Param('id') id: string, @Body() payload: UpdateJobPostingDto) {
    return this.recruitmentService.updateJobPosting(id, payload);
  }

  @Delete('job-postings/:id')
  removeJobPosting(@Param('id') id: string) {
    return this.recruitmentService.removeJobPosting(id);
  }

  @Get('candidates')
  listCandidates(@Query() query: ListQueryDto) {
    return this.recruitmentService.listCandidates(query);
  }

  @Get('candidates/:id')
  getCandidate(@Param('id') id: string) {
    return this.recruitmentService.getCandidate(id);
  }

  @Post('candidates')
  createCandidate(@Body() payload: CreateCandidateDto) {
    return this.recruitmentService.createCandidate(payload);
  }

  @Patch('candidates/:id')
  updateCandidate(@Param('id') id: string, @Body() payload: UpdateCandidateDto) {
    return this.recruitmentService.updateCandidate(id, payload);
  }

  @Delete('candidates/:id')
  removeCandidate(@Param('id') id: string) {
    return this.recruitmentService.removeCandidate(id);
  }

  @Get('resumes')
  listResumes(@Query() query: ListQueryDto) {
    return this.recruitmentService.listResumes(query);
  }

  @Get('resumes/:id')
  getResume(@Param('id') id: string) {
    return this.recruitmentService.getResume(id);
  }

  @Get('resumes/:id/download')
  async downloadResume(@Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const file = await this.recruitmentService.getResumeDownload(id);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Disposition', buildAttachmentContentDisposition(file.fileName));
    response.setHeader('Cache-Control', 'no-store');
    return file.buffer;
  }

  @Post('resumes/:id/analyze')
  analyzeResume(@Param('id') id: string) {
    return this.recruitmentService.analyzeResume(id);
  }

  @Post('resumes')
  createResume(@Body() payload: CreateResumeDto) {
    return this.recruitmentService.createResume(payload);
  }

  @Patch('resumes/:id')
  updateResume(@Param('id') id: string, @Body() payload: UpdateResumeDto) {
    return this.recruitmentService.updateResume(id, payload);
  }

  @Delete('resumes/:id')
  removeResume(@Param('id') id: string) {
    return this.recruitmentService.removeResume(id);
  }

  @Post('resumes/upload/:candidateId')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RESUME_UPLOAD_SIZE_BYTES } }))
  uploadResume(@Param('candidateId') candidateId: string, @UploadedFile() file: Express.Multer.File) {
    return this.recruitmentService.uploadResume(candidateId, file);
  }

  @Get('interviews')
  listInterviews(@Query() query: ListQueryDto) {
    return this.recruitmentService.listInterviews(query);
  }

  @Get('interviews/:id')
  getInterview(@Param('id') id: string) {
    return this.recruitmentService.getInterview(id);
  }

  @Post('interviews')
  createInterview(@Body() payload: CreateInterviewDto) {
    return this.recruitmentService.createInterview(payload);
  }

  @Patch('interviews/:id')
  updateInterview(@Param('id') id: string, @Body() payload: UpdateInterviewDto) {
    return this.recruitmentService.updateInterview(id, payload);
  }

  @Delete('interviews/:id')
  removeInterview(@Param('id') id: string) {
    return this.recruitmentService.removeInterview(id);
  }

  @Get('offers')
  listOffers(@Query() query: ListQueryDto) {
    return this.recruitmentService.listOffers(query);
  }

  @Get('offers/:id')
  getOffer(@Param('id') id: string) {
    return this.recruitmentService.getOffer(id);
  }

  @Post('offers')
  createOffer(@Body() payload: CreateOfferDto) {
    return this.recruitmentService.createOffer(payload);
  }

  @Patch('offers/:id')
  updateOffer(@Param('id') id: string, @Body() payload: UpdateOfferDto) {
    return this.recruitmentService.updateOffer(id, payload);
  }

  @Delete('offers/:id')
  removeOffer(@Param('id') id: string) {
    return this.recruitmentService.removeOffer(id);
  }
}
