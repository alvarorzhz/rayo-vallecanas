"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { ENV_FPS, PRESIDENT, splitSentences, type PressCues } from "@/lib/president";

/**
 * 4.27.0 · La rueda de prensa de Don Rayo dentro de la crónica: su cara dibujada mueve la boca con su voz
 * y van saliendo los subtítulos. Con audio (la voz de Gemini, creada una vez), la boca sigue al audio;
 * sin audio, habla con la voz del propio móvil. Nada se manda fuera.
 */
export function DonRayo({ text, audioUrl, cues, score, children }: {
  text: string;
  audioUrl: string | null;
  cues: PressCues | null;
  /** Marcador pequeño de arriba a la derecha: «3-1». */
  score: string | null;
  /** Herramientas de la redacción (solo quien puede editar). */
  children?: React.ReactNode;
}) {
  const sentences = splitSentences(text);
  const uid = useId().replace(/:/g, "");
  const audio = useRef<HTMLAudioElement | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const raf = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [line, setLine] = useState(-1);
  const [progress, setProgress] = useState(0);
  const useAudio = !!(audioUrl && cues);
  const lineRef = useRef(-1);

  // Mueve la cara: boca (0-1), cabeza, cejas y parpadeos, sin repintar React en cada fotograma
  const pose = (t: number, open: number, talking: boolean) => {
    const s = svg.current;
    if (!s) return;
    const q = (sel: string) => s.querySelector<SVGElement>(`[data-p="${sel}"]`);
    const o = Math.max(0, Math.min(1, open));
    const ry = 3 + o * 19, rx = 21 + o * 6, cy = 248 + o * 6;
    q("mo")?.setAttribute("ry", String(ry)); q("mo")?.setAttribute("rx", String(rx)); q("mo")?.setAttribute("cy", String(cy));
    q("mclip")?.setAttribute("ry", String(ry)); q("mclip")?.setAttribute("rx", String(rx)); q("mclip")?.setAttribute("cy", String(cy));
    q("teeth")?.setAttribute("y", String(cy - ry));
    q("tongue")?.setAttribute("cy", String(cy + ry - 4));
    q("stache")?.setAttribute("transform", `translate(0 ${-o * 4})`);
    const calm = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const tilt = calm ? 0 : Math.sin(t * 1.7) * 2.2 + Math.sin(t * 4.3) * o * 2.5;
    const bob = calm ? 0 : Math.sin(t * 2.1) * 2 + o * 3;
    q("head")?.setAttribute("transform", `translate(0 ${bob}) rotate(${tilt} 260 300)`);
    q("body")?.setAttribute("transform", `translate(0 ${bob * 0.35})`);
    // Cejas arriba al empezar cada frase; parpadeo cada pocos segundos
    const brow = talking ? Math.max(0, Math.sin(((t * 1000) % 3700) / 3700 * Math.PI * 2)) * 6 : 0;
    q("browL")?.setAttribute("transform", `translate(0 ${-brow})`);
    q("browR")?.setAttribute("transform", `translate(0 ${-brow})`);
    const blink = (t % 3.3) < 0.16 ? Math.sin(((t % 3.3) / 0.16) * Math.PI) * 24 : 0;
    q("lidL")?.setAttribute("height", String(blink)); q("lidR")?.setAttribute("height", String(blink));
  };

  const setLineOnce = (i: number) => { if (lineRef.current !== i) { lineRef.current = i; setLine(i); } };

  // Con audio: la boca sigue a la voz grabada
  const tick = () => {
    const a = audio.current;
    if (!a || !cues) return;
    const t = a.currentTime;
    const i = Math.floor(t * ENV_FPS);
    const v = (Number(cues.env[i] ?? 0) / 9) * 0.75 + (Number(cues.env[i - 1] ?? 0) / 9) * 0.25;
    pose(t, v * 1.1, !a.paused);
    setLineOnce(cues.cues.findIndex((c, k) => t >= c.start - 0.05 && t < (cues.cues[k + 1]?.start ?? c.end + 0.6)));
    setProgress(Math.min(1, t / (cues.duration || a.duration || 1)));
    raf.current = requestAnimationFrame(tick);
  };

  // Sin audio: la voz del móvil, frase a frase, y la boca se mueve mientras habla
  const speaking = useRef(false);
  const speakT0 = useRef(0);
  const fakeTick = () => {
    const t = (performance.now() - speakT0.current) / 1000;
    const o = speaking.current ? 0.35 + 0.35 * Math.sin(t * 17) + 0.3 * Math.sin(t * 7.3) : 0;
    pose(t, o, speaking.current);
    raf.current = requestAnimationFrame(fakeTick);
  };

  const stopAll = () => {
    cancelAnimationFrame(raf.current);
    audio.current?.pause();
    try { window.speechSynthesis?.cancel(); } catch { /* nada */ }
    speaking.current = false;
    setPlaying(false);
  };

  useEffect(() => () => stopAll(), []);

  const playPhoneVoice = () => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    speakT0.current = performance.now();
    raf.current = requestAnimationFrame(fakeTick);
    setPlaying(true);
    setStarted(true);
    let i = 0;
    const next = () => {
      if (i >= sentences.length) { speaking.current = false; setPlaying(false); cancelAnimationFrame(raf.current); pose(0, 0, false); setProgress(1); return; }
      const k = i++;
      setLineOnce(k);
      setProgress(k / sentences.length);
      if (!synth || muted) {
        speaking.current = !muted;
        setTimeout(next, 600 + sentences[k].length * 55);
        return;
      }
      const u = new SpeechSynthesisUtterance(sentences[k]);
      u.lang = "es-ES";
      const vs = synth.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("es"));
      const best = vs.sort((a, b) => Number(b.lang.toLowerCase() === "es-es") - Number(a.lang.toLowerCase() === "es-es") || Number(/google|natural|neural|premium|enhanced|mejorad/i.test(b.name)) - Number(/google|natural|neural|premium|enhanced|mejorad/i.test(a.name)))[0];
      if (best) u.voice = best;
      u.pitch = 0.8;
      u.rate = 1;
      u.onstart = () => { speaking.current = true; };
      u.onend = () => { speaking.current = false; setTimeout(next, 250); };
      u.onerror = () => { speaking.current = false; setTimeout(next, 250); };
      synth.speak(u);
    };
    next();
  };

  const toggle = () => {
    if (playing) return stopAll();
    if (useAudio && audio.current) {
      const a = audio.current;
      if (a.ended || a.currentTime >= (cues!.duration || a.duration) - 0.05) a.currentTime = 0;
      a.muted = muted;
      void a.play().then(() => { setPlaying(true); setStarted(true); raf.current = requestAnimationFrame(tick); }).catch(() => playPhoneVoice());
      return;
    }
    playPhoneVoice();
  };

  const flipMute = () => {
    const m = !muted;
    setMuted(m);
    if (audio.current) audio.current.muted = m;
    if (m) try { window.speechSynthesis?.cancel(); } catch { /* nada */ }
  };

  const sub = line >= 0 ? sentences[line] : null;
  return (
    <section id="don-rayo" aria-label={`Rueda de prensa de ${PRESIDENT}`} className="donrayo relative -mx-4 mt-8 overflow-hidden bg-negro px-4 py-5 text-white sm:mx-0 sm:rounded-sm sm:px-5">
      <span aria-hidden className="donrayo-slash" />
      <div className="relative z-[1] flex items-end justify-between gap-3">
        <div>
          <p className="sport text-[13px] font-black uppercase italic tracking-[0.2em] text-dorado">Sala de prensa</p>
          <h2 className="news-head mt-1 text-[1.7rem] font-black leading-none">Habla <em className="text-dorado">{PRESIDENT}</em></h2>
        </div>
        {cues && <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em]">🎙 {Math.round(cues.duration)} s</span>}
      </div>

      <div className="donrayo-stage relative z-[1] mt-3.5 overflow-hidden rounded-[14px] ring-2 ring-dorado/55">
        <Stage uid={uid} svgRef={svg} score={score} />
        {sub && (
          <p key={line} className="donrayo-sub" aria-live="polite">{sub}</p>
        )}
        <span className="donrayo-bar" style={{ width: `${progress * 100}%` }} />
        {!playing && (
          <button type="button" onClick={toggle} className="donrayo-play" aria-label={started ? "Escuchar otra vez" : "Escuchar al presidente"}>
            <span className="donrayo-play-dot"><Play size={30} fill="currentColor" className="ml-1" /></span>
            <span className="donrayo-play-label">{started ? "Otra vez" : "Escuchar al presidente"}</span>
          </button>
        )}
      </div>

      <div className="relative z-[1] mt-3 flex gap-2">
        <button type="button" onClick={toggle} className="donrayo-btn donrayo-btn-gold">
          {playing ? <><Pause size={16} /> Parar</> : <><Play size={16} /> Escuchar</>}
        </button>
        <button type="button" onClick={flipMute} className="donrayo-btn" aria-pressed={muted}>
          {muted ? <><VolumeX size={16} /> Sin voz</> : <><Volume2 size={16} /> Con voz</>}
        </button>
      </div>
      <details className="relative z-[1] mt-3 rounded-xl bg-white/[0.06] px-3 py-2.5">
        <summary className="cursor-pointer text-sm font-bold text-dorado">Leer lo que ha dicho</summary>
        <p className="news-body mt-2 italic leading-relaxed text-white/90">«{text}»</p>
      </details>
      <p className="relative z-[1] mt-2.5 text-[11.5px] leading-snug text-white/55">
        {PRESIDENT} es un personaje de broma de La Voz del Rayo. Sus palabras las escribe la IA con los datos del acta y las revisa la redacción.
      </p>
      {useAudio && <audio ref={audio} src={audioUrl!} preload="none" onEnded={() => { stopAll(); pose(0, 0, false); setProgress(1); }} />}
      {children}
    </section>
  );
}

