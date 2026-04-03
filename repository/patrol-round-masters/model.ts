export type PatrolRoundMaster = {
  id: string;
  place_id: string;
  round_no: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PatrolRoundMasterCreate = {
  placeId: string;
  roundNo: number;
  isActive?: boolean | null;
};

export type PatrolRoundMasterPatch = {
  roundNo?: number;
  isActive?: boolean;
};
