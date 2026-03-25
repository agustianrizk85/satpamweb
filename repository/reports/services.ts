import { getToken } from "@/libs/auth";
import { createHttpAgent } from "@/libs/http";
import type {
  AttendanceReportDownloadParams,
  AttendanceReportListParams,
  AttendanceReportRow,
  AttendanceReportSummary,
  FacilityScanReportDownloadParams,
  FacilityScanReportListParams,
  FacilityScanReportRow,
  FacilityScanReportSummary,
  PatrolScanReportDownloadParams,
  PatrolScanReportListParams,
  PatrolScanReportRow,
  PatrolScanReportSummary,
  PatrolScanReportDatesResponse,
  VisitorReportDownloadParams,
  VisitorReportListParams,
  VisitorReportRow,
  VisitorReportSummary,
  ReportDownloadFormat,
  ReportListResponse,
} from "./model";

type QueryValue = string | number | boolean | null | undefined;
type QueryObject = Record<string, QueryValue>;
export type ReportDownloadProgress = {
  loadedBytes: number;
  totalBytes: number | null;
  percent: number;
  isEstimated: boolean;
};

export type ReportDownloadOptions = {
  onProgress?: (progress: ReportDownloadProgress) => void;
};

const attendanceReportAgent = createHttpAgent({ basePath: "/api/v1/reports/attendance", auth: true });
const visitorReportAgent = createHttpAgent({ basePath: "/api/v1/reports/visitors", auth: true });
const patrolScanReportAgent = createHttpAgent({ basePath: "/api/v1/reports/patrol-scans", auth: true });
const facilityScanReportAgent = createHttpAgent({ basePath: "/api/v1/reports/facility-scans", auth: true });

function toQueryString(query?: QueryObject): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  return params.toString();
}

function resolveApiBaseUrl(): string {
  return String(process.env.NEXT_PUBLIC_AUTH_BASE ?? process.env.AUTH_API_BASE ?? "").replace(/\/$/, "");
}

function buildApiUrl(path: string, query?: QueryObject): string {
  const base = resolveApiBaseUrl();
  const absolute = /^https?:\/\//i.test(path);
  const fullPath = absolute ? path : `${base}${path}`;
  const qs = toQueryString(query);
  if (!qs) return fullPath;
  return fullPath.includes("?") ? `${fullPath}&${qs}` : `${fullPath}?${qs}`;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const parsed = (await res.json()) as { message?: string; error?: string };
      if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
      if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
    } else {
      const text = await res.text();
      if (text.trim()) return text.trim();
    }
  } catch {
    // ignore parse errors
  }
  return `HTTP ${res.status}`;
}

function buildProgressPayload(
  loadedBytes: number,
  totalBytes: number | null,
  percent: number,
  isEstimated: boolean,
): ReportDownloadProgress {
  return {
    loadedBytes: Math.max(0, Math.floor(loadedBytes)),
    totalBytes: totalBytes && totalBytes > 0 ? Math.floor(totalBytes) : null,
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    isEstimated,
  };
}

function parseFilenameFromContentDisposition(headerValue: string | null): string | null {
  if (!headerValue) return null;

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].replace(/["']/g, ""));
    } catch {
      return utf8Match[1].replace(/["']/g, "");
    }
  }

  const simpleMatch = headerValue.match(/filename="?([^";]+)"?/i);
  return simpleMatch?.[1] ?? null;
}

