"use client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { Bell, DownloadCloud, Star, Trash2 } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { Jersey } from "@/components/squad/jersey";
import { LINES, lineOf, shirtName } from "@/lib/squad";
import { CLUB_NAME, type MatchRow } from "@/lib/matches";
import { emptyApp, type DraftApp, type ReportDraft, type ReportPlayer } from "@/lib/reports";
import type { PrefillResult, ReportState } from "@/app/(app)/partidos/report-actions";

type A = (s: ReportState, f: FormData) => Promise<ReportState>;

function Toggle({ on, onClick, children, tone = "bg-negro text-white ring-negro", label }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: string; label?: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onClick}
      className={`sport rounded-lg px-2.5 py-1 text-sm font-black ring-1 transition active:scale-95 ${on ? tone : "bg-white text-negro/60 ring-black/15 hover:ring-black/30"}`}>
      {children}
    </button>
  );
}

/** El acta: quién jugó, goles con asistencia, tarjetas, encajados y MVP. */
export function ReportEditor({ action, prefill, match, pool, initial }: {
  action: A;
  prefill: (() => Promise<PrefillResult>) | null;
  match: MatchRow;
  pool: ReportPlayer[];
  initial: ReportDraft;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [pending, start] = useTransition();
  const [loading, startLoad] = useTransition();
  const [info, setInfo] = useState<{ error?: string; ok?: string }>();
  const [apps, setApps] = useState<Record<string, DraftApp>>(initial.apps);
  const goalsFor = match.goals_for ?? 0;
  const [goals, setGoals] = useState(() => Array.from({ length: goalsFor }, (_, i) => initial.goals[i] ?? { scorer: "", assist: "" }));
  const [mvp, setMvp] = useState(initial.mvp);

  const played = useMemo(() => pool.filter((p) => apps[p.player_id]), [pool, apps]);
  const starters = played.filter((p) => apps[p.player_id].started).length;
  const gks = played.filter((p) => apps[p.player_id].goalkeeper);
  const concededSum = gks.reduce((n, p) => n + apps[p.player_id].conceded, 0);
  const named = goals.filter((g) => g.scorer).length;

  const setApp = (id: string, patch: Partial<DraftApp>) => setApps((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyApp()), ...patch } }));
  function togglePlayed(p: ReportPlayer) {
    const id = p.player_id;
    if (apps[id]) {
      const next = { ...apps };
      delete next[id];
      setApps(next);
      setGoals((gs) => gs.map((g) => ({ scorer: g.scorer === id ? "" : g.scorer, assist: g.assist === id ? "" : g.assist })));
      if (mvp === id) setMvp("");
    } else {
      const gk = lineOf(p.position) === "GK" && !Object.values(apps).some((a) => a.goalkeeper);
      setApps({ ...apps, [id]: { ...emptyApp(), goalkeeper: gk, conceded: gk ? match.goals_against ?? 0 : 0 } });
    }
  }
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("payload", JSON.stringify({ apps, goals, mvp } satisfies ReportDraft));
    start(() => formAction(fd));
  }
  function loadLeague() {
    if (!prefill) return;
    if (Object.keys(apps).length && !confirm("Se sustituirá lo que hayas marcado por lo que diga la liga. ¿Seguir?")) return;
    startLoad(async () => {
      const r = await prefill();
      setInfo({ error: r.error, ok: r.ok });
      if (r.draft) {
        setApps(r.draft.apps);
        setGoals(Array.from({ length: goalsFor }, (_, i) => r.draft!.goals[i] ?? { scorer: "", assist: "" }));
        if (r.draft.mvp && r.draft.apps[r.draft.mvp]) setMvp(r.draft.mvp);
      }
    });
  }

  const option = (p: ReportPlayer) => <option key={p.player_id} value={p.player_id}>{p.number != null ? `${p.number} · ` : ""}{shirtName(p.player)}</option>;

  return (
    <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>Quién jugó</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="badge bg-negro text-white">{played.length} jugaron</span>
              <span className={`badge ${starters > 7 ? "bg-rojo/10 text-rojo" : "bg-gris text-negro"}`}>{starters} titulares</span>
            </div>
          </div>
          {starters > 7 && <p className="text-sm font-semibold text-rojo">En fútbol 7 salen 7 de titulares: revisa los marcados.</p>}
          {LINES.map((l) => {
            const rows = pool.filter((p) => lineOf(p.position) === l.key);
            if (!rows.length) return null;
            return (
              <fieldset key={l.key}>
                <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-negro/65">{l.plural}</legend>
                <ul className="space-y-2">
                  {rows.map((p) => {
                    const a = apps[p.player_id];
                    return (
                      <li key={p.player_id} className={`rounded-2xl p-2 ring-1 transition ${a ? "bg-white ring-2 ring-rojo" : "bg-gris ring-black/5"}`}>
                        <label className="flex cursor-pointer items-center gap-3">
                          <input type="checkbox" checked={!!a} onChange={() => togglePlayed(p)} className="h-5 w-5 shrink-0 accent-[var(--color-rojo)]" />
                          <Jersey number={p.number} goalkeeper={a ? a.goalkeeper : l.key === "GK"} size={30} dim={!a} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-bold">{shirtName(p.player)}</span>
                            <span className="block text-xs text-negro/65">{p.position}</span>
                          </span>
                        </label>
                        {a && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-8">
                            <Toggle on={a.started} onClick={() => setApp(p.player_id, { started: !a.started })}>Titular</Toggle>
                            <Toggle on={a.goalkeeper} tone="bg-dorado text-negro ring-dorado" onClick={() => setApp(p.player_id, { goalkeeper: !a.goalkeeper, conceded: a.goalkeeper ? 0 : a.conceded })}>Portero</Toggle>
                            {a.goalkeeper && (
                              <label className="inline-flex items-center gap-1 text-xs font-bold">
                                Encajó
                                <input type="number" min={0} max={99} inputMode="numeric" value={a.conceded} aria-label={`Goles encajados por ${shirtName(p.player)}`}
                                  onChange={(e) => setApp(p.player_id, { conceded: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })}
                                  className="input sport w-14 px-2 py-1 text-center text-base font-black" />
                              </label>
                            )}
                            <Toggle on={a.yellows > 0} tone="bg-amber-400 text-negro ring-amber-500" label={`Amarillas: ${a.yellows}`}
                              onClick={() => setApp(p.player_id, { yellows: (a.yellows + 1) % 3, red: a.yellows + 1 === 2 ? true : a.red })}>
                              🟨{a.yellows > 1 ? " ×2" : ""}
                            </Toggle>
                            <Toggle on={a.red} tone="bg-rojo text-white ring-rojo" label="Roja" onClick={() => setApp(p.player_id, { red: !a.red })}>🟥</Toggle>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
          {gks.length > 0 && concededSum !== (match.goals_against ?? 0) && (
            <p className="text-sm text-amber-800">Los porteros suman {concededSum} goles encajados y el marcador dice {match.goals_against}.</p>
          )}
        </section>

        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>⚽ Nuestros goles</h2>
            <span className="badge bg-gris text-negro">{named} de {goalsFor} con autor</span>
          </div>
          {goalsFor === 0 ? (
            <p className="text-sm text-negro/65">{CLUB_NAME} no marcó en este partido.</p>
          ) : played.length === 0 ? (
            <p className="text-sm text-negro/65">Marca primero quién jugó para poder elegir goleadores.</p>
          ) : (
            <ol className="space-y-2">
              {goals.map((g, i) => (
                <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-2xl bg-gris p-2 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)]">
                  <span className="sport flex h-8 w-8 items-center justify-center rounded-full bg-negro text-sm font-black text-white">{i + 1}</span>
                  <div>
                    <label className="sr-only" htmlFor={`g-${i}`}>Goleador del gol {i + 1}</label>
                    <select id={`g-${i}`} value={g.scorer} className="input py-2"
                      onChange={(e) => setGoals((gs) => gs.map((x, k) => (k === i ? { scorer: e.target.value, assist: x.assist === e.target.value || e.target.value === "own" ? "" : x.assist } : x)))}>
                      <option value="">— Goleador sin apuntar —</option>
                      {played.map(option)}
                      <option value="own">En propia puerta (del rival)</option>
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="sr-only" htmlFor={`a-${i}`}>Asistencia del gol {i + 1}</label>
                    <select id={`a-${i}`} value={g.assist} disabled={g.scorer === "own"} className="input py-2"
                      onChange={(e) => setGoals((gs) => gs.map((x, k) => (k === i ? { ...x, assist: e.target.value } : x)))}>
                      <option value="">Sin asistencia</option>
                      {played.filter((p) => p.player_id !== g.scorer).map(option)}
                    </select>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2"><Star size={18} className="fill-dorado text-dorado" /> MVP</h2>
          {played.length === 0 ? <p className="text-sm text-negro/65">Marca quién jugó para elegir al mejor.</p> : (
            <div role="radiogroup" aria-label="Mejor jugador del partido" className="grid grid-cols-2 gap-2">
              {played.map((p) => (
                <label key={p.player_id} className={`flex cursor-pointer items-center gap-2 rounded-xl p-2 text-sm font-bold ring-1 ${mvp === p.player_id ? "bg-negro text-white ring-dorado ring-2" : "bg-white ring-black/10"}`}>
                  <input type="radio" name="mvp" value={p.player_id} checked={mvp === p.player_id} onChange={() => setMvp(p.player_id)} className="sr-only" />
                  {mvp === p.player_id ? <Star size={16} className="shrink-0 fill-dorado text-dorado" /> : <span className="sport w-4 shrink-0 text-center text-xs text-negro/50">{p.number ?? ""}</span>}
                  <span className="truncate">{shirtName(p.player)}</span>
                </label>
              ))}
              {mvp && <button type="button" className="col-span-2 text-xs font-bold text-negro/65 underline" onClick={() => setMvp("")}>Quitar MVP</button>}
            </div>
          )}
        </section>

        {prefill && (
          <section className="card space-y-2">
            <h2>Desde la liga</h2>
            <p className="text-xs text-negro/65">Trae quién jugó, los goles que tenga apuntados, lo que encajó el portero y las tarjetas. Titulares, asistencias y MVP los pones tú.</p>
            <button type="button" onClick={loadLeague} disabled={loading} className="btn-ghost w-full"><DownloadCloud size={16} className="text-rojo" /> {loading ? "Leyendo la liga…" : "Rellenar con la liga"}</button>
            <FormMessage state={info} />
          </section>
        )}

        <section className="card space-y-3">
          {!match.report_saved_at && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-[var(--color-rojo)]" />
              <Bell size={15} className="text-rojo" /> Avisar al equipo (goleadores y MVP)
            </label>
          )}
          <FormMessage state={state} />
          <button type="submit" disabled={pending} className="btn-primary w-full">{pending ? "Guardando…" : match.report_saved_at ? "Guardar cambios" : "Guardar acta"}</button>
          <p className="text-xs text-negro/65">Las estadísticas de los cromos se recalculan solas al guardar.</p>
        </section>
      </aside>
    </form>
  );
}

export function DeleteReportButton({ action }: { action: () => Promise<ReportState> }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ReportState>();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className="btn-ghost text-rojo"
        onClick={() => { if (confirm("¿Borrar el acta? Las estadísticas de este partido dejarán de contar.")) start(async () => setState(await action())); }}>
        <Trash2 size={16} /> {pending ? "Borrando…" : "Borrar acta"}
      </button>
      <FormMessage state={state} />
    </div>
  );
}
