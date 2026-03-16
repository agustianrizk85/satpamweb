"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/repository";
import type { Spot } from "@/repository/Spots";
import { spotHooks } from "@/repository/Spots";
import type { SpotAssignment } from "@/repository/spot-assignments";
import { spotAssignmentHooks } from "@/repository/spot-assignments";
import type { FacilityCheckItem } from "@/repository/facility-items";
import { listFacilityItems } from "@/repository/facility-items";
import type { FacilityCheckSpot } from "@/repository/facility-spots";
import { listFacilitySpots } from "@/repository/facility-spots";
import { createFacilityScan } from "@/repository/facility-scans";

type BarcodeLike = {
  rawValue?: string | null;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<BarcodeLike[]>;
};

type ItemMapEntry = {
  itemId: string;
  itemName: string;
  spotId: string;
  spotCode: string;
  spotName: string;
};

type ScannedFacilityItem = {
  itemId: string;
  itemName: string;
  spotId: string;
  spotCode: string;
  spotName: string;
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function normalizeItemLabel(item: ScannedFacilityItem): string {
  return `${item.itemName} - ${item.spotName} (${item.spotCode})`;
}

function extractPayloadCandidates(raw: string): string[] {
  const out = new Set<string>();
  const base = raw.trim();
  if (!base) return [];
  out.add(base);
  out.add(base.toLowerCase());

  // Support payload label format like "Ruang Tunggu (Spot-003)".
  const parenMatches = Array.from(base.matchAll(/\(([^)]+)\)/g));
  for (const m of parenMatches) {
    const token = (m[1] ?? "").trim();
    if (token) {
      out.add(token);
      out.add(token.toLowerCase());
    }
  }

  // Also split by common separators to get potential code/id tokens.
  const chunks = base.split(/[,\s|;:/\\]+/).map((s) => s.trim()).filter(Boolean);
  for (const c of chunks) {
    out.add(c);
    out.add(c.toLowerCase());
  }

  try {
    const parsed = JSON.parse(base) as Record<string, unknown>;
    const keys = ["spotId", "spot_id", "id", "spotCode", "spot_code", "qrToken", "qr_token"];
    for (const k of keys) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim()) out.add(v.trim());
    }
  } catch {}

  try {
    const url = new URL(base);
    const spotId = url.searchParams.get("spotId") ?? url.searchParams.get("spot_id");
    const spotCode = url.searchParams.get("spotCode") ?? url.searchParams.get("spot_code");
    const qrToken = url.searchParams.get("qrToken") ?? url.searchParams.get("qr_token");
    if (spotId?.trim()) out.add(spotId.trim());
    if (spotCode?.trim()) out.add(spotCode.trim());
    if (qrToken?.trim()) out.add(qrToken.trim());
  } catch {}

  return Array.from(out);
}

function resolveSpotFromPayload(raw: string, spots: FacilityCheckSpot[]): FacilityCheckSpot | null {
  const candidates = extractPayloadCandidates(raw);
  for (const token of candidates) {
    const tokenLower = token.toLowerCase();
    const byId = spots.find((s) => s.id === token);
    if (byId) return byId;
    const byCode = spots.find((s) => s.spot_code.toLowerCase() === tokenLower);
    if (byCode) return byCode;
    const byName = spots.find((s) => s.spot_name.toLowerCase() === tokenLower);
    if (byName) return byName;
    const byCodeIncluded = spots.find((s) => tokenLower.includes(s.spot_code.toLowerCase()));
    if (byCodeIncluded) return byCodeIncluded;
  }
  return null;
}

