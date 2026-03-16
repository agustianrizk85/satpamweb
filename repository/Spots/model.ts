export type SpotStatus = "ACTIVE" | "INACTIVE";

export type Spot = {
  id: string;
  place_id: string;
  spot_code?: string;
  spot_name?: string;
  code?: string;
  name?: string;
  qr_token: string;
  latitude?: number | null;
  longitude?: number | null;
  status: SpotStatus;
  created_at: string;
  updated_at: string;
};

export type SpotCreate = {
  placeId: string;
  spotCode: string;
  spotName: string;
  qrToken: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: SpotStatus;
};

export type SpotPatch = {
  placeId?: string;
  spotCode?: string;
  spotName?: string;
  qrToken?: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: SpotStatus;
};

export type CreatedIdResponse = {
  id: string;
};
