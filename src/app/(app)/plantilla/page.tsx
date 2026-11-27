import Link from "next/link";
import { CalendarPlus, Download, FileSpreadsheet, FileText, FolderLock, History, LayoutGrid, List, Plus, Search, Shirt } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchRoster, fetchSeasons } from "@/lib/squad-queries";
import {
  FOOT_LABEL, LINES, LINE_TONE, SQUAD_ORDERS, STATUSES, STATUS_LABEL, STATUS_TONE, POSITION_LABEL,
  fullName, groupByLine, preparingTime, lineFromSlug, lineOf, nextSeason, orderFromSlug, orderRoster, prevSeason, seasonFromSlug, seasonSlug, shirtName, statusFromSlug,
} from "@/lib/squad";
import { Empty, PageHeader } from "@/components/ui";
import { SectionShortcuts } from "@/components/section-shortcuts";
import { todayMadrid } from "@/lib/matches";
import { Armband, PlayerCard, PositionChip } from "@/components/squad/player-card";
import { Pitch } from "@/components/squad/pitch";
import { Jersey } from "@/components/squad/jersey";
import { Ball } from "@/components/squad/ball";
import { CountUp } from "@/components/squad/count-up";
import { LeagueNewcomers, type NewcomerItem } from "@/components/squad/league-newcomers";
import { createAdminClient } from "@/lib/supabase/admin";
import { storedNewcomers } from "@/lib/newcomers";

export const metadata = { title: "Plantilla" };

type SP = { temporada?: string; vista?: string; linea?: string; estado?: string; orden?: string; q?: string; preparada?: string; sindorsal?: string };

