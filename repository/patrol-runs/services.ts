import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { PatrolRun, PatrolRunCreate, PatrolRunPatch } from "./model";
import { fetchAllListRows } from "@/repository/list-response";

const agent = createHttpAgent({ basePath: "/api/v1/patrol/runs", auth: true });

export type PatrolRunListParams = {
  placeId: string;
  userId?: string;
  attendanceId?: string;
  shiftId?: string;
  runNo?: number;
  status?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "runNo" | "status" | "startedAt" | "completedAt" | "createdAt" | "updatedAt" | "userId" | "attendanceId" | "totalActiveSpots";
  sortOrder?: "asc" | "desc";
};

export const patrolRunHooks = createCrudHooksV2<
  PatrolRun[],
  PatrolRun,
  PatrolRunCreate,
  PatrolRunPatch,
  string,
  PatrolRunListParams
>({
  agent,
  key: "satpam-patrol-runs",
});

export async function listPatrolRuns(params: PatrolRunListParams): Promise<PatrolRun[]> {
  return fetchAllListRows<PatrolRun>(agent, "", params);
}

export async function createPatrolRun(body: PatrolRunCreate): Promise<PatrolRun> {
  return agent.post<PatrolRun>("", body);
}

export async function updatePatrolRun(runId: string, body: PatrolRunPatch): Promise<PatrolRun> {
  return agent.patch<PatrolRun>(`/${runId}`, body);
}

export async function deletePatrolRun(runId: string): Promise<{ id: string }> {
  return agent.delete<{ id: string }>(`/${runId}`);
}
