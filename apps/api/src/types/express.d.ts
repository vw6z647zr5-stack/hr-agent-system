import type { AuthenticatedUser } from '../users/user.entity';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}

export {};
