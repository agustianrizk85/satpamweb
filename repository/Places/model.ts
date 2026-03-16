export type PlaceStatus = "ACTIVE" | "INACTIVE";

export type Place = {
  id: string;
  place_code: string;
  place_name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: PlaceStatus;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};

export type PlaceCreate = {
  placeCode: string;
  placeName: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: PlaceStatus;
};

export type PlacePatch = {
  placeCode?: string;
  placeName?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: PlaceStatus;
};

export type CreatedIdResponse = {
  id: string;
};