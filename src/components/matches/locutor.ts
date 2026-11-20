"use client";
import type { Line } from "@/lib/commentator";

/**
 * 4.22.0 · La voz del locutor y el rugido de la grada con lo que ya trae el móvil (síntesis de voz y
 * Web Audio del navegador): gratis, sin servicios externos y sin mandar nada fuera.
 * Se apaga y enciende desde el marcador en directo; la preferencia se guarda en este dispositivo.
 * Los navegadores solo dejan sonar algo después de que hayas tocado la pantalla una vez: por eso
 * el primer toque «desbloquea» la voz y el sonido (en iPhone es imprescindible).
 */
const KEY = "rv-locutor";
const EVENT = "rv-locutor";
const MAX_MS = 12_000;

const synth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);
export const locutorSupported = () => !!synth();

/** Si suena (por defecto, sí). Sin almacenamiento, vale lo último que se eligió en esta pantalla. */
let memory: boolean | null = null;
export function locutorOn(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return memory ?? true; }
}

export function setLocutor(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* sin almacenamiento: dura lo que la pantalla */ }
  memory = on;
  if (!on) stopLocutor();
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeLocutor(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

// ── Desbloqueo con el primer toque ──
let unlocked = false;
let ctx: AudioContext | null = null;
/**
 * 4.27.2 · Solo cuenta un toque con el marcador ya en pantalla (el que desbloquea la voz y el rugido).
 * Antes valía cualquier toque anterior (al llegar a Inicio desde otra pantalla): el botón decía «Locutor»
 * como si ya sonara, pero en iPhone la voz seguía bloqueada y en ningún móvil se oía la grada.
 */
export const hasTouched = () => unlocked;

export function unlockLocutor() {
  if (unlocked) return;
  unlocked = true;
  const s = synth();
  if (s) {
    // Una frase vacía y muda dentro del toque: a partir de ahí iOS deja hablar sin tocar
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    try { s.speak(u); } catch { /* nada */ }
  }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) { ctx ??= new AC(); void ctx.resume(); }
  } catch { /* sin Web Audio: solo la voz */ }
  window.dispatchEvent(new Event(EVENT));
}

// ── Voz ──
function spanishVoice(): SpeechSynthesisVoice | null {
  const vs = synth()?.getVoices() ?? [];
  const es = vs.filter((v) => v.lang?.toLowerCase().startsWith("es"));
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang.toLowerCase() === "es-es" ? 4 : 0) + (/google|natural|neural|premium|enhanced|mejorad/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  return es.sort((a, b) => score(b) - score(a))[0] ?? null;
}

export function stopLocutor() {
  try { synth()?.cancel(); } catch { /* nada */ }
  try { roar?.stop(); } catch { /* ya parado */ }
  roar = null;
}

/** El rugido de la grada: ruido filtrado que sube y se apaga, unos 4 segundos, por debajo de la voz. */
let roar: AudioBufferSourceNode | null = null;
function crowdRoar() {
  if (!ctx || ctx.state !== "running") return;
  const secs = 4.5;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * secs), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    // Ruido «marrón» (más grave que el blanco): suena a gente a lo lejos y no a interferencia
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 700;
  band.Q.value = 0.5;
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.5, t + 0.5);
  gain.gain.setValueAtTime(0.5, t + 1.6);
  gain.gain.exponentialRampToValueAtTime(0.18, t + 2.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + secs);
  src.connect(band).connect(gain).connect(ctx.destination);
  src.start();
  roar = src;
}

/**
 * Canta el gol. Devuelve cuándo ha terminado (o a los 12 s como mucho, por si el navegador no avisa).
 * No hace nada si está silenciado o el navegador no tiene voz.
 */
export function narrate(lines: Line[], crowd = true): Promise<void> {
  const s = synth();
  if (!s || !lines.length || !locutorOn()) return Promise.resolve();
  stopLocutor();
  if (crowd) crowdRoar();
  const voice = spanishVoice();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(t); resolve(); };
    const t = setTimeout(done, MAX_MS);
    lines.forEach((l, i) => {
      const u = new SpeechSynthesisUtterance(l.text);
      u.lang = voice?.lang ?? "es-ES";
      if (voice) u.voice = voice;
      u.rate = l.rate;
      u.pitch = l.pitch;
      u.volume = 1;
      if (i === lines.length - 1) { u.onend = done; u.onerror = done; }
      s.speak(u);
    });
  });
}

/** Al activar el locutor a mano (eso ya es un toque), se presenta: así se oye que funciona. */
export function sayHello() {
  void narrate([{ text: "¡Locutor activado! Aquí se cantan los goles del Rayo.", rate: 1.1, pitch: 1.1 }], false);
}
