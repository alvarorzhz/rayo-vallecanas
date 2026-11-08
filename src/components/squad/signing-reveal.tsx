"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FutCard } from "@/components/squad/player-card";
import { Jersey } from "@/components/squad/jersey";
import { Confetti } from "@/components/matches/matchday-fx";
import { FOOT_LABEL, POSITION_LABEL, lineOf, shirtName, fullName, type RosterEntry } from "@/lib/squad";

const KEY = "rv-fichajes-vistos";
/** Como mucho se presentan seguidos estos fichajes (si llegan muchos de golpe, el resto está en Plantilla). */
const MAX = 6;

type Clue = { key: string; label: string; big: React.ReactNode; small?: string };

function cluesOf(e: RosterEntry): Clue[] {
  const gk = lineOf(e.position) === "GK";
  const out: Clue[] = [{ key: "pos", label: "Posición", big: e.position, small: POSITION_LABEL[e.position] }];
  if (e.player.foot) out.push({ key: "foot", label: "Pierna", big: FOOT_LABEL[e.player.foot] });
  if (e.number != null) out.push({ key: "num", label: "Dorsal", big: <Jersey number={e.number} goalkeeper={gk} size={150} /> });
  return out;
}

// Momentos de la presentación (ms desde que empieza cada fichaje)
const T_INTRO = 1300;
const T_CLUE = 1050;
const T_SPIN = 1100;

/**
 * Presentación de un fichaje al estilo de los sobres de los juegos de fútbol:
 * «Nuevo fichaje», tres pistas (posición, pierna y dorsal), el cromo girando
 * y, con un fogonazo, el jugador con confeti. Se salta tocando la pantalla.
 */
