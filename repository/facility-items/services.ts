import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, FacilityCheckItem, FacilityCheckItemCreate, FacilityCheckItemPatch } from "./model";
import { fetchAllListRows } from "@/repository/list-response";

const agent = createHttpAgent({ basePath: "/api/v1/facility/items", auth: true });

export type FacilityItemListParams = {
  spotId: string;
  page?: number;
  pageSize?: number;
  sortBy?: "sortNo" | "createdAt" | "updatedAt" | "itemName" | "isRequired" | "isActive";
  sortOrder?: "asc" | "desc";
};

export const facilityItemHooks = createCrudHooksV2<
  FacilityCheckItem[],
  FacilityCheckItem,
  FacilityCheckItemCreate,
  FacilityCheckItemPatch,
  string,
  FacilityItemListParams
>({
  agent,
  key: "satpam-facility-items",
});

export async function listFacilityItems(params: FacilityItemListParams): Promise<FacilityCheckItem[]> {
  return fetchAllListRows<FacilityCheckItem>(agent, "", params);
}

export async function createFacilityItem(body: FacilityCheckItemCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}

export async function updateFacilityItem(itemId: string, body: FacilityCheckItemPatch): Promise<FacilityCheckItem> {
  return agent.patch<FacilityCheckItem>(`/${itemId}`, body);
}

export async function deleteFacilityItem(itemId: string): Promise<CreatedIdResponse> {
  return agent.delete<CreatedIdResponse>(`/${itemId}`);
}
