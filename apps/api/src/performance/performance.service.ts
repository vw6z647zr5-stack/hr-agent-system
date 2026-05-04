import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ListQueryDto } from '../common/dto/list-query.dto';
import { paginateQuery } from '../common/utils/pagination';
import {
  CreatePerformanceCycleDto,
  CreatePerformanceGoalDto,
  CreatePerformanceReviewDto,
  UpdatePerformanceCycleDto,
  UpdatePerformanceGoalDto,
  UpdatePerformanceReviewDto,
} from './performance.dto';
import {
  PerformanceCycleEntity,
  PerformanceGoalEntity,
  PerformanceReviewEntity,
} from './performance.entities';

@Injectable()
export class PerformanceService {
  constructor(
    @InjectRepository(PerformanceCycleEntity)
    private readonly cyclesRepository: Repository<PerformanceCycleEntity>,
    @InjectRepository(PerformanceGoalEntity)
    private readonly goalsRepository: Repository<PerformanceGoalEntity>,
    @InjectRepository(PerformanceReviewEntity)
    private readonly reviewsRepository: Repository<PerformanceReviewEntity>,
  ) {}

  async listPerformanceCycles(query: ListQueryDto) {
    const builder = this.cyclesRepository.createQueryBuilder('cycle').orderBy('cycle.startDate', 'DESC');

    if (query.search) {
      builder.andWhere('cycle.name ILIKE :search', { search: `%${query.search}%` });
    }

    if (query.status) {
      builder.andWhere('cycle.status = :status', { status: query.status });
    }

    return paginateQuery(builder, query);
  }

  async getPerformanceCycle(id: string) {
    const entity = await this.cyclesRepository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('未找到绩效周期。');
    }

    return entity;
  }

  createPerformanceCycle(dto: CreatePerformanceCycleDto) {
    return this.cyclesRepository.save(this.cyclesRepository.create(dto));
  }

  async updatePerformanceCycle(id: string, dto: UpdatePerformanceCycleDto) {
    const entity = await this.cyclesRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到绩效周期。');
    }

    return this.cyclesRepository.save(entity);
  }

  async removePerformanceCycle(id: string) {
    await this.getPerformanceCycle(id);
    await this.cyclesRepository.delete(id);
    return { success: true };
  }

  async listPerformanceGoals(query: ListQueryDto) {
    const builder = this.goalsRepository
      .createQueryBuilder('goal')
      .leftJoinAndSelect('goal.employee', 'employee')
      .leftJoinAndSelect('goal.cycle', 'cycle')
      .orderBy('goal.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('goal.title ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'employee.fullName ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.employeeId) {
      builder.andWhere('goal.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    if (query.status) {
      builder.andWhere('goal.status = :status', { status: query.status });
    }

    return paginateQuery(builder, query);
  }

  async getPerformanceGoal(id: string) {
    const entity = await this.goalsRepository.findOne({
      where: { id },
      relations: { employee: true, cycle: true },
    });
    if (!entity) {
      throw new NotFoundException('未找到绩效目标。');
    }

    return entity;
  }

  createPerformanceGoal(dto: CreatePerformanceGoalDto) {
    return this.goalsRepository.save(this.goalsRepository.create(dto));
  }

  async updatePerformanceGoal(id: string, dto: UpdatePerformanceGoalDto) {
    const entity = await this.goalsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到绩效目标。');
    }

    return this.goalsRepository.save(entity);
  }

  async removePerformanceGoal(id: string) {
    await this.getPerformanceGoal(id);
    await this.goalsRepository.delete(id);
    return { success: true };
  }

  async listPerformanceReviews(query: ListQueryDto) {
    const builder = this.reviewsRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.employee', 'employee')
      .leftJoinAndSelect('review.reviewer', 'reviewer')
      .leftJoinAndSelect('review.cycle', 'cycle')
      .orderBy('review.createdAt', 'DESC');

    if (query.search) {
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('employee.fullName ILIKE :search', { search: `%${query.search}%` }).orWhere(
            'review.summary ILIKE :search',
            { search: `%${query.search}%` },
          );
        }),
      );
    }

    if (query.employeeId) {
      builder.andWhere('review.employeeId = :employeeId', { employeeId: query.employeeId });
    }

    return paginateQuery(builder, query);
  }

  async getPerformanceReview(id: string) {
    const entity = await this.reviewsRepository.findOne({
      where: { id },
      relations: { employee: true, reviewer: true, cycle: true },
    });
    if (!entity) {
      throw new NotFoundException('未找到绩效评估。');
    }

    return entity;
  }

  createPerformanceReview(dto: CreatePerformanceReviewDto) {
    return this.reviewsRepository.save(this.reviewsRepository.create(dto));
  }

  async updatePerformanceReview(id: string, dto: UpdatePerformanceReviewDto) {
    const entity = await this.reviewsRepository.preload({ id, ...dto });
    if (!entity) {
      throw new NotFoundException('未找到绩效评估。');
    }

    return this.reviewsRepository.save(entity);
  }

  async removePerformanceReview(id: string) {
    await this.getPerformanceReview(id);
    await this.reviewsRepository.delete(id);
    return { success: true };
  }
}
