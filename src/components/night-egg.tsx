"use client";
import { useEffect, useRef, useState } from "react";
import { Timer, X } from "lucide-react";
import { nightContext } from "@/app/(app)/night-actions";
import { esMadrugada, FINAL_DESCUENTO, horaForzada, parte, relojMadrid, SEGUNDA_AMARILLA, type Parte, type Reloj } from "@/lib/madrugada";

/*
 * Sorpresa de madrugada (4.30.1). Secreta: no sale en Novedades.
 * Entre la 1:00 y las 5:59 (Madrid) el escudo se pone gorro de dormir y, al abrir la app, el árbitro
 * te saca una amarilla por trasnochar con un parte que sabe si mañana juegas. «Me voy a dormir» apaga
 * los focos del campo; «Cinco minutos más» es la segunda amarilla y cinco minutos de descuento.
 * Volver a abrirla la misma noche es roja directa; la tercera, al Comité. Más de tres, ya no molesta.
 * Para probar: ?madrugada=1 (o ?madrugada=3:12 para fingir la hora); ?madrugada=off lo quita.
 */

const FORCE_KEY = "rv-madrugada";
const NIGHTS_KEY = "rv-noches";
const AWAY_MS = 10 * 60 * 1000;
const DESCUENTO_MS = 5 * 60 * 1000;
const MAX_VISITAS = 3;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const busy = () => !!(document.getElementById("rv-tour") || document.getElementById("whats-new-title") || document.getElementById("rv-fichaje") || document.getElementById("rv-gala"));

function forced(): string | null {
  try {
    const q = new URLSearchParams(location.search).get("madrugada");
    if (q === "off") sessionStorage.removeItem(FORCE_KEY);
    else if (q) sessionStorage.setItem(FORCE_KEY, q);
    return sessionStorage.getItem(FORCE_KEY);
  } catch {
    return null;
  }
}

/** Hora de Madrid (o la fingida para probar) si es de madrugada; null si no. */
function nightClock(): { now: Reloj; test: boolean } | null {
  const real = relojMadrid(new Date());
  const f = horaForzada(forced(), real);
  const now = f ?? real;
  return esMadrugada(now) ? { now, test: !!f } : null;
}

/** ¿Es de madrugada? Para el gorro del escudo. */
export function useMadrugada() {
  const [n, setN] = useState(false);
  useEffect(() => {
    const check = () => setN(!!nightClock());
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, []);
  return n;
}

/** Gorro de dormir y unas zetas sobre el escudo. */
export function Nightcap({ size }: { size: number }) {
  return (
    <>
      <svg aria-hidden viewBox="0 0 40 34" width={size} height={size * 0.85} className="pointer-events-none absolute"
        style={{ left: "26%", top: -size * 0.36, transform: "rotate(-14deg)" }}>
        <path d="M3 28 C6 14 14 5 25 6 C31 7 33 12 30 18 C28 22 31 25 33 27 Z" fill="#7B93EC" />
        {/* Rayas del pijama */}
        <path d="M9 17 L17 27 M15 10 L24 26 M22 7 L29 21" stroke="#C9D5FF" strokeWidth="2.6" strokeLinecap="round" />
        <rect x="1" y="25" width="33" height="7" rx="3.5" fill="#fff" />
        <circle cx="33" cy="17" r="4.2" fill="#D5AF32" />
      </svg>
      <span aria-hidden className="pointer-events-none absolute -right-3 -top-2 text-[10px] font-black leading-none text-white/90">
        <span className="noche-z absolute">z</span>
        <span className="noche-z absolute" style={{ animationDelay: "1s" }}>z</span>
        <span className="noche-z absolute" style={{ animationDelay: "2s" }}>Z</span>
      </span>
    </>
  );
}

/* ---------- Sonidos (solo después de tocar un botón) ---------- */
type AC = AudioContext;
function audio(): AC | null {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return C ? new C() : null;
  } catch {
    return null;
  }
}

