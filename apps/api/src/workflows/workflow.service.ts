import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant.context';
import { AuthenticatedUser, Role } from '../users/user.entity';
import {
  WorkflowEventEntity,
  WorkflowNotificationEntity,
  WorkflowPriority,
  WorkflowTaskEntity,
  WorkflowTaskStatus,
} from './workflow.entities';

interface CreateNotificationInput {
  companyId?: string;
  userId?: string | null;
  employeeId?: string | null;
  category: string;
  priority?: WorkflowPriority;
  title: string;
  message?: string;
  linkPath?: string;
  metadata?: Record<string, unknown>;
}

interface CreateTaskInput {
  companyId?: string;
  ownerEmployeeId?: string | null;
  category: string;
  priority?: WorkflowPriority;
  title: string;
  description?: string;
  linkPath?: string;
  relatedEntityType?: string;
  relatedEntityId?: string | null;
  dueAt?: Date | string | null;
  metadata?: Record<string, unknown>;
}

interface CreateEventInput {
  companyId?: string;
  actorUserId?: string | null;
  actorEmployeeId?: string | null;
  category: string;
  title: string;
  description?: string;
  relatedEntityType?: string;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WorkflowService {
  constructor(
    @InjectRepository(WorkflowNotificationEntity)
    private readonly notificationsRepository: Repository<WorkflowNotificationEntity>,
    @InjectRepository(WorkflowTaskEntity)
    private readonly tasksRepository: Repository<WorkflowTaskEntity>,
    @InjectRepository(WorkflowEventEntity)
    private readonly eventsRepository: Repository<WorkflowEventEntity>,
    private readonly tenantContext: TenantContext,
  ) {}

  async listNotifications(user: AuthenticatedUser, limit = 20) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.company_id = :companyId', { companyId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('notification.user_id = :userId', { userId: user.userId });

          if (user.employeeId) {
            qb.orWhere('notification.employee_id = :employeeId', { employeeId: user.employeeId });
          }

          if ([Role.ADMIN, Role.HR, Role.MANAGER].includes(user.role)) {
            qb.orWhere('notification.user_id IS NULL AND notification.employee_id IS NULL');
          }
        }),
      )
      .orderBy('notification.createdAt', 'DESC')
      .take(this.normalizeLimit(limit));

    return builder.getMany();
  }

  async getUnreadCount(user: AuthenticatedUser) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.notificationsRepository
      .createQueryBuilder('notification')
      .where('notification.company_id = :companyId', { companyId })
      .andWhere('notification.is_read = false')
      .andWhere(
        new Brackets((qb) => {
          qb.where('notification.user_id = :userId', { userId: user.userId });

          if (user.employeeId) {
            qb.orWhere('notification.employee_id = :employeeId', { employeeId: user.employeeId });
          }

          if ([Role.ADMIN, Role.HR, Role.MANAGER].includes(user.role)) {
            qb.orWhere('notification.user_id IS NULL AND notification.employee_id IS NULL');
          }
        }),
      );

    return { count: await builder.getCount() };
  }

  async markNotificationRead(user: AuthenticatedUser, id: string) {
    const notification = await this.getNotificationForUser(user, id);
    notification.isRead = true;
    notification.readAt = new Date();
    return this.notificationsRepository.save(notification);
  }

  async markAllNotificationsRead(user: AuthenticatedUser) {
    const notifications = await this.listNotifications(user, 100);
    const unread = notifications.filter((item) => !item.isRead);
    const now = new Date();
    await this.notificationsRepository.save(unread.map((item) => ({ ...item, isRead: true, readAt: now })));
    return { updated: unread.length };
  }

  async listTasks(user: AuthenticatedUser, status: WorkflowTaskStatus | 'all' = 'pending', limit = 30) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.tasksRepository
      .createQueryBuilder('task')
      .where('task.company_id = :companyId', { companyId })
      .orderBy("CASE task.priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END", 'DESC')
      .addOrderBy('task.dueAt', 'ASC', 'NULLS LAST')
      .addOrderBy('task.createdAt', 'DESC')
      .take(this.normalizeLimit(limit, 50));

    if (status !== 'all') {
      builder.andWhere('task.status = :status', { status });
    }

    if (![Role.ADMIN, Role.HR].includes(user.role)) {
      if (!user.employeeId) {
        return [];
      }
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('task.owner_employee_id = :employeeId', { employeeId: user.employeeId }).orWhere(
            'task.owner_employee_id IS NULL',
          );
        }),
      );
    }

    return builder.getMany();
  }

  async completeTask(user: AuthenticatedUser, id: string) {
    const task = await this.getTaskForUser(user, id);
    task.status = 'completed';
    task.completedAt = new Date();
    return this.tasksRepository.save(task);
  }

  async listEvents(params: { entityType?: string; entityId?: string; limit?: number }) {
    const companyId = this.tenantContext.getCompanyId();
    const builder = this.eventsRepository
      .createQueryBuilder('event')
      .where('event.company_id = :companyId', { companyId })
      .orderBy('event.createdAt', 'DESC')
      .take(this.normalizeLimit(params.limit ?? 30, 80));

    if (params.entityType) {
      builder.andWhere('event.related_entity_type = :entityType', { entityType: params.entityType });
    }

    if (params.entityId) {
      builder.andWhere('event.related_entity_id = :entityId', { entityId: params.entityId });
    }

    return builder.getMany();
  }

  createNotification(input: CreateNotificationInput) {
    return this.notificationsRepository.save(
      this.notificationsRepository.create({
        companyId: input.companyId ?? this.tenantContext.getCompanyId(),
        userId: input.userId ?? null,
        employeeId: input.employeeId ?? null,
        category: input.category,
        priority: input.priority ?? 'medium',
        title: input.title,
        message: input.message ?? '',
        linkPath: input.linkPath ?? '',
        metadata: input.metadata ?? {},
      }),
    );
  }

  createTask(input: CreateTaskInput) {
    return this.tasksRepository.save(
      this.tasksRepository.create({
        companyId: input.companyId ?? this.tenantContext.getCompanyId(),
        ownerEmployeeId: input.ownerEmployeeId ?? null,
        category: input.category,
        priority: input.priority ?? 'medium',
        status: 'pending',
        title: input.title,
        description: input.description ?? '',
        linkPath: input.linkPath ?? '',
        relatedEntityType: input.relatedEntityType ?? '',
        relatedEntityId: input.relatedEntityId ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        metadata: input.metadata ?? {},
      }),
    );
  }

  createEvent(input: CreateEventInput) {
    return this.eventsRepository.save(
      this.eventsRepository.create({
        companyId: input.companyId ?? this.tenantContext.getCompanyId(),
        actorUserId: input.actorUserId ?? null,
        actorEmployeeId: input.actorEmployeeId ?? null,
        category: input.category,
        title: input.title,
        description: input.description ?? '',
        relatedEntityType: input.relatedEntityType ?? '',
        relatedEntityId: input.relatedEntityId ?? null,
        metadata: input.metadata ?? {},
      }),
    );
  }

  private async getNotificationForUser(user: AuthenticatedUser, id: string) {
    const notification = await this.notificationsRepository.findOne({ where: { id } });
    if (!notification || notification.companyId !== this.tenantContext.getCompanyId()) {
      throw new NotFoundException('未找到通知。');
    }

    if (
      notification.userId !== user.userId &&
      notification.employeeId !== user.employeeId &&
      !([Role.ADMIN, Role.HR, Role.MANAGER].includes(user.role) && !notification.userId && !notification.employeeId)
    ) {
      throw new ForbiddenException('无权访问该通知。');
    }

    return notification;
  }

  private async getTaskForUser(user: AuthenticatedUser, id: string) {
    const task = await this.tasksRepository.findOne({ where: { id } });
    if (!task || task.companyId !== this.tenantContext.getCompanyId()) {
      throw new NotFoundException('未找到待办任务。');
    }

    if (![Role.ADMIN, Role.HR].includes(user.role) && task.ownerEmployeeId && task.ownerEmployeeId !== user.employeeId) {
      throw new ForbiddenException('无权处理该待办任务。');
    }

    return task;
  }

  private normalizeLimit(limit: number, max = 100) {
    const numeric = Number(limit);
    if (!Number.isInteger(numeric) || numeric <= 0) {
      return 20;
    }

    return Math.min(numeric, max);
  }
}