function triggerFileDownload(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

async function downloadReportFile(
  path: string,
  query: QueryObject,
  format: ReportDownloadFormat,
  fallbackFilename: string,
  options?: ReportDownloadOptions,
): Promise<void> {
  if (typeof window === "undefined") return;

  const token = getToken();
  const headers: Record<string, string> = {
    Accept: format === "pdf" ? "application/pdf" : "text/csv",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(buildApiUrl(path, { ...query, format }), {
    method: "GET",
    cache: "no-store",
    headers,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  const filename = parseFilenameFromContentDisposition(res.headers.get("content-disposition")) ?? fallbackFilename;
  const contentLengthRaw = Number(res.headers.get("content-length") ?? "");
  const totalBytes = Number.isFinite(contentLengthRaw) && contentLengthRaw > 0 ? contentLengthRaw : null;
  const emitProgress = options?.onProgress;

  if (emitProgress) {
    emitProgress(buildProgressPayload(0, totalBytes, 0, totalBytes === null));
  }

  let blob: Blob;
  if (!res.body) {
    blob = await res.blob();
    emitProgress?.(buildProgressPayload(blob.size, totalBytes ?? blob.size, 100, totalBytes === null));
  } else {
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let loadedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      // Normalize to ArrayBuffer-backed view for BlobPart compatibility in TS libdom.
      chunks.push(new Uint8Array(value));
      loadedBytes += value.byteLength;
      if (emitProgress) {
        if (totalBytes && totalBytes > 0) {
          const percent = Math.min(99, (loadedBytes / totalBytes) * 100);
          emitProgress(buildProgressPayload(loadedBytes, totalBytes, percent, false));
        } else {
          const estimated = Math.min(95, Math.max(1, Math.log10(loadedBytes + 1) * 20));
          emitProgress(buildProgressPayload(loadedBytes, null, estimated, true));
        }
      }
    }

    blob = new Blob(chunks, { type: res.headers.get("content-type") ?? undefined });
    emitProgress?.(buildProgressPayload(blob.size, totalBytes ?? blob.size, 100, totalBytes === null));
  }

  triggerFileDownload(blob, filename);
}

export async function listAttendanceReports(params: AttendanceReportListParams): Promise<ReportListResponse<AttendanceReportRow, AttendanceReportSummary>> {
  return attendanceReportAgent.get<ReportListResponse<AttendanceReportRow, AttendanceReportSummary>>("", { query: params });
}

export async function listVisitorReports(params: VisitorReportListParams): Promise<ReportListResponse<VisitorReportRow, VisitorReportSummary>> {
  return visitorReportAgent.get<ReportListResponse<VisitorReportRow, VisitorReportSummary>>("", { query: params });
}

export async function listPatrolScanReports(params: PatrolScanReportListParams): Promise<ReportListResponse<PatrolScanReportRow, PatrolScanReportSummary>> {
  return patrolScanReportAgent.get<ReportListResponse<PatrolScanReportRow, PatrolScanReportSummary>>("", { query: params });
}

export async function listPatrolScanReportDates(params: { placeId?: string; month?: string }): Promise<PatrolScanReportDatesResponse> {
  return patrolScanReportAgent.get<PatrolScanReportDatesResponse>("/dates", { query: params });
}

export async function listFacilityScanReports(params: FacilityScanReportListParams): Promise<ReportListResponse<FacilityScanReportRow, FacilityScanReportSummary>> {
  return facilityScanReportAgent.get<ReportListResponse<FacilityScanReportRow, FacilityScanReportSummary>>("", { query: params });
}

export async function downloadAttendanceReportCsv(
  params: AttendanceReportDownloadParams,
  format: ReportDownloadFormat = "csv",
  options?: ReportDownloadOptions,
): Promise<void> {
  return downloadReportFile(
    "/api/v1/reports/attendance/download",
    params,
    format,
    format === "pdf" ? "attendance-report.pdf" : "attendance-report.csv",
    options,
  );
}

export async function downloadVisitorReportCsv(
  params: VisitorReportDownloadParams,
  format: ReportDownloadFormat = "csv",
  options?: ReportDownloadOptions,
): Promise<void> {
  return downloadReportFile(
    "/api/v1/reports/visitors/download",
    params,
    format,
    format === "pdf" ? "visitor-log-report.pdf" : "visitor-log-report.csv",
    options,
  );
}

export async function downloadPatrolScanReportCsv(
  params: PatrolScanReportDownloadParams,
  format: ReportDownloadFormat = "csv",
  options?: ReportDownloadOptions,
): Promise<void> {
  return downloadReportFile(
    "/api/v1/reports/patrol-scans/download",
    params,
    format,
    format === "pdf" ? "patrol-scan-report.pdf" : "patrol-scan-report.csv",
    options,
  );
}

export async function downloadFacilityScanReportCsv(params: FacilityScanReportDownloadParams, options?: ReportDownloadOptions): Promise<void> {
  return downloadReportFile("/api/v1/reports/facility-scans/download", params, "csv", "facility-scan-report.csv", options);
}
