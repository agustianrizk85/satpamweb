"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/repository";
import type { Spot } from "@/repository/Spots";
import { spotHooks } from "@/repository/Spots";
import type { SpotAssignment } from "@/repository/spot-assignments";
import { spotAssignmentHooks } from "@/repository/spot-assignments";
import { createPatrolScan } from "@/repository/patrol-scans";
import { uploadPhoto } from "@/repository/uploads";
import { compressImageDataUrl, estimateDataUrlSizeBytes, formatBytesToKB } from "@/libs/image";

const PATROL_PHOTO_MAX_KB = 200;
const PATROL_WATERMARK_TEXT = "Property of Azzahra System";

type BarcodeLike = {
  rawValue?: string | null;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeLike[]>;
};
type CaptureFacingMode = "user" | "environment";

function buildRunId(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RUN-${yyyy}${mm}${dd}-${hh}${mi}${ss}${ms}-${rand}`;
}

function localDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeSpotLabel(s: Spot): string {
  return `${s.name ?? s.spot_name ?? s.id} (${s.code ?? s.spot_code ?? "-"})`;
}

function extractPayloadCandidates(raw: string): string[] {
  const out = new Set<string>();
  const base = raw.trim();
  if (!base) return [];
  out.add(base);

  try {
    const parsed = JSON.parse(base) as Record<string, unknown>;
    const keys = ["spotId", "spot_id", "id", "qrToken", "qr_token"];
    for (const k of keys) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim()) out.add(v.trim());
    }
  } catch {}

  try {
    const url = new URL(base);
    const spotId = url.searchParams.get("spotId") ?? url.searchParams.get("spot_id");
    const qrToken = url.searchParams.get("qrToken") ?? url.searchParams.get("qr_token");
    if (spotId?.trim()) out.add(spotId.trim());
    if (qrToken?.trim()) out.add(qrToken.trim());
  } catch {}

  return Array.from(out);
}

function resolveSpotFromPayload(raw: string, spots: Spot[]): Spot | null {
  const candidates = extractPayloadCandidates(raw);
  for (const token of candidates) {
    const byId = spots.find((s) => s.id === token);
    if (byId) return byId;
    const byQr = spots.find((s) => (s.qr_token ?? "").trim() === token);
    if (byQr) return byQr;
  }
  return null;
}

export default function MobilePatrolScanPage() {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<BarcodeDetectorLike | null>(null);
  const detectingRef = React.useRef(false);

  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = React.useState("");
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successText, setSuccessText] = React.useState<string | null>(null);
  const [patrolRunId, setPatrolRunId] = React.useState(() => buildRunId(new Date()));
  const [note, setNote] = React.useState("");
  const [resolvedSpot, setResolvedSpot] = React.useState<Spot | null>(null);
  const [scanSupported, setScanSupported] = React.useState(false);
  const [captureFacingMode, setCaptureFacingMode] = React.useState<CaptureFacingMode>("user");

  const meQuery = useQuery({
    queryKey: ["satpam-mobile-me-patrol-camera"],
    queryFn: () => auth.me(),
  });

  const me = meQuery.data ?? null;
  const activePlaceId = me?.defaultPlaceId ?? me?.placeAccesses?.[0]?.placeId ?? "";

  const assignmentQuery = spotAssignmentHooks.useList(
    { placeId: activePlaceId || undefined },
    { enabled: Boolean(activePlaceId) },
  );
  const assignmentRows = React.useMemo(() => (assignmentQuery.data ?? []) as SpotAssignment[], [assignmentQuery.data]);
  const myActiveAssignment = React.useMemo(
    () => assignmentRows.find((row) => row.user_id === me?.id && row.is_active) ?? null,
    [assignmentRows, me?.id],
  );

  const spotsQuery = spotHooks.useList({});
  const spotRows = React.useMemo(() => (spotsQuery.data ?? []) as Spot[], [spotsQuery.data]);
  const availableSpots = React.useMemo(() => {
    const pid = activePlaceId.trim();
    if (!pid) return [] as Spot[];
    return spotRows.filter((s) => s.place_id === pid && (s.status ?? "ACTIVE") === "ACTIVE");
  }, [activePlaceId, spotRows]);

  const isScanStep = !resolvedSpot;

  React.useEffect(() => {
    const detectorCtor = (
      window as Window & { BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike }
    ).BarcodeDetector;
    if (!detectorCtor) {
      setScanSupported(false);
      detectorRef.current = null;
      return;
    }
    try {
      detectorRef.current = new detectorCtor({ formats: ["qr_code"] });
      setScanSupported(true);
    } catch {
      detectorRef.current = null;
      setScanSupported(false);
    }
  }, []);

  const stopCamera = React.useCallback(() => {
    if (!streamRef.current) return;
    for (const track of streamRef.current.getTracks()) track.stop();
    streamRef.current = null;
  }, []);

  const startCamera = React.useCallback(
    async (mode: "scan" | "photo", photoFacingMode: CaptureFacingMode) => {
      stopCamera();
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Kamera tidak tersedia di perangkat ini.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode === "scan" ? "environment" : photoFacingMode } },
          audio: false,
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        setCameraError(e instanceof Error ? e.message : "Gagal membuka kamera.");
      }
    },
    [stopCamera],
  );

  React.useEffect(() => {
    if (!myActiveAssignment) return;
    if (!isScanStep && photoUrl) return;
    void startCamera(isScanStep ? "scan" : "photo", captureFacingMode);
    return () => {
      stopCamera();
    };
  }, [captureFacingMode, isScanStep, myActiveAssignment, photoUrl, startCamera, stopCamera]);

  const resolveAndSetSpot = React.useCallback(
    (payloadRaw: string) => {
      const match = resolveSpotFromPayload(payloadRaw, availableSpots);
      if (!match) {
        setScanError("QR tidak dikenali untuk spot di place aktif.");
        return false;
      }
      stopCamera();
      setResolvedSpot(match);
      setScanError(null);
      setSubmitError(null);
      return true;
    },
    [availableSpots, stopCamera],
  );

  React.useEffect(() => {
    if (!myActiveAssignment || !scanSupported || !isScanStep) return;
    const timer = window.setInterval(async () => {
      if (detectingRef.current) return;
      const detector = detectorRef.current;
      const video = videoRef.current;
      if (!detector || !video || video.readyState < 2) return;
      detectingRef.current = true;
      try {
        const barcodes = await detector.detect(video);
        const raw = barcodes[0]?.rawValue?.trim() ?? "";
        if (!raw) return;
        void resolveAndSetSpot(raw);
      } catch {
      } finally {
        detectingRef.current = false;
      }
    }, 450);
    return () => {
      window.clearInterval(timer);
    };
  }, [isScanStep, myActiveAssignment, resolveAndSetSpot, scanSupported]);

  const capturePhoto = React.useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      setCameraError("Kamera belum siap.");
      return;
    }
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      setCameraError("Video kamera belum siap.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("Gagal mengambil foto.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const raw = canvas.toDataURL("image/jpeg", 0.92);
      const compressed = await compressImageDataUrl(raw, {
        maxKB: PATROL_PHOTO_MAX_KB,
        watermarkText: PATROL_WATERMARK_TEXT,
      });
      setPhotoUrl(compressed.dataUrl);
      stopCamera();
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : "Gagal memproses foto.");
    }
  }, [stopCamera]);

  const onScanAgain = React.useCallback(() => {
    stopCamera();
    setResolvedSpot(null);
    setScanError(null);
    setPhotoUrl("");
    setCameraError(null);
  }, [stopCamera]);

  const retakePhoto = React.useCallback(() => {
    setPhotoUrl("");
    setSubmitError(null);
  }, []);

  const onSelectCaptureCamera = React.useCallback((nextMode: CaptureFacingMode) => {
    setCaptureFacingMode(nextMode);
    setPhotoUrl("");
    setCameraError(null);
  }, []);

  const submitPatrolScan = React.useCallback(async () => {
    setSubmitError(null);
    setSuccessText(null);

    if (!activePlaceId || !me?.id) {
      setSubmitError("Data user/place belum siap.");
      return;
    }
    if (!myActiveAssignment) {
      setSubmitError("Belum ada assignment aktif. Aktifkan assignment dulu.");
      return;
    }
    if (!resolvedSpot?.id) {
      setSubmitError("Scan QR spot dulu.");
      return;
    }
    if (!patrolRunId.trim()) {
      setSubmitError("Patrol Run ID tidak valid.");
      return;
    }
    if (!photoUrl) {
      setSubmitError("Foto wajib diisi.");
      return;
    }
    if (!note.trim()) {
      setSubmitError("Catatan wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedPhoto = await uploadPhoto({
        category: "patrol",
        placeId: activePlaceId,
        userId: me.id,
        date: localDateKey(new Date()),
        dataUrl: photoUrl,
        name: resolvedSpot.spot_code ?? resolvedSpot.code ?? "patrol",
      });
      await createPatrolScan({
        placeId: activePlaceId,
        userId: me.id,
        spotId: resolvedSpot.id,
        patrolRunId: patrolRunId.trim(),
        photoUrl: uploadedPhoto.photoUrl,
        note: note.trim(),
      });
      setSuccessText("Patrol scan berhasil.");
      setPatrolRunId(buildRunId(new Date()));
      setNote("");
      setPhotoUrl("");
      setResolvedSpot(null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Gagal submit patrol scan.");
    } finally {
      setIsSubmitting(false);
    }
  }, [activePlaceId, me?.id, myActiveAssignment, note, patrolRunId, photoUrl, resolvedSpot]);

  const disabledAction = !myActiveAssignment || isSubmitting;

  return (
    <div className="min-h-[100svh] bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-[560px]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[18px] font-black">Patrol QR Scanner</div>
            <div className="text-[12px] font-semibold text-slate-300">
              {myActiveAssignment ? "Scan QR spot, lalu isi foto + catatan" : "Belum ada assignment aktif"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/mobile/dashboard")}
            className="rounded-lg border border-slate-700 px-3 py-2 text-[12px] font-bold"
          >
            Back
          </button>
        </div>

        {!myActiveAssignment ? (
          <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-[12px] font-bold text-rose-200">
            Belum ada assignment aktif. Kembali ke Dashboard dan aktifkan shift dulu.
          </div>
        ) : null}

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="text-[12px] font-bold text-slate-300">Spot Dari QR</div>
          {resolvedSpot ? (
            <div className="mt-1 text-[13px] font-black text-emerald-300">{normalizeSpotLabel(resolvedSpot)}</div>
          ) : (
            <div className="mt-1 text-[13px] font-black text-amber-300">Belum terbaca. Arahkan kamera ke QR Spot.</div>
          )}

          <div className="mt-2 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={onScanAgain}
              className="rounded-xl border border-slate-700 px-3 py-2 text-[12px] font-black"
            >
              Scan Ulang
            </button>
          </div>
          {!scanSupported ? (
            <div className="mt-2 text-[11px] font-bold text-amber-300">
              Browser tidak support scan QR otomatis. Gunakan browser yang support QR scanner.
            </div>
          ) : null}
        </div>

        {isScanStep ? (
          <div className="mt-3">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="h-[420px] w-full object-cover" />
            </div>
            <div className="mt-2 text-[12px] font-bold text-slate-300">
              Scan QR dulu. Setelah berhasil, kamera foto dan catatan akan muncul.
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-800 bg-black">
              {photoUrl ? (
                <img src={photoUrl} alt="Preview Patrol" className="h-[420px] w-full object-cover" />
              ) : (
                <video ref={videoRef} autoPlay playsInline muted className="h-[420px] w-full object-cover" />
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSelectCaptureCamera("user")}
                disabled={disabledAction}
                className={`rounded-xl border px-4 py-2 text-[12px] font-black disabled:opacity-60 ${
                  captureFacingMode === "user"
                    ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
                    : "border-slate-700 bg-slate-900 text-white"
                }`}
              >
                Kamera Depan
              </button>
              <button
                type="button"
                onClick={() => onSelectCaptureCamera("environment")}
                disabled={disabledAction}
                className={`rounded-xl border px-4 py-2 text-[12px] font-black disabled:opacity-60 ${
                  captureFacingMode === "environment"
                    ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
                    : "border-slate-700 bg-slate-900 text-white"
                }`}
              >
                Kamera Belakang
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              {!photoUrl ? (
                <button
                  type="button"
                  onClick={() => void capturePhoto()}
                  disabled={disabledAction}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-[13px] font-black disabled:opacity-60"
                >
                  Ambil Foto
                </button>
              ) : (
                <button
                  type="button"
                  onClick={retakePhoto}
                  disabled={isSubmitting}
                  className="rounded-xl bg-slate-700 px-4 py-3 text-[13px] font-black disabled:opacity-60"
                >
                  Ulangi Foto
                </button>
              )}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan (wajib)"
              className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white placeholder:text-slate-400"
            />

            <button
              type="button"
              onClick={() => void submitPatrolScan()}
              disabled={disabledAction || !photoUrl || !note.trim()}
              className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-[13px] font-black disabled:opacity-60"
            >
              {isSubmitting ? "Menyimpan..." : "Submit Patrol Scan"}
            </button>
          </>
        )}

        {photoUrl ? (
          <div className="mt-2 text-[12px] font-bold text-slate-300">
            Ukuran foto: {formatBytesToKB(estimateDataUrlSizeBytes(photoUrl))} (target {PATROL_PHOTO_MAX_KB} KB)
          </div>
        ) : null}
        {spotsQuery.isLoading ? <div className="mt-2 text-[12px] font-bold text-slate-300">Memuat data spot...</div> : null}
        {!spotsQuery.isLoading && availableSpots.length === 0 ? (
          <div className="mt-2 text-[12px] font-bold text-amber-300">Belum ada spot aktif di place ini.</div>
        ) : null}
        {cameraError ? <div className="mt-2 text-[12px] font-bold text-amber-300">{cameraError}</div> : null}
        {scanError ? <div className="mt-2 text-[12px] font-bold text-amber-300">{scanError}</div> : null}
        {submitError ? <div className="mt-2 text-[12px] font-bold text-rose-300">{submitError}</div> : null}
        {successText ? <div className="mt-2 text-[12px] font-bold text-emerald-300">{successText}</div> : null}
      </div>
    </div>
  );
}
