import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Minus, Trophy } from "lucide-react";
import { CLUB_NAME, OUTCOME_LABEL, OUTCOME_TONE, type Rival } from "@/lib/matches";
import type { LeagueTable, StandingRow } from "@/lib/league-table";
import { Crest } from "./crest";

export type TableRival = Pick<Rival, "name" | "short_name" | "color" | "crest_url"> & { ext_id: string | null };

type Props = { table: LeagueTable; us: string; rivals: TableRival[] };

const rivalOf = (rivals: TableRival[], row: StandingRow) =>
  rivals.find((r) => r.ext_id === `futormes:${row.teamId}`) ?? { name: row.name, short_name: null, color: null, crest_url: null, ext_id: null };

const teamName = (row: StandingRow, us: string, rivals: TableRival[]) => (row.teamId === us ? CLUB_NAME : rivalOf(rivals, row).name);

function Move({ v }: { v: number }) {
  if (v > 0) return <span title={`Sube ${v} ${v === 1 ? "posición" : "posiciones"}`} className="inline-flex items-center text-[10px] font-black text-green-700"><ArrowUp size={12} strokeWidth={3} />{v}</span>;
  if (v < 0) return <span title={`Baja ${-v} ${v === -1 ? "posición" : "posiciones"}`} className="inline-flex items-center text-[10px] font-black text-rojo"><ArrowDown size={12} strokeWidth={3} />{-v}</span>;
  return <span title="Mantiene la posición" className="text-negro/30"><Minus size={12} strokeWidth={3} /></span>;
}

function Form({ form }: { form: StandingRow["form"] }) {
  if (!form.length) return <span className="text-negro/30">—</span>;
  return (
    <ol className="flex justify-end gap-0.5" aria-label="Últimos partidos">
      {form.map((o, i) => (
        <li key={i} title={OUTCOME_LABEL[o].long}
          className={`sport inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${OUTCOME_TONE[o]}`}>
          <span aria-hidden>{OUTCOME_LABEL[o].short}</span><span className="sr-only">{OUTCOME_LABEL[o].long}</span>
        </li>
      ))}
    </ol>
  );
}

/** Zonas (ascenso, descenso…) en el orden en que aparecen en la tabla. */
function zones(rows: StandingRow[]) {
  const seen = new Map<string, { label: string; color: string; from: number; to: number }>();
  for (const r of rows) {
    if (!r.zone) continue;
    const z = seen.get(r.zone.label);
    if (z) z.to = r.pos;
    else seen.set(r.zone.label, { ...r.zone, from: r.pos, to: r.pos });
  }
  return [...seen.values()];
}

const ord = (n: number) => `${n}º`;

/** Resumen de dónde estamos: posición, puntos y distancia a las zonas. */
function situation(rows: StandingRow[], us: string) {
  const me = rows.find((r) => r.teamId === us);
  if (!me) return null;
  const z = zones(rows);
  const top = z.find((x) => x.from === 1);
  const bottom = z.find((x) => x.to === rows.at(-1)?.pos && x !== top);
  let note: string;
  if (me.pos === 1) note = me.played ? "¡Líderes de la liga!" : "Arrancamos la liga";
  else if (top && me.pos <= top.to) note = `En zona de ${top.label}`;
  else if (bottom && me.pos >= bottom.from) {
    const safe = rows.find((r) => r.pos === bottom.from - 1);
    note = safe ? `En zona de descenso · a ${safe.points - me.points} ${safe.points - me.points === 1 ? "punto" : "puntos"} de salir` : "En zona de descenso";
  } else if (top) {
    const last = rows.find((r) => r.pos === top.to)!;
    const gap = last.points - me.points;
    note = gap <= 0 ? `Empatados a puntos con el ${ord(top.to)}` : `A ${gap} ${gap === 1 ? "punto" : "puntos"} del ${ord(top.to)} (${top.label})`;
  } else {
    const leader = rows[0];
    note = `A ${leader.points - me.points} puntos del líder`;
  }
  return { me, note };
}

