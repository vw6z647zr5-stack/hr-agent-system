import { AuthenticatedUser, Role } from '../../users/user.entity';

export function canViewSalaryDetails(user: AuthenticatedUser, employeeId: string): boolean {
  if (user.role === Role.ADMIN || user.role === Role.HR) {
    return true;
  }

  return user.employeeId === employeeId;
}

export function maskCurrency(value: number | string): string {
  const normalized = typeof value === 'number' ? value.toFixed(2) : value;
  return normalized.replace(/\d/g, '*');
}

export function maskSensitiveValue(value: string): string {
  if (value.length <= 4) {
    return '****';
  }

  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}