export default async function SquadPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await requirePerm("squad", "read");
  const supabase = await createClient();
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const view = sp.vista === "campo" || sp.vista === "lista" ? sp.vista : "cromos";
  const line = lineFromSlug(sp.linea);
  const status = sp.estado === "todos" ? "all" : statusFromSlug(sp.estado);
  const q = (sp.q ?? "").trim().toLowerCase();
  const order = orderFromSlug(sp.orden);

  const canPrivate = s.can("squad_private", "read");
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const canCreate = s.can("squad", "create");
  const current = season === seasonOf();
  // Nuevos en la liga (4.31.5: a la vez que lo demás; antes iba después): solo para quien puede fichar (la configuración de la liga es de Partidos, se lee en el servidor)
  const newcomersP: PromiseLike<NewcomerItem[]> = canCreate && current
    ? createAdminClient().from("league_sync").select("last_summary").eq("id", 1).maybeSingle()
      .then((r) => storedNewcomers(r.data?.last_summary as Record<string, unknown> | null).newcomers
        .map((n) => ({ extId: n.extId, name: n.name, number: n.number, line: n.line, returning: !!n.playerId, apps: n.apps, goals: n.goals, seenAt: n.seenAt })))
    : Promise.resolve([]);
  const [roster, seasons, stats, docAlerts, lastMvp, newcomers] = await Promise.all([
    fetchRoster(supabase, season),
    fetchSeasons(supabase),
    supabase.rpc("squad_season_stats", { p_season: season }).then((r) => r.data as { avg_age: number | null; with_birth: number } | null),
    canPrivate
      ? supabase.from("player_documents").select("id", { count: "exact", head: true }).lte("expires_on", in30).then((r) => r.count ?? 0)
      : Promise.resolve(0),
    // «En forma»: el MVP del último partido jugado de la temporada (si ya está elegido)
    supabase.from("matches").select("mvp_player_id").eq("season", season).eq("status", "played")
      .order("match_date", { ascending: false }).order("kickoff", { ascending: false, nullsFirst: false }).limit(1)
      .then((r) => (r.data?.[0]?.mvp_player_id as string | null | undefined) ?? null),
    newcomersP,
  ]);

  const inSquad = roster.filter((r) => r.status !== "left");
  const shown = orderRoster(roster.filter(
    (r) =>
      (status === "all" ? true : status ? r.status === status : r.status !== "left") &&
      (!line || lineOf(r.position) === line) &&
      (!q || `${fullName(r.player)} ${r.player.nickname ?? ""} ${r.number ?? ""}`.toLowerCase().includes(q)),
  ), order);

  const link = (p: Partial<SP>) => {
    const next = { temporada: seasonSlug(season), vista: view, linea: sp.linea, estado: sp.estado, orden: sp.orden, q: sp.q, ...p };
    const qs = new URLSearchParams(Object.entries(next).filter(([k, v]) => v && !(k === "vista" && v === "cromos") && !(k === "orden" && v === "lineas")) as [string, string][]);
    return `/plantilla?${qs}`;
  };
  const hrefFor = (id: string) => `/plantilla/${id}?temporada=${seasonSlug(season)}`;
  const counts = Object.fromEntries(LINES.map((l) => [l.key, inSquad.filter((r) => lineOf(r.position) === l.key).length]));

  return (
    <>
      <PageHeader
        title="Plantilla"
        subtitle={<>Temporada <b>{season}</b>{current ? " · actual" : ""}</>}
        actions={canCreate && <Link href={`/plantilla/nuevo?temporada=${seasonSlug(season)}`} prefetch className="btn-primary"><Plus size={18} /> Fichar</Link>}
      />
      {sp.preparada && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          ¡Temporada {season} preparada con {sp.preparada} jugadores!{sp.sindorsal ? ` ${sp.sindorsal} se han quedado sin dorsal porque estaba repetido: pónselo desde su ficha.` : ""} Ahora puedes fichar a los nuevos.
        </p>
      )}

      {canCreate && current && <LeagueNewcomers items={newcomers} />}

      {/* 4.31.2 · Los mismos accesos que en Partidos, como mucho 4. Las cuotas están en Finanzas;
          «Preparar» solo sale en verano, que es cuando se prepara la temporada siguiente */}
      <SectionShortcuts label="Herramientas de la plantilla" items={[
        { href: "/plantilla/historia", icon: History, label: "Historia" },
        { href: docAlerts > 0 ? "/plantilla/documentos?filtro=caducan" : "/plantilla/documentos", icon: FolderLock, label: "Documentos", badge: docAlerts, show: canPrivate },
        {
          icon: Download, label: "Exportar", show: s.can("squad", "update") && roster.length > 0,
          menu: (
            <>
              <a href={`/api/plantilla/exportar?temporada=${seasonSlug(season)}&formato=xlsx`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-gris"><FileSpreadsheet size={16} className="text-green-700" /> Excel de la plantilla</a>
              <a href={`/api/plantilla/exportar?temporada=${seasonSlug(season)}&formato=pdf`} target="_blank" rel="noopener" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-gris"><FileText size={16} className="text-rojo" /> PDF de la plantilla</a>
              {canPrivate && (
                <a href={`/api/plantilla/exportar?temporada=${seasonSlug(season)}&formato=xlsx&datos=1`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-gris"><FolderLock size={16} /> Excel con datos personales</a>
              )}
            </>
          ),
        },
        {
          href: `/plantilla/nueva-temporada?desde=${seasonSlug(season)}`, icon: CalendarPlus, label: `Preparar ${nextSeason(season)}`,
          show: canCreate && current && preparingTime(todayMadrid()) && !seasons.includes(nextSeason(season)) && roster.length > 0,
        },
      ]} />

      {/* Marcador de la plantilla */}
      <section className="franja relative mb-6 overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl sm:p-6">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.10),transparent_55%)]" />
        <span aria-hidden className="absolute right-5 top-7 hidden sm:block"><Ball size={34} className="anim-bounce-ball drop-shadow-[0_8px_6px_rgba(0,0,0,0.5)]" /></span>
        <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Jugadores", inSquad.length],
            ["Disponibles", inSquad.filter((r) => r.status === "active").length],
            ["Lesionados", inSquad.filter((r) => r.status === "injured").length],
            ["Edad media", stats?.avg_age != null ? String(stats.avg_age).replace(".", ",") : "–"],
          ].map(([k, v], i) => (
            <div key={k} className="anim-score" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">{k}</div>
              <div className="sport text-4xl font-black leading-none sm:text-5xl">{typeof v === "number" ? <CountUp value={v} /> : v}</div>
            </div>
          ))}
        </div>
        {inSquad.length > 0 && (
          <div className="relative mt-5">
            <div className="anim-fill flex h-3 overflow-hidden rounded-full bg-white/10" style={{ animationDelay: "250ms" }}>
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
              className={`sport flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-black transition ${view === v ? "tab-on bg-negro text-white" : "text-negro/60 hover:text-negro"}`}>
              <Icon size={15} /> {label}
            </Link>
          ))}
        </div>
        {view !== "campo" && (
          <div className="flex gap-1" role="group" aria-label="Ordenar">
            {SQUAD_ORDERS.map((o) => (
              <Link key={o.key} href={link({ orden: o.key })} prefetch aria-current={order === o.key ? "true" : undefined}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${order === o.key ? "tab-on bg-negro text-white" : "bg-white text-negro/70 ring-1 ring-black/10 hover:ring-negro/30"}`}>
                {o.label}
              </Link>
            ))}
          </div>
        )}
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
          {order !== "lineas" && <input type="hidden" name="orden" value={order} />}
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-negro/60" />
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
          <span aria-hidden className="mb-3 block h-8 overflow-hidden"><span className="inline-block [--roll:90px]"><Ball size={30} className="anim-roll" /></span></span>
          {canCreate ? (
            <>
              Aún no hay jugadores en la temporada {season}.{" "}
              {seasons.includes(prevSeason(season)) ? (
                <Link href={`/plantilla/nueva-temporada?desde=${seasonSlug(prevSeason(season))}`} className="font-semibold text-rojo">Cópiala de la temporada {prevSeason(season)}</Link>
              ) : (
                <Link href={`/plantilla/nuevo?temporada=${seasonSlug(season)}`} className="font-semibold text-rojo">Da de alta al primero</Link>
              )}
              .
            </>
          ) : (
            <>Aún no hay jugadores en la temporada {season}.</>
          )}
        </Empty>
      ) : view === "campo" ? (
        <>
          <Pitch roster={inSquad} hrefFor={hrefFor} />
          <p className="mt-2 text-center text-xs text-negro/65">Cada jugador aparece en su línea. Los lesionados y las bajas temporales salen atenuados.</p>
        </>
      ) : shown.length === 0 ? (
        <Empty>Ningún jugador cumple esos filtros.</Empty>
      ) : view === "lista" ? (
        <div className="card overflow-x-auto p-0 sm:p-0">
          <table className="table">
            <thead>
              <tr><th className="w-10 text-center">#</th><th>Jugador</th><th>Posición</th><th className="hidden text-center md:table-cell" title="Partidos jugados">PJ</th><th className="hidden text-center md:table-cell" title="Goles">GOL</th><th className="hidden text-center md:table-cell" title="Asistencias">ASI</th><th className="hidden lg:table-cell">Pierna</th><th className="hidden sm:table-cell">Estado</th></tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.id} className="anim-rise hover:bg-gris/60" style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}>
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
                        <span className="block truncate text-xs font-normal text-negro/65">
                          {shirtName(r.player)}
                          {r.status !== "active" && <span className={`badge ml-1 sm:hidden ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>}
                        </span>
                      </span>
                      <Armband kind={r.armband} />
                    </Link>
                  </td>
                  <td><PositionChip code={r.position} /> <span className="hidden text-xs text-negro/60 md:inline">{POSITION_LABEL[r.position]}</span></td>
                  <td className="hidden text-center font-bold tabular-nums md:table-cell">{r.apps}</td>
                  <td className="hidden text-center font-bold tabular-nums md:table-cell">{r.goals}</td>
                  <td className="hidden text-center font-bold tabular-nums md:table-cell">{r.assists}</td>
                  <td className="hidden text-negro/70 lg:table-cell">{r.player.foot ? FOOT_LABEL[r.player.foot] : "—"}</td>
                  <td className="hidden sm:table-cell"><span className={`badge ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : order === "lineas" ? (
        <div className="space-y-7">
          {groupByLine(shown).map(({ line: l, rows }, gi) => (
            <section key={l.key} aria-labelledby={`linea-${l.slug}`}>
              <div className="anim-rise mb-3 flex items-center gap-3" style={{ animationDelay: `${gi * 60}ms` }}>
                <span className={`h-3 w-3 shrink-0 rounded-full ${LINE_TONE[l.key].dot}`} />
                <h2 id={`linea-${l.slug}`} className="sport text-2xl font-black leading-none">{l.plural}</h2>
                <span className="sport text-lg font-black text-negro/60">{rows.length}</span>
                <span aria-hidden className="h-0.5 flex-1 bg-[linear-gradient(90deg,var(--color-dorado),transparent)]" />
              </div>
              <div className={CARD_GRID}>
                {rows.map((r, i) => <PlayerCard key={r.id} entry={r} href={hrefFor(r.player_id)} index={i} form={r.player_id === lastMvp} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={CARD_GRID}>
          {shown.map((r, i) => <PlayerCard key={r.id} entry={r} href={hrefFor(r.player_id)} index={i} form={r.player_id === lastMvp} />)}
        </div>
      )}

      {!canPrivate && (
        <p className="mt-6 text-center text-xs text-negro/65">Los teléfonos y demás datos personales solo los ven los gestores.</p>
      )}
    </>
  );
}

function Chip({ href, on, dot, children }: { href: string; on: boolean; dot?: string; children: React.ReactNode }) {
  return (
    <Link href={href} prefetch
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition ${on ? "tab-on bg-negro text-white" : "bg-white text-negro/70 ring-1 ring-black/10 hover:ring-negro/30"}`}>
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}{children}
    </Link>
  );
}

const CARD_GRID = "grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-6 md:grid-cols-4 xl:grid-cols-5";

