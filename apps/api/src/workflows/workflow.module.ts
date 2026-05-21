import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  WorkflowEventEntity,
  WorkflowNotificationEntity,
  WorkflowTaskEntity,
} from './workflow.entities';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowNotificationEntity, WorkflowTaskEntity, WorkflowEventEntity])],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
