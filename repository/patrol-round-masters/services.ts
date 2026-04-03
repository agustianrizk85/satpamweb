import { createHttpAgent } from "@/libs/http";
import { fetchAllListRows } from "@/repository/list-response";
import type { PatrolRoundMaster, PatrolRoundMasterCreate, PatrolRoundMasterPatch } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/patrol/round-masters", auth: true });

export type PatrolRoundMasterListParams = {
  placeId: string;
  page?: number;
  pageSize?: number;
  sortBy?: "roundNo" | "isActive" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
};

export async function listPatrolRoundMasters(params: PatrolRoundMasterListParams): Promise<PatrolRoundMaster[]> {
  return fetchAllListRows<PatrolRoundMaster>(agent, "", params);
}

export async function createPatrolRoundMaster(body: PatrolRoundMasterCreate): Promise<PatrolRoundMaster> {
  return agent.post<PatrolRoundMaster>("", body);
}

export async function updatePatrolRoundMaster(id: string, body: PatrolRoundMasterPatch): Promise<PatrolRoundMaster> {
  return agent.patch<PatrolRoundMaster>(`/${id}`, body);
}

export async function deletePatrolRoundMaster(id: string): Promise<{ id: string }> {
  return agent.delete<{ id: string }>(`/${id}`);
}
