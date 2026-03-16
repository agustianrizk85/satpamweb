export type Role = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type RoleCreate = {
  code: string;
  name: string;
};

export type RolePatch = {
  code?: string;
  name?: string;
};

export type CreatedIdResponse = {
  id: string;
};