"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Home, Settings, Shirt, Sparkles, Ticket, Trophy, UserRound, Wallet, X, Newspaper } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TourStep } from "@/lib/tour";
import { APP_VERSION } from "@/lib/changelog";

const ICONS = { Sparkles, Home, CalendarDays, Shirt, Ticket, Wallet, Settings, UserRound, Trophy, Newspaper };
const KEY = "rv-tutorial-visto";
/** Evento para volver a lanzar el tutorial desde cualquier botón (ver TourButton). */
const TOUR_EVENT = "rv-tutorial";

type Rect = { top: number; left: number; width: number; height: number };

function seenHere(version: number) {
  try {
    return Number(localStorage.getItem(KEY)) >= version;
  } catch {
    return false;
  }
}

/** El elemento del menú que se ve ahora (en el móvil la barra de abajo, en el ordenador el lateral). */
function findTarget(target: string): Rect | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

/** Tutorial de bienvenida: la primera vez que alguien entra le enseña la app página a página. */
export function Tour({ steps, version, seen }: { steps: TourStep[]; version: number; seen: number }) {
  const router = useRouter();
  const path = usePathname();
  const [i, setI] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (seen < version && !seenHere(version)) setI(0);
    const start = () => setI(0);
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, [seen, version]);

  const finish = useCallback(() => {
    setI(null);
    setRect(null);
    try {
      localStorage.setItem(KEY, String(version));
      // Las novedades de esta versión ya las cuenta el propio recorrido
      localStorage.setItem("rv-version-vista", APP_VERSION);
    } catch {}
    if (seen >= version) return;
    // Se guarda en la cuenta para que no vuelva a salir en otros móviles u ordenadores
    const supabase = createClient();
    supabase.auth
      .updateUser({ data: { tutorial: version } })
      .then(({ error }) => (error ? null : supabase.auth.refreshSession()))
      .catch(() => {});
  }, [seen, version]);

  const step = i === null ? null : steps[i];

  // Lleva a la página del paso
  useEffect(() => {
    if (step?.href && step.href !== path && !(step.href === "/admin" && path.startsWith("/admin"))) router.push(step.href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.key]);

  // Resalta el botón del menú del paso y lo sigue si cambia el tamaño de la pantalla
  useLayoutEffect(() => {
    if (!step?.target) {
      setRect(null);
      return;
    }
    const update = () => setRect(findTarget(step.target!));
    update();
    const t = setInterval(update, 400);
    window.addEventListener("resize", update);
    return () => {
      clearInterval(t);
      window.removeEventListener("resize", update);
    };
  }, [step?.target, path]);

  // Al abrirse, el foco entra en la ventana (con Tab se llega a los botones; con las flechas se avanza)
  const open = i !== null;
  useEffect(() => {
    if (open) box.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (i === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") {
        if (i + 1 < steps.length) setI(i + 1);
        else finish();
      }
      else if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, steps.length, finish]);

  if (i === null || !step) return null;
  const Icon = ICONS[step.icon];
  const last = i === steps.length - 1;
  const centered = i === 0 || last;
  const next = () => (last ? finish() : setI(i + 1));
  const pad = 6;

  return (
    <div id="rv-tour" ref={box} tabIndex={-1} style={{ outline: "none" }} className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
      {/* Capa que oscurece y bloquea la página; si hay botón resaltado, se le abre un hueco */}
      <div className={`absolute inset-0 transition-colors ${rect ? "bg-transparent" : centered ? "bg-black/60" : "bg-black/45"}`} />
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl border-[3px] border-dorado transition-all duration-300 ease-out"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(8,8,8,0.5), 0 0 24px 4px rgba(213,175,50,0.55)",
          }}
        />
      )}

      <div
        className={
          centered
            ? "absolute inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2"
            : "absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] mx-auto max-w-md lg:inset-x-auto lg:bottom-8 lg:left-[18rem] lg:mx-0 lg:w-[26rem]"
        }
      >
        <div className="animate-pop overflow-hidden rounded-2xl bg-negro text-white shadow-2xl ring-1 ring-white/10">
          <div className="franja relative px-5 pb-4 pt-5">
            <button onClick={finish} aria-label="Saltar el tutorial" className="absolute right-2 top-2 z-10 rounded-lg p-1.5 text-white/60 hover:text-white">
              <X size={18} />
            </button>
            <div className="relative flex items-center gap-3 pr-8">
              {i === 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/escudo.png" alt="" width={44} height={52} className="shrink-0 drop-shadow-lg" />
              ) : (
                <span className="flex h-11 w-11 shrink-0 -skew-x-[10deg] items-center justify-center rounded-xl bg-rojo shadow-lg">
                  <Icon size={22} className="skew-x-[10deg]" />
                </span>
              )}
              <div className="min-w-0">
                <p className="sport text-xs font-bold tracking-[0.2em] text-dorado">
                  {i === 0 ? "TUTORIAL" : last ? "FIN DEL RECORRIDO" : `PASO ${i} DE ${steps.length - 2}`}
                </p>
                <h2 id="tour-title" key={step.key} className="animate-fade-in sport text-2xl font-black leading-tight">{step.title}</h2>
              </div>
            </div>
          </div>
          <div className="px-5 pb-5">
            <div key={step.key} className="animate-fade-in">
            <p id="tour-text" className="text-[15px] text-white/85">{step.text}</p>
            {step.points && step.points.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-white/75">
                {step.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span aria-hidden className="mt-[7px] h-1.5 w-3 shrink-0 -skew-x-[25deg] bg-dorado" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            )}
            </div>
            <div className="mt-4 flex items-center gap-1" aria-hidden>
              {steps.map((s, n) => (
                <span key={s.key} className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-rojo" : n < i ? "w-2 bg-dorado" : "w-2 bg-white/20"}`} />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              {i === 0 ? (
                <button onClick={finish} className="btn flex-1 bg-white/10 text-white hover:bg-white/20">Saltar</button>
              ) : (
                !last && (
                  <button onClick={() => setI(i - 1)} className="btn bg-white/10 text-white hover:bg-white/20" aria-label="Paso anterior">
                    <ArrowLeft size={18} />
                  </button>
                )
              )}
              <button onClick={next} className="btn-primary flex-1">
                {i === 0 ? "Empezar recorrido" : last ? "¡Vamos!" : "Siguiente"} {!last && <ArrowRight size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Botón para repetir el tutorial (por ejemplo, desde «Mi perfil»). */
export function TourButton({ className = "btn-ghost w-full" }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}>
      <Sparkles size={18} /> Ver el tutorial otra vez
    </button>
  );
}
