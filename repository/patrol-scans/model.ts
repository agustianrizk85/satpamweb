export type PatrolScan = {
  id: string;
  place_id: string;
  user_id: string;
  spot_id: string;
  patrol_run_id: string;
  scanned_at: string;
  photo_url?: string | null;
  note?: string | null;
};

export type PatrolScanCreate = {
  placeId: string;
  userId: string;
  spotId: string;
  patrolRunId: string;
  photoUrl?: string | null;
  note?: string | null;
};

export type CreatedIdResponse = {
  id: string;
};
