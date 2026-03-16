export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "OFF" | "SICK" | "LEAVE";

export type Attendance = {
  id: string;
  place_id: string;
  user_id: string;
  assignment_id?: string | null;
  shift_id?: string | null;
  attendance_date: string;
  check_in_at?: string | null;
  check_out_at?: string | null;
  photo_url?: string | null;
  check_in_photo_url?: string | null;
  check_out_photo_url?: string | null;
  status: AttendanceStatus;
  late_minutes?: number | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceCreate = {
  placeId: string;
  userId: string;
  assignmentId?: string | null;
  shiftId?: string | null;
  attendanceDate: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInPhotoUrl?: string | null;
  checkOutPhotoUrl?: string | null;
  photoUrl?: string | null;
  status?: AttendanceStatus;
  note?: string | null;
};

export type AttendancePatch = {
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInPhotoUrl?: string | null;
  checkOutPhotoUrl?: string | null;
  photoUrl?: string | null;
  status?: AttendanceStatus;
  note?: string | null;
};

export type CreatedIdResponse = {
  id: string;
};
