import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authStore } from '../state/auth.store';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  roles?: UserRole[];
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { token, user } = authStore();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    const fallbackPath = getRoleHomePath(user.role);
    if (location.pathname === fallbackPath) {
      authStore.getState().logout();
      return <Navigate to="/login" replace />;
    }

    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}

function getRoleHomePath(role: UserRole | string) {
  if (role === 'candidate') {
    return '/career/me';
  }

  if (role === 'admin' || role === 'hr' || role === 'manager' || role === 'employee') {
    return '/dashboard';
  }

  return '/login';
}
