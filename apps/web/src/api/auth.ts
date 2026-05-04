import type { AuthUser } from '../types';
import { apiRequest } from './http';

export interface UploadUserPhotoResponse {
  photoUrl: string;
  user: AuthUser;
}

export function uploadMyPhoto(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest<UploadUserPhotoResponse>('/auth/me/photo', {
    method: 'POST',
    body: formData,
  });
}

export async function logoutSession() {
  await apiRequest<void>('/auth/logout', {
    method: 'POST',
  });
}
