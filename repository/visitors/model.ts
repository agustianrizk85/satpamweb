export type Visitor = {
  id: string;
  place_id: string;
  user_id: string;
  nik: string;
  nama: string;
  tujuan?: string | null;
  catatan?: string | null;
  created_at: string;
  updated_at: string;
};

export type VisitorCreate = {
  placeId: string;
  userId: string;
  nik: string;
  nama: string;
  tujuan?: string | null;
  catatan?: string | null;
};

export type VisitorPatch = {
  placeId?: string;
  userId?: string;
  nik?: string;
  nama?: string;
  tujuan?: string | null;
  catatan?: string | null;
};

export type CreatedIdResponse = {
  id: string;
};
