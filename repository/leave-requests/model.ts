export type LeaveType = "SICK" | "LEAVE";
export type LeaveRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type LeaveRequest = {
  id: string;
  place_id: string;
  user_id: string;
  assignment_id?: string | null;
  leave_type: LeaveType;
  start_date: string;
  end_date?: string | null;
  reason?: string | null;
  status: LeaveRequestStatus;
  created_at: string;
  updated_at: string;
};

export type LeaveRequestCreate = {
  placeId: string;
  userId: string;
  assignmentId?: string | null;
  leaveType: LeaveType;
  startDate: string;
  endDate?: string | null;
  reason?: string | null;
};

export type LeaveRequestPatch = {
  id: string;
  placeId: string;
  status: LeaveRequestStatus;
};

export type CreatedIdResponse = {
  id: string;
};