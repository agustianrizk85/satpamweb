export type UserPlaceRole = {
  id: string;
  user_id: string;
  place_id: string;
  role_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserPlaceRoleUpsert = {
  userId: string;
  placeId: string;
  roleId: string;
  isActive?: boolean;
};

export type CreatedIdResponse = {
  id: string;
};