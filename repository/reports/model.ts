export type AttendanceReportStatus = "PRESENT" | "LATE" | "ABSENT" | "OFF" | "SICK" | "LEAVE";
export type FacilityReportStatus = "OK" | "NOT_OK" | "PARTIAL";

export type AttendanceReportRow = {
  id: string;
  place_id: string;
  place_name: string;
  user_id: string;
  full_name: string;
  assignment_id: string | null;
  shift_id: string | null;
  shift_name: string | null;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: AttendanceReportStatus;
  late_minutes: number | null;
  note: string | null;
  check_in_photo_url: string | null;
  check_out_photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceReportSummary = {
  total_data: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  off_count: number;
  sick_count: number;
  leave_count: number;
};

export type PatrolScanReportRow = {
  id: string;
  place_id: string;
  place_name: string;
  user_id: string;
  full_name: string;
  spot_id: string;
  spot_code: string;
  spot_name: string;
  patrol_run_id: string;
  scanned_at: string;
  photo_url: string | null;
  note: string | null;
};

export type PatrolScanReportSummary = {
  total_data: number;
  unique_patrol_runs: number;
  unique_spots: number;
  unique_users: number;
};

export type FacilityScanReportRow = {
  id: string;
  place_id: string;
  place_name: string;
  spot_id: string;
  spot_code: string;
  spot_name: string;
  item_id: string | null;
  item_name: string | null;
  user_id: string;
  full_name: string;
  scanned_at: string;
  status: FacilityReportStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type FacilityScanReportSummary = {
  total_data: number;
  ok_count: number;
  not_ok_count: number;
  partial_count: number;
  unique_spots: number;
  unique_items: number;
  unique_users: number;
};

export type ReportListPagination = {
  page: number;
  pageSize: number;
  totalData: number;
  totalPages: number;
};

export type ReportListSort = {
  sortBy: string;
  sortOrder: "asc" | "desc";
};

export type ReportListResponse<T, S> = {
  data: T[];
  pagination: ReportListPagination;
  sort: ReportListSort;
  summary: S;
};

export type AttendanceReportListParams = {
  placeId?: string;
  userId?: string;
  status?: AttendanceReportStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "attendanceDate" | "checkInAt" | "checkOutAt" | "status" | "lateMinutes" | "userName" | "placeName" | "createdAt";
  sortOrder?: "asc" | "desc";
};

export type PatrolScanReportListParams = {
  placeId?: string;
  userId?: string;
  spotId?: string;
  patrolRunId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "scannedAt" | "patrolRunId" | "userName" | "placeName" | "spotName";
  sortOrder?: "asc" | "desc";
};

export type FacilityScanReportListParams = {
  placeId?: string;
  userId?: string;
  spotId?: string;
  itemId?: string;
  status?: FacilityReportStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "scannedAt" | "status" | "userName" | "placeName" | "spotName" | "itemName" | "createdAt";
  sortOrder?: "asc" | "desc";
};

export type AttendanceReportDownloadParams = Omit<AttendanceReportListParams, "page" | "pageSize" | "sortBy" | "sortOrder">;
export type PatrolScanReportDownloadParams = Omit<PatrolScanReportListParams, "page" | "pageSize" | "sortBy" | "sortOrder">;
export type FacilityScanReportDownloadParams = Omit<FacilityScanReportListParams, "page" | "pageSize" | "sortBy" | "sortOrder">;

export type ReportDownloadFormat = "csv" | "pdf";
