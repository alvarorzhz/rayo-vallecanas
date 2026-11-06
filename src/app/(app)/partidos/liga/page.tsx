import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fecha } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { LeagueForm, SyncButton } from "@/components/matches/league-forms";
import { runLeagueSync, saveLeague } from "../actions";

export const maxDuration = 60;
export const metadata = { title: "Liga" };

type Cfg = { competition: string; competition_name: string | null; team: string; last_synced_at: string | null; last_summary: { matchesNew: number; matchesUpdated: number; rivalsNew: number } | null };

export default async function LeaguePage() {
  await requirePerm("matches", "update");
  const supabase = await createClient();
  const { data: cfg } = await supabase.from("league_sync").select("competition, competition_name, team, last_synced_at, last_summary").eq("id", 1).maybeSingle<Cfg>();
  const { count } = await supabase.from("matches").select("id", { count: "exact", head: true }).not("ext_id", "is", null);
  return (
    <>
      <PageHeader title="Liga" subtitle="Trae el calendario, los campos, los rivales con su escudo y los resultados de la web de la liga" back={{ href: "/partidos", label: "Partidos" }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2>Competición</h2>
          {cfg?.competition_name && <p className="sport text-xl font-black">{cfg.competition_name}</p>}
          <LeagueForm action={saveLeague} url={cfg ? `https://www.futormes.com/mod/soccer/situation.aspx?itm=${cfg.competition}` : ""} />
        </section>
        <section className="card space-y-4">
          <h2>Sincronizar</h2>
          {cfg ? (
            <>
              <p className="text-sm text-negro/70">
                {cfg.last_synced_at ? <>Última vez: <b>{fecha(cfg.last_synced_at, true)}</b>. {count ?? 0} partidos vienen de la liga.</> : "Aún no se ha sincronizado nunca."}
              </p>
              <SyncButton action={runLeagueSync} className="btn-primary w-full py-3 text-base" />
              <ul className="list-disc space-y-1 pl-5 text-xs text-negro/65">
                <li>Añade los partidos nuevos y actualiza fechas, horas, campos y resultados.</li>
                <li>No toca lo que hayáis escrito a mano: observaciones, enlaces del mapa ni partidos amistosos.</li>
                <li>Si cambia un horario o entra un resultado, el equipo recibe el aviso en el móvil.</li>
              </ul>
            </>
          ) : (
            <p className="text-sm text-negro/65">Guarda primero la competición.</p>
          )}
        </section>
      </div>
    </>
  );
}
