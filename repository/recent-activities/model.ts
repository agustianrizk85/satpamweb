export type RecentActivityType =
  | "ATTENDANCE_CHECK_IN"
  | "ATTENDANCE_CHECK_OUT"
  | "PATROL_SPOT_SCAN"
  | "PATROL_FACILITY_SCAN";

export type RecentActivityRow = {
  activity_id: string;
  activity_type: RecentActivityType;
  activity_at: string;
  place_id: string;
  place_name: string | null;
  user_id: string;
  user_name: string | null;
  source_id: string;
  metadata: Record<string, unknown> | null;
};

export type RecentActivitySummary = {
  total_today: number;
  total_month: number;
  total_year: number;
  facility_active: number;
  spot_active: number;
  point_active: number;
  patrol_spot_today: number;
  patrol_spot_month: number;
  patrol_spot_year: number;
  patrol_facility_today: number;
  patrol_facility_month: number;
  patrol_facility_year: number;
  attendance_check_in_today: number;
  attendance_check_in_month: number;
  attendance_check_in_year: number;
  attendance_check_out_today: number;
  attendance_check_out_month: number;
  attendance_check_out_year: number;
};

export type RecentActivityListResponse = {
  data: RecentActivityRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalData: number;
    totalPages: number;
  };
  sort: {
    sortBy: "activityAt" | "activityType" | "userId" | "placeId";
    sortOrder: "asc" | "desc";
  };
  summary: RecentActivitySummary;
};

export type RecentActivityListParams = {
  placeId?: string;
  userId?: string;
  activityType?: RecentActivityType;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "activityAt" | "activityType" | "userId" | "placeId";
  sortOrder?: "asc" | "desc";
};
