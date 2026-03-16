import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, FacilityCheckScan, FacilityCheckScanCreate } from "./model";
import { fetchAllListRows } from "@/repository/list-response";

const agent = createHttpAgent({ basePath: "/api/v1/facility/scans", auth: true });

export type FacilityScanListParams = {
  placeId: string;
  spotId?: string;
  itemId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "scannedAt" | "createdAt" | "updatedAt" | "status" | "placeId" | "spotId" | "userId";
  sortOrder?: "asc" | "desc";
};

export const facilityScanHooks = createCrudHooksV2<
  FacilityCheckScan[],
  FacilityCheckScan,
  FacilityCheckScanCreate,
  never,
  string,
  FacilityScanListParams
>({
  agent,
  key: "satpam-facility-scans",
});

export async function listFacilityScans(params: FacilityScanListParams): Promise<FacilityCheckScan[]> {
  return fetchAllListRows<FacilityCheckScan>(agent, "", params);
}

export async function createFacilityScan(body: FacilityCheckScanCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}
