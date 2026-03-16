import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, Spot, SpotCreate, SpotPatch } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/spots", auth: true });

export const spotHooks = createCrudHooksV2<Spot[], Spot, SpotCreate, SpotPatch>({
  agent,
  key: "satpam-spots",
  createConfig: {
    onSuccess: (_data, _vars, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-spots"] });
    },
  },
  updateConfig: {
    onSuccess: (_data, _vars, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-spots"] });
    },
  },
  removeConfig: {
    onSuccess: (_data, _id, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-spots"] });
    },
  },
});

export async function createSpot(body: SpotCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}