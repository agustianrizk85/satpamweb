export type UserStatus = "ACTIVE" | "INACTIVE";

export type UserRole = {
  id: string;
  code: string;
  name: string;
};

export type User = {
  id: string;
  role: UserRole;
  full_name: string;
  username: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

export type UserCreate = {
  roleId: string;
  fullName: string;
  username: string;
  password: string;
  status?: UserStatus;
};

export type UserPatch = {
  roleId?: string;
  fullName?: string;
  username?: string;
  password?: string;
  status?: UserStatus;
};

export type CreatedIdResponse = {
  id: string;
};