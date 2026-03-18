import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { Visitor, VisitorCreate, VisitorPatch, CreatedIdResponse } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/visitors", auth: true });

export type VisitorListParams = {
  placeId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "updatedAt" | "placeId" | "userId" | "nik" | "nama";
  sortOrder?: "asc" | "desc";
};

export const visitorHooks = createCrudHooksV2<
  Visitor[],
  Visitor,
  VisitorCreate,
  VisitorPatch,
  string,
  VisitorListParams
>({
  agent,
  key: "satpam-visitors",
});

export async function listVisitors(params: VisitorListParams): Promise<Visitor[]> {
  return agent.get<Visitor[]>("", { query: params });
}

export async function createVisitor(body: VisitorCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}

export async function updateVisitor(visitorId: string, body: VisitorPatch): Promise<Visitor> {
  return agent.patch<Visitor>(`/${visitorId}`, body);
}

export async function deleteVisitor(visitorId: string): Promise<CreatedIdResponse> {
  return agent.delete<CreatedIdResponse>(`/${visitorId}`);
}
