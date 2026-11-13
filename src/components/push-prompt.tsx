"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, Lock, Share, SquarePlus, X } from "lucide-react";
import { enablePush, isIOS, isStandalone, pushSupported, syncSubscription } from "@/lib/push-client";
import { promptDecision, type PromptMode } from "@/lib/push-prompt-rules";

const KEY = "rv-avisos-pantalla";

type Memory = { at: number; times: number };
function readMemory(): Memory {
  try {
    const m = JSON.parse(localStorage.getItem(KEY) || "null");
    return m && typeof m.at === "number" ? { at: m.at, times: Number(m.times) || 0 } : { at: 0, times: 0 };
  } catch {
    return { at: 0, times: 0 };
  }
}
function remember() {
  try {
    const m = readMemory();
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), times: m.times + 1 }));
  } catch {}
}

const PERKS = [
  "La convocatoria, y contestar «Voy» desde el propio aviso",
  "El resultado y el MVP en cuanto entran",
  "Las votaciones y las noticias de La Voz del Rayo",
];

/**
 * Pantalla para activar los avisos, solo para quien no los tiene en ese dispositivo.
 * Sin agobiar: sale una vez al entrar; con «Ahora no» no vuelve en 30 días y, tras dos «Ahora no», ya no sale más
 * (se pueden activar siempre desde Mi perfil). En iPhone explica antes cómo instalar la app, y si el permiso está
 * bloqueado explica cómo desbloquearlo.
 */
export function PushPrompt() {
  const router = useRouter();
  // Si se contesta a la convocatoria desde el aviso con la app abierta, se refresca la pantalla
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "callup-replied") router.refresh(); };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [router]);
  const [mode, setMode] = useState<PromptMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const check = () => {
      // Espera a que se cierren las novedades, el tutorial, los fichajes, la gala del MVP y el bombo para no amontonar ventanas
      if (document.getElementById("whats-new-title") || document.getElementById("rv-tour") || document.getElementById("rv-fichaje") || document.getElementById("rv-gala") || document.getElementById("rv-bombo")) {
        t = setTimeout(check, 1500);
        return;
      }
      const supported = pushSupported();
      const permission = supported ? Notification.permission : null;
      if (permission === "granted") {
        syncSubscription(); // dispositivo con permiso: se registra en silencio
        return;
      }
      const m = readMemory();
      setMode(promptDecision({ supported, permission, ios: isIOS(), standalone: isStandalone(), lastAt: m.at, times: m.times, now: Date.now() }));
    };
    t = setTimeout(check, 1500);
    return () => clearTimeout(t);
  }, []);

  if (!mode) return null;
  const close = () => { remember(); setMode(null); };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="push-title" id="rv-avisos"
      className="fixed inset-0 z-50 flex items-end justify-center bg-negro/60 p-3 backdrop-blur-sm sm:items-center">
      <div className="relative w-full max-w-md animate-fade-up overflow-hidden rounded-3xl bg-negro text-white shadow-2xl ring-1 ring-white/10">
        <div className="franja relative px-5 pb-5 pt-6 text-center">
          <button onClick={close} aria-label="Cerrar" className="absolute right-3 top-3 rounded-lg p-1.5 text-white/50 hover:text-white"><X size={20} /></button>
          <span className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rojo shadow-lg">
            {done ? <Check size={32} /> : mode === "denied" ? <Lock size={30} /> : <BellRing size={30} className="anim-ring" />}
          </span>
          <h2 id="push-title" className="sport mt-3 text-2xl font-black leading-tight">
            {done ? "¡Avisos activados!" : mode === "denied" ? "Los avisos están bloqueados" : "Que no se te escape nada"}
          </h2>
          <p className="mt-1 text-sm text-white/70">
            {done ? "Ya te llegará todo lo del Rayo a este dispositivo." : mode === "denied"
              ? "En este dispositivo se dijo que no a los avisos. Si los quieres, se desbloquean en un momento:"
              : "Activa los avisos del Rayo en este dispositivo y te llegará:"}
          </p>
        </div>

        <div className="space-y-4 px-5 pb-5">
          {!done && mode !== "denied" && (
            <ul className="space-y-2 text-sm">
              {PERKS.map((p) => (
                <li key={p} className="flex gap-2"><Check size={18} className="mt-px shrink-0 text-dorado" /><span>{p}</span></li>
              ))}
            </ul>
          )}

          {!done && mode === "ios" && (
            <ol className="space-y-2 rounded-2xl bg-white/5 p-3 text-sm ring-1 ring-white/10">
              <li className="text-xs font-bold uppercase tracking-wider text-dorado">En iPhone, primero instala la app</li>
              <li className="flex items-center gap-2"><b className="sport w-5 text-dorado">1</b> Pulsa <Share size={16} className="shrink-0" /> <b>Compartir</b> abajo en Safari</li>
              <li className="flex items-center gap-2"><b className="sport w-5 text-dorado">2</b> Elige <SquarePlus size={16} className="shrink-0" /> <b>Añadir a pantalla de inicio</b></li>
              <li className="flex items-center gap-2"><b className="sport w-5 text-dorado">3</b> Ábrela desde el escudo y activa los avisos</li>
            </ol>
          )}

          {!done && mode === "denied" && (
            <div className="space-y-2 rounded-2xl bg-white/5 p-3 text-sm ring-1 ring-white/10">
              {isIOS() ? (
                <p><b>iPhone:</b> Ajustes → Notificaciones → Rayo Vallecañas → activa <b>Permitir notificaciones</b>.</p>
              ) : (
                <>
                  <p><b>Android:</b> mantén pulsado el icono de la app → <b>Información de la app</b> → <b>Notificaciones</b> → actívalas.</p>
                  <p><b>En el navegador:</b> toca el candado junto a la dirección → <b>Permisos</b> → <b>Notificaciones</b> → Permitir.</p>
                </>
              )}
              <p className="text-white/60">Luego vuelve a abrir la app y listo.</p>
            </div>
          )}

          {error && <p className="text-sm text-dorado">{error}</p>}

          <div className="flex flex-col gap-2">
            {done ? (
              <button className="btn-primary w-full" onClick={() => setMode(null)}>¡Vamos!</button>
            ) : mode === "ask" ? (
              <>
                <button className="btn-primary w-full" disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    const r = await enablePush();
                    setBusy(false);
                    if (r.ok) setDone(true);
                    else if (typeof Notification !== "undefined" && Notification.permission === "denied") { remember(); setMode("denied"); }
                    else setError(r.error ?? "No se pudieron activar.");
                  }}>
                  <BellRing size={16} /> {busy ? "Activando…" : "Activar avisos"}
                </button>
                <button className="btn w-full bg-white/10 text-white hover:bg-white/20" onClick={close}>Ahora no</button>
              </>
            ) : (
              <button className="btn w-full bg-white/10 text-white hover:bg-white/20" onClick={close}>Entendido</button>
            )}
          </div>
          {!done && <p className="text-center text-xs text-white/50">Puedes cambiarlo cuando quieras en Mi perfil.</p>}
        </div>
      </div>
    </div>
  );
}