/** El aviso pequeño bajo el titular, que baja hasta la rueda de prensa. */
export function DonRayoTeaser({ seconds }: { seconds: number | null }) {
  return (
    <a href="#don-rayo" className="mt-4 flex items-center gap-2.5 rounded-xl bg-negro py-2 pl-2 pr-2.5 text-white shadow-[0_6px_16px_rgba(0,0,0,0.15)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-[#1a1816] ring-2 ring-dorado">
        <MiniFace />
      </span>
      <span className="min-w-0 flex-1">
        <span className="sport block text-[15px] font-black uppercase italic tracking-wide text-dorado">{PRESIDENT} ha hablado</span>
        <span className="block truncate text-[13px] font-semibold text-white/85">Su rueda de prensa{seconds ? `, en ${seconds} segundos` : ""}</span>
      </span>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rojo"><Play size={14} fill="currentColor" className="ml-0.5" /></span>
    </a>
  );
}

function MiniFace() {
  return (
    <svg viewBox="150 50 220 260" className="h-11 w-11 translate-y-1" aria-hidden>
      <path d="M168 150 C168 80 210 52 260 52 C310 52 352 80 352 150 L352 205 C352 268 310 304 260 304 C210 304 168 268 168 205 Z" fill="#f0bd96" />
      <path d="M166 175 C158 120 170 92 190 80 C182 110 184 140 190 172 Z M354 175 C362 120 350 92 330 80 C338 110 336 140 330 172 Z" fill="#cfcac2" />
      <g fill="none" stroke="#c99a22" strokeWidth="6"><rect x="196" y="152" width="54" height="40" rx="12" /><rect x="270" y="152" width="54" height="40" rx="12" /></g>
      <circle cx="224" cy="173" r="7" fill="#2a1d14" /><circle cx="296" cy="173" r="7" fill="#2a1d14" />
      <path d="M260 230 C246 222 222 222 206 236 C194 246 190 262 176 262 C190 276 220 262 236 252 C246 246 254 244 260 246 C266 244 274 246 284 252 C300 262 330 276 344 262 C330 262 326 246 314 236 C298 222 274 222 260 230 Z" fill="#ece8e0" />
    </svg>
  );
}

