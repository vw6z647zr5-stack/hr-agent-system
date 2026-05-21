import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from '../agents/agent.module';
import { KnowledgeBaseArticleEntity } from '../agents/agent-support.entities';
import { EmployeeContractEntity, EmployeeEntity } from '../organization/organization.entities';
import { WorkflowModule } from '../workflows/workflow.module';
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
    WorkflowModule,
    TypeOrmModule.forFeature([
      JobPostingEntity,
      CandidateEntity,
      ResumeEntity,
      InterviewEntity,
      OfferEntity,
      KnowledgeBaseArticleEntity,
      EmployeeEntity,
      EmployeeContractEntity,
    ]),
  ],
  controllers: [CareerController, RecruitmentController],
  providers: [RecruitmentService],
  exports: [RecruitmentService],
})
export class RecruitmentModule {}
