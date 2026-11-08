import Link from "next/link";
import { CalendarPlus, ClipboardCheck, ClipboardList, Flame, MapPin, Megaphone, Star, Swords, Trophy } from "lucide-react";
import {
  CLUB_SHORT, COMPETITION_LABEL, hhmm, kickoffDate, longDay, mapsLink, matchShareText, outcomeOf, rivalShort, sides, streak,
  type MatchRow,
} from "@/lib/matches";
import { PHASE_TITLE, type MatchdayPhase } from "@/lib/matchday";
import { tally, type CallupRow } from "@/lib/callups";
import { lineOf, shirtName, type Player } from "@/lib/squad";
import type { ReportView } from "@/lib/reports";
import { Crest } from "@/components/matches/crest";
import { FormStrip, MatchLine } from "@/components/matches/match-bits";
import { MeetLine, MyCallupCard, callupOpen } from "@/components/matches/callup-section";
import { LineupPitch } from "@/components/matches/lineup-pitch";
import { ShareButton } from "@/components/matches/share-button";
import { ShareImageButton } from "@/components/matches/share-image";
import { Confetti, MatchdayCountdown } from "@/components/matches/matchday-fx";
import { Jersey } from "@/components/squad/jersey";
import { Ball } from "@/components/squad/ball";

const darkBtn = "btn bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20";

