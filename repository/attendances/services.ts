import { createHttpAgent } from "@/libs/http";
import { createCrudHooksV2 } from "@/libs/query-agent";
import type { Attendance, AttendanceCreate, AttendancePatch, CreatedIdResponse } from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/attendances", auth: true });

export type AttendanceListParams = {
  placeId?: string;
  userId?: string;
  attendanceDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "attendanceDate" | "createdAt" | "updatedAt" | "checkInAt" | "checkOutAt" | "status" | "userId" | "placeId";
  sortOrder?: "asc" | "desc";
};

export const attendanceHooks = createCrudHooksV2<
  Attendance[],
  Attendance,
  AttendanceCreate,
  AttendancePatch,
  string,
  AttendanceListParams
>({
  agent,
  key: "satpam-attendances",
});

export async function createAttendance(body: AttendanceCreate): Promise<CreatedIdResponse> {
  return agent.post<CreatedIdResponse>("", body);
}

export async function updateAttendance(attendanceId: string, body: AttendancePatch): Promise<Attendance> {
  return agent.patch<Attendance>(`/${attendanceId}`, body);
}

export async function deleteAttendance(attendanceId: string): Promise<CreatedIdResponse> {
  return agent.delete<CreatedIdResponse>(`/${attendanceId}`);
}
