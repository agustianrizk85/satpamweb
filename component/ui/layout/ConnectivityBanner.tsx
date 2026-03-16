"use client";

import * as React from "react";
import { ConfirmModalMaster } from "@/component/ui/layout/ModalMaster";
import {
  getBackendStatus,
  subscribeBackendStatus,
  type BackendStatus,
} from "@/libs/connectivity";

type UiStatus = "ok" | "offline" | "backend-down";

export default function ConnectivityModal() {
  const [isOnline, setIsOnline] = React.useState<boolean>(true);
  const [backend, setBackend] = React.useState<BackendStatus>("ok");
  const [dismissedKey, setDismissedKey] = React.useState<string>("");

  React.useEffect(() => {
    const syncNet = () => setIsOnline(navigator.onLine);
    syncNet();

    window.addEventListener("online", syncNet);
    window.addEventListener("offline", syncNet);

    const unsub = subscribeBackendStatus((s) => setBackend(s));
    setBackend(getBackendStatus());

    return () => {
      window.removeEventListener("online", syncNet);
      window.removeEventListener("offline", syncNet);
      unsub();
    };
  }, []);

  const status: UiStatus = !isOnline ? "offline" : backend === "down" ? "backend-down" : "ok";

  const openKey = status === "ok" ? "" : status;
  const open = openKey !== "" && dismissedKey !== openKey;

  React.useEffect(() => {
    if (status === "ok") setDismissedKey("");
  }, [status]);

  if (status === "ok") return null;

  const title =
    status === "offline" ? "Kamu sedang offline" : "Server tidak bisa diakses";

  const message =
    status === "offline"
      ? "Koneksi internet terputus. Beberapa fitur tidak akan jalan sampai koneksi kembali."
      : "Server sedang tidak merespon / timeout. Coba lagi beberapa saat.";

  const confirmLabel = status === "offline" ? "Saya Mengerti" : "Coba Lagi";

  const onConfirm = () => {
    if (status === "backend-down") {
      window.location.reload();
      return;
    }
    setDismissedKey(openKey);
  };

  const onClose = () => setDismissedKey(openKey);

  return (
    <ConfirmModalMaster
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      action="edit"
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel="Tutup"
    />
  );
}
