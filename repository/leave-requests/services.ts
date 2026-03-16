import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type {
  CreatedIdResponse,
  LeaveRequest,
  LeaveRequestCreate,
  LeaveRequestPatch,
  LeaveRequestStatus,
} from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/leave-requests", auth: true });

export type LeaveRequestListParams = {
  placeId: string;
  userId?: string;
  status?: LeaveRequestStatus;
};

export const leaveRequestHooks = createCrudHooksV2<
  LeaveRequest[],
  LeaveRequest,
  LeaveRequestCreate,
  LeaveRequestPatch,
  string,
  LeaveRequestListParams
>({
  agent,
  key: "satpam-leave-requests",
});

export async function createLeaveRequest(body: LeaveRequestCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}

export async function updateLeaveRequestStatus(body: LeaveRequestPatch): Promise<CreatedIdResponse> {
  return agent.patch<CreatedIdResponse>("", body);
}