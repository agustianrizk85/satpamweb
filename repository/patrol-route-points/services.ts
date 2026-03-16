import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, PatrolRoutePoint, PatrolRoutePointCreate } from "./model";
import { fetchAllListRows } from "@/repository/list-response";

const agent = createHttpAgent({ basePath: "/api/v1/patrol/route-points", auth: true });

export type PatrolRoutePointListParams = {
  placeId: string;
  page?: number;
  pageSize?: number;
  sortBy?: "seq" | "createdAt" | "updatedAt" | "spotId" | "isActive";
  sortOrder?: "asc" | "desc";
};

export type PatrolRoutePointDeleteParams = {
  id: string;
  placeId: string;
};

export const patrolRoutePointHooks = createCrudHooksV2<
  PatrolRoutePoint[],
  PatrolRoutePoint,
  PatrolRoutePointCreate,
  never,
  string,
  PatrolRoutePointListParams
>({
  agent,
  key: "satpam-patrol-route-points",
});

export async function listPatrolRoutePoints(params: PatrolRoutePointListParams): Promise<PatrolRoutePoint[]> {
  return fetchAllListRows<PatrolRoutePoint>(agent, "", params);
}

export async function createPatrolRoutePoint(body: PatrolRoutePointCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}

export async function deletePatrolRoutePoint(params: PatrolRoutePointDeleteParams): Promise<CreatedIdResponse> {
  return agent.delete<CreatedIdResponse>("", { query: params });
}
