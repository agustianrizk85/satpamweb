export type BackendStatus = "ok" | "down";

type Listener = (s: BackendStatus) => void;

let status: BackendStatus = "ok";
const listeners = new Set<Listener>();

export function getBackendStatus(): BackendStatus {
  return status;
}

export function setBackendStatus(next: BackendStatus): void {
  if (status === next) return;
  status = next;
  for (const l of listeners) l(status);
}

export function subscribeBackendStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
