import { getToken } from "@/libs/auth";
import { resolveAssetUrl } from "@/libs/asset-url";
import { createHttpAgent } from "@/libs/http";
import { fetchAllListRows } from "@/repository/list-response";

import type {
  AppVersion,
  AppVersionCreate,
  AppVersionListParams,
  AppVersionPatch,
  AppVersionUploadParams,
  AppVersionUploadResult,
} from "./model";

const agent = createHttpAgent({ basePath: "/api/v1/app-versions", auth: true });

const API_BASE_URL = String(
  process.env.NEXT_PUBLIC_AUTH_BASE ?? process.env.AUTH_API_BASE ?? "",
).replace(/\/$/, "");

function resolveApiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

export async function listAppVersions(params: AppVersionListParams): Promise<AppVersion[]> {
  return fetchAllListRows<AppVersion>(agent, "", params);
}

export async function createAppVersion(body: AppVersionCreate): Promise<AppVersion> {
  return agent.post<AppVersion>("", body);
}

export async function updateAppVersion(versionId: string, body: AppVersionPatch): Promise<AppVersion> {
  return agent.patch<AppVersion>(`/${versionId}`, body);
}

export async function deleteAppVersion(versionId: string): Promise<{ id: string }> {
  return agent.delete<{ id: string }>(`/${versionId}`);
}

export async function uploadAppVersionFile(params: AppVersionUploadParams): Promise<AppVersionUploadResult> {
  const token = getToken();
  if (!token) {
    throw new Error("Token login tidak ditemukan.");
  }

  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("placeId", params.placeId);
  formData.append("userId", params.userId);
  formData.append("versionName", params.versionName);

  const response = await fetch(resolveApiUrl("/api/v1/app-versions/upload"), {
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

  const parsed = data as AppVersionUploadResult;
  return {
    ...parsed,
    downloadUrl: resolveAssetUrl(parsed.downloadUrl),
  };
}