/** Tabla completa de la clasificación. */
export function StandingsTable({ table, us, rivals }: Props) {
  const z = zones(table.rows);
  const sit = situation(table.rows, us);
  return (
    <div className="space-y-4">
      {sit && (
        <section className="relative overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-lg">
          <span aria-hidden className="absolute -right-6 top-0 h-full w-16 -skew-x-[20deg] bg-rojo" />
          <span aria-hidden className="absolute right-8 top-0 h-full w-3 -skew-x-[20deg] bg-dorado" />
          <div className="relative flex items-center gap-4">
            <Crest us size={56} />
            <div className="min-w-0 pr-10">
              <div className="text-[11px] font-bold uppercase tracking-wider text-dorado">{table.competition ?? "Clasificación"}</div>
              <div className="sport flex items-baseline gap-3 text-5xl font-black leading-none">
                {ord(sit.me.pos)}
                <span className="text-xl text-white/80">{sit.me.points} {Math.abs(sit.me.points) === 1 ? "punto" : "puntos"}</span>
                <Move v={sit.me.move} />
              </div>
              <div className="mt-1 text-sm font-semibold text-white/85">{sit.note}</div>
            </div>
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Clasificación{table.round ? ` tras la ${table.round.toLowerCase()}` : ""}</caption>
          <thead>
            <tr className="bg-negro text-[11px] font-bold uppercase tracking-wider text-white">
              <th scope="col" className="w-9 py-2 pl-3 text-left">#</th>
              <th scope="col" className="py-2 text-left">Equipo</th>
              <th scope="col" className="w-7 py-2 text-center" title="Partidos jugados">PJ</th>
              <th scope="col" className="w-7 py-2 text-center" title="Ganados">G</th>
              <th scope="col" className="w-7 py-2 text-center" title="Empatados">E</th>
              <th scope="col" className="w-7 py-2 text-center" title="Perdidos">P</th>
              <th scope="col" className="hidden w-9 py-2 text-center sm:table-cell" title="Goles a favor">GF</th>
              <th scope="col" className="hidden w-9 py-2 text-center sm:table-cell" title="Goles en contra">GC</th>
              <th scope="col" className="w-9 py-2 text-center" title="Diferencia de goles">DG</th>
              <th scope="col" className="w-10 py-2 text-center text-dorado" title="Puntos">Pts</th>
              <th scope="col" className="hidden w-32 py-2 pr-3 text-right md:table-cell">Racha</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => {
              const mine = r.teamId === us;
              return (
                <tr key={r.teamId} className={`anim-rise border-t border-black/5 ${mine ? "bg-rojo/10 font-bold" : i % 2 ? "bg-black/[0.015]" : ""}`} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                  <td className="relative py-2 pl-3">
                    {r.zone && <span aria-hidden className="absolute inset-y-1 left-0 w-1 rounded-r" style={{ background: r.zone.color }} title={r.zone.label} />}
                    <div className="flex flex-col items-start leading-none">
                      <span className="sport text-base font-black">{r.pos}</span>
                      <Move v={r.move} />
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Crest us={mine} rival={mine ? null : rivalOf(rivals, r)} size={22} className="shrink-0" />
                      <span className={`truncate ${mine ? "text-rojo" : ""}`}>{teamName(r, us, rivals)}</span>
                    </div>
                  </td>
                  <td className="text-center tabular-nums">{r.played}</td>
                  <td className="text-center tabular-nums">{r.won}</td>
                  <td className="text-center tabular-nums">{r.drawn}</td>
                  <td className="text-center tabular-nums">{r.lost}</td>
                  <td className="hidden text-center tabular-nums sm:table-cell">{r.gf}</td>
                  <td className="hidden text-center tabular-nums sm:table-cell">{r.ga}</td>
                  <td className="text-center tabular-nums">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="sport text-center text-base font-black tabular-nums">
                    {r.points}
                    {r.penalty !== 0 && <sup className="ml-0.5 text-[9px] text-rojo" title={`${Math.abs(r.penalty)} de sanción`}>*</sup>}
                  </td>
                  <td className="hidden py-2 pr-3 md:table-cell"><Form form={r.form} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-negro/65">
        {z.map((x) => (
          <span key={x.label} className="inline-flex items-center gap-1.5"><span aria-hidden className="h-3 w-1.5 rounded" style={{ background: x.color }} /> {x.label}</span>
        ))}
        {table.rows.some((r) => r.penalty !== 0) && <span><b className="text-rojo">*</b> con puntos de sanción</span>}
        <span className="ml-auto">Datos de la web de la liga{table.round ? ` · tras la ${table.round.toLowerCase()}` : ""}</span>
      </div>
    </div>
  );
}

/** Mini tabla: nuestra posición con los equipos de alrededor. */
export function StandingsMini({ table, us, rivals, href }: Props & { href: string }) {
  const rows = table.rows;
  const me = rows.findIndex((r) => r.teamId === us);
  if (me < 0) return null;
  const from = Math.max(0, Math.min(me - 2, rows.length - 5));
  const slice = rows.slice(from, from + 5);
  const sit = situation(rows, us);
  return (
    <Link href={href} prefetch className="group mb-6 block overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-dorado">
      <div className="flex items-center justify-between gap-3 bg-negro px-4 py-2.5 text-white">
        <span className="sport inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-black"><Trophy size={16} className="text-dorado" /> Clasificación</span>
        <span className="inline-flex min-w-0 items-center gap-1 text-right text-xs font-bold text-dorado">
          {sit ? <><b className="sport text-base">{ord(sit.me.pos)}</b><span className="hidden truncate sm:inline">· {sit.note}</span></> : "Ver tabla"}
          <ChevronRight size={14} className="shrink-0 transition group-hover:translate-x-0.5" />
        </span>
      </div>
      <ol>
        {slice.map((r) => {
          const mine = r.teamId === us;
          return (
            <li key={r.teamId} className={`relative flex items-center gap-2 border-t border-black/5 px-4 py-1.5 text-sm first:border-t-0 ${mine ? "bg-rojo/10 font-bold" : ""}`}>
              {r.zone && <span aria-hidden className="absolute inset-y-1 left-0 w-1 rounded-r" style={{ background: r.zone.color }} />}
              <span className="sport w-6 text-base font-black">{r.pos}</span>
              <Crest us={mine} rival={mine ? null : rivalOf(rivals, r)} size={20} className="shrink-0" />
              <span className={`min-w-0 flex-1 truncate ${mine ? "text-rojo" : ""}`}>{teamName(r, us, rivals)}</span>
              <span className="hidden w-8 text-center text-xs text-negro/60 tabular-nums sm:inline" title="Partidos jugados">{r.played}</span>
              <span className="w-9 text-center text-xs text-negro/60 tabular-nums" title="Diferencia de goles">{r.gd > 0 ? `+${r.gd}` : r.gd}</span>
              <span className="sport w-8 text-right text-base font-black tabular-nums">{r.points}</span>
            </li>
          );
        })}
      </ol>
    </Link>
  );
}
