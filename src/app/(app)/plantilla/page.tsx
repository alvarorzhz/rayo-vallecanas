import Link from "next/link";
import { LayoutGrid, List, Plus, Search, Shirt } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchRoster, fetchSeasons } from "@/lib/squad-queries";
import {
  FOOT_LABEL, LINES, LINE_TONE, STATUSES, STATUS_LABEL, STATUS_TONE, POSITION_LABEL,
  fullName, lineFromSlug, lineOf, seasonFromSlug, seasonSlug, shirtName, statusFromSlug,
} from "@/lib/squad";
import { Empty, PageHeader } from "@/components/ui";
import { Armband, PlayerCard, PositionChip } from "@/components/squad/player-card";
import { Pitch } from "@/components/squad/pitch";
import { Jersey } from "@/components/squad/jersey";

export const metadata = { title: "Plantilla" };

type SP = { temporada?: string; vista?: string; linea?: string; estado?: string; q?: string };

export default async function SquadPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await requirePerm("squad", "read");
  const supabase = await createClient();
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const view = sp.vista === "campo" || sp.vista === "lista" ? sp.vista : "cromos";
  const line = lineFromSlug(sp.linea);
  const status = sp.estado === "todos" ? "all" : statusFromSlug(sp.estado);
  const q = (sp.q ?? "").trim().toLowerCase();

  const [roster, seasons, stats] = await Promise.all([
    fetchRoster(supabase, season),
    fetchSeasons(supabase),
    supabase.rpc("squad_season_stats", { p_season: season }).then((r) => r.data as { avg_age: number | null; with_birth: number } | null),
  ]);

  const inSquad = roster.filter((r) => r.status !== "left");
  const shown = roster.filter(
    (r) =>
      (status === "all" ? true : status ? r.status === status : r.status !== "left") &&
      (!line || lineOf(r.position) === line) &&
      (!q || `${fullName(r.player)} ${r.player.nickname ?? ""} ${r.number ?? ""}`.toLowerCase().includes(q)),
  );

  const canCreate = s.can("squad", "create");
  const current = season === seasonOf();
  const link = (p: Partial<SP>) => {
    const next = { temporada: seasonSlug(season), vista: view, linea: sp.linea, estado: sp.estado, q: sp.q, ...p };
    const qs = new URLSearchParams(Object.entries(next).filter(([k, v]) => v && !(k === "vista" && v === "cromos")) as [string, string][]);
    return `/plantilla?${qs}`;
  };
  const hrefFor = (id: string) => `/plantilla/${id}?temporada=${seasonSlug(season)}`;
  const counts = Object.fromEntries(LINES.map((l) => [l.key, inSquad.filter((r) => lineOf(r.position) === l.key).length]));

  return (
    <>
      <PageHeader
        title="Plantilla"
        subtitle={<>Temporada <b>{season}</b>{current ? " · actual" : ""}</>}
        actions={canCreate && (
          <Link href={`/plantilla/nuevo?temporada=${seasonSlug(season)}`} prefetch className="btn-primary"><Plus size={18} /> Nuevo jugador</Link>
        )}
      />

      {/* Marcador de la plantilla */}
      <section className="franja relative mb-6 overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl sm:p-6">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.10),transparent_55%)]" />
        <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Jugadores", inSquad.length],
            ["Disponibles", inSquad.filter((r) => r.status === "active").length],
            ["Lesionados", inSquad.filter((r) => r.status === "injured").length],
            ["Edad media", stats?.avg_age != null ? String(stats.avg_age).replace(".", ",") : "–"],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">{k}</div>
              <div className="sport text-4xl font-black leading-none sm:text-5xl">{v}</div>
            </div>
          ))}
        </div>
        {inSquad.length > 0 && (
          <div className="relative mt-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
              {LINES.map((l) => counts[l.key] > 0 && (
                <span key={l.key} className={LINE_TONE[l.key].dot} style={{ width: `${(counts[l.key] / inSquad.length) * 100}%` }} title={`${l.plural}: ${counts[l.key]}`} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/75">
              {LINES.map((l) => (
                <span key={l.key} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${LINE_TONE[l.key].dot}`} /> {l.plural} <b className="text-white">{counts[l.key]}</b></span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Vista, temporada y filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
          {([["cromos", "Cromos", LayoutGrid], ["campo", "Campo", Shirt], ["lista", "Lista", List]] as const).map(([v, label, Icon]) => (
            <Link key={v} href={link({ vista: v })} prefetch
              className={`sport flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-black transition ${view === v ? "bg-negro text-white" : "text-negro/60 hover:text-negro"}`}>
              <Icon size={15} /> {label}
            </Link>
          ))}
        </div>
        {seasons.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {seasons.map((t) => (
              <Link key={t} href={link({ temporada: seasonSlug(t) })} prefetch
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 ${t === season ? "bg-rojo text-white ring-rojo" : "bg-white text-negro/70 ring-black/10 hover:ring-rojo"}`}>
                {t}
              </Link>
            ))}
          </div>
        )}
        <form action="/plantilla" className="relative ml-auto w-full sm:w-56">
          <input type="hidden" name="temporada" value={seasonSlug(season)} />
          {view !== "cromos" && <input type="hidden" name="vista" value={view} />}
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-negro/40" />
          <input name="q" defaultValue={sp.q} placeholder="Buscar nombre o dorsal" className="input pl-9" />
        </form>
      </div>
      {view !== "campo" && (
        <div className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [scrollbar-width:none]">
          <Chip href={link({ linea: undefined })} on={!line}>Todas las líneas</Chip>
          {LINES.map((l) => <Chip key={l.key} href={link({ linea: l.slug })} on={line === l.key} dot={LINE_TONE[l.key].dot}>{l.plural}</Chip>)}
          <span className="mx-1 w-px shrink-0 bg-black/10" />
          <Chip href={link({ estado: undefined })} on={!status}>En plantilla</Chip>
          {STATUSES.map((x) => <Chip key={x.key} href={link({ estado: x.slug })} on={status === x.key}>{x.label}</Chip>)}
          <Chip href={link({ estado: "todos" })} on={status === "all"}>Todos</Chip>
        </div>
      )}

      {roster.length === 0 ? (
        <Empty>
          {canCreate ? (
            <>Aún no hay jugadores en la temporada {season}. <Link href={`/plantilla/nuevo?temporada=${seasonSlug(season)}`} className="font-semibold text-rojo">Da de alta al primero</Link>.</>
          ) : (
            <>Aún no hay jugadores en la temporada {season}.</>
          )}
        </Empty>
      ) : view === "campo" ? (
        <>
          <Pitch roster={inSquad} hrefFor={hrefFor} />
          <p className="mt-2 text-center text-xs text-negro/50">Cada jugador aparece en su línea. Los lesionados y las bajas temporales salen atenuados.</p>
        </>
      ) : shown.length === 0 ? (
        <Empty>Ningún jugador cumple esos filtros.</Empty>
      ) : view === "lista" ? (
        <div className="card overflow-x-auto p-0 sm:p-0">
          <table className="table">
            <thead>
              <tr><th className="w-10 text-center">#</th><th>Jugador</th><th>Posición</th><th className="hidden sm:table-cell">Pierna</th><th className="hidden sm:table-cell">Estado</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="hover:bg-gris/60">
                  <td className="text-center"><span className="sport text-xl font-black">{r.number ?? "–"}</span></td>
                  <td>
                    <Link href={hrefFor(r.player_id)} prefetch className="flex items-center gap-3 font-semibold hover:text-rojo">
                      {r.player.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.player.photo_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-dorado" />
                      ) : (
                        <span className="shrink-0"><Jersey number={r.number} goalkeeper={lineOf(r.position) === "GK"} size={36} /></span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate">{fullName(r.player)}</span>
                        <span className="block truncate text-xs font-normal text-negro/50">
                          {shirtName(r.player)}
                          {r.status !== "active" && <span className={`badge ml-1 sm:hidden ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>}
                        </span>
                      </span>
                      <Armband kind={r.armband} />
                    </Link>
                  </td>
                  <td><PositionChip code={r.position} /> <span className="hidden text-xs text-negro/60 md:inline">{POSITION_LABEL[r.position]}</span></td>
                  <td className="hidden text-negro/70 sm:table-cell">{r.player.foot ? FOOT_LABEL[r.player.foot] : "—"}</td>
                  <td className="hidden sm:table-cell"><span className={`badge ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5">
          {shown.map((r) => <PlayerCard key={r.id} entry={r} href={hrefFor(r.player_id)} />)}
        </div>
      )}

      {!s.can("squad", "update") && (
        <p className="mt-6 text-center text-xs text-negro/50">Los teléfonos y demás datos personales solo los ven los gestores.</p>
      )}
    </>
  );
}

function Chip({ href, on, dot, children }: { href: string; on: boolean; dot?: string; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition ${on ? "bg-negro text-white" : "bg-white text-negro/70 ring-1 ring-black/10 hover:ring-negro/30"}`}>
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}{children}
    </Link>
  );
}