export function SigningShow({ list, me, onClose }: { list: RosterEntry[]; me: string; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  // fase: intro → pistas (0..n-1) → giro → presentado
  const [phase, setPhase] = useState<"intro" | "clue" | "spin" | "done">("intro");
  const [clue, setClue] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const entry = list[idx];
  const clues = cluesOf(entry);
  const stage = useRef<HTMLDivElement>(null);
  const mainBtn = useRef<HTMLButtonElement>(null);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    clear();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setPhase("done"); return; }
    setPhase("intro");
    setClue(0);
    const at = (ms: number, f: () => void) => timers.current.push(setTimeout(f, ms));
    // El primero empieza con el «Nuevo fichaje»; los siguientes van directos a las pistas
    let t = idx === 0 ? T_INTRO : 350;
    clues.forEach((_, i) => { at(t, () => { setPhase("clue"); setClue(i); }); t += T_CLUE; });
    at(t, () => setPhase("spin"));
    at(t + T_SPIN, () => setPhase("done"));
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => { (phase === "done" ? mainBtn.current : stage.current)?.focus({ preventScroll: true }); }, [phase]);

  const skip = useCallback(() => { if (phase !== "done") { clear(); setPhase("done"); } }, [phase]);
  const next = () => (idx + 1 < list.length ? setIdx(idx + 1) : onClose());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = entry.player;
  const isMe = !!p.user_id && p.user_id === me;
  const shown = phase === "spin" || phase === "done";
  const facts = [POSITION_LABEL[entry.position], p.foot && FOOT_LABEL[p.foot], p.height_cm && `${(p.height_cm / 100).toFixed(2).replace(".", ",")} m`].filter(Boolean) as string[];

  return (
    <div ref={stage} tabIndex={-1} id="rv-fichaje" role="dialog" aria-modal="true" aria-labelledby="fichaje-title"
      className="fc-stage fixed inset-0 outline-none z-[70] flex flex-col overflow-hidden text-white" onClick={skip}>
      {/* Estadio de noche: focos, humo rojo y la franja del Rayo */}
      <div aria-hidden className="fc-bg absolute inset-0" />
      <span aria-hidden className="md-light md-light-l" />
      <span aria-hidden className="md-light md-light-r" />
      <span aria-hidden className="fc-franja absolute inset-0" />

      {/* Rótulo «Oficial» como en las cuentas de los clubes */}
      <div aria-hidden className="fc-ticker relative z-10 mt-[env(safe-area-inset-top)] overflow-hidden bg-rojo py-1.5 shadow-lg">
        <div className="md-ticker sport flex w-max gap-6 whitespace-nowrap text-sm font-black tracking-[0.25em]">
          {Array.from({ length: 2 }, (_, k) => (
            <span key={k} className="flex gap-6">
              {Array.from({ length: 6 }, (_, i) => <span key={i}>OFICIAL <span className="text-dorado">⚡</span> NUEVO FICHAJE <span className="text-dorado">⚡</span></span>)}
            </span>
          ))}
        </div>
      </div>

      <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Cerrar la presentación"
        className="absolute right-3 top-[calc(env(safe-area-inset-top)+2.6rem)] z-30 rounded-full bg-black/40 p-2 text-white/75 ring-1 ring-white/15 hover:text-white">
        <X size={20} />
      </button>
      {list.length > 1 && (
        <div className="absolute left-3 top-[calc(env(safe-area-inset-top)+2.9rem)] z-30 rounded-full bg-black/40 px-3 py-1 text-xs font-bold tracking-wider text-white/80 ring-1 ring-white/15">
          Fichaje {idx + 1} de {list.length}
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {/* 1 · Nuevo fichaje */}
        {phase === "intro" && (
          <div key={`intro-${idx}`} className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/escudo.png" alt="" className="fc-crest mx-auto mb-4 w-24 drop-shadow-[0_0_30px_rgba(213,175,50,0.6)]" />
            <p className="fc-kicker text-xs font-bold uppercase tracking-[0.4em] text-dorado">Rayo Vallecañas anuncia</p>
            <p className="fc-slam sport mt-2 text-6xl font-black leading-[0.85] sm:text-8xl">Nuevo<br /><span className="md-title">fichaje</span></p>
          </div>
        )}

        {/* 2 · Pistas: posición, pierna y dorsal */}
        {phase === "clue" && clues[clue] && (
          <div key={`${idx}-${clues[clue].key}`} className="fc-clue text-center">
            <p className="text-xs font-bold uppercase tracking-[0.45em] text-white/60">{clues[clue].label}</p>
            <div className="sport mt-2 flex min-h-36 items-center justify-center text-8xl font-black leading-none text-dorado drop-shadow-[0_0_28px_rgba(213,175,50,0.55)] sm:text-9xl">
              {clues[clue].big}
            </div>
            {clues[clue].small && <p className="sport mt-1 text-2xl font-black text-white/85">{clues[clue].small}</p>}
          </div>
        )}

        {/* 3 · El cromo gira y aparece el jugador */}
        {shown && (
          <div key={`card-${idx}`} className="flex w-full flex-col items-center">
            <div className="relative">
              <span aria-hidden className="fc-rays absolute left-1/2 top-1/2 h-[150%] w-[190%] -translate-x-1/2 -translate-y-1/2" />
              {phase === "done" && <span aria-hidden className="fc-ring absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full" />}
              <div className={`fc-scene relative w-52 sm:w-64 ${phase === "done" ? "fc-glow" : "fc-scene-in"}`}>
                <div className={`fc-flip relative ${phase === "spin" ? "fc-spinning" : "fc-landed"}`}>
                  <div className="fc-face"><div className="drop-shadow-[0_22px_30px_rgba(0,0,0,0.7)]"><FutCard entry={entry} size="lg" /></div></div>
                  {/* Dorso del cromo */}
                  <div aria-hidden className="fc-face fc-back absolute inset-0">
                    <div className="absolute inset-0 bg-negro" style={{ clipPath: "polygon(12% 0, 88% 0, 100% 7%, 100% 89%, 50% 100%, 0 89%, 0 7%)" }} />
                    <div className="absolute inset-[3px] flex items-center justify-center bg-[linear-gradient(160deg,#2a0306,#080808_55%,#3a2c07)]" style={{ clipPath: "polygon(12% 0, 88% 0, 100% 7%, 100% 89%, 50% 100%, 0 89%, 0 7%)" }}>
                      <span className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0_58%,var(--color-rojo)_58%_70%,var(--color-dorado)_70%_72%,transparent_72%)] opacity-80" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/escudo.png" alt="" className="relative w-1/2 drop-shadow-[0_0_18px_rgba(213,175,50,0.7)]" />
                    </div>
                  </div>
                </div>
              </div>
              {phase === "done" && (
                <div aria-hidden className="lg-burst pointer-events-none absolute inset-0">
                  {Array.from({ length: 18 }, (_, i) => <span key={i} style={{ ["--a" as string]: `${i * 20}deg`, animationDelay: `${(i % 3) * 40}ms` }} />)}
                </div>
              )}
            </div>

            {phase === "done" && (
              <div className="mt-5 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
                <p className="fc-up text-xs font-bold uppercase tracking-[0.35em] text-dorado" style={{ animationDelay: "80ms" }}>
                  {isMe ? "¡Eres tú! Bienvenido a la familia" : "Ya es del Rayo ⚡"}
                </p>
                <h2 id="fichaje-title" className="fc-up sport mt-1 text-5xl font-black leading-[0.9] sm:text-6xl" style={{ animationDelay: "160ms" }}>
                  {entry.number != null && <span className="mr-2 text-dorado">{entry.number}</span>}{shirtName(p)}
                </h2>
                <p className="fc-up mt-1 text-white/70" style={{ animationDelay: "220ms" }}>{fullName(p)}</p>
                <div className="fc-up mt-3 flex flex-wrap justify-center gap-1.5" style={{ animationDelay: "300ms" }}>
                  {facts.map((f) => <span key={f} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold ring-1 ring-white/15">{f}</span>)}
                </div>
                <div className="fc-up mt-5 flex gap-2" style={{ animationDelay: "420ms" }}>
                  <Link href={`/plantilla/${p.id}`} prefetch={false} onClick={onClose} className="btn flex-1 bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20">Ver ficha</Link>
                  <button ref={mainBtn} type="button" onClick={next} className="btn-primary flex-1">
                    {idx + 1 < list.length ? <>Siguiente <ArrowRight size={16} /></> : "¡Aúpa Rayo!"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase !== "done" && <p className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] text-xs font-semibold text-white/60">Toca para saltar</p>}
      </div>

      {phase === "done" && <div key={`fx-${idx}`} aria-hidden className="egg-flash pointer-events-none absolute inset-0 z-20" />}
      {phase === "done" && <Confetti key={`cf-${idx}`} pieces={70} />}
    </div>
  );
}

// La marca va por usuario: en un móvil compartido cada uno ve sus presentaciones
const read = (me: string) => { try { return localStorage.getItem(`${KEY}:${me}`) ?? ""; } catch { return ""; } };
/** a es posterior a b (las fechas llegan con formatos distintos de la BD y del navegador). */
const later = (a: string, b: string) => !b || Date.parse(a) > Date.parse(b);

/**
 * La primera vez que alguien entra después de un fichaje (alta a mano o desde la web de la liga)
 * se le presenta. Lo ya visto se guarda en su cuenta para que no le vuelva a salir en otro móvil.
 * `init`: aún no tiene marca (primera vez con esta función): se pone la de ahora sin presentar
 * a la plantilla que ya estaba.
 */
export function SigningsOnEnter({ entries, init, now, me }: { entries: RosterEntry[]; init: boolean; now: string; me: string }) {
  const [list, setList] = useState<RosterEntry[] | null>(null);
  const newest = entries.reduce((m, e) => (later(e.player.created_at, m) ? e.player.created_at : m), "");

  const save = useCallback((mark: string) => {
    try { localStorage.setItem(`${KEY}:${me}`, mark); } catch {}
    const supabase = createClient();
    supabase.auth.updateUser({ data: { fichajes: mark } })
      .then(({ error }) => (error ? null : supabase.auth.refreshSession()))
      .catch(() => {});
  }, [me]);

  useEffect(() => {
    if (init) {
      save(read(me) || now);
      return;
    }
    const local = read(me);
    const fresh = entries.filter((e) => later(e.player.created_at, local))
      .sort((a, b) => a.player.created_at.localeCompare(b.player.created_at)).slice(-MAX);
    if (!fresh.length) return;
    // Espera a que se cierren el tutorial y las novedades para no amontonar ventanas
    let t: ReturnType<typeof setTimeout>;
    const go = () => {
      if (document.getElementById("rv-tour") || document.getElementById("whats-new-title")) t = setTimeout(go, 900);
      else setList(fresh);
    };
    t = setTimeout(go, 700);
    return () => clearTimeout(t);
  }, [entries, init, now, me, save]);

  const close = useCallback(() => {
    setList(null);
    if (newest) save(newest);
  }, [newest, save]);

  if (!list) return null;
  return <SigningShow list={list} me={me} onClose={close} />;
}

/** Botón «Presentación» de la ficha: vuelve a ver (o enseña) la presentación del jugador. */
export function SigningReplay({ entry, me }: { entry: RosterEntry; me: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20">
        <Sparkles size={16} /> Presentación
      </button>
      {open && <SigningShow list={[entry]} me={me} onClose={() => setOpen(false)} />}
    </>
  );
}
