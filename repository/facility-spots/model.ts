export type FacilityCheckSpot = {
  id: string;
  place_id: string;
  spot_code: string;
  spot_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FacilityCheckSpotCreate = {
  placeId: string;
  spotCode: string;
  spotName: string;
  isActive?: boolean;
};

export type FacilityCheckSpotPatch = {
  placeId?: string;
  spotCode?: string;
  spotName?: string;
  isActive?: boolean;
};

export type CreatedIdResponse = {
  id: string;
};
