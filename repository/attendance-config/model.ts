export type AttendanceConfig = {
  place_id: string;
  allowed_radius_m: number;
  center_latitude?: number | null;
  center_longitude?: number | null;
  require_photo: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AttendanceConfigUpsert = {
  placeId: string;
  allowedRadiusM: number;
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  requirePhoto?: boolean;
  isActive?: boolean;
};