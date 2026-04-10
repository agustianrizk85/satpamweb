type PatrolRunLike = {
  id: string;
  place_id: string;
  user_id: string;
  shift_id?: string | null;
  shift_name?: string | null;
  run_no: number;
  started_at: string;
};

export type PatrolRunVirtualMeta = {
  displayRoundNo: number;
  isVirtual: boolean;
};

function toJakartaDateKey(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function buildGroupKey(run: PatrolRunLike): string {
  const shiftKey = String(run.shift_id ?? run.shift_name ?? "").trim() || "-";
  return [
    run.place_id,
    shiftKey,
    toJakartaDateKey(run.started_at),
  ].join("|");
}

export function buildVirtualRoundMap<T extends PatrolRunLike>(runs: readonly T[]): Map<string, PatrolRunVirtualMeta> {
  const byGroup = new Map<string, T[]>();
  for (const run of runs) {
    const key = buildGroupKey(run);
    const existing = byGroup.get(key);
    if (existing) existing.push(run);
    else byGroup.set(key, [run]);
  }

  const out = new Map<string, PatrolRunVirtualMeta>();
  for (const groupRuns of byGroup.values()) {
    const hasRealRounds = groupRuns.some((run) => Number(run.run_no) > 0);
    const zeroRuns = groupRuns
      .filter((run) => Number(run.run_no) === 0)
      .sort((a, b) => {
        const timeDiff = new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id);
      });

    for (const run of groupRuns) {
      if (Number(run.run_no) > 0) {
        out.set(run.id, { displayRoundNo: Number(run.run_no), isVirtual: false });
      }
    }

    zeroRuns.forEach((run, index) => {
      if (hasRealRounds) {
        out.set(run.id, { displayRoundNo: 0, isVirtual: false });
        return;
      }
      out.set(run.id, { displayRoundNo: index + 1, isVirtual: true });
    });
  }

  return out;
}

export function formatPatrolRoundLabel(roundNo: number | null | undefined, isVirtual = false): string {
  const numeric = Number(roundNo ?? 0);
  if (numeric <= 0) return "Tanpa Ronde";
  return isVirtual ? `Ronde ${numeric}*` : `Ronde ${numeric}`;
}
