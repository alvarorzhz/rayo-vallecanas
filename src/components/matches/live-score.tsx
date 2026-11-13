"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { clockLabel, KIND_ICON, liveClock } from "@/lib/live";
import type { LiveView } from "@/lib/live-queries";

/**
 * Marcador en directo en Inicio (v4.12.0). Un solo «vigilante» por partido consulta lo apuntado
 * cada 15 segundos (solo con la pantalla a la vista) y lo reparte al marcador y a la lista de jugadas.
 */
const POLL_MS = 15_000;
type Store = { view: LiveView; subs: Set<() => void>; stop: (() => void) | null };
const stores = new Map<string, Store>();

function subscribe(matchId: string, initial: LiveView, cb: () => void) {
  let s = stores.get(matchId);
  if (!s) {
    s = { view: initial, subs: new Set(), stop: null };
    stores.set(matchId, s);
  }
  s.subs.add(cb);
  if (!s.stop) {
    const timer = setInterval(() => poll(matchId), POLL_MS);
    // Al volver a la app, se pone al día sin esperar a la siguiente vuelta
    const onVisible = () => { if (document.visibilityState === "visible") poll(matchId); };
    document.addEventListener("visibilitychange", onVisible);
    s.stop = () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }
  const store = s;
  return () => {
    store.subs.delete(cb);
    if (!store.subs.size) {
      store.stop?.();
      stores.delete(matchId);
    }
  };
}

async function poll(matchId: string) {
  const s = stores.get(matchId);
  if (!s || document.visibilityState !== "visible") return;
  try {
    const r = await fetch(`/api/partidos/${matchId}/directo`, { cache: "no-store" });
    if (!r.ok) return;
    s.view = (await r.json()) as LiveView;
    s.subs.forEach((f) => f());
  } catch {
    // sin conexión: se vuelve a intentar en la próxima vuelta
  }
}

function useLive(matchId: string, initial: LiveView) {
  const sub = useCallback((cb: () => void) => subscribe(matchId, initial, cb), [matchId, initial]);
  return useSyncExternalStore(sub, () => stores.get(matchId)?.view ?? initial, () => initial);
}

/** El marcador del centro de la portada, con «¡GOL!» cuando marca el Rayo. */
export function LiveScoreBox({ matchId, initial, home }: { matchId: string; initial: LiveView; home: boolean }) {
  const v = useLive(matchId, initial);
  const router = useRouter();
  const lastGf = useRef(v.gf);
  const [goal, setGoal] = useState(false);
  useEffect(() => {
    if (v.gf > lastGf.current) {
      setGoal(true);
      const t = setTimeout(() => setGoal(false), 3500);
      lastGf.current = v.gf;
      return () => clearTimeout(t);
    }
    lastGf.current = v.gf;
  }, [v.gf]);
  // Al pitido final la portada pasa sola a «Final»
  useEffect(() => { if (v.played) router.refresh(); }, [v.played, router]);
  const [a, b] = home ? [v.gf, v.ga] : [v.ga, v.gf];
  return (
    <div className="relative">
      <div className="md-vs flex items-center gap-1.5 rounded-2xl bg-black/70 px-3 py-2 ring-1 ring-rojo/60 sm:px-5" aria-live="polite" aria-label={`Marcador en directo: ${a} a ${b}`}>
        <span key={`a${a}`} className="anim-score sport text-5xl font-black tabular-nums leading-none sm:text-7xl">{a}</span>
        <span className="sport text-3xl font-black text-white/40 sm:text-5xl">-</span>
        <span key={`b${b}`} className="anim-score sport text-5xl font-black tabular-nums leading-none sm:text-7xl">{b}</span>
      </div>
      {goal && (
        <span aria-hidden className="live-goal sport pointer-events-none absolute inset-x-[-3rem] -top-3 text-center text-4xl font-black italic text-dorado drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] sm:text-6xl">¡GOOOL!</span>
      )}
    </div>
  );
}

/** Minuto de juego y las jugadas apuntadas, debajo del marcador. */
export function LiveFeed({ matchId, initial }: { matchId: string; initial: LiveView }) {
  const v = useLive(matchId, initial);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);
  const clock = now ? liveClock({ live_started_at: v.started, live_second_at: v.second }, now) : null;
  const shown = v.events.slice(-6).reverse();
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-2">
      <p className="sport flex items-center gap-2 text-2xl font-black text-white">
        <span className="md-live-dot" aria-hidden /> {clock ? `En directo · ${clock.half === 2 ? "2ª parte" : "1ª parte"} · ${clock.minute}'` : "Partido en juego · ¡vamos Rayo!"}
      </p>
      {shown.length > 0 && (
        <ol className="w-full space-y-1 rounded-2xl bg-white/[0.08] p-2 text-left text-sm ring-1 ring-white/15" aria-label="Jugadas del partido">
          {shown.map((e) => (
            <li key={e.id} className="anim-rise flex items-center gap-2">
              <span className="sport w-11 shrink-0 text-right font-black tabular-nums text-dorado">{clockLabel(e)}</span>
              <span aria-hidden>{KIND_ICON[e.kind]}</span>
              <span className="min-w-0 truncate font-semibold text-white/90">{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
