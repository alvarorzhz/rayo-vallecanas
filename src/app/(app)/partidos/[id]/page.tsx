import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, MapPin, Pencil, StickyNote, Swords } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchMatch } from "@/lib/match-queries";
import {
  COMPETITION_LABEL, MATCH_STATUS_LABEL, hhmm, longDay, mapsLink, matchShareText, outcomeOf, record, todayMadrid,
  type MatchRow,
} from "@/lib/matches";
import { seasonSlug } from "@/lib/squad";
import { PageHeader } from "@/components/ui";
import { MatchLine, Scoreboard } from "@/components/matches/match-bits";
import { DeleteButton, ResultForm, StatusForm } from "@/components/matches/match-forms";
import { ShareButton } from "@/components/matches/share-button";
import { Crest } from "@/components/matches/crest";
import { deleteMatch, saveResult, setMatchStatus } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const m = await fetchMatch(supabase, id);
  return { title: m ? `vs ${m.rival.name}` : "Partido" };
}

export default async function MatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string; guardado?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requirePerm("matches", "read");
  const supabase = await createClient();
  const m = await fetchMatch(supabase, id);
  if (!m) notFound();

  // Historial contra este rival
  const { data: h2hData } = await supabase.from("matches").select("*, rival:rivals!inner(*)").eq("rival_id", m.rival_id).neq("id", m.id)
    .order("match_date", { ascending: false }).limit(20).returns<MatchRow[]>();
  const h2h = h2hData ?? [];
  const h2hRec = record(h2h);

  const canEdit = s.can("matches", "update");
  const link = mapsLink(m);
  const today = todayMadrid();
  const canScore = canEdit && m.status !== "cancelled" && (m.status === "played" || m.match_date <= today);

  return (
    <>
      <PageHeader
        title={`${m.is_home ? "Rayo Vallecañas vs" : ""} ${m.rival.name}${m.is_home ? "" : " vs Rayo Vallecañas"}`.trim()}
        subtitle={<><span className="inline-block first-letter:uppercase">{longDay(m.match_date)}</span>{m.kickoff ? ` · ${hhmm(m.kickoff)}` : ""} · {COMPETITION_LABEL[m.competition]}{m.round ? ` · ${m.round}` : ""} · {MATCH_STATUS_LABEL[m.status]}</>}
        back={{ href: `/partidos?temporada=${seasonSlug(m.season)}`, label: "Partidos" }}
        actions={<>
          <ShareButton text={matchShareText(m)} label="WhatsApp" className="btn-ghost" />
          {m.status === "scheduled" && <a href={`/api/partidos/${m.id}/calendario`} className="btn-ghost"><CalendarPlus size={18} /> A mi calendario</a>}
          {canEdit && <Link href={`/partidos/${m.id}/editar`} prefetch className="btn-dark"><Pencil size={18} /> Editar</Link>}
        </>}
      />
      {sp.nuevo && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">¡Partido añadido al calendario!</p>}
      {sp.guardado && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">Cambios guardados.</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Scoreboard m={m} />

          <section className="card space-y-3">
            <h2>Dónde y cuándo</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-bold uppercase tracking-wider text-negro/65">Fecha</dt><dd className="font-semibold first-letter:uppercase">{longDay(m.match_date)}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-negro/65">Hora</dt><dd className="font-semibold">{hhmm(m.kickoff) ?? "Por confirmar"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-negro/65">Campo</dt><dd className="font-semibold">{m.venue ?? "Por confirmar"}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-negro/65">Juega</dt><dd className="font-semibold">{m.is_home ? "En casa 🏠" : "Fuera 🚌"}</dd></div>
            </dl>
            {link && <a href={link} target="_blank" rel="noopener" className="btn-primary"><MapPin size={16} /> Cómo llegar</a>}
            {m.notes && (
              <p className="flex gap-2 rounded-xl bg-gris p-3 text-sm"><StickyNote size={16} className="mt-0.5 shrink-0 text-dorado" /> <span className="whitespace-pre-line">{m.notes}</span></p>
            )}
          </section>

          <section className="card">
            <h2 className="mb-3 flex items-center gap-2"><Swords size={18} className="text-rojo" /> Contra {m.rival.name}</h2>
            {h2h.length === 0 ? (
              <p className="text-sm text-negro/65">Es la primera vez que nos enfrentamos (en la app).</p>
            ) : (
              <>
                {h2hRec.played > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2 text-sm">
                    <span className="badge bg-green-100 text-green-800">{h2hRec.W} {h2hRec.W === 1 ? "victoria" : "victorias"}</span>
                    <span className="badge bg-black/10 text-negro/70">{h2hRec.D} {h2hRec.D === 1 ? "empate" : "empates"}</span>
                    <span className="badge bg-rojo/10 text-rojo">{h2hRec.L} {h2hRec.L === 1 ? "derrota" : "derrotas"}</span>
                    <span className="badge bg-gris text-negro">Goles {h2hRec.gf}-{h2hRec.ga}</span>
                  </div>
                )}
                <ol className="space-y-2">{h2h.slice(0, 5).map((x) => <li key={x.id}><MatchLine m={x} /></li>)}</ol>
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          {canScore && (
            <section className="card">
              <h2 className="mb-3">{m.status === "played" ? "Resultado" : "Resultado final"}</h2>
              <ResultForm action={saveResult.bind(null, m.id)} match={m} rivalName={m.rival.name} />
              {outcomeOf(m) && <p className="mt-3 text-center text-xs text-negro/65">Las actas con goleadores, tarjetas y MVP llegan en la versión 3.2.</p>}
            </section>
          )}
          {canEdit && (
            <section className="card">
              <h2 className="mb-3">{m.status === "played" ? "Estado" : "Aplazar o cambiar"}</h2>
              <StatusForm action={setMatchStatus.bind(null, m.id)} match={m} />
            </section>
          )}
          <section className="card flex items-center gap-3">
            <Crest rival={m.rival} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{m.rival.name}</div>
              {m.rival.home_venue && <div className="truncate text-xs text-negro/65">Su campo: {m.rival.home_venue}</div>}
              {m.rival.notes && <div className="mt-1 text-xs text-negro/70">{m.rival.notes}</div>}
            </div>
          </section>
          {s.can("matches", "delete") && (
            <DeleteButton action={deleteMatch.bind(null, m.id)} label="Eliminar partido" confirmText={`¿Eliminar el partido contra ${m.rival.name}? No se puede deshacer.`} />
          )}
        </aside>
      </div>
    </>
  );
}
