export type TokenConfig = {
  access_ttl_seconds: number;
  refresh_ttl_seconds: number;
  created_at: string;
  updated_at: string;
};

export type TokenConfigUpsert = {
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
};
