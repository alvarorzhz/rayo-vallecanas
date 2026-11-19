"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImageDown, Pause, RotateCcw, X } from "lucide-react";
import type { Slide } from "@/lib/wrapped";
import { lineOf, type RosterEntry } from "@/lib/squad";
import { Jersey } from "@/components/squad/jersey";
import { FutCard } from "@/components/squad/player-card";
import { Ball } from "@/components/squad/ball";
import { CountUp } from "@/components/squad/count-up";
import { useShareImage } from "@/components/matches/share-image";

/** Lo que dura cada historia antes de pasar sola a la siguiente. */
const SLIDE_MS = 7000;

// Sobre el fondo rojo de esa historia, las derrotas van en negro
const RESULT_TONE = { W: "bg-dorado", D: "bg-white/60", L: "bg-negro" } as const;

/**
 * Rayo Wrapped (4.23.0): la temporada de un jugador en historias a pantalla completa, como las de
 * Instagram. Toca a la derecha para avanzar, a la izquierda para volver y mantén pulsado para parar.
 * Cada historia tiene su imagen para compartir; la última es el título con el cromo.
 */
export function WrappedStories({ slides, entry, imgBase, fileBase, backHref, scope, totals, you, capsuleHref }: {
  slides: Slide[];
  entry: RosterEntry;
  /** /api/resumen/{jugador}/{alcance}: cada historia es {imgBase}/{clave}. */
  imgBase: string;
  fileBase: string;
  backHref: string;
  scope: string;
  totals: { label: string; value: number }[];
  /** Es el Wrapped del que mira. */
  you: boolean;
  /** 4.24.0 · La cápsula del tiempo de esa temporada, si ya se ha abierto. */
  capsuleHref?: string | null;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [held, setHeld] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const bar = useRef<HTMLSpanElement>(null);
  const elapsed = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasHold = useRef(false);
  const last = idx === slides.length - 1;
  const slide = slides[idx];
  const paused = held || sharing || hidden || last;

  const go = useCallback((d: 1 | -1) => {
    setIdx((i) => Math.min(slides.length - 1, Math.max(0, i + d)));
  }, [slides.length]);

  // Al cambiar de historia, el tiempo vuelve a empezar
  useEffect(() => { elapsed.current = 0; }, [idx]);

  // El reloj de cada historia (con requestAnimationFrame, así se puede parar y seguir donde estaba)
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (t: number) => {
      elapsed.current += t - prev;
      prev = t;
      const p = Math.min(1, elapsed.current / SLIDE_MS);
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      if (p >= 1) go(1);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, idx, go]);

  // Si se va a otra app, se para
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sharing) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") router.push(backHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, router, backHref, sharing]);

  // Que no se mueva la página de detrás
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function down() {
    wasHold.current = false;
    holdTimer.current = setTimeout(() => { wasHold.current = true; setHeld(true); }, 220);
  }
  function up(e: React.PointerEvent<HTMLDivElement>) {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setHeld(false);
    if (wasHold.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    go(e.clientX - r.left < r.width / 3 ? -1 : 1);
  }

  const dark = slide.tone !== "oro";
  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-black sm:items-center sm:py-6" role="dialog" aria-modal="true" aria-label={`Rayo Wrapped · ${scope}`}>
      <div className={`wr-stage wr-${slide.tone} relative flex h-full w-full max-w-[440px] flex-col overflow-hidden sm:h-[min(860px,100%)] sm:rounded-[2rem] sm:shadow-2xl`}>
        <div key={`f${idx}`} className="wr-franja" aria-hidden />
        {slide.count === undefined && slide.extra?.kind !== "score" && slide.key !== "titulo" ? null : (
          <span key={`g${idx}`} aria-hidden className={`wr-ghost sport font-black ${dark ? "text-white" : "text-negro"}`}>{slide.key === "titulo" ? "⚡" : slide.extra?.kind === "score" ? "VS" : slide.big.replace(" %", "")}</span>
        )}

        {/* Barras de progreso y cabecera */}
        <div className="relative z-20 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex gap-1" aria-hidden>
            {slides.map((s, n) => (
              <span key={s.key} className={`h-1 flex-1 overflow-hidden rounded-full ${dark ? "bg-white/25" : "bg-negro/20"}`}>
                <span ref={n === idx ? bar : undefined}
                  className={`wr-progress block h-full origin-left rounded-full ${dark ? "bg-white" : "bg-negro"}`}
                  style={{ transform: `scaleX(${n < idx || (n === idx && last) ? 1 : 0})` }} />
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/escudo.png" alt="" className="h-8 w-8 object-contain" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="sport text-sm font-black tracking-wider">RAYO <span className={dark ? "text-dorado" : "text-rojo"}>WRAPPED</span></p>
              <p className={`truncate text-xs font-semibold ${dark ? "text-white/70" : "text-negro/70"}`}>{scope}</p>
            </div>
            {held && <Pause size={18} aria-label="En pausa" />}
            <Link href={backHref} aria-label="Cerrar" className={`rounded-full p-2 ${dark ? "bg-white/15 hover:bg-white/25" : "bg-negro/10 hover:bg-negro/20"}`}><X size={20} /></Link>
          </div>
        </div>

        {/* Zona de toques: izquierda atrás, derecha adelante, mantener para parar */}
        <div className="absolute inset-0 z-10" onPointerDown={down} onPointerUp={up} onPointerCancel={() => { setHeld(false); if (holdTimer.current) clearTimeout(holdTimer.current); }}
          onContextMenu={(e) => e.preventDefault()} aria-hidden />

        <div key={idx} className="pointer-events-none relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
          <SlideBody slide={slide} entry={entry} dark={dark} />
        </div>

        {/* Pie: compartir esta historia (y en la última, todo lo demás) */}
        <div className="relative z-20 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {last ? (
            <div className="space-y-3">
              <div className="wr-in grid grid-cols-4 gap-2" style={{ "--d": "900ms" } as React.CSSProperties}>
                {totals.map((t) => (
                  <div key={t.label} className="rounded-xl bg-negro/85 py-2 text-center text-white">
                    <div className="sport text-2xl font-black leading-none">{t.value}</div>
                    <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white/65">{t.label}</div>
                  </div>
                ))}
              </div>
              <div className="wr-in flex gap-2" style={{ "--d": "1100ms" } as React.CSSProperties}>
                <ShareSlide key={slide.key} url={`${imgBase}/${slide.key}`} name={`${fileBase}-wrapped`} label={you ? "Compartir mi Wrapped" : "Compartir su Wrapped"} big onOpen={setSharing} />
              </div>
              <div className="wr-in flex justify-center gap-4 text-sm font-bold" style={{ "--d": "1200ms" } as React.CSSProperties}>
                <button type="button" onClick={() => setIdx(0)} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"><RotateCcw size={15} /> Ver otra vez</button>
                <Link href={backHref} className="underline-offset-4 hover:underline">Ver el resumen</Link>
              </div>
              {capsuleHref && (
                <Link href={capsuleHref} className="wr-in block rounded-xl bg-negro px-3 py-2.5 text-center text-sm font-black text-dorado ring-1 ring-dorado/60" style={{ "--d": "1300ms" } as React.CSSProperties}>
                  🔓 Y ahora… la cápsula del tiempo →
                </Link>
              )}
            </div>
          ) : slide.key !== "intro" ? (
            <div className="flex justify-center">
              <ShareSlide key={slide.key} url={`${imgBase}/${slide.key}`} name={`${fileBase}-${slide.key}`} label="Compartir" dark={dark} onOpen={setSharing} />
            </div>
          ) : (
            <p className={`text-center text-xs font-semibold ${dark ? "text-white/60" : "text-negro/60"}`}>Toca para avanzar · mantén pulsado para parar</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ShareSlide({ url, name, label, big = false, dark = true, onOpen }: { url: string; name: string; label: string; big?: boolean; dark?: boolean; onOpen: (open: boolean) => void }) {
  const { busy, ready, error, prepare, modal } = useShareImage(url, name, label);
  const open = !!busy || !!ready;
  useEffect(() => { onOpen(open); }, [open, onOpen]);
  useEffect(() => () => onOpen(false), [onOpen]);
  return (
    <>
      <button type="button" onClick={() => prepare("story")} disabled={!!busy}
        className={big ? "btn-primary w-full py-3 text-base" : `inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold backdrop-blur ${dark ? "bg-white/15 text-white hover:bg-white/25" : "bg-negro/10 text-negro hover:bg-negro/20"}`}>
        <ImageDown size={big ? 18 : 15} /> {busy && !ready ? "Preparando…" : error && !ready ? "Reintentar" : label}
      </button>
      {modal}
    </>
  );
}

function SlideBody({ slide: s, entry, dark }: { slide: Slide; entry: RosterEntry; dark: boolean }) {
  const soft = dark ? "text-white/80" : "text-negro/75";
  const accent = dark ? "text-dorado" : "text-rojo";
  const x = s.extra;
  const lines = s.lines.filter(Boolean);
  // Lo grande: cifras que suben como un marcador, o un nombre/título que entra de golpe
  const bigCls = s.count !== undefined ? "text-[min(9rem,34vw)]" : s.big.length > 12 ? "text-[min(3.4rem,13vw)]" : "text-[min(4.8rem,17vw)]";

  return (
    <>
      <p className={`wr-in sport text-sm font-black tracking-[0.3em] ${accent}`} style={{ "--d": "150ms" } as React.CSSProperties}>{s.kicker}</p>

      {s.key === "intro" && (
        <div className="wr-pop my-5" style={{ "--d": "250ms" } as React.CSSProperties}>
          {entry.player.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.player.photo_url} alt="" className="h-32 w-32 rounded-3xl object-cover shadow-2xl ring-4 ring-dorado" />
          ) : (
            <Jersey number={entry.number} goalkeeper={lineOf(entry.position) === "GK"} size={120} />
          )}
        </div>
      )}

      {x?.kind === "card" && (
        <div className="wr-card wr-glow my-2 w-[min(13rem,52vw,25dvh)] sm:my-3"><FutCard entry={entry} size="lg" /></div>
      )}

      {x?.kind === "score" ? (
        <div className="wr-in mt-5 w-full rounded-3xl bg-negro/70 p-5 text-white ring-2 ring-dorado" style={{ "--d": "300ms" } as React.CSSProperties}>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {([[x.home, x.homeGoals, x.homeUs], [x.away, x.awayGoals, !x.homeUs]] as [string, number, boolean][]).map(([t, g, us], n) => (
              <div key={n} className={`flex flex-col items-center ${n ? "order-3" : ""}`}>
                <span className={`wr-slam sport text-7xl font-black leading-none ${us ? "text-dorado" : ""}`} style={{ "--d": `${500 + n * 250}ms` } as React.CSSProperties}>{g}</span>
                <span className={`sport mt-1 line-clamp-2 text-base font-black uppercase leading-tight ${us ? "text-dorado" : "text-white/85"}`}>{t}</span>
              </div>
            ))}
            <span className="sport order-2 text-4xl font-black text-white/40">-</span>
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.3em] text-white/60">{x.date}{x.mvp ? " · MVP ⭐" : ""}</p>
        </div>
      ) : (
        <h2 className={`wr-slam sport mt-2 max-w-full break-words font-black leading-[0.9] ${bigCls} ${s.count === undefined && dark ? "text-dorado" : ""}`}
          style={{ "--d": x?.kind === "card" ? "1000ms" : "350ms" } as React.CSSProperties}>
          {s.count !== undefined ? <><CountUp value={s.count} duration={1100} />{s.big.endsWith(" %") ? <span className="text-[0.5em]"> %</span> : null}</> : s.big}
        </h2>
      )}
      {s.unit && <p className={`wr-in sport mt-1 text-2xl font-black uppercase tracking-wide ${accent}`} style={{ "--d": "650ms" } as React.CSSProperties}>{s.unit}</p>}

      {x && x.kind !== "card" && x.kind !== "score" && <div className="mt-6 w-full"><Extra x={x} dark={dark} /></div>}

      <div className={`${s.key === "titulo" ? "mt-2" : "mt-6"} space-y-1.5`}>
        {lines.map((l, n) => (
          <p key={n} className={`wr-in text-lg font-semibold leading-snug ${n ? soft : ""}`} style={{ "--d": `${1000 + n * 220}ms` } as React.CSSProperties}>{l}</p>
        ))}
      </div>
    </>
  );
}

function Extra({ x, dark }: { x: NonNullable<Slide["extra"]>; dark: boolean }) {
  if (x.kind === "calendar") {
    return (
      <div>
        <div className="flex flex-wrap justify-center gap-1.5">
          {x.games.map((g, n) => (
            <span key={n} className={`wr-pop h-7 w-7 rounded-md ${g.played ? `${RESULT_TONE[g.result]} shadow` : "border-2 border-dashed border-white/40"}`} style={{ "--d": `${700 + n * 60}ms` } as React.CSSProperties} />
          ))}
        </div>
        <p className="wr-in mt-2 text-[11px] font-semibold text-white/70" style={{ "--d": `${900 + x.games.length * 60}ms` } as React.CSSProperties}>
          Cada cuadro, un partido: dorado ganado, blanco empate, negro perdido; vacío, sin jugar
        </p>
      </div>
    );
  }
  if (x.kind === "balls") {
    const n = Math.min(24, x.goals), a = Math.min(24 - n, x.assists);
    return (
      <div className="flex flex-wrap justify-center gap-1.5">
        {Array.from({ length: n + a }, (_, j) => (
          <span key={j} className={`wr-drop ${j < n ? "" : "opacity-40"}`} style={{ "--d": `${700 + j * 90}ms` } as React.CSSProperties}><Ball size={n + a > 12 ? 26 : 34} /></span>
        ))}
      </div>
    );
  }
  if (x.kind === "stars") {
    return (
      <div className="flex flex-wrap justify-center gap-1 text-4xl">
        {Array.from({ length: Math.min(12, x.n) }, (_, j) => <span key={j} className="wr-pop" style={{ "--d": `${700 + j * 140}ms` } as React.CSSProperties}>⭐</span>)}
      </div>
    );
  }
  if (x.kind === "bars") {
    const row = (label: string, p: number, on: boolean, d: number) => (
      <div className="flex items-center gap-3">
        <span className="sport w-10 text-left text-lg font-black">{label}</span>
        <span className="h-6 flex-1 overflow-hidden rounded-md bg-white/10">
          <span className={`wr-bar block h-full rounded-md ${on ? "bg-dorado" : "bg-white/45"}`} style={{ width: `${Math.max(3, p)}%`, "--d": `${d}ms` } as React.CSSProperties} />
        </span>
        <span className={`sport w-14 text-right text-xl font-black ${on ? "text-dorado" : ""}`}>{p} %</span>
      </div>
    );
    return (
      <div className="space-y-2.5">
        {row("CON", x.withPct, true, 700)}
        {x.withoutPct !== null && row("SIN", x.withoutPct, false, 950)}
      </div>
    );
  }
  if (x.kind === "partner") {
    const chip = (t: string, gold: boolean) => (
      <span className={`sport max-w-[42%] truncate rounded-xl px-3 py-2 text-xl font-black uppercase ${gold ? "bg-dorado text-negro" : dark ? "bg-white text-negro" : "bg-negro text-white"}`}>{t}</span>
    );
    return (
      <div className="wr-in" style={{ "--d": "500ms" } as React.CSSProperties}>
        <div className="flex items-center justify-between gap-2">{chip(x.me, false)}{chip(x.partner, true)}</div>
        <div className="relative mx-auto mt-3 h-12 w-[75%]">
          <span className="absolute bottom-0 left-0 right-0 h-px bg-white/40" />
          <span className="wr-pass absolute bottom-0 h-8 w-8"><Ball size={32} /></span>
        </div>
      </div>
    );
  }
  return null;
}
