export type AppVersion = {
  id: string;
  place_id: string;
  user_id: string;
  version_name: string;
  download_url: string;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AppVersionCreate = {
  placeId: string;
  userId: string;
  versionName: string;
  downloadUrl: string;
  isMandatory?: boolean;
  isActive?: boolean;
};

export type AppVersionPatch = {
  versionName?: string;
  downloadUrl?: string;
  isMandatory?: boolean;
  isActive?: boolean;
};

export type AppVersionListParams = {
  placeId: string;
  userId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "versionName" | "createdAt" | "updatedAt" | "isActive" | "isMandatory" | "userId";
  sortOrder?: "asc" | "desc";
};

export type AppVersionUploadParams = {
  placeId: string;
  userId: string;
  versionName: string;
  file: File;
};

export type AppVersionUploadResult = {
  objectKey: string;
  downloadUrl: string;
  fileName: string;
  size: number;
};
