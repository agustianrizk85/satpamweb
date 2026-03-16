export type FacilityCheckItem = {
  id: string;
  spot_id: string;
  item_name: string;
  qr_token: string;
  is_required: boolean;
  sort_no: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FacilityCheckItemCreate = {
  spotId: string;
  itemName: string;
  qrToken?: string | null;
  isRequired?: boolean;
  sortNo?: number;
  isActive?: boolean;
};

export type FacilityCheckItemPatch = {
  spotId?: string;
  itemName?: string;
  qrToken?: string | null;
  isRequired?: boolean;
  sortNo?: number;
  isActive?: boolean;
};

export type CreatedIdResponse = {
  id: string;
};
