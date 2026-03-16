export type PatrolRoutePoint = {
  id: string;
  place_id: string;
  spot_id: string;
  seq: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PatrolRoutePointCreate = {
  placeId: string;
  spotId: string;
  seq: number;
  isActive?: boolean;
};

export type CreatedIdResponse = {
  id: string;
};