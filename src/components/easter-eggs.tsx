"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { fiestaDe, fiestaForzada, madridParts, saludoDe, type DiaFiesta } from "@/lib/fiestas";

/*
 * Sorpresas escondidas. No salen en Novedades a propósito.
 * - 7 toques seguidos al escudo de la cabecera (uno por jugador de fútbol 7): cruza un rayo,
 *   suena la grada y la app entra un rato en «modo noche de final» (negro y dorado).
 * - En Navidad, Nochevieja y Año Nuevo el escudo se viste y sale un saludo al entrar.
 */

const EVENT = "rv-rayo";
const FINAL_KEY = "rv-final-hasta";
const FIESTA_KEY = "rv-fiesta";
const FINAL_MS = 5 * 60 * 1000;
const TOQUES = 7;

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const tourOpen = () => !!document.getElementById("rv-tour");

function useFiesta(): DiaFiesta | null {
  const [f, setF] = useState<DiaFiesta | null>(null);
  useEffect(() => {
    let forced: string | null = null;
    try {
      const q = new URLSearchParams(location.search).get("fiesta");
      if (q === "off") sessionStorage.removeItem(FIESTA_KEY);
      else if (q) sessionStorage.setItem(FIESTA_KEY, q);
      forced = sessionStorage.getItem(FIESTA_KEY);
    } catch {}
    const now = new Date();
    setF(fiestaForzada(forced, now) ?? fiestaDe(now));
  }, []);
  return f;
}

/** Escudo de la cabecera que cuenta los toques. Va dentro del enlace a Inicio. */
export function CrestEgg({ width, height, className = "" }: { width: number; height: number; className?: string }) {
  const taps = useRef({ n: 0, last: 0 });
  const [tap, setTap] = useState(0);
  const fiesta = useFiesta();

  function onClick(e: React.MouseEvent) {
    const now = Date.now();
    const t = taps.current;
    t.n = now - t.last > 1200 ? 1 : t.n + 1;
    t.last = now;
    // A partir del segundo toque seguido ya no se navega: se están contando toques
    if (t.n >= 2) e.preventDefault();
    setTap((x) => x + 1);
    if (t.n >= TOQUES) {
      t.n = 0;
      window.dispatchEvent(new Event(EVENT));
    }
  }

  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width, height, touchAction: "manipulation" }} onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={tap} src="/escudo.png" alt="" width={width} height={height} draggable={false}
        className={`relative select-none drop-shadow-lg ${tap ? "egg-tap" : ""}`} />
      {fiesta?.adorno === "gorro" && <SantaHat size={width * 0.78} />}
      {fiesta?.adorno === "purpurina" && <Glitter />}
    </span>
  );
}

function SantaHat({ size }: { size: number }) {
  return (
    <svg aria-hidden viewBox="0 0 40 32" width={size} height={size * 0.8} className="pointer-events-none absolute"
      style={{ left: "38%", top: -size * 0.42, transform: "rotate(18deg)" }}>
      <path d="M4 25 C8 10 18 2 30 4 C34 5 37 9 38 14 L33 15 C32 11 29 9 26 10 C22 12 26 20 29 25 Z" fill="#D20D17" />
      <path d="M26 10 C22 12 26 20 29 25 L33 24 C30 19 28 14 30 11 Z" fill="#A80A12" />
      <rect x="1" y="23" width="31" height="7" rx="3.5" fill="#fff" />
      <circle cx="36" cy="16" r="4" fill="#fff" />
    </svg>
  );
}

function Glitter() {
  const dots = [[-12, 6, 0], [92, 0, 0.4], [100, 62, 0.9], [-16, 70, 1.3], [40, -14, 0.7], [60, 96, 1.6]];
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {dots.map(([x, y, d], i) => (
        <span key={i} className="egg-twinkle absolute text-[10px] leading-none text-dorado" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}>✦</span>
      ))}
    </span>
  );
}

/** Grada: ruido filtrado que sube y baja, con un trueno al principio. Sin ficheros de sonido. */
function playCrowd() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const len = 3.6;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 0.22;
    out.connect(ctx.destination);

    // Trueno: graves cortos
    const boom = ctx.createBufferSource();
    boom.buffer = buf;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 140;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0, t0);
    bg.gain.linearRampToValueAtTime(2.4, t0 + 0.03);
    bg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
    boom.connect(low).connect(bg).connect(out);
    boom.start(t0);
    boom.stop(t0 + 1.2);

    // Ovación
    const crowd = ctx.createBufferSource();
    crowd.buffer = buf;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 900;
    band.Q.value = 0.6;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0, t0 + 0.15);
    cg.gain.linearRampToValueAtTime(0.9, t0 + 0.9);
    cg.gain.setValueAtTime(0.9, t0 + 2.2);
    cg.gain.linearRampToValueAtTime(0, t0 + len);
    // Oleaje de la grada
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 2.2;
    lg.gain.value = 0.18;
    lfo.connect(lg).connect(cg.gain);
    crowd.connect(band).connect(cg).connect(out);
    crowd.start(t0 + 0.1);
    lfo.start(t0);
    crowd.stop(t0 + len);
    lfo.stop(t0 + len);
    setTimeout(() => ctx.close().catch(() => {}), (len + 0.5) * 1000);
  } catch {}
}

const SPARKS = Array.from({ length: 14 }, (_, i) => i);

