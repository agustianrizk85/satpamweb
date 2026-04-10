import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, PatrolProgress, PatrolScan, PatrolScanCreate } from "./model";
import { fetchAllListRows } from "@/repository/list-response";

const agent = createHttpAgent({ basePath: "/api/v1/patrol/scans", auth: true });
const progressAgent = createHttpAgent({ basePath: "/api/v1/patrol/progress", auth: true });

export type PatrolScanListParams = {
  placeId: string;
  patrolRunId?: string;
  userId?: string;
  attendanceId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "scannedAt" | "placeId" | "userId" | "spotId" | "patrolRunId";
  sortOrder?: "asc" | "desc";
};

export const patrolScanHooks = createCrudHooksV2<
  PatrolScan[],
  PatrolScan,
  PatrolScanCreate,
  never,
  string,
  PatrolScanListParams
>({
  agent,
  key: "satpam-patrol-scans",
});

export async function listPatrolScans(params: PatrolScanListParams): Promise<PatrolScan[]> {
  return fetchAllListRows<PatrolScan>(agent, "", params);
}

export async function createPatrolScan(body: PatrolScanCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}

export async function deletePatrolScan(id: string): Promise<CreatedIdResponse> {
  return agent.delete<CreatedIdResponse>(`/${id}`);
}

export async function getPatrolProgress(attendanceId: string): Promise<PatrolProgress> {
  return progressAgent.get<PatrolProgress>("", { query: { attendanceId } });
}
