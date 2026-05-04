import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { Role } from '../users/user.entity';
import {
  CreatePerformanceCycleDto,
  CreatePerformanceGoalDto,
  CreatePerformanceReviewDto,
  UpdatePerformanceCycleDto,
  UpdatePerformanceGoalDto,
  UpdatePerformanceReviewDto,
} from './performance.dto';
import { PerformanceService } from './performance.service';

@Controller()
@Roles(Role.ADMIN, Role.HR, Role.MANAGER)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  /** 分页查询绩效周期。 */
  @Get('performance-cycles')
  listPerformanceCycles(@Query() query: ListQueryDto) {
    return this.performanceService.listPerformanceCycles(query);
  }

  /** 返回单个绩效周期。 */
  @Get('performance-cycles/:id')
  getPerformanceCycle(@Param('id') id: string) {
    return this.performanceService.getPerformanceCycle(id);
  }

  /** 创建绩效周期。 */
  @Post('performance-cycles')
  createPerformanceCycle(@Body() payload: CreatePerformanceCycleDto) {
    return this.performanceService.createPerformanceCycle(payload);
  }

  /** 更新绩效周期。 */
  @Patch('performance-cycles/:id')
  updatePerformanceCycle(@Param('id') id: string, @Body() payload: UpdatePerformanceCycleDto) {
    return this.performanceService.updatePerformanceCycle(id, payload);
  }

  /** 删除绩效周期。 */
  @Delete('performance-cycles/:id')
  removePerformanceCycle(@Param('id') id: string) {
    return this.performanceService.removePerformanceCycle(id);
  }

  /** 分页查询绩效目标。 */
  @Get('performance-goals')
  listPerformanceGoals(@Query() query: ListQueryDto) {
    return this.performanceService.listPerformanceGoals(query);
  }

  /** 返回单个绩效目标。 */
  @Get('performance-goals/:id')
  getPerformanceGoal(@Param('id') id: string) {
    return this.performanceService.getPerformanceGoal(id);
  }

  /** 创建绩效目标。 */
  @Post('performance-goals')
  createPerformanceGoal(@Body() payload: CreatePerformanceGoalDto) {
    return this.performanceService.createPerformanceGoal(payload);
  }

  /** 更新绩效目标。 */
  @Patch('performance-goals/:id')
  updatePerformanceGoal(@Param('id') id: string, @Body() payload: UpdatePerformanceGoalDto) {
    return this.performanceService.updatePerformanceGoal(id, payload);
  }

  /** 删除绩效目标。 */
  @Delete('performance-goals/:id')
  removePerformanceGoal(@Param('id') id: string) {
    return this.performanceService.removePerformanceGoal(id);
  }

  /** 分页查询绩效评审。 */
  @Get('performance-reviews')
  listPerformanceReviews(@Query() query: ListQueryDto) {
    return this.performanceService.listPerformanceReviews(query);
  }

  /** 返回单条绩效评审。 */
  @Get('performance-reviews/:id')
  getPerformanceReview(@Param('id') id: string) {
    return this.performanceService.getPerformanceReview(id);
  }

  /** 创建绩效评审。 */
  @Post('performance-reviews')
  createPerformanceReview(@Body() payload: CreatePerformanceReviewDto) {
    return this.performanceService.createPerformanceReview(payload);
  }

  /** 更新绩效评审。 */
  @Patch('performance-reviews/:id')
  updatePerformanceReview(@Param('id') id: string, @Body() payload: UpdatePerformanceReviewDto) {
    return this.performanceService.updatePerformanceReview(id, payload);
  }

  /** 删除绩效评审。 */
  @Delete('performance-reviews/:id')
  removePerformanceReview(@Param('id') id: string) {
    return this.performanceService.removePerformanceReview(id);
  }
}
