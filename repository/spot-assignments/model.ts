export type SpotAssignment = {
  id: string;
  place_id: string;
  user_id: string;
  shift_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SpotAssignmentCreate = {
  placeId: string;
  userId: string;
  shiftId: string;
  isActive?: boolean;
};

export type SpotAssignmentPatch = {
  placeId?: string;
  userId?: string;
  shiftId?: string;
  isActive?: boolean;
};

export type CreatedIdResponse = {
  id: string;
};
