import { getToken } from "@/libs/auth";
import { resolveAssetUrl } from "@/libs/asset-url";

const API_BASE_URL = String(
  process.env.NEXT_PUBLIC_AUTH_BASE ?? process.env.AUTH_API_BASE ?? "",
).replace(/\/$/, "");

type UploadCategory = "attendance" | "patrol";

type UploadPhotoParams = {
  category: UploadCategory;
  placeId: string;
  userId: string;
  date: string;
  dataUrl: string;
  name?: string;
};

type UploadPhotoResponse = {
  objectKey: string;
  photoUrl: string;
  mimeType: string;
  size: number;
};

function resolveApiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

function dataUrlToFile(dataUrl: string, fileNameBase: string): File {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|webp));base64,(.+)$/);
  if (!match) {
    throw new Error("Format foto tidak valid untuk upload.");
  }

  const mimeType = match[1];
  const base64 = match[2];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  return new File([bytes], `${fileNameBase}.${ext}`, { type: mimeType });
}

export async function uploadPhoto(params: UploadPhotoParams): Promise<UploadPhotoResponse> {
  const token = getToken();
  if (!token) {
    throw new Error("Token login tidak ditemukan.");
  }

  const file = dataUrlToFile(params.dataUrl, params.name?.trim() || params.category);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("placeId", params.placeId);
  formData.append("userId", params.userId);
  formData.append("date", params.date);
  if (params.name?.trim()) {
    formData.append("name", params.name.trim());
  }

  const response = await fetch(resolveApiUrl(`/api/v1/uploads/${params.category}`), {
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

  const parsed = data as UploadPhotoResponse;
  return {
    ...parsed,
    photoUrl: resolveAssetUrl(parsed.photoUrl),
  };
}
