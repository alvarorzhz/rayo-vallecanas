"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { clockLabel, KIND_ICON, liveClock } from "@/lib/live";
import type { LiveView } from "@/lib/live-queries";
import { GoalBurst, OUR_SHORT, type Burst } from "@/components/matches/goal-burst";
import { goalCall } from "@/lib/commentator";
import { LocutorToggle } from "@/components/matches/locutor-toggle";

/**
 * Marcador en directo en Inicio (v4.12.0). Un solo «vigilante» por partido consulta lo apuntado
 * cada 15 segundos (solo con la pantalla a la vista) y lo reparte al marcador y a la lista de jugadas.
 */
const POLL_MS = 15_000;
const WAIT_KEY = "rv-directo-desde-";
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
  const last = useRef({ gf: v.gf, ga: v.ga });
  const [goal, setGoal] = useState(false);
  const [burst, setBurst] = useState<Burst | null>(null);
  const closeBurst = useCallback(() => setBurst(null), []);
  // 4.20.2 · Si la portada se acaba de poner al día desde LiveWaiter, se celebra lo que marcó el Rayo mientras tanto
  useEffect(() => {
    try {
      if (sessionStorage.getItem(`${WAIT_KEY}${matchId}`)) {
        sessionStorage.removeItem(`${WAIT_KEY}${matchId}`);
        last.current = { gf: 0, ga: 0 };
      }
    } catch { /* sin almacenamiento */ }
  }, [matchId]);
  useEffect(() => {
    const prev = last.current;
    last.current = { gf: v.gf, ga: v.ga };
    if (v.played || (v.gf <= prev.gf && v.ga <= prev.ga)) return;
    const us = v.gf > prev.gf;
    // La última jugada de gol apuntada (la nuestra o la del rival)
    const ev = [...v.events].reverse().find((e) => e.kind === (us ? "goal" : "goal_against")) ?? null;
    const rival = (v.rival ?? "Rival").toUpperCase();
    const [h, a] = home ? [v.gf, v.ga] : [v.ga, v.gf];
    const who = us ? ev?.who ?? null : null;
    setBurst({
      // 4.22.0 · Lo que canta el locutor (solo los goles del Rayo)
      speech: us ? goalCall({ scorer: who?.name ?? null, assist: who?.assist ?? null, goalsToday: who?.goalsToday ?? 0, gf: v.gf, ga: v.ga, rival: v.rival ?? null }) : undefined,
      us, minute: ev ? clockLabel(ev) || null : null, who,
      home: h, away: a, homeName: home ? OUR_SHORT : rival, awayName: home ? rival : OUR_SHORT,
    });
    if (!us) return;
    setGoal(true);
    const t = setTimeout(() => setGoal(false), 3500);
    return () => clearTimeout(t);
  }, [v.gf, v.ga, v.played, v.events, v.rival, home]);
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
      {burst && <GoalBurst burst={burst} onClose={closeBurst} />}
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
      {!v.played && <LocutorToggle />}
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

/**
 * 4.20.2 · Con Inicio ya abierta antes del pitido inicial no había marcador que vigilar, así que el directo
 * (y la pantalla ¡GOOOL!) no salía hasta recargar. Este vigilante mira cada 15 segundos, solo con la
 * pantalla a la vista, y en cuanto quien lleva el acta da el pitido inicial, pone la portada al día.
 */
export function LiveWaiter({ matchId }: { matchId: string }) {
  const router = useRouter();
  useEffect(() => {
    let done = false;
    const check = async () => {
      if (done || document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/partidos/${matchId}/directo`, { cache: "no-store" });
        if (!r.ok) return;
        const v = (await r.json()) as LiveView;
        if (v.started || v.events.length || v.played) {
          done = true;
          try { if (!v.played) sessionStorage.setItem(`${WAIT_KEY}${matchId}`, "1"); } catch { /* sin almacenamiento */ }
          router.refresh();
        }
      } catch { /* sin conexión: otra vuelta */ }
    };
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [matchId, router]);
  return null;
}
