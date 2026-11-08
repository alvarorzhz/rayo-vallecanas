"use client";
import { useActionState, useState } from "react";
import { Check, Copy, Search, ShieldCheck, ShieldX } from "lucide-react";
import type { RaffleCheck } from "@/lib/lottery/public";
import { fecha } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";

/** Copia un texto al portapapeles (enlace público o huella). */
export function CopyButton({ text, label = "Copiar enlace", className = "btn-ghost" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Copia el texto:", text);
        }
      }}
    >
      {done ? <Check size={16} /> : <Copy size={16} />} {done ? "Copiado" : label}
    </button>
  );
}

type CheckState = { result?: RaffleCheck; error?: string; number?: string; reference?: string } | undefined;

export function CheckNumberForm({ action, total }: { action: (s: CheckState, f: FormData) => Promise<CheckState>; total: number }) {
  const [state, formAction] = useActionState(action, undefined);
  const r = state?.result;
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[8rem_1fr_auto]">
        <div>
          <label className="label" htmlFor="number">Tu número</label>
          <input id="number" name="number" type="number" key={`n${state?.number ?? ""}`} defaultValue={state?.number} min={1} max={total} required inputMode="numeric"
            className="input text-center font-mono text-lg font-bold" />
        </div>
        <div>
          <label className="label" htmlFor="reference">Referencia del justificante</label>
          <input id="reference" name="reference" required key={`r${state?.reference ?? ""}`} defaultValue={state?.reference} autoCapitalize="characters" autoComplete="off"
            className="input font-mono uppercase" placeholder="RV-2026-0001" />
        </div>
        <div className="flex items-end">
          <SubmitButton className="btn-primary w-full" pendingText="Comprobando…"><Search size={16} /> Comprobar</SubmitButton>
        </div>
      </div>
      <p className="text-xs text-negro/65">La referencia está en tu justificante (PDF o mensaje de WhatsApp), junto a «Referencia».</p>
      <div aria-live="polite">
        {state?.error && <p role="alert" className="rounded-lg bg-rojo/10 px-3 py-2 text-sm font-medium text-rojo">{state.error}</p>}
        {r && !r.found && (
          <p className="rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
            <b>No encontramos ese número con esa referencia.</b> Revisa que los dos estén bien escritos. Si sigue sin salir, habla con
            la persona que te lo vendió o con cualquier gestor del club.
          </p>
        )}
        {r?.found && (
          <div className={`rounded-xl px-4 py-3 text-sm ${r.winner ? "bg-dorado text-negro" : "bg-green-50 text-green-900"}`}>
            {r.winner && <p className="sport mb-1 text-xl font-black">¡Es el número ganador! 🏆</p>}
            <p><b>El número {r.number} está registrado</b> y es tuyo.</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Comprado el {fecha(r.sold_on)}.</li>
              <li>{r.paid ? "Está pagado." : "Tiene un pago pendiente: habla con quien te lo vendió."}</li>
              {r.in_frozen_list === true && <li>Está en la lista cerrada de números vendidos que entra en el sorteo.</li>}
              {r.in_frozen_list === false && <li>No aparece en la lista cerrada del sorteo: habla con cualquier gestor del club.</li>}
            </ul>
          </div>
        )}
      </div>
    </form>
  );
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Recalcula en el móvil de quien lo pulse la huella de la lista cerrada y la compara con la guardada. */
export function VerifyFingerprint({ numbers, fingerprint }: { numbers: number[]; fingerprint: string }) {
  const [res, setRes] = useState<"ok" | "ko" | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-dark"
        onClick={async () => setRes((await sha256Hex([...numbers].sort((a, b) => a - b).join(","))) === fingerprint ? "ok" : "ko")}
      >
        <ShieldCheck size={16} /> Comprobar la huella
      </button>
      <div aria-live="polite">
        {res === "ok" && (
          <p className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
            Coincide: la lista de números vendidos es exactamente la que se cerró. Nadie la ha cambiado después.
          </p>
        )}
        {res === "ko" && (
          <p className="flex items-start gap-2 rounded-lg bg-rojo/10 px-3 py-2 text-sm text-rojo">
            <ShieldX size={18} className="mt-0.5 shrink-0" />
            No coincide. Avisa a cualquier gestor del club.
          </p>
        )}
      </div>
    </div>
  );
}