/** Escucha los 7 toques y pinta el rayo, el modo final y los saludos de los días señalados. */
export function EasterEggs() {
  const [bolt, setBolt] = useState(0);
  const [until, setUntil] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const fiesta = useFiesta();
  const [greet, setGreet] = useState(false);

  // Modo final guardado en esta pestaña (sobrevive a recargar)
  useEffect(() => {
    try {
      const v = Number(sessionStorage.getItem(FINAL_KEY));
      if (v > Date.now()) setUntil(v);
    } catch {}
  }, []);

  useEffect(() => {
    const on = () => {
      const u = Date.now() + FINAL_MS;
      setBolt((b) => b + 1);
      setUntil(u);
      try {
        sessionStorage.setItem(FINAL_KEY, String(u));
      } catch {}
      playCrowd();
      try {
        navigator.vibrate?.([40, 60, 40, 60, 120]);
      } catch {}
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    if (!bolt) return;
    if (!reduced()) {
      document.documentElement.classList.add("egg-shake");
      setTimeout(() => document.documentElement.classList.remove("egg-shake"), 500);
    }
    const t = setTimeout(() => setBolt(0), 2900);
    return () => clearTimeout(t);
  }, [bolt]);

  useEffect(() => {
    const html = document.documentElement;
    if (!until) {
      html.classList.remove("rv-final");
      return;
    }
    html.classList.add("rv-final");
    const tick = () => {
      const l = until - Date.now();
      if (l <= 0) stopFinal();
      else setLeft(l);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);

  function stopFinal() {
    setUntil(null);
    try {
      sessionStorage.removeItem(FINAL_KEY);
    } catch {}
  }

  // Saludo de fiesta: una vez al día por dispositivo (y una vez por pestaña si se fuerza)
  useEffect(() => {
    if (!fiesta?.saludo) return;
    const { year, month, day } = madridParts(new Date());
    const key = `rv-saludo-${fiesta.saludo}-${year}-${month}-${day}`;
    try {
      const forced = !!sessionStorage.getItem(FIESTA_KEY);
      const store = forced ? sessionStorage : localStorage;
      if (store.getItem(key)) return;
      store.setItem(key, "1");
    } catch {}
    let t: ReturnType<typeof setTimeout>;
    const go = () => {
      if (tourOpen() || document.getElementById("whats-new-title") || document.getElementById("rv-fichaje") || document.getElementById("rv-gala")) t = setTimeout(go, 1000);
      else setGreet(true);
    };
    t = setTimeout(go, 900);
    return () => clearTimeout(t);
  }, [fiesta]);

  useEffect(() => {
    if (!greet) return;
    const t = setTimeout(() => setGreet(false), 9000);
    return () => clearTimeout(t);
  }, [greet]);

  const mm = Math.floor(left / 60000);
  const ss = String(Math.floor(left / 1000) % 60).padStart(2, "0");
  const s = greet && fiesta?.saludo ? saludoDe(fiesta.saludo, fiesta.year) : null;

  return (
    <>
      {bolt > 0 && (
        <div key={bolt} aria-hidden className="egg-rayo pointer-events-none fixed inset-0 z-[70] overflow-hidden">
          <div className="egg-dim absolute inset-0" />
          <div className="egg-flash absolute inset-0" />
          <svg className="egg-bolt absolute left-1/2 top-0 h-full w-[min(70vw,420px)] -translate-x-1/2" viewBox="0 0 100 200" preserveAspectRatio="none">
            <path d="M68 0 L30 92 L52 92 L22 200 L80 74 L56 74 L86 0 Z" fill="#D5AF32" stroke="#fff6d0" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {SPARKS.map((i) => (
                <span key={i} className="egg-spark absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
                  style={{ ["--a" as string]: `${(360 / SPARKS.length) * i}deg`, background: i % 3 ? "#D5AF32" : "#fff", animationDelay: `${0.45 + (i % 4) * 0.04}s` }} />
              ))}
              <p className="egg-grito sport whitespace-nowrap text-center text-5xl font-black italic leading-none text-dorado sm:text-7xl">¡Aúpa Rayo!</p>
            </div>
          </div>
        </div>
      )}

      {until && (
        <>
          <div aria-hidden className="egg-final-bg pointer-events-none fixed inset-0 -z-10" />
          <div role="status" className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-3 z-40 flex items-center gap-2 rounded-full bg-negro py-1.5 pl-3 pr-1.5 text-xs font-bold text-dorado shadow-xl ring-1 ring-dorado/60 lg:bottom-4">
            <span aria-hidden>🏆</span>
            <span className="sport tracking-wide">Noche de final · {mm}:{ss}</span>
            <button onClick={stopFinal} aria-label="Salir del modo noche de final" className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"><X size={14} /></button>
          </div>
        </>
      )}

      {s && (
        <div role="status" className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4.5rem)] z-50 mx-auto max-w-sm lg:top-6">
          {!reduced() && (
            <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
              {Array.from({ length: 36 }, (_, i) => (
                <span key={i} className={fiesta?.saludo === "navidad" ? "egg-snow" : "egg-gold"}
                  style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.35}s`, animationDuration: `${3.5 + (i % 5) * 0.6}s` }}>
                  {fiesta?.saludo === "navidad" ? "❄" : "✦"}
                </span>
              ))}
            </div>
          )}
          <div className="relative animate-pop overflow-hidden rounded-2xl border-l-4 border-dorado bg-negro p-4 pr-10 text-white shadow-2xl ring-1 ring-dorado/50">
            <button onClick={() => setGreet(false)} aria-label="Cerrar" className="absolute right-2 top-2 rounded-lg p-1 text-white/70 hover:text-white"><X size={18} /></button>
            <div className="relative flex items-start gap-3">
              <span aria-hidden className="text-3xl leading-none">{s.emoji}</span>
              <div>
                <p className="sport text-xl font-black leading-tight text-dorado">{s.title}</p>
                <p className="mt-1 text-sm text-white/85">{s.text}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