/** Silbato: pitidos con el trino de la bolita. */
function whistle(ctx: AC | null, blasts: number[]) {
  if (!ctx) return;
  try {
    ctx.resume().catch(() => {});
    let t = ctx.currentTime + 0.05;
    for (const len of blasts) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 2900;
      const trill = ctx.createOscillator();
      trill.frequency.value = 32;
      const tg = ctx.createGain();
      tg.gain.value = 140;
      trill.connect(tg).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.setValueAtTime(0.12, t + len - 0.04);
      g.gain.linearRampToValueAtTime(0, t + len);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      trill.start(t);
      o.stop(t + len);
      trill.stop(t + len);
      t += len + 0.12;
    }
  } catch {}
}

/** «Clonc» del interruptor de un foco. */
function clunk(ctx: AC | null, at: number) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.25);
  } catch {}
}

/* ---------- Escena ---------- */
type Fase = "parte" | "segunda" | "recurso" | "apagando" | "dormido";

function Focos({ off }: { off: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 flex justify-between px-[6%] pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      {[0, 1, 2, 3].map((i) => {
        const lit = i >= off;
        return (
          <div key={i} className="flex flex-col items-center" style={{ transform: `translateY(${i === 1 || i === 2 ? 14 : 0}px)` }}>
            <div className={`grid grid-cols-3 gap-[3px] rounded-[4px] p-[3px] transition-all duration-300 ${lit ? "bg-[#fff6d0] shadow-[0_0_28px_10px_rgba(255,240,180,0.55)]" : "bg-[#2a2f45]"}`}>
              {Array.from({ length: 6 }, (_, k) => (
                <span key={k} className={`h-[6px] w-[6px] rounded-full transition-colors duration-300 ${lit ? "bg-white" : "bg-[#3a4060]"}`} />
              ))}
            </div>
            <div className="h-16 w-[3px] bg-[#3a4060]" />
            {lit && <div className="noche-haz absolute top-[calc(env(safe-area-inset-top)+2.4rem)] h-[38vh] w-24 -translate-x-0" />}
          </div>
        );
      })}
    </div>
  );
}

function Tarjeta({ color, delay = 0, tilt = -8, x = 0 }: { color: "yellow" | "red"; delay?: number; tilt?: number; x?: number }) {
  return (
    <div className="noche-tarjeta absolute left-1/2 top-0 h-[104px] w-[72px] rounded-[7px] shadow-[0_10px_30px_rgba(0,0,0,0.55)]"
      style={{
        background: color === "yellow" ? "linear-gradient(140deg,#FFE04A,#F5C400 55%,#E0AE00)" : "linear-gradient(140deg,#FF3B3B,#D20D17 55%,#A80A12)",
        ["--tilt" as string]: `${tilt}deg`, ["--x" as string]: `${x}px`, animationDelay: `${delay}s`,
      }}>
      <span className="absolute inset-x-2 top-2 h-5 rounded-full bg-white/25 blur-[2px]" />
    </div>
  );
}

