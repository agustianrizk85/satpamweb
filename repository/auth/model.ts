export type LoginBody = {
  username: string;
  password: string;
};

export type LoginUser = {
  id: string;
  fullName: string;
  role: string;
};

export type LoginResponse = {
  accessToken: string;
  user: LoginUser;
};

export type MeResponse = {
  id: string;
  fullName: string;
  role: string;
  username?: string;
  status?: string;
  defaultPlaceId?: string | null;
  placeAccesses?: Array<{
    placeId: string;
    placeCode: string;
    placeName: string;
    roleCode: string;
    roleName: string;
  }>;
};
