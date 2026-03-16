import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, UserPlaceRole, UserPlaceRoleUpsert } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/user-place-roles", auth: true });

export type UserPlaceRoleListParams = {
  placeId?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "updatedAt" | "userId" | "placeId" | "roleId" | "isActive";
  sortOrder?: "asc" | "desc";
};

export const userPlaceRoleHooks = createCrudHooksV2<
  UserPlaceRole[],
  UserPlaceRole,
  UserPlaceRoleUpsert,
  never,
  string,
  UserPlaceRoleListParams
>({
  agent,
  key: "satpam-user-place-roles",
});

export async function upsertUserPlaceRole(body: UserPlaceRoleUpsert): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}
