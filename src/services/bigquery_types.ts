export interface Article {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  pageSize: number;
}