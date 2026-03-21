export type APIErrorLog = {
  id: string;
  occurred_at: string;
  method: string;
  path: string;
  status_code: number;
  message?: string | null;
  place_id?: string | null;
  user_id?: string | null;
  user_role?: string | null;
  client_ip?: string | null;
  user_agent?: string | null;
  request_query: Record<string, unknown>;
  request_body?: string | null;
  response_body?: string | null;
};

export type APIErrorLogListParams = {
  placeId?: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  statusCode?: number;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "occurredAt" | "statusCode" | "method" | "path";
  sortOrder?: "asc" | "desc";
};
