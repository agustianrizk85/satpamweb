import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { CreatedIdResponse, Shift, ShiftCreate, ShiftPatch } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/shifts", auth: true });

export const shiftHooks = createCrudHooksV2<Shift[], Shift, ShiftCreate, ShiftPatch>({
  agent,
  key: "satpam-shifts",
  createConfig: {
    onSuccess: (_data, _vars, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-shifts"] });
    },
  },
  updateConfig: {
    onSuccess: (_data, _vars, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-shifts"] });
    },
  },
  removeConfig: {
    onSuccess: (_data, _id, helpers) => {
      helpers.queryClient.invalidateQueries({ queryKey: ["satpam-shifts"] });
    },
  },
});

export async function createShift(body: ShiftCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}