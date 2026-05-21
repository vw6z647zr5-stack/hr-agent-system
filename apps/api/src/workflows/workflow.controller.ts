import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../users/user.entity';
import { WorkflowTaskStatus } from './workflow.entities';
import { WorkflowService } from './workflow.service';

@ApiTags('workflow')
@ApiBearerAuth()
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('notifications')
  listNotifications(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.workflowService.listNotifications(user, Number(limit ?? 20));
  }

  @Get('notifications/unread-count')
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.workflowService.getUnreadCount(user);
  }

  @Patch('notifications/read-all')
  markAllNotificationsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.workflowService.markAllNotificationsRead(user);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.workflowService.markNotificationRead(user, id);
  }

  @Get('tasks')
  listTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: WorkflowTaskStatus | 'all',
    @Query('limit') limit?: string,
  ) {
    return this.workflowService.listTasks(user, status ?? 'pending', Number(limit ?? 30));
  }

  @Patch('tasks/:id/complete')
  completeTask(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.workflowService.completeTask(user, id);
  }

  @Get('events')
  listEvents(@Query('entityType') entityType?: string, @Query('entityId') entityId?: string, @Query('limit') limit?: string) {
    return this.workflowService.listEvents({ entityType, entityId, limit: Number(limit ?? 30) });
  }
}
