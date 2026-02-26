export interface ArticleCreate {
  id: string;
  title: string;
  path: string;// for example pro-knowledge/dfdsf546dfs/pro-fact
}

export interface Article extends ArticleCreate {
  created_at: string;
}

export interface Cursor {
  created_at: string;
  id: string;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: Cursor | null;
}