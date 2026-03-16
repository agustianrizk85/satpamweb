import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, User, UserCreate, UserPatch } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/users", auth: true });

export const userHooks = createCrudHooksV2<User[], User, UserCreate, UserPatch>({
  agent,
  key: "satpam-users",
  createConfig: {
    onSuccess: (_data, _vars, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-users"] });
    },
  },
  updateConfig: {
    onSuccess: (_data, _vars, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-users"] });
    },
  },
  removeConfig: {
    onSuccess: (_data, _id, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-users"] });
    },
  },
});

export async function createUser(body: UserCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}