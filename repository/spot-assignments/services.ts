import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, SpotAssignment, SpotAssignmentCreate, SpotAssignmentPatch } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/spot-assignments", auth: true });

export type SpotAssignmentListParams = {
  placeId?: string;
  userId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "updatedAt" | "placeId" | "userId" | "shiftId" | "isActive";
  sortOrder?: "asc" | "desc";
};

export const spotAssignmentHooks = createCrudHooksV2<
  SpotAssignment[],
  SpotAssignment,
  SpotAssignmentCreate,
  SpotAssignmentPatch,
  string,
  SpotAssignmentListParams,
  SpotAssignment
>({
  agent,
  key: "satpam-spot-assignments",
});

export async function getSpotAssignment(assignmentId: string): Promise<SpotAssignment> {
  return agent.get<SpotAssignment>(`/${assignmentId}`);
}

export async function createSpotAssignment(body: SpotAssignmentCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}

export async function updateSpotAssignment(assignmentId: string, body: SpotAssignmentPatch): Promise<SpotAssignment> {
  return agent.patch<SpotAssignment>(`/${assignmentId}`, body);
}

export async function deleteSpotAssignment(assignmentId: string): Promise<CreatedIdResponse> {
  return agent.delete<CreatedIdResponse>(`/${assignmentId}`);
}
