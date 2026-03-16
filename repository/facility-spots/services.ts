import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, FacilityCheckSpot, FacilityCheckSpotCreate, FacilityCheckSpotPatch } from "./model";
import { fetchAllListRows } from "@/repository/list-response";

const agent = createHttpAgent({ basePath: "/api/v1/facility/spots", auth: true });

export type FacilitySpotListParams = {
  placeId: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "updatedAt" | "spotCode" | "spotName" | "isActive" | "placeId";
  sortOrder?: "asc" | "desc";
};

export const facilitySpotHooks = createCrudHooksV2<
  FacilityCheckSpot[],
  FacilityCheckSpot,
  FacilityCheckSpotCreate,
  FacilityCheckSpotPatch,
  string,
  FacilitySpotListParams
>({
  agent,
  key: "satpam-facility-spots",
});

export async function listFacilitySpots(params: FacilitySpotListParams): Promise<FacilityCheckSpot[]> {
  return fetchAllListRows<FacilityCheckSpot>(agent, "", params);
}

export async function createFacilitySpot(body: FacilityCheckSpotCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}

export async function updateFacilitySpot(spotId: string, body: FacilityCheckSpotPatch): Promise<FacilityCheckSpot> {
  return agent.patch<FacilityCheckSpot>(`/${spotId}`, body);
}

export async function deleteFacilitySpot(spotId: string): Promise<CreatedIdResponse> {
  return agent.delete<CreatedIdResponse>(`/${spotId}`);
}
