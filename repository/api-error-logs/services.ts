import { createHttpAgent } from "@/libs/http";
import { fetchAllListRows } from "@/repository/list-response";
import type { APIErrorLog, APIErrorLogListParams } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/api-error-logs", auth: true });

export async function listAPIErrorLogs(params: APIErrorLogListParams): Promise<APIErrorLog[]> {
  return fetchAllListRows<APIErrorLog>(agent, "", params);
}
