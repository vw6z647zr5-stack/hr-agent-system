import type { AuthUser } from '../types';
import { apiRequest } from './http';

export interface UploadUserPhotoResponse {
  photoUrl: string;
  user: AuthUser;
}

export interface RegisterCompanyPayload {
  companyName: string;
  industry?: string;
  size?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
  adminDisplayName: string;
}

export interface RegisterCompanyResponse {
  accessToken: string;
  user: AuthUser;
}

export function registerCompany(payload: RegisterCompanyPayload) {
  return apiRequest<RegisterCompanyResponse>('/companies/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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