/** La sala de prensa entera, dibujada en un único SVG que escala con el móvil. */
function Stage({ uid, svgRef, score }: { uid: string; svgRef: React.RefObject<SVGSVGElement | null>; score: string | null }) {
  const id = (s: string) => `${s}-${uid}`;
  return (
    <svg ref={svgRef} viewBox="0 0 720 900" className="block h-auto w-full" role="img" aria-label="Don Rayo en la sala de prensa">
      <defs>
        <linearGradient id={id("wall")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#171513" /><stop offset="1" stopColor="#0b0a09" /></linearGradient>
        <radialGradient id={id("spot")} cx="0.48" cy="0.42" r="0.5"><stop offset="0" stopColor="rgba(255,236,190,0.16)" /><stop offset="1" stopColor="rgba(255,236,190,0)" /></radialGradient>
        <linearGradient id={id("skin")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3c39c" /><stop offset="1" stopColor="#e2a57d" /></linearGradient>
        <linearGradient id={id("suit")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e1e22" /><stop offset="1" stopColor="#0c0c0e" /></linearGradient>
        <linearGradient id={id("table")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b1917" /><stop offset="1" stopColor="#0a0908" /></linearGradient>
        <pattern id={id("scarf")} width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)"><rect width="34" height="34" fill="#D20D17" /><rect width="17" height="34" fill="#111" /></pattern>
        <pattern id={id("tiles")} width="280" height="240" patternUnits="userSpaceOnUse" x="-40" y="-30">
          <image href="/escudo.png" x="47" y="18" width="46" height="55" />
          <text x="210" y="50" textAnchor="middle" className="donrayo-tile">RAYO VALLECAÑAS</text>
          <image href="/escudo.png" x="187" y="138" width="46" height="55" />
          <text x="70" y="170" textAnchor="middle" className="donrayo-tile donrayo-tile-gold">LA VOZ DEL RAYO</text>
        </pattern>
        <clipPath id={id("mouth")}><ellipse data-p="mclip" cx="260" cy="248" rx="21" ry="3" /></clipPath>
      </defs>

      {/* Photocall */}
      <rect width="720" height="900" fill={`url(#${id("wall")})`} />
      <rect width="720" height="900" fill={`url(#${id("tiles")})`} opacity="0.13" />
      <g transform="rotate(18 560 400)"><rect x="440" y="-200" width="14" height="1300" fill="#D5AF32" /><rect x="454" y="-200" width="400" height="1300" fill="#D20D17" /></g>
      <rect width="720" height="900" fill={`url(#${id("spot")})`} />

      {/* Rótulos */}
      <g transform="translate(28 26)">
        <rect width="196" height="36" fill="#000" x="4" y="4" /><rect width="196" height="36" fill="#D20D17" />
        <circle cx="18" cy="18" r="5" fill="#fff" />
        <text x="32" y="26" className="donrayo-badge">RUEDA DE PRENSA</text>
        <text x="0" y="66" className="donrayo-voz">LA VOZ <tspan fill="#D5AF32">⚡</tspan> DEL RAYO</text>
      </g>
      {score && (
        <g transform="translate(546 26)">
          <rect width="146" height="46" rx="10" fill="rgba(0,0,0,0.72)" stroke="rgba(213,175,50,0.6)" strokeWidth="1.5" />
          <image href="/escudo.png" x="12" y="7" width="28" height="33" />
          <text x="94" y="33" textAnchor="middle" className="donrayo-score">{score}</text>
          <text x="73" y="64" textAnchor="middle" className="donrayo-final">FINAL</text>
        </g>
      )}

      {/* Don Rayo */}
      <g transform="translate(55 128) scale(1.115)">
        <g data-p="body">
          <path d="M60 470 C70 380 130 335 200 322 L320 322 C390 335 450 380 460 470 Z" fill={`url(#${id("suit")})`} />
          <path d="M222 322 L260 420 L298 322 Z" fill="#f4f1ea" />
          <path d="M248 335 L272 335 L280 420 L260 445 L240 420 Z" fill="#D20D17" />
          <path d="M248 335 L272 335 L266 352 L254 352 Z" fill="#A80A12" />
          <path d="M200 322 L262 450 L232 470 L170 340 Z" fill="#26262b" />
          <path d="M320 322 L258 450 L288 470 L350 340 Z" fill="#26262b" />
          <g transform="translate(330 395)"><circle r="13" fill="#D5AF32" /><path d="M2 -9 L-6 2 L0 2 L-3 10 L6 -2 L0 -2 Z" fill="#111" /></g>
          <path d="M168 318 C210 300 310 300 352 318 L360 345 C310 330 210 330 160 345 Z" fill={`url(#${id("scarf")})`} />
          <path d="M175 330 L150 455 L196 462 L214 336 Z" fill={`url(#${id("scarf")})`} />
          <path d="M150 455 L196 462" stroke="#D5AF32" strokeWidth="6" />
        </g>
        <g data-p="head">
          <rect x="226" y="270" width="68" height="58" fill="#d99a73" />
          <ellipse cx="160" cy="200" rx="20" ry="30" fill="#e7ad86" /><ellipse cx="360" cy="200" rx="20" ry="30" fill="#e7ad86" />
          <ellipse cx="163" cy="202" rx="9" ry="16" fill="#cf8f69" /><ellipse cx="357" cy="202" rx="9" ry="16" fill="#cf8f69" />
          <path d="M168 150 C168 80 210 52 260 52 C310 52 352 80 352 150 L352 205 C352 268 310 304 260 304 C210 304 168 268 168 205 Z" fill={`url(#${id("skin")})`} />
          <ellipse cx="200" cy="225" rx="22" ry="14" fill="#e9877a" opacity=".45" /><ellipse cx="320" cy="225" rx="22" ry="14" fill="#e9877a" opacity=".45" />
          <path d="M166 175 C158 120 170 92 190 80 C182 110 184 140 190 172 Z" fill="#cfcac2" />
          <path d="M354 175 C362 120 350 92 330 80 C338 110 336 140 330 172 Z" fill="#cfcac2" />
          <path d="M196 86 C230 62 300 60 330 84 C300 74 250 76 214 96 Z" fill="#dcd7cf" opacity=".9" />
          <ellipse cx="236" cy="78" rx="26" ry="9" fill="#fff" opacity=".28" />
          <g data-p="browL"><path d="M196 142 C210 126 236 124 248 134 L246 144 C232 138 214 140 200 150 Z" fill="#e8e4dc" stroke="#9a948b" strokeWidth="2" /></g>
          <g data-p="browR"><path d="M324 142 C310 126 284 124 272 134 L274 144 C288 138 306 140 320 150 Z" fill="#e8e4dc" stroke="#9a948b" strokeWidth="2" /></g>
          <ellipse cx="222" cy="172" rx="13" ry="11" fill="#fff" /><circle cx="224" cy="173" r="6.5" fill="#2a1d14" /><circle cx="226" cy="170" r="2" fill="#fff" />
          <ellipse cx="298" cy="172" rx="13" ry="11" fill="#fff" /><circle cx="296" cy="173" r="6.5" fill="#2a1d14" /><circle cx="298" cy="170" r="2" fill="#fff" />
          <rect data-p="lidL" x="206" y="158" width="32" height="0" fill="#e9b28b" />
          <rect data-p="lidR" x="282" y="158" width="32" height="0" fill="#e9b28b" />
          <g fill="none" stroke="#c99a22" strokeWidth="4">
            <rect x="196" y="152" width="54" height="40" rx="12" /><rect x="270" y="152" width="54" height="40" rx="12" />
            <path d="M250 166 C256 160 264 160 270 166" /><path d="M196 164 L170 158" /><path d="M324 164 L350 158" />
          </g>
          <path d="M260 178 C252 200 240 214 246 224 C252 232 268 232 274 224 C280 214 268 200 260 178 Z" fill="#e09a73" />
          <ellipse cx="252" cy="223" rx="4" ry="3" fill="#b9714f" /><ellipse cx="268" cy="223" rx="4" ry="3" fill="#b9714f" />
          <ellipse data-p="mo" cx="260" cy="248" rx="21" ry="3" fill="#4a1414" />
          <g clipPath={`url(#${id("mouth")})`}>
            <rect data-p="teeth" x="230" y="245" width="60" height="9" fill="#fbf7ee" />
            <ellipse data-p="tongue" cx="260" cy="262" rx="15" ry="8" fill="#d7545a" />
          </g>
          <path d="M238 284 C250 290 270 290 282 284" stroke="#c98b65" strokeWidth="3" fill="none" />
          <g data-p="stache">
            <path d="M260 230 C246 222 222 222 206 236 C194 246 190 262 176 262 C190 276 220 262 236 252 C246 246 254 244 260 246 C266 244 274 246 284 252 C300 262 330 276 344 262 C330 262 326 246 314 236 C298 222 274 222 260 230 Z" fill="#ece8e0" stroke="#a9a399" strokeWidth="2.5" />
            <path d="M224 240 C232 236 244 236 252 240 M268 240 C276 236 288 236 296 240" stroke="#bdb7ad" strokeWidth="2" fill="none" />
          </g>
        </g>
      </g>

      {/* Mesa, micros y cartel */}
      <rect x="0" y="622" width="720" height="290" fill={`url(#${id("table")})`} />
      <rect x="0" y="622" width="720" height="5" fill="#D5AF32" />
      <g transform="translate(222 622) rotate(14)">
        <rect x="-6" y="-46" width="12" height="46" rx="3" fill="#222" /><rect x="-17" y="-80" width="34" height="42" rx="17" fill="#2b2b2b" stroke="#444" strokeWidth="2" />
        <rect x="-23" y="-40" width="46" height="20" rx="4" fill="#D20D17" /><text x="0" y="-26" textAnchor="middle" className="donrayo-mic">LA VOZ</text>
      </g>
      <g transform="translate(470 622) rotate(-12)">
        <rect x="-6" y="-52" width="12" height="52" rx="3" fill="#222" /><rect x="-17" y="-86" width="34" height="42" rx="17" fill="#2b2b2b" stroke="#444" strokeWidth="2" />
        <rect x="-23" y="-46" width="46" height="20" rx="4" fill="#D5AF32" /><text x="0" y="-32" textAnchor="middle" className="donrayo-mic" fill="#111">RVA TV</text>
      </g>
      <path d="M578 560 h40 v58 a8 8 0 0 1 -8 8 h-24 a8 8 0 0 1 -8 -8 Z" fill="rgba(180,210,255,0.12)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
      <g transform="translate(360 642)">
        <rect x="-82" y="0" width="164" height="58" fill="#f8f4ea" /><rect x="-82" y="54" width="164" height="4" fill="#D20D17" />
        <text x="0" y="30" textAnchor="middle" className="donrayo-plate">D. RAYO</text>
        <text x="0" y="47" textAnchor="middle" className="donrayo-plate-sub">PRESIDENTE</text>
      </g>
    </svg>
  );
}
