import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../agents/agent.module';
import { KnowledgeBaseArticleEntity } from '../agents/agent-support.entities';
import { CareerController } from './career.controller';
import {
  CandidateEntity,
  InterviewEntity,
  JobPostingEntity,
  OfferEntity,
  ResumeEntity,
} from './recruitment.entities';
import { RecruitmentController } from './recruitment.controller';
import { RecruitmentService } from './recruitment.service';

@Module({
  imports: [
    AgentModule,
    TypeOrmModule.forFeature([
      JobPostingEntity,
      CandidateEntity,
      ResumeEntity,
      InterviewEntity,
      OfferEntity,
      KnowledgeBaseArticleEntity,
    ]),
  ],
  controllers: [CareerController, RecruitmentController],
  providers: [RecruitmentService],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}
