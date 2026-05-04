import { apiRequest, toQueryString } from './http';
import type { PaginatedResponse } from '../types';

export function listResource<T>(
  endpoint: string,
  params: Record<string, string | number | undefined>,
) {
  return apiRequest<PaginatedResponse<T>>(`/${endpoint}${toQueryString(params)}`);
}

export function getResource<T>(endpoint: string, id: string) {
  return apiRequest<T>(`/${endpoint}/${id}`);
}

export function createResource<T>(endpoint: string, payload: Record<string, unknown>) {
  return apiRequest<T>(`/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateResource<T>(endpoint: string, id: string, payload: Record<string, unknown>) {
  return apiRequest<T>(`/${endpoint}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function removeResource(endpoint: string, id: string) {
  return apiRequest<{ success: boolean }>(`/${endpoint}/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchReferenceOptions(endpoint: string) {
  const response = await listResource<Record<string, unknown>>(endpoint, { page: 1, limit: 100 });
  return response.items;
}