/** Portada del día de partido (y de la víspera) en Inicio. */
export function MatchdayHero({ m, phase, greeting }: { m: MatchRow; phase: MatchdayPhase; greeting: string }) {
  const [a, b] = sides(m, m.rival);
  const o = outcomeOf(m);
  const link = mapsLink(m);
  const time = hhmm(m.kickoff);
  const ticker = [
    PHASE_TITLE[phase],
    m.is_home ? `${m.rival.name} visita nuestro campo` : `Visitamos a ${m.rival.name}`,
    phase === "final" ? `${a.name} ${a.goals} - ${b.goals} ${b.name}` : time ? `Pitido inicial ${time}` : longDay(m.match_date),
    m.venue,
    "¡Aúpa Rayo! ⚡",
  ].filter(Boolean) as string[];

  const team = (t: typeof a, side: "left" | "right") => (
    <div className={`flex min-w-0 flex-1 flex-col items-center gap-2 text-center ${side === "left" ? "md-in-left" : "md-in-right"}`}>
      <span className="md-crest"><Crest us={t.us} rival={t.us ? null : m.rival} size={76} /></span>
      <span className="sport block w-full truncate text-xl font-black leading-tight sm:text-3xl">
        <span className="sm:hidden">{t.us ? CLUB_SHORT : rivalShort(m.rival)}</span>
        <span className="hidden sm:inline">{t.name}</span>
      </span>
    </div>
  );

  return (
    <section aria-label={`${PHASE_TITLE[phase]}: ${a.name} contra ${b.name}`} className="matchday relative mb-6 overflow-hidden rounded-3xl bg-negro text-white shadow-2xl ring-1 ring-dorado/20">
      {/* Fondo: focos del estadio, líneas del campo y la franja del Rayo */}
      <div aria-hidden className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(210,13,23,0.35),transparent_60%)]" />
        <span className="md-light md-light-l" />
        <span className="md-light md-light-r" />
        <svg className="absolute inset-x-0 bottom-0 h-1/2 w-full opacity-[0.07]" viewBox="0 0 400 200" preserveAspectRatio="none">
          <g fill="none" stroke="#fff" strokeWidth="2">
            <line x1="0" y1="2" x2="400" y2="2" /><circle cx="200" cy="2" r="60" /><rect x="120" y="140" width="160" height="60" /><rect x="165" y="178" width="70" height="22" />
          </g>
        </svg>
        <div className="franja anim-sweep absolute inset-0 opacity-60" />
      </div>
      {phase === "final" && o === "W" && <Confetti />}

      <div className="relative px-5 pb-4 pt-5 sm:px-8 sm:pt-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="sport text-sm font-bold tracking-[0.15em] text-white/80">{greeting}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em]">
            <span className="rounded bg-rojo px-1.5 py-0.5">{COMPETITION_LABEL[m.competition]}{m.round ? ` · ${m.round}` : ""}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5">{m.is_home ? "En casa 🏠" : "Fuera 🚌"}</span>
          </p>
        </div>
        <h1 className="mt-2 text-center">
          <span className={`md-title sport block font-black leading-[0.85] ${phase === "eve" ? "text-5xl sm:text-7xl" : "text-6xl sm:text-8xl"}`}>{PHASE_TITLE[phase]}</span>
          <span className="sr-only"> · {a.name} contra {b.name}</span>
        </h1>

        <div className="md-clash mt-5 flex items-center gap-2 sm:gap-6">
          {team(a, "left")}
          <div className="relative flex shrink-0 flex-col items-center">
            <span aria-hidden className="md-impact" />
            {phase === "final" ? (
              <div className="anim-score md-vs flex items-center gap-1.5 rounded-2xl bg-black/70 px-3 py-2 ring-1 ring-dorado/40 sm:px-5">
                <span className={`sport text-5xl font-black tabular-nums leading-none sm:text-7xl ${a.us && o === "W" ? "text-dorado" : ""}`}>{a.goals}</span>
                <span className="sport text-3xl font-black text-white/40 sm:text-5xl">-</span>
                <span className={`sport text-5xl font-black tabular-nums leading-none sm:text-7xl ${b.us && o === "W" ? "text-dorado" : ""}`}>{b.goals}</span>
              </div>
            ) : (
              <span className="md-vs sport text-4xl font-black italic text-white sm:text-6xl">VS</span>
            )}
            {phase !== "final" && time && <span className="sport md-vs mt-1 rounded-md bg-rojo px-2 py-0.5 text-xl font-black leading-none shadow-lg">{time}</span>}
          </div>
          {team(b, "right")}
        </div>

        <div className="mt-5 flex flex-col items-center gap-3">
          {(phase === "day" || phase === "eve") && m.kickoff && <MatchdayCountdown to={kickoffDate(m).toISOString()} />}
          {(phase === "day" || phase === "eve") && !m.kickoff && <p className="text-sm text-white/70">Hora por confirmar</p>}
          {phase === "live" && (
            <p className="sport flex items-center gap-2 text-2xl font-black text-white"><span className="md-live-dot" aria-hidden /> Partido en juego · ¡vamos Rayo!</p>
          )}
          {phase === "final" && o && (
            <p className={`sport text-2xl font-black sm:text-3xl ${o === "W" ? "text-dorado" : "text-white/90"}`}>
              {o === "W" ? <><Trophy size={26} className="anim-trophy mr-1 inline" /> ¡Victoria del Rayo!</> : o === "D" ? "Empate. ¡A por la próxima!" : "Derrota. ¡Levantaremos la cabeza!"}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/85">
            <span className="first-letter:uppercase">{longDay(m.match_date)}</span>
            {m.venue && <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-dorado" /> {m.venue}</span>}
          </div>
          {phase !== "final" && <MeetLine m={m} className="text-white/90" />}
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {phase !== "final" && link && <a href={link} target="_blank" rel="noopener" className="btn-primary"><MapPin size={17} /> Cómo llegar</a>}
            {phase === "final" && m.report_saved_at && <ShareImageButton url={`/api/partidos/${m.id}/imagen`} name={`resultado-${m.match_date}.png`} />}
            <Link href={`/partidos/${m.id}`} prefetch className={darkBtn}>{phase === "final" ? <><ClipboardCheck size={17} /> Ver acta</> : <>Ver partido</>}</Link>
            {phase === "eve" && <a href={`/api/partidos/${m.id}/calendario`} className={darkBtn}><CalendarPlus size={17} /> Calendario</a>}
            <ShareButton text={matchShareText(m)} label="WhatsApp" className={darkBtn} />
          </div>
        </div>
      </div>

      {/* Marcador LED que corre por abajo, como en la banda del estadio */}
      <div aria-hidden className="relative overflow-hidden border-t border-dorado/30 bg-rojo py-1.5">
        <div className="md-ticker sport flex w-max gap-8 whitespace-nowrap text-sm font-black tracking-widest">
          {[0, 1].map((k) => (
            <span key={k} className="flex gap-8">
              {[...ticker, ...ticker].map((t, i) => <span key={i} className="flex items-center gap-8"><span>{t}</span><span className="text-dorado">⚡</span></span>)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

type Scorer = { goals: number; number: number | null; position: string; player: Player };

/** Debajo de la portada: tu convocatoria, los convocados y la previa (o el resumen si ya se jugó). */
export function MatchdayDetails({ m, phase, callups, myPlayerId, canEdit, recent, lastH2H, topScorer, report }: {
  m: MatchRow; phase: MatchdayPhase; callups: CallupRow[]; myPlayerId: string | null; canEdit: boolean;
  recent: MatchRow[]; lastH2H: MatchRow | null; topScorer: Scorer | null; report: ReportView | null;
}) {
  const formRows = [...recent].filter((x) => x.id !== m.id).slice(0, 5).reverse();
  const run = streak(recent);

  if (phase === "final") {
    const ours = report?.goals.filter((g) => g.scorer) ?? [];
    const byScorer = new Map<string, { name: string; n: number }>();
    for (const g of ours) {
      const k = g.scorer!.player_id;
      byScorer.set(k, { name: shirtName(g.scorer!.player), n: (byScorer.get(k)?.n ?? 0) + 1 });
    }
    return (
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {report?.mvp ? (
          <div className="franja cromo-shine anim-rise relative flex items-center gap-4 overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-lg">
            <span className="relative anim-trophy"><Jersey number={report.mvp.number} goalkeeper={lineOf(report.mvp.position) === "GK"} size={60} /></span>
            <div className="relative min-w-0">
              <p className="sport flex items-center gap-1 text-xs font-black tracking-widest text-dorado"><Star size={13} className="fill-dorado" /> MVP del partido</p>
              <p className="sport truncate text-3xl font-black leading-tight">{shirtName(report.mvp.player)}</p>
            </div>
          </div>
        ) : (
          <div className="card anim-rise flex items-center gap-3 text-sm text-negro/70">
            <ClipboardCheck size={22} className="shrink-0 text-rojo" />
            <span className="flex-1">{m.report_saved_at ? "El acta ya está, pero sin MVP." : "Falta el acta: con ella salen los goleadores, el MVP y la imagen para compartir."}</span>
            {canEdit && !m.report_saved_at && <Link href={`/partidos/${m.id}/acta`} prefetch className="btn-primary shrink-0 px-3 py-1.5 text-sm">Rellenar</Link>}
          </div>
        )}
        <div className="card anim-rise" style={{ animationDelay: "80ms" }}>
          <h2 className="sport mb-2 flex items-center gap-2 text-lg font-black"><Ball size={18} /> Goles del Rayo</h2>
          {byScorer.size ? (
            <ul className="flex flex-wrap gap-2">
              {[...byScorer.values()].map((x) => (
                <li key={x.name} className="badge bg-gris text-negro">⚽ {x.name}{x.n > 1 ? ` ×${x.n}` : ""}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-negro/65">{(m.goals_for ?? 0) === 0 ? "Hoy no hubo goles nuestros." : "Los goleadores salen cuando se guarde el acta."}</p>
          )}
          {formRows.length > 0 && <div className="mt-3 text-negro"><FormStrip rows={[...formRows, m]} /></div>}
        </div>
      </div>
    );
  }

  const published = !!m.callup_published_at;
  const mine = callups.find((r) => r.player_id === myPlayerId) ?? null;
  const t = tally(callups);
  const placed = callups.filter((r) => r.slot != null);
  const going = callups.filter((r) => r.reply !== "no");

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="card anim-rise min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="sport flex items-center gap-2 text-xl font-black"><ClipboardList size={20} className="text-rojo" /> Convocatoria</h2>
          {published && <span className="badge bg-negro text-white">{t.total} convocados · ✅ {t.yes}</span>}
        </div>
        {!published ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gris p-3 text-sm text-negro/75">
            <span>La convocatoria aún no está publicada. Te avisaremos en cuanto salga.</span>
            {canEdit && <Link href={`/partidos/${m.id}/convocatoria`} prefetch className="btn-primary px-3 py-1.5 text-sm">Preparar</Link>}
          </div>
        ) : (
          <>
            {mine && callupOpen(m) && phase !== "live" && <MyCallupCard m={m} mine={mine} meet={false} />}
            {!mine && myPlayerId && (
              <p className="flex items-center gap-2 rounded-xl bg-gris p-3 text-sm font-medium"><Megaphone size={18} className="shrink-0 text-rojo" /> Esta vez no vas convocado. ¡A animar desde la banda!</p>
            )}
            {placed.length > 0 ? (
              <LineupPitch compact formation={m.formation} at={(n) => { const r = callups.find((x) => x.slot === n); return r ? { player: r.player, number: r.number } : null; }} />
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {going.map((r, i) => (
                  <li key={r.id} className={`anim-walkout flex items-center gap-2 rounded-xl bg-gris px-2 py-1.5 ${r.player_id === myPlayerId ? "ring-2 ring-dorado" : ""}`} style={{ animationDelay: `${i * 45}ms` }}>
                    <Jersey number={r.number} goalkeeper={lineOf(r.position) === "GK"} size={28} dim={r.reply === "pending"} />
                    <span className="min-w-0 truncate text-sm font-bold">{shirtName(r.player)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <section className="card anim-rise min-w-0 space-y-4" style={{ animationDelay: "80ms" }}>
        <h2 className="sport flex items-center gap-2 text-xl font-black"><Flame size={20} className="text-rojo" /> La previa</h2>
        {formRows.length > 0 && (
          <div>
            <FormStrip rows={formRows} />
            {run && <p className="mt-1 text-sm font-bold text-negro/75">🔥 {run}</p>}
          </div>
        )}
        <div>
          <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-negro/65"><Swords size={14} /> Última vez contra {m.rival.name}</h3>
          {lastH2H ? <MatchLine m={lastH2H} /> : <p className="text-sm text-negro/65">Primer enfrentamiento (en la app). ¡A estrenarnos con victoria!</p>}
        </div>
        {topScorer && (
          <div className="franja relative flex items-center gap-3 overflow-hidden rounded-2xl bg-negro p-3 text-white">
            <span className="relative"><Jersey number={topScorer.number} goalkeeper={lineOf(topScorer.position) === "GK"} size={44} /></span>
            <div className="relative min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-dorado">Nuestro pichichi</p>
              <p className="sport truncate text-xl font-black leading-tight">{shirtName(topScorer.player)}</p>
              <p className="text-xs text-white/70">{topScorer.goals} {topScorer.goals === 1 ? "gol" : "goles"} esta temporada</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

