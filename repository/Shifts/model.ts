export type Shift = {
  id: string;
  place_id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ShiftCreate = {
  placeId: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
};

export type ShiftPatch = {
  placeId?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  isActive?: boolean;
};

export type CreatedIdResponse = {
  id: string;
};
