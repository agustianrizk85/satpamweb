export type PatrolScan = {
  id: string;
  place_id: string;
  user_id: string;
  spot_id: string;
  attendance_id?: string | null;
  patrol_run_id: string;
  scanned_at: string;
  submit_at?: string | null;
  photo_url?: string | null;
  note?: string | null;
};

export type PatrolScanCreate = {
  placeId: string;
  userId: string;
  spotId: string;
  attendanceId?: string | null;
  patrolRunId: string;
  scannedAt?: string | null;
  submitAt?: string | null;
  photoUrl?: string | null;
  note?: string | null;
};

export type PatrolProgressSpot = {
  spot_id: string;
  spot_code: string;
  spot_name: string;
  seq: number;
  scan_count: number;
  is_patrolled: boolean;
  last_scanned_at?: string | null;
  last_patrol_run_id?: string | null;
};

export type PatrolProgress = {
  attendance_id: string;
  place_id: string;
  user_id: string;
  shift_id?: string | null;
  attendance_date: string;
  check_in_at?: string | null;
  check_out_at?: string | null;
  total_route_spots: number;
  patrolled_spots: number;
  unpatrolled_spots: number;
  total_scans: number;
  total_patrol_runs: number;
  spots: PatrolProgressSpot[];
};

export type CreatedIdResponse = {
  id: string;
};
