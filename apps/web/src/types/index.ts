import type { Dayjs } from 'dayjs';

export type UserRole = 'admin' | 'hr' | 'manager' | 'employee' | 'candidate';

export interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  role: UserRole;
  employeeId: string | null;
  displayName: string;
  photoUrl?: string;
  employee?: Record<string, unknown> | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type FieldKind = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'multitag' | 'json' | 'switch';

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface ResourceField {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  downloadEndpoint?: string;
  options?: FieldOption[];
  optionsEndpoint?: string;
  optionLabelKey?: string;
  optionValueKey?: string;
}

export interface ResourceColumn {
  key: string;
  title: string;
  dataIndex: string | string[];
  ellipsis?: boolean;
}

export interface ResourceConfig {
  key: string;
  label: string;
  group: string;
  endpoint: string;
  path: string;
  roles: UserRole[];
  fields: ResourceField[];
  columns: ResourceColumn[];
}

export interface MenuGroup {
  key: string;
  label: string;
  items: ResourceConfig[];
}

export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type FormRecordValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | string[]
  | Record<string, unknown>
  | Dayjs;
