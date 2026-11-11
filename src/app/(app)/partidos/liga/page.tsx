import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fecha } from "@/lib/format";
import { CalendarCheck, Flag, History, Info, Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { LEAGUE_DATA } from "@/lib/league-plan";
import { changesText, leagueOver } from "@/lib/league-status";
import { LeagueForm, SyncButton } from "@/components/matches/league-forms";
import { LeagueHealthy, LeagueProblem } from "@/components/matches/league-problem";
import type { StoredSummary } from "@/lib/league-status";
import { findLeagues, runLeagueSync, saveLeague } from "../actions";

export const maxDuration = 60;
export const metadata = { title: "Liga" };

type Cfg = { competition: string; competition_name: string | null; team: string; last_synced_at: string | null; last_summary: StoredSummary };
type Past = { competition: string; name: string | null; season: string | null; finished: boolean; last_synced_at: string | null };

export default async function LeaguePage() {
  await requirePerm("matches", "update");
  const supabase = await createClient();
  const { data: cfg } = await supabase.from("league_sync").select("competition, competition_name, team, last_synced_at, last_summary").eq("id", 1).maybeSingle<Cfg>();
  const [{ data: past }, { data: tagged }] = await Promise.all([
    supabase.from("league_competitions").select("competition, name, season, finished, last_synced_at").order("created_at", { ascending: false }).returns<Past[]>(),
    supabase.from("matches").select("league_competition").not("league_competition", "is", null).returns<{ league_competition: string }[]>(),
  ]);
  const perLeague = new Map<string, number>();
  for (const m of tagged ?? []) perLeague.set(m.league_competition, (perLeague.get(m.league_competition) ?? 0) + 1);
  const count = cfg ? perLeague.get(cfg.competition) ?? 0 : 0;
  const sum = cfg?.last_summary ?? null;
  const over = leagueOver(sum);
  const next = sum?.next && sum.next.competition !== cfg?.competition ? sum.next : null;
  return (
    <>
      <PageHeader title="Liga" subtitle="Trae el calendario, los campos, los rivales con su escudo, los resultados y la plantilla de la web de la liga" back={{ href: "/partidos", label: "Partidos" }} />
      {sum && <div className="mb-6"><LeagueProblem summary={sum} /></div>}
      {(over || next) && (
        <section className="mb-6 flex items-start gap-3 rounded-2xl bg-dorado/15 p-4 ring-1 ring-dorado/50" data-testid="league-over">
          <Flag size={22} className="mt-0.5 shrink-0" />
          <div className="min-w-0 space-y-1">
            <p className="font-black">{next ? "Hay liga nueva en futormes" : "Esta competición ha terminado"}</p>
            <p className="text-sm text-negro/80">
              {next
                ? <>El Rayo aparece en <b>{next.name}</b> ({next.matches} {next.matches === 1 ? "partido" : "partidos"}). Ya está escrita abajo: pulsa «Comprobar» y, si es la buena, «Usar esta liga».</>
                : "No nos queda ningún partido por jugar. Cuando futormes publique la siguiente, pulsa «Buscar al Rayo en futormes» o pega su dirección. Cada lunes la app la busca sola y os avisa."}
            </p>
          </div>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2>Competición</h2>
          {cfg?.competition_name && <p className="sport text-xl font-black">{cfg.competition_name}</p>}
          <LeagueForm action={saveLeague} find={findLeagues} url={cfg ? `https://www.futormes.com/mod/soccer/situation.aspx?itm=${cfg.competition}` : ""} suggest={next?.competition} />
        </section>
        <section className="card space-y-4">
          <h2>Sincronizar</h2>
          {cfg ? (
            <>
              <p className="text-sm text-negro/70">
                {cfg.last_synced_at ? <>Última vez: <b>{fecha(cfg.last_synced_at, true)}</b>. {count} {count === 1 ? "partido viene" : "partidos vienen"} de esta competición.</> : "Esta competición aún no se ha sincronizado."}
              </p>
              {sum?.at && sum.status !== "failed" && (
                <dl className="grid grid-cols-3 gap-2 text-center" data-testid="league-last">
                  {[
                    { k: "Partidos", v: sum.matches != null ? `${sum.played ?? 0}/${sum.matches}` : "–", t: "jugados" },
                    { k: "Jugadores", v: sum.players ?? "–", t: "en la liga" },
                    { k: "Cambios", v: (sum.matchesNew ?? 0) + (sum.matchesUpdated ?? 0) + (sum.rivalsNew ?? 0) + (sum.playersNew ?? 0), t: "la última vez" },
                  ].map((x) => (
                    <div key={x.k} className="rounded-xl bg-gris px-2 py-2">
                      <dt className="text-[11px] font-bold uppercase tracking-wide text-negro/60">{x.k}</dt>
                      <dd className="sport text-xl font-black leading-tight">{x.v}</dd>
                      <dd className="text-[11px] text-negro/60">{x.t}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {sum?.at && sum.status !== "failed" && <p className="text-xs text-negro/65">Última lectura: {changesText(sum)}.</p>}
              <LeagueHealthy summary={sum} />
              <SyncButton action={runLeagueSync} className="btn-primary w-full py-3 text-base" />
              <ul className="list-disc space-y-1 pl-5 text-xs text-negro/65">
                <li>Añade los partidos nuevos y actualiza fechas, horas, campos y resultados.</li>
                <li>No toca lo que hayáis escrito a mano: observaciones, enlaces del mapa ni partidos amistosos.</li>
                <li>Si cambia un horario o entra un resultado, el equipo recibe el aviso en el móvil.</li>
                <li>Si la web de la liga tarda o falla, cada página se intenta hasta tres veces. Si algo no se puede leer, se guarda lo demás y los gestores reciben un aviso.</li>
                <li>Freno de seguridad: si la web enseña de repente bastantes menos partidos de los que ya había, no se guarda nada.</li>
                <li>Cada lunes la app revisa que la web de la liga se siga entendiendo y, si la competición ha terminado, busca la siguiente.</li>
              </ul>
            </>
          ) : (
            <p className="text-sm text-negro/65">Guarda primero la competición.</p>
          )}
        </section>
      </div>

      <section className="card mt-6" data-testid="league-data">
        <h2 className="flex items-center gap-2"><Info size={18} className="text-rojo" /> Qué datos se traen</h2>
        <p className="mt-1 text-sm text-negro/70">Todo sale de las páginas públicas de futormes. La app solo lee: nunca escribe nada en la web de la liga.</p>
        <dl className="mt-4 divide-y divide-black/5">
          {LEAGUE_DATA.map((d) => (
            <div key={d.what} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt>
                <span className="font-bold">{d.what}</span>
                <span className="block text-xs text-negro/60">Página: {d.page}</span>
              </dt>
              <dd className="text-sm">
                <span className="block text-negro/85">{d.fields}</span>
                <span className="block text-xs text-negro/65">{d.saved}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {!!past?.length && (
        <section className="card mt-6" data-testid="league-history">
          <h2 className="flex items-center gap-2"><History size={18} className="text-rojo" /> Competiciones</h2>
          <p className="mt-1 text-sm text-negro/70">Cada partido y cada total de jugador queda guardado con su competición. Cambiar de liga no borra las anteriores.</p>
          <ul className="mt-3 divide-y divide-black/5">
            {past.map((c) => {
              const current = c.competition === cfg?.competition;
              const n = perLeague.get(c.competition) ?? 0;
              return (
                <li key={c.competition} className="flex items-center gap-3 py-2.5">
                  {current ? <Trophy size={18} className="shrink-0 text-dorado" /> : <CalendarCheck size={18} className="shrink-0 text-negro/40" />}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{c.name ?? `Competición ${c.competition}`}</span>
                    <span className="block text-xs text-negro/65">
                      {[c.season && `Temporada ${c.season}`, `${n} ${n === 1 ? "partido" : "partidos"}`, c.last_synced_at && `leída el ${fecha(c.last_synced_at)}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={`badge shrink-0 ${current ? "bg-green-100 text-green-800" : "bg-black/10 text-negro/70"}`}>{current ? (c.finished ? "Actual · terminada" : "Actual") : c.finished ? "Terminada" : "Anterior"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
