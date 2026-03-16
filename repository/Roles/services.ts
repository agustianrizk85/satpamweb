import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, Role, RoleCreate, RolePatch } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/roles", auth: true });

export const roleHooks = createCrudHooksV2<Role[], Role, RoleCreate, RolePatch>({
  agent,
  key: "satpam-roles",
  createConfig: {
    onSuccess: (_data, _vars, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-roles"] });
    },
  },
  updateConfig: {
    onSuccess: (_data, _vars, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-roles"] });
    },
  },
  removeConfig: {
    onSuccess: (_data, _id, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-roles"] });
    },
  },
});

export async function createRole(body: RoleCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}