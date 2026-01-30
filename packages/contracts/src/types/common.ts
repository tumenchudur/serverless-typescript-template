export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  total?: number;
}

export interface ApiResponse<T = unknown> {
  message?: string;
  data?: T;
  error?: string;
}

export type Status = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
