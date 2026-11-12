"use client";
import { useState, useTransition } from "react";
import { Archive } from "lucide-react";
import type { BackupNowState } from "@/app/(app)/admin/copia/actions";

export function BackupNow({ action }: { action: () => Promise<BackupNowState> }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<BackupNowState>();
  return (
    <div>
      <button type="button" className="btn-dark" disabled={pending} onClick={() => start(async () => setState(await action()))}>
        <Archive size={16} /> {pending ? "Haciendo la copia…" : "Hacer copia ahora"}
      </button>
      {state?.ok && <p className="mt-2 text-sm font-semibold text-green-700">{state.ok}</p>}
      {state?.error && <p className="mt-2 text-sm font-semibold text-rojo">{state.error}</p>}
    </div>
  );
}
