"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Share, X } from "lucide-react";
import { enablePush, isIOS, isStandalone, pushSupported, syncSubscription } from "@/lib/push-client";

const KEY = "rv-push-pospuesto";
const DAYS = 7;

function postponed() {
  try {
    const t = Number(localStorage.getItem(KEY) || 0);
    return Date.now() - t < DAYS * 864e5;
  } catch {
    return false;
  }
}
function postpone() {
  try { localStorage.setItem(KEY, String(Date.now())); } catch {}
}

/** Al entrar en la app pregunta si se quieren activar los avisos (o explica cómo en iPhone). */
export function PushPrompt() {
  const router = useRouter();
  // Si se contesta a la convocatoria desde el aviso con la app abierta, se refresca la pantalla
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => { if (e.data?.type === "callup-replied") router.refresh(); };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [router]);
  const [mode, setMode] = useState<"ask" | "ios" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const check = () => {
      // Espera a que se cierren las novedades y el tutorial para no amontonar ventanas
      if (document.getElementById("whats-new-title") || document.getElementById("rv-tour")) {
        t = setTimeout(check, 1500);
        return;
      }
      if (pushSupported()) {
        if (Notification.permission === "granted") {
          syncSubscription(); // dispositivo con permiso: se registra en silencio
          return;
        }
        if (Notification.permission === "default" && !postponed()) setMode("ask");
      } else if (isIOS() && !isStandalone() && !postponed()) {
        setMode("ios"); // en iPhone los avisos solo funcionan con la app instalada
      }
    };
    t = setTimeout(check, 1500);
    return () => clearTimeout(t);
  }, []);

  if (!mode) return null;
  const close = () => { postpone(); setMode(null); };

  return (
    <div role="dialog" aria-labelledby="push-title"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-40 mx-auto max-w-md animate-fade-up rounded-2xl bg-negro p-4 text-white shadow-2xl ring-1 ring-white/10 lg:bottom-6 lg:right-6 lg:left-auto">
      <button onClick={close} aria-label="Cerrar" className="absolute right-2 top-2 rounded-lg p-1.5 text-white/50 hover:text-white"><X size={18} /></button>
      <div className="flex gap-3 pr-6">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rojo"><BellRing size={20} /></span>
        <div className="min-w-0">
          <h2 id="push-title" className="sport text-lg font-black">¿Activamos los avisos?</h2>
          {mode === "ask" ? (
            <p className="text-sm text-white/70">Te avisaremos cuando se abra un sorteo, cuando haya ventas nuevas y cuando salga el número ganador.</p>
          ) : (
            <p className="text-sm text-white/70">
              En iPhone, primero instala la app: pulsa <Share size={14} className="inline" /> <b>Compartir</b> y luego
              <b> Añadir a pantalla de inicio</b>. Ábrela desde ese icono y te preguntaremos.
            </p>
          )}
          {error && <p className="mt-2 text-sm text-dorado">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {mode === "ask" && (
              <button className="btn-primary" disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await enablePush();
                  setBusy(false);
                  if (r.ok) setMode(null);
                  else { setError(r.error ?? ""); postpone(); }
                }}>
                {busy ? "Activando…" : "Activar avisos"}
              </button>
            )}
            <button className="btn bg-white/10 text-white hover:bg-white/20" onClick={close}>{mode === "ask" ? "Ahora no" : "Entendido"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
