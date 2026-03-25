export type AppVersionMaster = {
  id: string;
  version_name: string;
  download_url: string;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AppVersionMasterCreate = {
  versionName: string;
  downloadUrl: string;
  isMandatory?: boolean;
  isActive?: boolean;
};

export type AppVersionMasterPatch = {
  versionName?: string;
  downloadUrl?: string;
  isMandatory?: boolean;
  isActive?: boolean;
};

export type AppVersionMasterListParams = {
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "versionName" | "createdAt" | "updatedAt" | "isActive" | "isMandatory";
  sortOrder?: "asc" | "desc";
};

export type AppVersionMasterUploadParams = {
  versionName: string;
  file: File;
};

export type AppVersionMasterUploadResult = {
  objectKey: string;
  downloadUrl: string;
  fileName: string;
  size: number;
};
