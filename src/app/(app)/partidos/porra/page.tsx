import Link from "next/link";
import { Target } from "lucide-react";
import { getSession, requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchMatchSeasons } from "@/lib/match-queries";
import { fetchPorraSeason } from "@/lib/porra-queries";
import { seasonFromSlug, seasonSlug } from "@/lib/squad";
import { plural } from "@/lib/stats-board";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "La porra" };

const MEDAL = ["🥇", "🥈", "🥉"];

export default async function PorraPage({ searchParams }: { searchParams: Promise<{ temporada?: string }> }) {
  const sp = await searchParams;
  await requirePerm("matches", "read");
  const [s, supabase] = await Promise.all([getSession(), createClient()]);
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const [{ table, matches }, seasons] = await Promise.all([fetchPorraSeason(supabase, season), fetchMatchSeasons(supabase)]);
  const me = table.find((r) => r.user_id === s.user.id);
  const podium = table.filter((r) => r.pos <= 3).slice(0, 3);

  return (
    <>
      <PageHeader title="La porra" subtitle={<>Temporada <b>{season}</b> · {matches} {plural(matches, "partido jugado", "partidos jugados")}</>}
        back={{ href: `/partidos?temporada=${seasonSlug(season)}`, label: "Partidos" }} />

      {seasons.length > 1 && (
        <nav aria-label="Temporadas" className="mb-4 flex flex-wrap gap-2">
          {seasons.map((x) => (
            <Link key={x} href={`/partidos/porra?temporada=${seasonSlug(x)}`} prefetch
              className={`sport rounded-full px-3 py-1 text-sm font-black ring-1 ${x === season ? "tab-on bg-negro text-white ring-negro" : "bg-white ring-black/10"}`}>{x}</Link>
          ))}
        </nav>
      )}

      <div className="mx-auto max-w-2xl space-y-6">
        {podium.length > 0 && (
          <section className="franja relative overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl">
            <p className="sport relative text-xs font-black tracking-[0.2em] text-dorado">EL PODIO DE LA PORRA</p>
            <ol className="relative mt-3 grid grid-cols-3 items-end gap-2 text-center">
              {[podium[1], podium[0], podium[2]].map((r, i) => r ? (
                <li key={r.user_id} className="anim-rise min-w-0" style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="text-3xl">{MEDAL[r.pos - 1] ?? ""}</div>
                  <div className="sport truncate text-lg font-black leading-tight">{r.name}</div>
                  <div className={`mx-auto mt-1 rounded-t-xl bg-white/10 px-2 pt-2 ${r.pos === 1 ? "h-20" : r.pos === 2 ? "h-14" : "h-10"}`}>
                    <span className="sport text-2xl font-black text-dorado tabular-nums">{r.points}</span><span className="text-xs text-white/70"> pts</span>
                  </div>
                </li>
              ) : <li key={i} />)}
            </ol>
          </section>
        )}

        {me && <p className="rounded-xl bg-dorado/15 px-3 py-2 text-sm">Vas <b>{me.pos}º</b> con <b>{me.points} {plural(me.points, "punto", "puntos")}</b>: {me.exact} {plural(me.exact, "resultado clavado", "resultados clavados")} y {me.sign} {plural(me.sign, "acierto", "aciertos")} de quién gana en {me.played} {plural(me.played, "partido", "partidos")}.</p>}

        {table.length ? (
          <section className="card p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-negro/60">
                  <th className="px-3 py-2">#</th><th className="py-2">Nombre</th>
                  <th className="py-2 text-center" title="Resultados clavados">🎯</th><th className="py-2 text-center" title="Aciertos de quién gana">✓</th>
                  <th className="py-2 text-center">PJ</th><th className="px-3 py-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {table.map((r) => (
                  <tr key={r.user_id} className={r.user_id === s.user.id ? "bg-dorado/15 font-bold" : ""}>
                    <td className="px-3 py-2 tabular-nums text-negro/60">{r.pos}</td>
                    <td className="max-w-0 truncate py-2 font-semibold">{r.name}</td>
                    <td className="py-2 text-center tabular-nums">{r.exact}</td>
                    <td className="py-2 text-center tabular-nums">{r.sign}</td>
                    <td className="py-2 text-center tabular-nums text-negro/60">{r.played}</td>
                    <td className="sport px-3 py-2 text-right text-lg font-black tabular-nums">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <Empty>Todavía no hay puntos esta temporada. La porra de cada partido se juega desde la convocatoria o desde la ficha del partido.</Empty>
        )}

        <p className="flex items-start gap-2 text-xs text-negro/65"><Target size={14} className="mt-0.5 shrink-0 text-rojo" />
          3 puntos por clavar el resultado y 1 por acertar quién gana o el empate. Se cierra al pitido inicial; a igualdad de puntos va antes quien más resultados ha clavado.</p>
      </div>
    </>
  );
}
