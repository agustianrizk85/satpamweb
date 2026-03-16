import { createHttpAgent } from "@/libs/http";
import type { RecentActivityListParams, RecentActivityListResponse } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/recent-activities", auth: true });

export async function listRecentActivities(params: RecentActivityListParams): Promise<RecentActivityListResponse> {
  return agent.get<RecentActivityListResponse>("", { query: params });
}
