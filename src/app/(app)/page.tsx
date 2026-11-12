import Link from "next/link";
import { Award, BarChart3, Mic, ShoppingCart, Shirt, Ticket, Wallet } from "lucide-react";
import { fetchCallups, fetchMatchday, fetchMatchdayFocus, fetchMatchdayPreview, fetchMyPlayerId, fetchPlayerLog, fetchReport } from "@/lib/match-queries";
import { MatchdayDetails, MatchdayHero } from "@/components/matches/matchday";
import { fetchMatchWeather } from "@/lib/weather";
import { MyCallupCard, callupOpen } from "@/components/matches/callup-section";
import { PorraCard } from "@/components/matches/porra";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros, fecha } from "@/lib/format";
import { Progress } from "@/components/ui";
import type { Campaign, Summary } from "@/lib/types";
import { seasonOf, seasonRange, type FinanceSummary } from "@/lib/finance";
import { fetchRoster } from "@/lib/squad-queries";
import { form, record } from "@/lib/matches";
import { MySeason } from "@/components/squad/my-season";
import { SponsorStrip } from "@/components/sponsors/showcase";
import { fetchDisplay, type Showcase } from "@/lib/sponsors";
import { PollCard } from "@/components/polls/poll-card";
import type { Poll } from "@/lib/polls";
import { fetchMvpBoard } from "@/lib/mvp-server";
import { countPublished, fetchMyPendingInterviews, fetchPendingChronicle, fetchPublished } from "@/lib/news-queries";
import { isFeaturedNow } from "@/lib/news";
import { HomeFront, HomeLatest } from "@/components/news/home";
import { competitionShort } from "@/lib/season-summary-queries";

