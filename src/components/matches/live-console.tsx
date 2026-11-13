"use client";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Flag, Play, RotateCcw, Trash2, X } from "lucide-react";
import { Jersey } from "@/components/squad/jersey";
import { Crest } from "@/components/matches/crest";
import { addLiveEvent, deleteLiveEvent, finishLive, resetLive, startHalf, type LiveState } from "@/app/(app)/partidos/live-actions";
import { clockLabel, KIND_ICON, liveClock, type LiveKind } from "@/lib/live";
import type { LiveView } from "@/lib/live-queries";
import { CLUB_SHORT, rivalShort, type Rival } from "@/lib/matches";

export type LivePlayer = { id: string; name: string; number: number | null; gk: boolean; going: boolean };

type Sheet =
  | { kind: "goal"; step: "scorer" }
  | { kind: "goal"; step: "assist"; scorer: string }
  | { kind: "yellow" | "red"; step: "player" };

/**
 * El acta en vivo desde la banda: botones grandes para apuntar goles, asistencias y tarjetas.
 * Todo lo apuntado sale al momento en Inicio y, al pitido final, rellena el acta.
 */
export function LiveConsole({ matchId, home, rival, view, players }: { matchId: string; home: boolean; rival: Rival; view: LiveView; players: LivePlayer[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<LiveState>();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  const clock = liveClock({ live_started_at: view.started, live_second_at: view.second }, now);
  const run = (fn: () => Promise<LiveState>) => start(async () => {
    const r = await fn();
    setMsg(r?.error ? r : undefined);
  });
  const add = (kind: LiveKind, extra: { player_id?: string | null; assist_id?: string | null; own_goal?: boolean } = {}) => {
    setSheet(null);
    run(() => addLiveEvent(matchId, { kind, ...extra }));
  };

  const us = { name: CLUB_SHORT, goals: view.gf, us: true };
  const them = { name: rivalShort(rival), goals: view.ga, us: false };
  const [a, b] = home ? [us, them] : [them, us];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Marcador */}
      <section className="franja relative overflow-hidden rounded-3xl bg-negro p-4 text-white shadow-xl sm:p-6">
        <div className="relative flex items-center justify-between gap-2">
          {[a, b].map((t, i) => (
            <div key={i} className={`flex min-w-0 flex-1 flex-col items-center gap-1 ${i === 1 ? "order-3" : ""}`}>
              <Crest us={t.us} rival={rival} size={44} />
              <span className="sport w-full truncate text-center text-lg font-black">{t.name}</span>
            </div>
          ))}
          <div className="order-2 flex shrink-0 flex-col items-center">
            <div className="flex items-center gap-2 rounded-2xl bg-black/60 px-4 py-2 ring-1 ring-dorado/40" aria-live="polite" aria-label={`Marcador ${a.name} ${a.goals}, ${b.name} ${b.goals}`}>
              <span className="sport text-6xl font-black tabular-nums leading-none">{a.goals}</span>
              <span className="sport text-3xl font-black text-white/40">-</span>
              <span className="sport text-6xl font-black tabular-nums leading-none">{b.goals}</span>
            </div>
            <span className="sport mt-2 flex items-center gap-1.5 rounded-md bg-rojo px-2 py-0.5 text-lg font-black">
              {clock ? <><span className="md-live-dot" aria-hidden /> {clock.half === 2 ? "2ª parte" : "1ª parte"} · {clock.minute}&apos;</> : "Sin empezar"}
            </span>
          </div>
        </div>
      </section>

      {msg?.error && <p role="alert" className="rounded-xl bg-rojo/10 px-3 py-2 text-sm font-semibold text-rojo">{msg.error}</p>}

      {!view.started ? (
        <section className="card space-y-3 text-center">
          <p className="text-sm text-negro/70">Cuando el árbitro pite, dale aquí. Desde ese momento todo el equipo ve el marcador en Inicio, al momento.</p>
          <button type="button" disabled={pending} onClick={() => run(() => startHalf(matchId, 1))} className="btn-primary w-full py-4 text-lg">
            <Play size={20} className="fill-white" /> Empieza el partido
          </button>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <BigButton tone="bg-gradient-to-br from-rojo to-rojo-oscuro text-white" disabled={pending} onClick={() => setSheet({ kind: "goal", step: "scorer" })} icon="⚽" label="Gol del Rayo" />
            <BigButton tone="bg-negro text-white" disabled={pending} onClick={() => add("goal_against")} icon="🥅" label="Gol del rival" />
            <BigButton tone="bg-amber-400 text-negro" disabled={pending} onClick={() => setSheet({ kind: "yellow", step: "player" })} icon="🟨" label="Amarilla" />
            <BigButton tone="bg-white text-rojo ring-2 ring-rojo" disabled={pending} onClick={() => setSheet({ kind: "red", step: "player" })} icon="🟥" label="Roja" />
          </section>
          <div className="flex flex-wrap gap-2">
            {!view.second && (
              <button type="button" disabled={pending} onClick={() => run(() => startHalf(matchId, 2))} className="btn-ghost flex-1"><Play size={16} className="text-rojo" /> Empieza la 2ª parte</button>
            )}
            <button type="button" disabled={pending} onClick={() => setFinishing(true)} className="btn-primary flex-1"><Flag size={16} /> Final del partido</button>
          </div>
        </>
      )}

      {/* Lo apuntado, lo último arriba */}
      <section className="card">
        <h2 className="mb-2 text-base">Lo que va pasando</h2>
        {view.events.length === 0 ? (
          <p className="text-sm text-negro/65">{view.started ? "Aún no hay nada apuntado." : "Nada todavía."}</p>
        ) : (
          <ol className="space-y-1.5">
            {[...view.events].reverse().map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-xl bg-gris px-2 py-1.5 text-sm">
                <span className="sport w-12 shrink-0 text-center font-black tabular-nums text-negro/70">{clockLabel(e)}</span>
                <span aria-hidden className="text-lg leading-none">{KIND_ICON[e.kind]}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{e.text}</span>
                <button type="button" disabled={pending} aria-label={`Borrar: ${e.text}`} className="rounded-lg p-1.5 text-negro/50 hover:bg-rojo/10 hover:text-rojo"
                  onClick={() => { if (confirm(`¿Borrar «${e.text}»?`)) run(() => deleteLiveEvent(matchId, e.id)); }}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {view.started && (
        <button type="button" disabled={pending} className="btn-ghost text-sm text-negro/60"
          onClick={() => { if (confirm("¿Empezar de cero? Se borra todo lo apuntado y el pitido inicial.")) run(() => resetLive(matchId)); }}>
          <RotateCcw size={15} /> Empezar de cero
        </button>
      )}

      {sheet && (
        <PlayerSheet
          title={sheet.kind === "goal" ? (sheet.step === "scorer" ? "⚽ ¿Quién ha marcado?" : "🎯 ¿Quién ha dado la asistencia?") : sheet.kind === "yellow" ? "🟨 Amarilla a…" : "🟥 Roja a…"}
          players={sheet.step === "assist" ? players.filter((p) => p.id !== sheet.scorer) : players}
          onClose={() => setSheet(null)}
          onPick={(id) => {
            if (sheet.kind === "goal" && sheet.step === "scorer") setSheet({ kind: "goal", step: "assist", scorer: id });
            else if (sheet.kind === "goal" && sheet.step === "assist") add("goal", { player_id: sheet.scorer, assist_id: id });
            else add(sheet.kind, { player_id: id });
          }}
          extra={sheet.kind === "goal" ? (
            sheet.step === "scorer" ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn-ghost" onClick={() => add("goal", { own_goal: true })}>En propia (del rival)</button>
                <button type="button" className="btn-ghost" onClick={() => add("goal")}>Sin apuntar autor</button>
              </div>
            ) : (
              <button type="button" className="btn-primary w-full" onClick={() => add("goal", { player_id: sheet.scorer })}>Sin asistencia</button>
            )
          ) : null}
        />
      )}

      {finishing && (
        <FinishDialog score={`${a.name} ${a.goals} - ${b.goals} ${b.name}`} pending={pending} onClose={() => setFinishing(false)}
          onConfirm={(notify) => run(() => finishLive(matchId, notify))} />
      )}
    </div>
  );
}

function BigButton({ tone, icon, label, onClick, disabled }: { tone: string; icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl p-3 shadow-sm transition active:scale-95 disabled:opacity-60 ${tone}`}>
      <span aria-hidden className="text-4xl leading-none">{icon}</span>
      <span className="sport text-xl font-black leading-tight">{label}</span>
    </button>
  );
}

/** Hoja para elegir jugador: primero los que van al partido, luego el resto de la plantilla. */
function PlayerSheet({ title, players, onPick, onClose, extra }: { title: string; players: LivePlayer[]; onPick: (id: string) => void; onClose: () => void; extra: React.ReactNode }) {
  const [all, setAll] = useState(false);
  const going = players.filter((p) => p.going);
  const list = all || going.length === 0 ? players : going;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="anim-rise max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="sport text-2xl font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 hover:bg-gris"><X size={20} /></button>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p.id)} className="flex w-full items-center gap-2 rounded-2xl bg-gris p-2 text-left ring-1 ring-black/5 transition hover:ring-rojo active:scale-95">
                <Jersey number={p.number} goalkeeper={p.gk} size={34} />
                <span className="min-w-0 truncate font-bold">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {!all && going.length > 0 && going.length < players.length && (
          <button type="button" onClick={() => setAll(true)} className="mt-2 text-sm font-bold text-rojo hover:underline">Ver toda la plantilla</button>
        )}
        {extra && <div className="mt-3">{extra}</div>}
      </div>
    </div>,
    document.body,
  );
}

function FinishDialog({ score, pending, onClose, onConfirm }: { score: string; pending: boolean; onClose: () => void; onConfirm: (notify: boolean) => void }) {
  const [notify, setNotify] = useState(true);
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Final del partido" onClick={onClose}>
      <div className="anim-rise w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="sport text-2xl font-black">🏁 Final del partido</h2>
        <p className="sport rounded-xl bg-negro px-3 py-2 text-center text-2xl font-black text-white">{score}</p>
        <p className="text-sm text-negro/70">Se guarda este resultado y pasas al acta, ya rellena con lo apuntado. Revísala y guárdala: así se abre la votación del MVP.</p>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-[var(--color-rojo)]" /> Avisar al equipo del resultado
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">Seguir</button>
          <button type="button" disabled={pending} onClick={() => onConfirm(notify)} className="btn-primary flex-1">{pending ? "Guardando…" : "Terminar"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
