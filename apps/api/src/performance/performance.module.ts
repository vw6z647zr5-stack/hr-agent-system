import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PerformanceCycleEntity,
  PerformanceGoalEntity,
  PerformanceReviewEntity,
} from './performance.entities';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({
  imports: [TypeOrmModule.forFeature([PerformanceCycleEntity, PerformanceGoalEntity, PerformanceReviewEntity])],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
