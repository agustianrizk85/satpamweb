import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { AttendanceConfig, AttendanceConfigUpsert } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/attendance-config", auth: true });

export type AttendanceConfigGetParams = {
  placeId: string;
};

export async function getAttendanceConfig(params: AttendanceConfigGetParams): Promise<AttendanceConfig> {
  return agent.get<AttendanceConfig>("", { query: params });
}

export async function upsertAttendanceConfig(body: AttendanceConfigUpsert): Promise<AttendanceConfig> {
  return agent.post<AttendanceConfig>("", body);
}

export const attendanceConfigHooks = createCrudHooksV2<
  AttendanceConfig,
  AttendanceConfig,
  AttendanceConfigUpsert,
  never,
  string,
  AttendanceConfigGetParams
>({
  agent,
  key: "satpam-attendance-config",
});