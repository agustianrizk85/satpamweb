export type PatrolRunStatus = "active" | "completed";

export type PatrolRun = {
  id: string;
  place_id: string;
  user_id: string;
  attendance_id?: string | null;
  run_no: number;
  total_active_spots: number;
  status: PatrolRunStatus | string;
  started_at: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  scan_count: number;
  unique_scanned_spots: number;
};

export type PatrolRunCreate = {
  placeId: string;
  userId: string;
  attendanceId?: string | null;
  runNo?: number | null;
  totalActiveSpots?: number | null;
  status?: PatrolRunStatus | string | null;
};

export type PatrolRunPatch = {
  runNo?: number;
  totalActiveSpots?: number;
  status?: PatrolRunStatus | string;
};