const LG_COLS: Record<number, string> = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const s = await getSession();
  const supabase = await createClient();
  const isAdmin = s.can("lottery_admin");
  const canSell = s.can("lottery_sell", "create");

  // Campaña activa más reciente visible para el usuario
  let campaign: Campaign | null = null;
  if (isAdmin) {
    const { data } = await supabase.from("lottery_campaigns").select("*").in("status", ["active", "closed"]).is("archived_at", null).order("created_at", { ascending: false }).limit(1).returns<Campaign[]>();
    campaign = data?.[0] ?? null;
  } else if (canSell) {
    const { data } = await supabase
      .from("lottery_campaign_sellers")
      .select("campaign:lottery_campaigns!inner(*)")
      .eq("user_id", s.user.id)
      .eq("campaign.status", "active")
      .limit(1);
    campaign = (data?.[0]?.campaign as unknown as Campaign) ?? null;
  }

  let summary: Summary | null = null;
  let mine = { shares: 0, total: 0, paid: 0 };
  if (campaign) {
    const [sum, own] = await Promise.all([
      supabase.rpc("lottery_campaign_summary", { p_campaign_id: campaign.id }),
      supabase.from("lottery_sales").select("quantity, total_cents, paid_cents").eq("campaign_id", campaign.id).eq("seller_id", s.user.id).is("cancelled_at", null),
    ]);
    summary = sum.data as Summary;
    for (const r of own.data ?? []) mine = { shares: mine.shares + r.quantity, total: mine.total + r.total_cents, paid: mine.paid + r.paid_cents };
  }

  // Resumen económico (solo quien puede ver Finanzas; nunca jugadores)
  let fin: FinanceSummary | null = null;
  const season = seasonOf();
  if (s.can("finances")) {
    const r = seasonRange(season)!;
    fin = (await supabase.rpc("finance_summary", { p_from: r.from, p_to: r.to })).data as FinanceSummary | null;
  }

  // Plantilla de la temporada y la ficha del propio usuario
  const roster = s.can("squad") ? await fetchRoster(supabase, season) : [];
  const squad = roster.filter((r) => r.status !== "left");
  const me = roster.find((r) => r.player.user_id === s.user.id) ?? null;
  const myLog = me && s.can("matches") ? await fetchPlayerLog(supabase, me.player_id, season) : [];

  // Partidos: el próximo y los últimos resultados
  const [matchday, focus] = s.can("matches") ? await Promise.all([fetchMatchday(supabase, 40), fetchMatchdayFocus(supabase)]) : [null, null];
  // ¿Me han convocado para el próximo partido? También durante el final y el post partido del anterior:
  // la convocatoria de la semana siguiente se publica antes de que se quite el resultado de la portada.
  const afterMatch = !!focus && (focus.phase === "final" || focus.phase === "post") && matchday?.next?.id !== focus.m.id;
  let myCallup = null;
  if ((!focus || afterMatch) && matchday?.next && callupOpen(matchday.next)) {
    const [rows, me] = await Promise.all([fetchCallups(supabase, matchday.next), fetchMyPlayerId(supabase, s.user.id)]);
    myCallup = rows.find((r) => r.player_id === me) ?? null;
  }
  // Especial Matchday: la víspera y el día del partido, Inicio se convierte en la portada del partido
  const md = focus
    ? await (async () => {
        const final = focus.phase === "final" || focus.phase === "post";
        // Votación del MVP (si ya toca, hace el recuento antes de leer el acta)
        const mvp = final ? await fetchMvpBoard(supabase, focus.m.id) : null;
        if (mvp?.winner_id) focus.m.mvp_player_id = mvp.winner_id;
        const [callups, myPlayerId, preview, report, weather] = await Promise.all([
          final ? Promise.resolve([]) : fetchCallups(supabase, focus.m),
          fetchMyPlayerId(supabase, s.user.id),
          final ? Promise.resolve({ lastH2H: null, topScorer: null, hot: [], ranks: null, stake: null }) : fetchMatchdayPreview(supabase, focus.m),
          final && focus.m.report_saved_at ? fetchReport(supabase, focus.m) : Promise.resolve(null),
          // El tiempo en Salamanca a la hora del partido: la víspera y el mismo día
          focus.phase === "eve" || focus.phase === "day" ? fetchMatchWeather(focus.m.match_date, focus.m.kickoff) : Promise.resolve(null),
        ]);
        return { ...focus, callups, myPlayerId, ...preview, report, weather, mvp };
      })()
    : null;

  // Patrocinadores (una línea discreta al final) y votaciones abiertas en las que puede votar (las que aún no ha votado, primero)
  const [display, showcase, board] = await Promise.all([fetchDisplay(supabase), supabase.rpc("sponsor_showcase"), supabase.rpc("poll_board", { p_limit: 10 })]);
  const polls = ((board.data ?? []) as Poll[])
    .filter((p) => p.open && p.can_vote)
    .sort((a, b) => Number(a.my_vote !== null) - Number(b.my_vote !== null));
  const canManagePolls = s.can("users", "update") || s.can("lottery_admin", "update");

  // La Voz del Rayo: si hay una noticia destacada (3 días), Inicio se abre como la portada del periódico
  const [news, newsCount, pendingChronicle] = s.can("news")
    ? await Promise.all([fetchPublished(supabase, { limit: 6 }), countPublished(supabase), s.can("news", "create") ? fetchPendingChronicle(supabase) : null])
    : [[], 0, null];
  // ¿Se acaba de terminar una liga (el Apertura…)? Tres semanas con el acceso a «Tu resumen»
  let ended: { competition: string; name: string } | null = null;
  if (s.can("matches")) {
    const { data: done } = await supabase.from("league_competitions").select("competition, name").eq("finished", true);
    for (const c of done ?? []) {
      const { data: lastM } = await supabase.from("matches").select("match_date").eq("league_competition", c.competition).eq("status", "played").order("match_date", { ascending: false }).limit(1).maybeSingle();
      if (lastM && Date.now() - new Date(lastM.match_date + "T12:00:00").getTime() < 21 * 86_400_000) { ended = { competition: c.competition, name: competitionShort(c.name) }; break; }
    }
  }
  // Entrevistas que me ha mandado la redacción y aún no he entregado
  const myInterviews = await fetchMyPendingInterviews(supabase, s.user.id);
  const featured = news.find((a) => isFeaturedNow(a)) ?? null;
  const latest = news[0] && Date.now() - new Date(news[0].published_at ?? 0).getTime() < 14 * 86_400_000 ? news[0] : null;
  const front = featured && <HomeFront lead={featured} others={news.filter((a) => a.id !== featured.id).slice(0, 2)} count={newsCount} />;
  // La víspera y el día del partido manda el Matchday: el periódico va justo debajo
  const matchFirst = !!md && md.phase !== "post";

  const sponsors = display.show_home ? ((showcase.data ?? []) as Showcase[]) : [];

  const firstName = s.profile.full_name.split(" ")[0];
  const greeting = `¡Hola, ${firstName}! ⚡`;
  const recentForm = form(matchday?.recent ?? []);
  const seasonRecord = record((matchday?.recent ?? []).filter((m) => m.season === season));
  const sellNow = campaign && campaign.status === "active" && canSell;
  const available = squad.filter((r) => r.status === "active").length;
  const injured = squad.filter((r) => r.status === "injured").length;

  // Accesos rápidos: un dato y su enlace (el detalle está en cada pestaña)
  const tiles: { href: string; icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }[] = [];
  if (fin) tiles.push({ href: "/finanzas", icon: <Wallet size={18} />, label: "Saldo", value: euros(fin.balance_cents), hint: `Resultado ${season}: ${euros(fin.income_cents - fin.expense_cents)}` });
  if (s.can("squad")) tiles.push({ href: "/plantilla", icon: <Shirt size={18} />, label: `Plantilla ${season}`, value: `${available}/${squad.length}`, hint: injured ? `disponibles · ${injured} lesionado${injured > 1 ? "s" : ""}` : "disponibles" });
  if (s.can("matches")) tiles.push({ href: "/partidos/estadisticas", icon: <BarChart3 size={18} />, label: "Estadísticas", value: seasonRecord.played ? `${seasonRecord.W}-${seasonRecord.D}-${seasonRecord.L}` : "–", hint: seasonRecord.played ? `V-E-D · ${seasonRecord.played} jugados` : "sin partidos jugados" });

  return (
    <>
      {error === "permiso" && (
        <div className="mb-4 rounded-xl bg-rojo/10 p-3 text-sm font-medium text-rojo">No tienes permiso para acceder a esa sección.</div>
      )}

      {/* 0 · Modo periódico: la noticia destacada abre Inicio (salvo la víspera y el día del partido) */}
      {front && !matchFirst && front}

      {/* 1 · El partido: siempre en portada, según el momento */}
      {md ? (
        <>
          <MatchdayHero m={md.m} phase={md.phase} greeting={greeting} form={recentForm} next={afterMatch ? matchday?.next ?? null : null} weather={md.weather} />
          {myCallup && matchday?.next && <div className="mb-6"><MyCallupCard m={matchday.next} mine={myCallup} withMatch /></div>}
          {/* La porra para quien no la tiene ya en su tarjeta de convocado */}
          {afterMatch && !myCallup && matchday?.next && <PorraCard m={matchday.next} withMatch />}
          {!afterMatch && (md.phase === "eve" || md.phase === "day") && !(md.myPlayerId && md.callups.some((c) => c.player_id === md.myPlayerId) && callupOpen(md.m)) && <PorraCard m={md.m} />}
          <MatchdayDetails m={md.m} phase={md.phase} callups={md.callups} myPlayerId={md.myPlayerId} canEdit={s.can("matches", "update")}
            recent={matchday?.recent ?? []} lastH2H={md.lastH2H} topScorer={md.topScorer} report={md.report} mvp={md.mvp}
            hot={md.hot} ranks={md.ranks} stake={md.stake} />
        </>
      ) : matchday?.next ? (
        <>
          <MatchdayHero m={matchday.next} phase="week" greeting={greeting} form={recentForm} />
          {myCallup ? <div className="mb-6"><MyCallupCard m={matchday.next} mine={myCallup} meet={false} /></div> : <PorraCard m={matchday.next} />}
        </>
      ) : (
        <section className="franja relative mb-6 overflow-hidden rounded-3xl bg-negro p-6 text-white shadow-xl sm:p-8">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.10),transparent_55%)]" />
          <div className="relative flex items-center gap-4 sm:gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/escudo.png" alt="Escudo del Rayo Vallecañas" width={84} height={100} className="w-16 shrink-0 drop-shadow-2xl sm:w-20" />
            <div className="min-w-0">
              <p className="sport text-sm font-bold tracking-[0.15em] text-dorado">{greeting}</p>
              <h1 className="sport text-4xl leading-[0.9] font-black sm:text-5xl">Rayo<br className="sm:hidden" /> Vallecañas</h1>
              <p className="mt-2 text-sm text-white/60">{fecha(new Date())}{s.can("matches") ? " · Sin partidos programados" : ""}</p>
            </div>
          </div>
        </section>
      )}

      {front && matchFirst && front}
      {!featured && <HomeLatest a={latest} pending={pendingChronicle} />}

      {/* La Voz del Rayo quiere entrevistarte */}
      {myInterviews.map((iv) => (
        <Link key={iv.id} href={`/la-voz/entrevista/${iv.id}`} prefetch className="group paper mb-6 flex items-center gap-4 rounded-2xl p-4 shadow-sm ring-1 ring-black/10 transition hover:ring-dorado">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-negro text-dorado ring-2 ring-dorado"><Mic size={22} /></span>
          <span className="min-w-0 flex-1">
            <span className="news-head block text-xs font-bold uppercase tracking-[0.2em] text-rojo">La Voz del Rayo</span>
            <span className="news-head block text-lg font-black leading-tight">Quiere entrevistarte</span>
            <span className="block text-sm text-negro/60">
              {iv.questions.length} pregunta{iv.questions.length > 1 ? "s" : ""}{iv.questions.some((x) => x.a) ? ` · llevas ${iv.questions.filter((x) => x.a).length}` : ""}
            </span>
          </span>
          <span className="shrink-0 text-sm font-bold text-rojo transition group-hover:translate-x-0.5">Contestar →</span>
        </Link>
      ))}

      {/* Se acabó la liga: el resumen de cada uno */}
      {ended && (
        <Link href={`/partidos/resumen?de=c${ended.competition}`} prefetch className="group franja relative mb-6 flex items-center gap-4 overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-lg transition hover:shadow-xl">
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-dorado/15 ring-2 ring-dorado"><Award size={24} className="text-dorado" /></span>
          <span className="relative min-w-0 flex-1">
            <span className="sport block text-xs font-black tracking-[0.2em] text-dorado">¡SE ACABÓ EL {ended.name.toUpperCase()}!</span>
            <span className="sport block text-2xl font-black leading-tight">Mira tu resumen</span>
            <span className="block text-sm text-white/75">Tus partidos, goles, MVP y tu mejor partido, en una imagen para compartir.</span>
          </span>
          <span className="relative shrink-0 text-sm font-bold text-dorado transition group-hover:translate-x-0.5">→</span>
        </Link>
      )}

      {/* Votaciones abiertas */}
      {polls.length > 0 && (
        <section aria-label="Votaciones" className="mb-6 space-y-3">
          <div className={`grid gap-3 ${polls.length > 1 ? "lg:grid-cols-2" : ""}`}>
            {polls.slice(0, 2).map((p) => <PollCard key={p.id} p={p} canManage={canManagePolls} compact />)}
          </div>
          <Link href="/votaciones" prefetch className="inline-block text-sm font-bold text-rojo hover:underline">
            {polls.length > 2 ? `Ver las ${polls.length} votaciones abiertas →` : "Ver votaciones →"}
          </Link>
        </section>
      )}

      {/* 2 · Tu ficha: cromo y temporada */}
      {me && <MySeason entry={me} squad={squad} log={myLog} season={season} />}

      {/* 3 · Accesos rápidos */}
      {(campaign && summary) || tiles.length ? (
        <section aria-label="Accesos rápidos" className={`mb-6 grid grid-cols-2 gap-3 ${LG_COLS[Math.min(5, (campaign && summary ? 2 : 0) + tiles.length)] ?? ""}`}>
          {campaign && summary && (
            <div className="col-span-2 flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <Link href={`/loteria/${campaign.id}`} prefetch className="group flex items-center gap-2">
                <Ticket size={18} className="shrink-0 text-rojo" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{campaign.name}</span>
                <span className="shrink-0 text-xs font-bold text-rojo transition group-hover:translate-x-0.5">Ver →</span>
              </Link>
              <div className="flex items-baseline justify-between gap-2">
                <span className="sport text-3xl font-black tabular-nums leading-none">{Math.round((summary.sold / Math.max(1, summary.total)) * 100)}%<span className="ml-1.5 text-sm font-bold text-negro/65">vendido</span></span>
                <span className="text-right text-xs text-negro/65">
                  {isAdmin ? <>Recaudado <b className="text-negro">{euros(summary.paid_cents)}</b></> : <>Tus {campaign.kind === "raffle" ? "números" : "participaciones"}: <b className="text-negro">{mine.shares}</b>{mine.total - mine.paid > 0 && <> · pendiente <b className="text-negro">{euros(mine.total - mine.paid)}</b></>}</>}
                </span>
              </div>
              <Progress value={summary.sold} total={summary.total} />
              {sellNow && (
                <Link href={`/loteria/${campaign.id}/vender`} prefetch className="btn-primary mt-1 w-full">
                  <ShoppingCart size={18} /> {campaign.kind === "raffle" ? "Nueva venta de rifa" : "Nueva venta de lotería"}
                </Link>
              )}
            </div>
          )}
          {tiles.map((t, i) => (
            <Link key={t.href} href={t.href} prefetch
              className={`${tiles.length % 2 && i === tiles.length - 1 ? "col-span-2 lg:col-span-1" : ""} group relative flex flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-rojo/40`}>
              <span aria-hidden className="absolute -right-3 top-0 h-full w-5 -skew-x-[20deg] bg-negro/[0.06]" />
              <span className="relative flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-negro/65"><span className="text-rojo">{t.icon}</span> {t.label}</span>
              <span className="sport relative mt-1 truncate text-3xl font-black tabular-nums leading-none">{t.value}</span>
              {t.hint && <span className="relative mt-1 text-xs text-negro/65">{t.hint}</span>}
            </Link>
          ))}
        </section>
      ) : null}

      <SponsorStrip sponsors={sponsors} />
    </>
  );
}
