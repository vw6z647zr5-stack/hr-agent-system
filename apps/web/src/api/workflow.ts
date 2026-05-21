import { apiRequest, toQueryString } from './http';

export interface WorkflowNotification {
  id: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  linkPath: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowTask {
  id: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'cancelled';
  title: string;
  description: string;
  linkPath: string;
  dueAt?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowEvent {
  id: string;
  category: string;
  title: string;
  description: string;
  relatedEntityType: string;
  relatedEntityId?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export function listNotifications(limit = 20) {
  return apiRequest<WorkflowNotification[]>(`/workflow/notifications${toQueryString({ limit })}`);
}

export function getUnreadNotificationCount() {
  return apiRequest<{ count: number }>('/workflow/notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return apiRequest<WorkflowNotification>(`/workflow/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiRequest<{ updated: number }>('/workflow/notifications/read-all', { method: 'PATCH' });
}

export function listWorkflowTasks(status: 'pending' | 'completed' | 'cancelled' | 'all' = 'pending', limit = 30) {
  return apiRequest<WorkflowTask[]>(`/workflow/tasks${toQueryString({ status, limit })}`);
}

export function completeWorkflowTask(id: string) {
  return apiRequest<WorkflowTask>(`/workflow/tasks/${id}/complete`, { method: 'PATCH' });
}

export function listWorkflowEvents(params: { entityType?: string; entityId?: string; limit?: number }) {
  return apiRequest<WorkflowEvent[]>(`/workflow/events${toQueryString({
    entityType: params.entityType,
    entityId: params.entityId,
    limit: params.limit ?? 30,
  })}`);
}