function resolveFacilityItemsFromPayload(
  raw: string,
  facilitySpots: FacilityCheckSpot[],
  placeSpots: Spot[],
  itemTokenMap: Map<string, ItemMapEntry>,
  spotItemsMap: Map<string, ScannedFacilityItem[]>,
): ScannedFacilityItem[] {
  const directSpot = resolveSpotFromPayload(raw, facilitySpots);
  if (directSpot) {
    return spotItemsMap.get(directSpot.id) ?? [];
  }

  const candidates = extractPayloadCandidates(raw);
  for (const token of candidates) {
    const tokenLower = token.toLowerCase();
    const sourceSpot = placeSpots.find((s) => {
      const code = (s.spot_code ?? s.code ?? "").toLowerCase();
      const qr = (s.qr_token ?? "").trim();
      return s.id === token || code === tokenLower || qr === token;
    });
    if (!sourceSpot) continue;

    const sourceCode = (sourceSpot.spot_code ?? sourceSpot.code ?? "").toLowerCase();
    if (!sourceCode) continue;

    const mappedFacilitySpot = facilitySpots.find((f) => f.spot_code.toLowerCase() === sourceCode);
    if (mappedFacilitySpot) return spotItemsMap.get(mappedFacilitySpot.id) ?? [];
  }

  // QR can be facility item token/id.
  for (const token of candidates) {
    const item = itemTokenMap.get(token) ?? itemTokenMap.get(token.toLowerCase());
    if (item) return [item];
  }

  return [];
}

