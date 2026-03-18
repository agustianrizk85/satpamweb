"use client";
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/repository";
import { attendanceHooks, createAttendance, updateAttendance } from "@/repository/attendances";
import type { Attendance } from "@/repository/attendances";
import type { SpotAssignment } from "@/repository/spot-assignments";
import { spotAssignmentHooks, updateSpotAssignment } from "@/repository/spot-assignments";
import { uploadPhoto } from "@/repository/uploads";
import { compressImageDataUrl, estimateDataUrlSizeBytes, formatBytesToKB } from "@/libs/image";

const ATTENDANCE_PHOTO_MAX_KB = 200;
const ATTENDANCE_WATERMARK_TEXT = "Property of Azzahra System";

function localDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function MobileAttendanceCameraPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const todayKey = React.useMemo(() => localDateKey(new Date()), []);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = React.useState("");
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successText, setSuccessText] = React.useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["satpam-mobile-me-camera"],
    queryFn: () => auth.me(),
  });

  const me = meQuery.data ?? null;
  const activePlaceId = me?.defaultPlaceId ?? me?.placeAccesses?.[0]?.placeId ?? "";

  const attendanceQuery = attendanceHooks.useList(
    {
      placeId: activePlaceId || undefined,
      userId: me?.id,
      attendanceDate: todayKey,
    },
    { enabled: Boolean(activePlaceId && me?.id) },
  );
  const assignmentQuery = spotAssignmentHooks.useList(
    {
      placeId: activePlaceId || undefined,
      userId: me?.id,
      isActive: true,
    },
    { enabled: Boolean(activePlaceId && me?.id), refetchOnMount: "always" },
  );

  const assignmentRows = React.useMemo(() => (assignmentQuery.data ?? []) as SpotAssignment[], [assignmentQuery.data]);
  const myActiveAssignment = React.useMemo(
    () => assignmentRows.find((row) => row.user_id === me?.id && row.is_active) ?? null,
    [assignmentRows, me?.id],
  );

  const attendanceRows = React.useMemo(() => (attendanceQuery.data ?? []) as Attendance[], [attendanceQuery.data]);

  const currentAttendance = React.useMemo(() => {
    const rows = [...attendanceRows].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return tb - ta;
    });

    if (myActiveAssignment?.id) {
      const byAssignment = rows.find((row) => row.assignment_id === myActiveAssignment.id);
      if (byAssignment) return byAssignment;
    }

    const openRow = rows.find((row) => row.check_in_at && !row.check_out_at);
    if (openRow) return openRow;

    return rows[0] ?? null;
  }, [attendanceRows, myActiveAssignment?.id]);

  const actionType = React.useMemo<"NEED_ASSIGNMENT" | "CHECK_IN" | "CHECK_OUT" | "DONE">(() => {
    if (currentAttendance?.check_in_at && !currentAttendance?.check_out_at) return "CHECK_OUT";
    if (myActiveAssignment?.id) {
      if (currentAttendance?.assignment_id === myActiveAssignment.id && currentAttendance?.check_out_at) return "DONE";
      return "CHECK_IN";
    }
    return "NEED_ASSIGNMENT";
  }, [currentAttendance?.assignment_id, currentAttendance?.check_in_at, currentAttendance?.check_out_at, myActiveAssignment?.id]);

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
        video: { facingMode: { ideal: "user" } },
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
    if (actionType === "DONE" || actionType === "NEED_ASSIGNMENT") return;
    if (photoUrl) return;
    void startCamera();
    return () => {
      stopCamera();
    };
  }, [actionType, photoUrl, startCamera, stopCamera]);

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
        maxKB: ATTENDANCE_PHOTO_MAX_KB,
        watermarkText: ATTENDANCE_WATERMARK_TEXT,
      });
      setPhotoUrl(compressed.dataUrl);
      stopCamera();
    } catch (e) {
      setCameraError(e instanceof Error ? e.message : "Gagal memproses foto.");
    }
  }, [stopCamera]);

  const retakePhoto = React.useCallback(() => {
    setPhotoUrl("");
    setSubmitError(null);
  }, []);

  const submitAttendance = React.useCallback(async () => {
    setSubmitError(null);
    if (!activePlaceId || !me?.id) {
      setSubmitError("Data user/place belum siap.");
      return;
    }
    if (actionType === "NEED_ASSIGNMENT") {
      setSubmitError("Assignment tidak aktif. Pilih shift dulu dari dashboard.");
      return;
    }
    if (actionType === "DONE") {
      setSubmitError("Attendance hari ini sudah check-in dan check-out.");
      return;
    }
    if (!photoUrl) {
      setSubmitError("Ambil foto dulu sebelum submit attendance.");
      return;
    }

    setIsSubmitting(true);
    const nowIso = new Date().toISOString();
    try {
      const uploadedPhoto = await uploadPhoto({
        category: "attendance",
        placeId: activePlaceId,
        userId: me.id,
        date: todayKey,
        dataUrl: photoUrl,
        name: actionType === "CHECK_IN" ? "checkin" : "checkout",
      });
      if (actionType === "CHECK_IN") {
        await createAttendance({
          placeId: activePlaceId,
          userId: me.id,
          assignmentId: myActiveAssignment?.id ?? null,
          shiftId: myActiveAssignment?.shift_id ?? null,
          attendanceDate: todayKey,
          checkInAt: nowIso,
          status: "PRESENT",
          checkInPhotoUrl: uploadedPhoto.photoUrl,
        });
        setSuccessText("Check-in berhasil.");
      } else {
        if (!currentAttendance?.id) throw new Error("Attendance hari ini tidak ditemukan.");
        await updateAttendance(currentAttendance.id, {
          checkOutAt: nowIso,
          checkOutPhotoUrl: uploadedPhoto.photoUrl,
        });
        const activeAssignmentIds = assignmentRows
          .filter((row) => row.user_id === me?.id && row.is_active)
          .map((row) => row.id);
        if (activeAssignmentIds.length > 0) {
          const results = await Promise.allSettled(
            activeAssignmentIds.map((assignmentId) => updateSpotAssignment(assignmentId, { isActive: false })),
          );
          const failedCount = results.filter((result) => result.status === "rejected").length;
          if (failedCount > 0) {
            console.warn(`Failed to deactivate ${failedCount} active spot assignment(s) after check-out.`);
          }
        }
        await queryClient.invalidateQueries({ queryKey: ["satpam-spot-assignments"] });
        await queryClient.invalidateQueries({ queryKey: ["satpam-attendances"] });
        setSuccessText("Check-out berhasil.");
      }

      window.setTimeout(() => {
        router.push("/mobile/dashboard");
      }, 700);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Gagal submit attendance.");
    } finally {
      setIsSubmitting(false);
    }
  }, [actionType, activePlaceId, assignmentRows, currentAttendance?.id, me?.id, myActiveAssignment?.id, myActiveAssignment?.shift_id, photoUrl, queryClient, router, todayKey]);

  return (
    <div className="min-h-[100svh] bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-[560px]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[18px] font-black">Attendance Camera</div>
            <div className="text-[12px] font-semibold text-slate-300">
              {actionType === "NEED_ASSIGNMENT"
                ? "Mode: Pilih Shift Dulu"
                : actionType === "CHECK_IN"
                  ? "Mode: Check In"
                  : actionType === "CHECK_OUT"
                    ? "Mode: Check Out"
                    : "Attendance Selesai"}
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

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black">
          {photoUrl ? (
            <img src={photoUrl} alt="Preview Attendance" className="h-[420px] w-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="h-[420px] w-full object-cover" />
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          {actionType === "DONE" ? (
            <div className="rounded-xl border border-emerald-800 bg-emerald-950/60 px-4 py-3 text-center text-[13px] font-black text-emerald-300">
              Attendance untuk shift aktif ini sudah selesai
            </div>
          ) : !photoUrl ? (
            <button
              type="button"
              onClick={() => void capturePhoto()}
              disabled={actionType === "NEED_ASSIGNMENT"}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ambil Foto
            </button>
          ) : (
            <button
              type="button"
              onClick={retakePhoto}
              className="rounded-xl bg-slate-700 px-4 py-3 text-[13px] font-black"
            >
              Ulangi Foto
            </button>
          )}
        </div>

        {actionType === "DONE" ? (
          <button
            type="button"
            onClick={() => router.push("/mobile/dashboard")}
            className="mt-3 w-full rounded-xl bg-slate-700 px-4 py-3 text-[13px] font-black"
          >
            Kembali Pilih Shift
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submitAttendance()}
            disabled={isSubmitting || actionType === "NEED_ASSIGNMENT"}
            className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-[13px] font-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Menyimpan..."
              : actionType === "NEED_ASSIGNMENT"
                ? "Pilih Shift di Dashboard"
                : actionType === "CHECK_IN"
                ? "Submit Check In"
                : "Submit Check Out"}
          </button>
        )}

        {actionType === "NEED_ASSIGNMENT" ? (
          <button
            type="button"
            onClick={() => router.push("/mobile/dashboard")}
            className="mt-2 w-full rounded-xl bg-slate-700 px-4 py-3 text-[13px] font-black"
          >
            Kembali Pilih Shift
          </button>
        ) : null}

        {photoUrl ? (
          <div className="mt-2 text-[12px] font-bold text-slate-300">
            Ukuran foto: {formatBytesToKB(estimateDataUrlSizeBytes(photoUrl))} (target {ATTENDANCE_PHOTO_MAX_KB} KB)
          </div>
        ) : null}
        {cameraError ? <div className="mt-2 text-[12px] font-bold text-amber-300">{cameraError}</div> : null}
        {submitError ? <div className="mt-2 text-[12px] font-bold text-rose-300">{submitError}</div> : null}
        {successText ? <div className="mt-2 text-[12px] font-bold text-emerald-300">{successText}</div> : null}
      </div>
    </div>
  );
}
