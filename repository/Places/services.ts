import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, Place, PlaceCreate, PlacePatch } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/places", auth: true });

export const placeHooks = createCrudHooksV2<Place[], Place, PlaceCreate, PlacePatch>({
  agent,
  key: "satpam-places",
  createConfig: {
    onSuccess: (_data, _vars, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-places"] });
    },
  },
  updateConfig: {
    onSuccess: (_data, _vars, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-places"] });
    },
  },
  removeConfig: {
    onSuccess: (_data, _id, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-places"] });
    },
  },
});

export async function createPlace(body: PlaceCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}