export default function MobileFacilityScanPage() {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<BarcodeDetectorLike | null>(null);
  const detectingRef = React.useRef(false);
  const lastScannedAtRef = React.useRef(0);
  const lastScannedSpotIdRef = React.useRef<string | null>(null);

  const [scannedItems, setScannedItems] = React.useState<ScannedFacilityItem[]>([]);
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  const [successText, setSuccessText] = React.useState<string | null>(null);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [scanSupported, setScanSupported] = React.useState(false);
  const [lastRawPayload, setLastRawPayload] = React.useState("");

  const meQuery = useQuery({
    queryKey: ["satpam-mobile-me-facility-scan"],
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
  const spotsQuery = spotHooks.useList({ placeId: activePlaceId || undefined }, { enabled: Boolean(activePlaceId) });
  const placeSpotRows = React.useMemo(() => (spotsQuery.data ?? []) as Spot[], [spotsQuery.data]);

  const facilitySpotQuery = useQuery({
    queryKey: ["satpam-mobile-facility-spots-page", activePlaceId],
    enabled: Boolean(activePlaceId),
    queryFn: () => listFacilitySpots({ placeId: activePlaceId }),
  });
  const spotRows = React.useMemo(() => (facilitySpotQuery.data ?? []) as FacilityCheckSpot[], [facilitySpotQuery.data]);
  const activeSpotRows = React.useMemo(() => spotRows.filter((s) => s.is_active), [spotRows]);
  const facilityItemTokenMapQuery = useQuery({
    queryKey: ["satpam-mobile-facility-item-token-map", activeSpotRows.map((s) => s.id).join(",")],
    enabled: activeSpotRows.length > 0,
    queryFn: async () => {
      const tokenToItem = new Map<string, ItemMapEntry>();
      const spotIdToItems = new Map<string, ScannedFacilityItem[]>();
      const spotById = new Map<string, FacilityCheckSpot>();
      for (const spot of activeSpotRows) {
        spotById.set(spot.id, spot);
      }

      await Promise.all(
        activeSpotRows.map(async (spot) => {
          try {
            const items = (await listFacilityItems({ spotId: spot.id })) as FacilityCheckItem[];
            const listForSpot: ScannedFacilityItem[] = [];
            for (const item of items) {
              if (!item.is_active) continue;
              const mapped: ScannedFacilityItem = {
                itemId: item.id,
                itemName: item.item_name,
                spotId: item.spot_id,
                spotCode: spotById.get(item.spot_id)?.spot_code ?? "-",
                spotName: spotById.get(item.spot_id)?.spot_name ?? item.spot_id,
              };
              listForSpot.push(mapped);

              const rawTokens = [item.id, item.qr_token];
              for (const raw of rawTokens) {
                const token = (raw ?? "").trim();
                if (!token) continue;
                const entry: ItemMapEntry = {
                  itemId: item.id,
                  itemName: item.item_name,
                  spotId: item.spot_id,
                  spotCode: mapped.spotCode,
                  spotName: mapped.spotName,
                };
                tokenToItem.set(token, entry);
                tokenToItem.set(token.toLowerCase(), entry);
              }
            }
            spotIdToItems.set(spot.id, listForSpot);
          } catch {
          }
        }),
      );
      return { tokenToItem, spotIdToItems };
    },
  });
  const facilityItemMapping = React.useMemo(
    () =>
      facilityItemTokenMapQuery.data ?? {
        tokenToItem: new Map<string, ItemMapEntry>(),
        spotIdToItems: new Map<string, ScannedFacilityItem[]>(),
      },
    [facilityItemTokenMapQuery.data],
  );

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

  const startCamera = React.useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Kamera tidak tersedia di perangkat ini.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
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
  }, [stopCamera]);

  React.useEffect(() => {
    if (!myActiveAssignment) return;
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [myActiveAssignment, startCamera, stopCamera]);

  React.useEffect(() => {
    if (!myActiveAssignment || !scanSupported) return;
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
        setLastRawPayload(raw);

        const resolvedItems = resolveFacilityItemsFromPayload(
          raw,
          activeSpotRows,
          placeSpotRows,
          facilityItemMapping.tokenToItem,
          facilityItemMapping.spotIdToItems,
        );
        if (resolvedItems.length === 0) {
          setScanError("QR tidak dikenali. Gunakan QR Facility Item atau QR Facility Spot yang punya item aktif.");
          return;
        }

        const now = Date.now();
        const firstSpotId = resolvedItems[0]?.spotId ?? "";
        if (firstSpotId && lastScannedSpotIdRef.current === firstSpotId && now - lastScannedAtRef.current < 1200) return;
        lastScannedSpotIdRef.current = firstSpotId || null;
        lastScannedAtRef.current = now;

        setScannedItems((prev) => {
          const merged = [...prev];
          for (const item of resolvedItems) {
            if (merged.some((p) => p.itemId === item.itemId)) continue;
            merged.push(item);
          }
          return merged;
        });
        setScanError(null);
        setErrorText(null);
        setSuccessText(null);
      } catch {
      } finally {
        detectingRef.current = false;
      }
    }, 420);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeSpotRows, facilityItemMapping, myActiveAssignment, placeSpotRows, scanSupported]);

  const submit = React.useCallback(async () => {
    setErrorText(null);
    setSuccessText(null);

    const resolvedUserId = String(me?.id ?? myActiveAssignment?.user_id ?? "").trim();

    if (!activePlaceId || !resolvedUserId) {
      setErrorText("Data user/place belum siap.");
      return;
    }
    if (!isUuid(resolvedUserId)) {
      setErrorText("User ID login tidak valid. Login ulang dulu.");
      return;
    }
    if (!myActiveAssignment) {
      setErrorText("Belum ada spot assignment aktif.");
      return;
    }
    if (scannedItems.length === 0) {
      setErrorText("Scan minimal 1 QR facility item.");
      return;
    }
    if (!note.trim()) {
      setErrorText("Catatan wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const submitJobs = scannedItems.map((item) =>
        createFacilityScan({
          placeId: activePlaceId,
          spotId: item.spotId,
          itemId: item.itemId,
          userId: resolvedUserId,
          status: "OK",
          note: note.trim(),
        }),
      );
      const result = await Promise.allSettled(submitJobs);

      const failedIndexes: number[] = [];
      const failedMessages: string[] = [];
      result.forEach((r, index) => {
        if (r.status === "fulfilled") return;
        failedIndexes.push(index);
        const msg = r.reason instanceof Error ? r.reason.message : "Gagal simpan data item";
        failedMessages.push(msg);
      });

      const successCount = result.length - failedIndexes.length;
      if (successCount > 0) {
        setSuccessText(`${successCount} item facility berhasil disimpan.`);
      }

      if (failedIndexes.length > 0) {
        const failedSet = new Set(failedIndexes);
        setScannedItems((prev) => prev.filter((_, idx) => failedSet.has(idx)));
        setErrorText(`${failedIndexes.length} item gagal disimpan. ${failedMessages[0] ?? ""}`.trim());
      } else {
        setScannedItems([]);
        setNote("");
      }
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Gagal simpan facility patrol.");
    } finally {
      setIsSubmitting(false);
    }
  }, [activePlaceId, me?.id, myActiveAssignment, note, scannedItems]);

  const removeScannedItem = React.useCallback((itemId: string) => {
    setScannedItems((prev) => prev.filter((s) => s.itemId !== itemId));
  }, []);

  const clearScannedItems = React.useCallback(() => {
    setScannedItems([]);
    setScanError(null);
    setErrorText(null);
    setSuccessText(null);
  }, []);

  const restartScan = React.useCallback(() => {
    setScanError(null);
    setCameraError(null);
    void startCamera();
  }, [startCamera]);

  return (
    <div className="min-h-[100svh] bg-[#f3f6fb] p-4">
      <div className="mx-auto max-w-[560px]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[18px] font-black text-slate-900">Facility Patrol</div>
            <div className="text-[12px] font-semibold text-slate-600">Scan QR beberapa item (bisa beda spot), lalu kirim catatan</div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/mobile/dashboard")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-[12px] font-bold text-slate-800"
          >
            Back
          </button>
        </div>

        {!myActiveAssignment ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-bold text-amber-900">
            Belum ada assignment aktif. Aktifkan dulu dari dashboard.
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[12px] font-bold text-slate-700">Scanner QR Facility Item</div>
          <div className="mt-2 overflow-hidden rounded-xl border border-slate-300 bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="h-[300px] w-full object-cover" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={restartScan}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] font-black text-slate-900"
            >
              Scan Ulang
            </button>
            <button
              type="button"
              onClick={clearScannedItems}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12px] font-black text-slate-900"
            >
              Reset List
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[12px] font-bold text-slate-700">Item Terscan ({scannedItems.length})</div>
            {scannedItems.length === 0 ? (
              <div className="mt-1 text-[12px] font-semibold text-slate-500">Belum ada. Arahkan kamera ke QR facility item.</div>
            ) : (
              <div className="mt-2 space-y-2">
                {scannedItems.map((item) => (
                  <div key={item.itemId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[12px] font-bold text-slate-800">{normalizeItemLabel(item)}</div>
                    <button
                      type="button"
                      onClick={() => removeScannedItem(item.itemId)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-black text-slate-700"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="mt-3 block">
            <div className="mb-1 text-[12px] font-bold text-slate-700">Catatan (wajib)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan patroli facility"
              className="min-h-[100px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900"
            />
          </label>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!myActiveAssignment || isSubmitting || scannedItems.length === 0 || !note.trim()}
            className="mt-3 w-full rounded-xl bg-[#0b3a86] px-4 py-3 text-[13px] font-black text-white disabled:opacity-60"
          >
            {isSubmitting ? "Menyimpan..." : "Submit Facility Patrol"}
          </button>
        </div>

        {facilitySpotQuery.isLoading ? <div className="mt-2 text-[12px] font-bold text-slate-600">Memuat spot fasilitas...</div> : null}
        {facilityItemTokenMapQuery.isLoading ? <div className="mt-2 text-[12px] font-bold text-slate-600">Memuat mapping item fasilitas...</div> : null}
        {spotsQuery.isLoading ? <div className="mt-2 text-[12px] font-bold text-slate-600">Memuat spot master...</div> : null}
        {!facilitySpotQuery.isLoading && activeSpotRows.length === 0 ? (
          <div className="mt-2 text-[12px] font-bold text-amber-700">Belum ada Facility Spot aktif di place ini.</div>
        ) : null}
        {!scanSupported ? (
          <div className="mt-2 text-[12px] font-bold text-amber-700">Browser tidak support QR scanner otomatis. Gunakan browser yang support QR scanner.</div>
        ) : null}
        {cameraError ? <div className="mt-2 text-[12px] font-bold text-amber-700">{cameraError}</div> : null}
        {scanError ? <div className="mt-2 text-[12px] font-bold text-amber-700">{scanError}</div> : null}
        {lastRawPayload ? (
          <div className="mt-2 break-all text-[11px] font-semibold text-slate-600">
            Payload terakhir: {lastRawPayload}
          </div>
        ) : null}
        {errorText ? <div className="mt-2 text-[12px] font-bold text-red-700">{errorText}</div> : null}
        {successText ? <div className="mt-2 text-[12px] font-bold text-emerald-700">{successText}</div> : null}
      </div>
    </div>
  );
}
