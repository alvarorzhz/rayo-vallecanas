"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { hasTouched, locutorOn, locutorSupported, sayHello, setLocutor, stopLocutor, subscribeLocutor, unlockLocutor } from "@/components/matches/locutor";

/**
 * 4.22.0 · Botón del locutor bajo el marcador en directo: encendido por defecto, se silencia con un toque.
 * Mientras no hayas tocado la pantalla, el navegador no deja sonar nada: entonces invita a tocar.
 */
const snap = () => `${locutorOn() ? 1 : 0}${hasTouched() ? 1 : 0}`;

export function LocutorToggle({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const state = useSyncExternalStore(subscribeLocutor, snap, () => "11");
  const on = state[0] === "1";
  const touched = state[1] === "1";
  useEffect(() => {
    setMounted(true);
    // Cualquier toque en la pantalla vale para desbloquear el sonido
    const unlock = () => unlockLocutor();
    document.addEventListener("pointerdown", unlock, { once: true, capture: true });
    document.addEventListener("keydown", unlock, { once: true, capture: true });
    return () => { document.removeEventListener("pointerdown", unlock, true); document.removeEventListener("keydown", unlock, true); };
  }, []);
  if (!mounted || !locutorSupported()) return null;

  const click = () => {
    unlockLocutor();
    if (on && touched) { setLocutor(false); stopLocutor(); return; }
    setLocutor(true);
    sayHello();
  };
  const label = !on ? "Locutor silenciado" : touched ? "Locutor" : "Toca para oír al locutor";
  return (
    <button type="button" onClick={click} aria-pressed={on}
      title={on ? "Silenciar al locutor" : "Activar al locutor"}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 transition ${on ? "bg-white/10 text-white ring-white/25 hover:bg-white/20" : "bg-black/30 text-white/60 ring-white/10 hover:text-white"} ${className}`}>
      {on ? <Volume2 size={14} aria-hidden /> : <VolumeX size={14} aria-hidden />}
      {label}
    </button>
  );
}
