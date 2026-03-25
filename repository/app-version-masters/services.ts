import { createHttpAgent } from "@/libs/http";
import { getToken } from "@/libs/auth";
import { resolveAssetUrl } from "@/libs/asset-url";
import { fetchAllListRows } from "@/repository/list-response";

import type {
  AppVersionMaster,
  AppVersionMasterCreate,
  AppVersionMasterListParams,
  AppVersionMasterPatch,
  AppVersionMasterUploadParams,
  AppVersionMasterUploadResult,
} from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/app-version-masters", auth: true });
const API_BASE_URL = String(
  process.env.NEXT_PUBLIC_AUTH_BASE ?? process.env.AUTH_API_BASE ?? "",
).replace(/\/$/, "");

function resolveApiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

export async function listAppVersionMasters(params: AppVersionMasterListParams): Promise<AppVersionMaster[]> {
  return fetchAllListRows<AppVersionMaster>(agent, "", params);
}

export async function createAppVersionMaster(body: AppVersionMasterCreate): Promise<AppVersionMaster> {
  return agent.post<AppVersionMaster>("", body);
}

export async function updateAppVersionMaster(masterId: string, body: AppVersionMasterPatch): Promise<AppVersionMaster> {
  return agent.patch<AppVersionMaster>(`/${masterId}`, body);
}

export async function deleteAppVersionMaster(masterId: string): Promise<{ id: string }> {
  return agent.delete<{ id: string }>(`/${masterId}`);
}

export async function uploadAppVersionMasterFile(params: AppVersionMasterUploadParams): Promise<AppVersionMasterUploadResult> {
  const token = getToken();
  if (!token) {
    throw new Error("Token login tidak ditemukan.");
  }

  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("versionName", params.versionName);

  const response = await fetch(resolveApiUrl("/api/v1/app-version-masters/upload"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    cache: "no-store",
  });

  const raw = await response.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw ? { message: raw } : null;
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  const parsed = data as AppVersionMasterUploadResult;
  return {
    ...parsed,
    downloadUrl: resolveAssetUrl(parsed.downloadUrl),
  };
}
