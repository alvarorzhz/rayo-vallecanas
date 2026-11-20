"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mic, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { PRESIDENT, PRESS_MAX } from "@/lib/president";
import type { PressState } from "@/app/(app)/la-voz/actions";

type Act = (id: string) => Promise<PressState>;

/**
 * 4.27.0 · Lo que ve la redacción para preparar la rueda de prensa de Don Rayo: la IA escribe el texto
 * con los datos del acta, se puede retocar, y después se crea su voz (una vez, gratis con Gemini).
 */
export function PressDesk({ id, text, voiced, write, save, voice, remove }: {
  id: string;
  text: string | null;
  voiced: boolean;
  write: Act;
  save: (id: string, text: string) => Promise<PressState>;
  voice: Act;
  remove: Act;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(text ?? "");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const busy = pending || !!step;

  const run = (fn: () => Promise<void>) => start(async () => { setError(null); try { await fn(); } finally { setStep(null); router.refresh(); } });

  // Escribe y, si sale bien, pone la voz seguida: un solo toque
  const fresh = () => run(async () => {
    setStep("Don Rayo está pensando qué decir…");
    const w = await write(id);
    if (w.error || !w.text) { setError(w.error ?? "No se pudo"); return; }
    setDraft(w.text);
    setStep("Poniéndole voz (unos 15 segundos)…");
    const v = await voice(id);
    if (v.error) setError(v.error);
  });

  const saveAndVoice = () => run(async () => {
    if (draft.trim() !== (text ?? "").trim()) {
      setStep("Guardando el texto…");
      const s = await save(id, draft);
      if (s.error) { setError(s.error); return; }
    }
    setStep("Poniéndole voz (unos 15 segundos)…");
    const v = await voice(id);
    if (v.error) setError(v.error);
  });

  const drop = () => run(async () => {
    setStep("Quitando…");
    const r = await remove(id);
    if (r.error) setError(r.error);
    else setDraft("");
  });

  const changed = draft.trim() !== (text ?? "").trim();
  return (
    <div className="relative z-[1] mt-4 rounded-xl bg-white p-3 text-negro ring-1 ring-black/10">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-rojo"><Mic size={13} /> Solo la redacción</p>
      {!text ? (
        <>
          <p className="mt-1 text-sm text-negro/70">La IA escribe 4 o 5 frases de {PRESIDENT} con el resultado, los goleadores, el MVP y la posición (solo apodos). Después podrás retocarlas.</p>
          <button type="button" onClick={fresh} disabled={busy} className="btn-primary mt-3 w-full justify-center"><Sparkles size={16} /> Que hable {PRESIDENT}</button>
        </>
      ) : (
        <>
          <label className="mt-1 block text-sm font-semibold" htmlFor={`press-${id}`}>Lo que dice {PRESIDENT}</label>
          <textarea id={`press-${id}`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={PRESS_MAX} rows={5} disabled={busy}
            className="mt-1 w-full rounded-lg border border-black/15 bg-gris/40 p-2 text-[15px] leading-snug" />
          <p className="text-right text-[11px] text-negro/50">{draft.length}/{PRESS_MAX}</p>
          {!voiced && !changed && <p className="text-xs font-medium text-amber-800">Aún sin voz grabada: mientras, habla con la voz del móvil.</p>}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={saveAndVoice} disabled={busy || draft.trim().length < 20} className="btn-primary col-span-2 justify-center">
              <Mic size={16} /> {changed ? "Guardar y poner la voz" : voiced ? "Volver a grabar la voz" : "Poner la voz"}
            </button>
            <button type="button" onClick={fresh} disabled={busy} className="btn-ghost justify-center !text-xs"><RefreshCw size={14} /> Otra versión</button>
            <button type="button" onClick={drop} disabled={busy} className="btn-ghost justify-center !text-xs !text-rojo"><Trash2 size={14} /> Quitar</button>
          </div>
        </>
      )}
      {step && <p className="mt-2 text-sm font-semibold text-negro/70" role="status">{step}</p>}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-600/15" role="alert">{error}</p>}
      <p className="mt-2 text-[11px] leading-snug text-negro/50">La voz sale de la IA gratis de Google, que da pocas al día: con una por partido sobra.</p>
    </div>
  );
}
