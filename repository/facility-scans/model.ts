export type FacilityScanStatus = "OK" | "NOT_OK" | "PARTIAL";

export type FacilityCheckScan = {
  id: string;
  place_id: string;
  spot_id: string;
  item_id?: string | null;
  item_name?: string | null;
  user_id: string;
  scanned_at: string;
  status: FacilityScanStatus;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

export type FacilityCheckScanCreate = {
  placeId: string;
  spotId: string;
  itemId?: string | null;
  userId?: string;
  status?: FacilityScanStatus;
  note?: string | null;
  scannedAt?: string | null;
};

export type CreatedIdResponse = {
  id: string;
};