export function NightEgg() {
  const [p, setP] = useState<Parte | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [now, setNow] = useState<Reloj | null>(null);
  const [fase, setFase] = useState<Fase>("parte");
  const [off, setOff] = useState(0);
  const [until, setUntil] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [pitido, setPitido] = useState(false);
  const ctxRef = useRef<AC | null>(null);
  const shown = useRef(false);
  const primary = useRef<HTMLButtonElement>(null);

  // La app entra (o vuelve tras un rato fuera) de madrugada
  useEffect(() => {
    const html = document.documentElement;
    let hiddenAt = 0;
    let wait: ReturnType<typeof setTimeout>;

    const visit = () => {
      const n = nightClock();
      if (!n) {
        html.classList.remove("rv-noche");
        return;
      }
      html.classList.add("rv-noche");
      // Las pruebas cuentan en esta pestaña; las de verdad, en el dispositivo
      const store = n.test ? sessionStorage : localStorage;
      let visita = 1;
      let noches = 1;
      try {
        const k = `rv-noche-${n.now.day}`;
        visita = Number(store.getItem(k) || 0) + 1;
        store.setItem(k, String(visita));
        const list: string[] = JSON.parse(store.getItem(NIGHTS_KEY) || "[]");
        if (!list.includes(n.now.day)) list.push(n.now.day);
        const month = n.now.day.slice(0, 7);
        const keep = list.filter((d) => d.slice(0, 7) === month);
        store.setItem(NIGHTS_KEY, JSON.stringify(keep));
        noches = keep.length;
      } catch {}
      if (visita > MAX_VISITAS || shown.current) return;

      const ctxPromise = nightContext().catch(() => null);
      const go = async () => {
        if (busy()) {
          wait = setTimeout(go, 1000);
          return;
        }
        const ctx = await ctxPromise;
        shown.current = true;
        setNow(n.now);
        setFase("parte");
        setOff(0);
        setName(ctx?.name ?? null);
        setP(parte(ctx, n.now, visita, noches));
      };
      wait = setTimeout(go, 1100);
    };

    visit();
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) visit();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(wait);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (p && fase !== "apagando" && fase !== "dormido") primary.current?.focus();
  }, [p, fase]);

  // Descuento de «cinco minutos más»
  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const l = until - Date.now();
      if (l <= 0) {
        setUntil(null);
        setPitido(true);
        whistle(ctxRef.current, [0.25, 0.25, 0.9]);
      } else setLeft(l);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);

  function close() {
    setP(null);
    shown.current = false;
  }

  function dormir() {
    ctxRef.current ??= audio();
    setFase("apagando");
    const step = reduced() ? 0 : 420;
    for (let i = 1; i <= 4; i++) {
      setTimeout(() => setOff(i), step * i);
      clunk(ctxRef.current, (step * i) / 1000);
    }
    try {
      navigator.vibrate?.([20, 380, 20, 380, 20, 380, 20]);
    } catch {}
    setTimeout(() => setFase("dormido"), step * 4 + 350);
    setTimeout(close, step * 4 + 3200);
  }

  function cincoMas() {
    ctxRef.current ??= audio();
    whistle(ctxRef.current, [0.18, 0.5]);
    setFase("segunda");
    setTimeout(() => {
      close();
      setUntil(Date.now() + DESCUENTO_MS);
    }, 2600);
  }

  function recurrir() {
    ctxRef.current ??= audio();
    whistle(ctxRef.current, [0.35]);
    setFase("recurso");
  }

  const mm = Math.floor(left / 60000);
  const ss = String(Math.floor(left / 1000) % 60).padStart(2, "0");
  const red = p?.card === "red" || fase === "segunda";
  const minute = now ? `${now.h}:${String(now.m).padStart(2, "0")}` : "";
  const dark = fase === "dormido";

  return (
    <>
      {p && (
        <div role="dialog" aria-modal="true" aria-labelledby="rv-noche-titulo" id="rv-noche"
          onKeyDown={(e) => e.key === "Escape" && close()}
          className={`noche-cielo fixed inset-0 z-[80] flex items-end justify-center overflow-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:items-center ${dark ? "noche-apagado" : ""}`}>
          <span aria-hidden className="noche-luna absolute right-[12%] top-[22%] h-12 w-12 rounded-full" />
          <Focos off={off} />

          <div className={`relative w-full max-w-sm transition-opacity duration-500 ${dark ? "opacity-0" : "opacity-100"}`}>
            <div className="relative mx-auto h-[118px] w-full">
              {fase === "segunda" ? (
                <>
                  <Tarjeta color="yellow" tilt={-14} x={-22} delay={0} />
                  <Tarjeta color="red" tilt={10} x={22} delay={0.35} />
                </>
              ) : (
                <Tarjeta color={p.card} />
              )}
            </div>

            <div className="noche-acta animate-pop rounded-2xl bg-white/[0.07] p-4 text-white ring-1 ring-white/15 backdrop-blur-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">Acta arbitral · Min. {minute}</p>
              {fase === "segunda" ? (
                <>
                  <h2 id="rv-noche-titulo" className="sport mt-1 text-2xl font-black leading-tight text-[#FF5A5A]">{SEGUNDA_AMARILLA.title}</h2>
                  <p className="mt-1.5 text-sm text-white/85">{SEGUNDA_AMARILLA.text}</p>
                </>
              ) : fase === "recurso" ? (
                <>
                  <h2 id="rv-noche-titulo" className="sport mt-1 text-2xl font-black leading-tight text-dorado">Recurso desestimado</h2>
                  <p className="mt-1.5 text-sm text-white/85">El Comité también quiere dormir. Se mantiene la sanción.</p>
                </>
              ) : (
                <>
                  <p className={`mt-1 text-xs font-black uppercase tracking-wide ${red ? "text-[#FF5A5A]" : "text-[#FFD43B]"}`}>
                    {red ? "Expulsado" : "Amonestado por trasnochar"}
                  </p>
                  <h2 id="rv-noche-titulo" className="sport mt-0.5 text-2xl font-black leading-tight text-white">{p.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/85">{p.text}</p>
                  {p.foot && <p className="mt-2 text-xs font-semibold text-dorado">{p.foot}</p>}
                </>
              )}

              {(fase === "parte" || fase === "recurso") && (
                <div className="mt-4 flex gap-2">
                  <button ref={primary} onClick={dormir}
                    className="flex-1 rounded-xl bg-dorado px-3 py-2.5 text-sm font-black text-negro shadow-lg transition active:scale-95">
                    Me voy a dormir 😴
                  </button>
                  {fase === "parte" && (p.card === "yellow" ? (
                    <button onClick={cincoMas} className="rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 ring-1 ring-white/25 transition hover:bg-white/10 active:scale-95">
                      Cinco minutos más
                    </button>
                  ) : (
                    <button onClick={recurrir} className="rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 ring-1 ring-white/25 transition hover:bg-white/10 active:scale-95">
                      Recurrir
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {fase === "dormido" && (
            <div className="noche-buenas absolute inset-0 flex flex-col items-center justify-center text-center" role="status">
              <span aria-hidden className="text-4xl">🌙</span>
              <p className="sport mt-3 text-3xl font-black text-white">Buenas noches{name ? `, ${name}` : ""}</p>
              <p className="mt-1 text-sm text-white/60">Focos apagados. El míster no se enterará 🤫</p>
            </div>
          )}
        </div>
      )}

      {until && (
        <div role="status" className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-3 z-40 flex items-center gap-2 rounded-full bg-[#0f1530] py-1.5 pl-3 pr-1.5 text-xs font-bold text-white shadow-xl ring-1 ring-[#D20D17]/70 lg:bottom-4">
          <span aria-hidden className="inline-block h-3.5 w-2.5 rounded-[2px] bg-[#D20D17]" />
          <Timer size={13} aria-hidden className="text-white/70" />
          <span className="sport tracking-wide">Descuento · {mm}:{ss}</span>
          <button onClick={() => setUntil(null)} aria-label="Quitar el descuento" className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"><X size={14} /></button>
        </div>
      )}

      {pitido && (
        <div role="alertdialog" aria-labelledby="rv-pitido" className="noche-cielo fixed inset-0 z-[80] flex items-center justify-center px-6 text-center">
          <div className="animate-pop max-w-xs text-white">
            <p aria-hidden className="text-5xl">📣</p>
            <p aria-hidden className="sport mt-2 text-sm font-black tracking-[0.3em] text-white/60">PII · PII · PIIIII</p>
            <h2 id="rv-pitido" className="sport mt-2 text-3xl font-black">{FINAL_DESCUENTO.title}</h2>
            <p className="mt-1.5 text-sm text-white/80">{FINAL_DESCUENTO.text}</p>
            <button autoFocus onClick={() => setPitido(false)} className="mt-5 rounded-xl bg-dorado px-5 py-2.5 text-sm font-black text-negro active:scale-95">Vale, míster</button>
          </div>
        </div>
      )}
    </>
  );
}
