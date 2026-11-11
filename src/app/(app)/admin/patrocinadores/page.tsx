import Link from "next/link";
import { AlertTriangle, CalendarClock, Gift, Handshake, Plus } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf, today as todayMadrid } from "@/lib/finance";
import { euros, fecha } from "@/lib/format";
import {
  SHOWN_LABEL, SHOWN_TONE, TIER_LABEL, daysTo, fetchAgreements, fetchDisplay, hasInKind, money, shownStatus, type Agreement, type Sponsor,
} from "@/lib/sponsors";
import { Empty, PageHeader } from "@/components/ui";
import { SponsorLogo } from "@/components/sponsors/logo";
import { DisplayForm } from "@/components/sponsors/forms";
import { saveDisplay } from "./actions";

export const metadata = { title: "Patrocinadores" };

export default async function SponsorsPage({ searchParams }: { searchParams: Promise<{ temporada?: string }> }) {
  const sp = await searchParams;
  const s = await requirePerm("sponsors", "read");
  const supabase = await createClient();
  const current = seasonOf();
  const season = /^\d{4}-\d{2}$/.test(sp.temporada ?? "") ? sp.temporada!.replace("-", "/") : current;
  const today = todayMadrid();

  const [{ data: sponsorRows }, agreements, { data: seasonRows }, display] = await Promise.all([
    supabase.from("sponsors").select("*").order("active", { ascending: false }).order("tier").order("sort").order("name").returns<Sponsor[]>(),
    fetchAgreements(supabase, { season }),
    supabase.from("sponsor_agreements").select("season"),
    fetchDisplay(supabase),
  ]);
  const sponsors = sponsorRows ?? [];
  const seasons = [...new Set([current, ...((seasonRows ?? []) as { season: string }[]).map((r) => r.season)])].sort().reverse();
  const bySponsor = new Map<string, Agreement[]>();
  for (const a of agreements) bySponsor.set(a.sponsor_id, [...(bySponsor.get(a.sponsor_id) ?? []), a]);

  // Marcador de la temporada (solo acuerdos firmados)
  const live = agreements.filter((a) => a.status === "signed");
  const totals = live.reduce((t, a) => {
    const m = money(a, today);
    return { agreed: t.agreed + m.total, paid: t.paid + m.paid, pending: t.pending + m.pending, overdue: t.overdue + m.overdue.length };
  }, { agreed: 0, paid: 0, pending: 0, overdue: 0 });
  const inKind = live.filter(hasInKind).length;
  const expiring = live.filter((a) => a.ends_on && daysTo(a.ends_on, today) >= 0 && daysTo(a.ends_on, today) <= 30);
  const pct = totals.agreed ? Math.min(100, Math.round((totals.paid / totals.agreed) * 100)) : 0;
  const activeSponsors = sponsors.filter((x) => x.active);
  const former = sponsors.filter((x) => !x.active);

  const card = (sp: Sponsor, i: number) => {
    const ags = bySponsor.get(sp.id) ?? [];
    const main = ags.find((a) => a.status !== "cancelled") ?? ags[0];
    const m = main ? money(main, today) : null;
    const st = main ? shownStatus(main, today) : null;
    return (
      <li key={sp.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
        <Link href={`/admin/patrocinadores/${sp.id}`} prefetch
          className="card contract-clip group flex h-full flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:ring-rojo/40">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-black/10">
              <SponsorLogo sponsor={sp} className="max-h-14" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="sport truncate text-xl font-black leading-tight group-hover:text-rojo">{sp.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className={`badge ${sp.tier === "main" ? "bg-dorado text-negro" : "bg-black/5 text-negro/70"}`}>{TIER_LABEL[sp.tier]}</span>
                {st && <span className={`badge ${SHOWN_TONE[st]}`}>{SHOWN_LABEL[st]}</span>}
              </p>
            </div>
          </div>
          {!main ? (
            <p className="text-sm text-negro/60">Sin acuerdo en {season}.</p>
          ) : (
            <div className="space-y-1.5">
              {m && m.total > 0 && (
                <>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-bold tabular-nums">{euros(m.paid)} <span className="font-normal text-negro/60">de {euros(m.total)}</span></span>
                    {m.pending > 0 && <span className="text-xs text-negro/65">Faltan {euros(m.pending)}</span>}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                    <div className="anim-fill h-full rounded-full bg-green-600" style={{ width: `${m.total ? Math.min(100, (m.paid / m.total) * 100) : 0}%` }} />
                  </div>
                </>
              )}
              {hasInKind(main) && main.in_kind && <p className="flex items-start gap-1.5 text-xs text-negro/70"><Gift size={14} className="mt-px shrink-0 text-rojo" /> {main.in_kind}</p>}
              {m && m.overdue.length > 0 ? (
                <p className="flex items-center gap-1.5 text-xs font-bold text-rojo"><AlertTriangle size={14} /> {m.overdue.length === 1 ? `Plazo sin cobrar desde el ${fecha(m.overdue[0].due_on)}` : `${m.overdue.length} plazos sin cobrar`}</p>
              ) : m?.next && main.status === "signed" ? (
                <p className="flex items-center gap-1.5 text-xs text-negro/65"><CalendarClock size={14} /> Próximo cobro: {euros(m.next.amount_cents)} el {fecha(m.next.due_on)}</p>
              ) : null}
            </div>
          )}
        </Link>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Patrocinadores" subtitle={<>Fichas, acuerdos y cobros de la temporada <b>{season}</b>. Cada cobro se apunta como ingreso en Finanzas.</>}
        actions={s.can("sponsors", "create") ? <Link href="/admin/patrocinadores/nuevo" prefetch className="btn-primary"><Plus size={18} /> Nuevo patrocinador</Link> : undefined} />

      {seasons.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {seasons.map((t) => (
            <Link key={t} href={`/admin/patrocinadores?temporada=${t.replace("/", "-")}`} prefetch
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 ${t === season ? "bg-rojo text-white ring-rojo" : "bg-white text-negro/70 ring-black/10 hover:ring-rojo"}`}>{t}</Link>
          ))}
        </div>
      )}

      <section className="franja relative mb-6 overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl sm:p-6">
        <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
          {([
            ["Acordado", euros(totals.agreed), ""],
            ["Cobrado", euros(totals.paid), "text-green-400"],
            ["Pendiente", euros(totals.pending), totals.pending ? "text-red-400" : ""],
            ["En especie", String(inKind), ""],
          ] as const).map(([k, v, tone], i) => (
            <div key={k} className="anim-score" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">{k}</div>
              <div className={`sport text-3xl font-black leading-none sm:text-4xl ${tone}`}>{v}</div>
            </div>
          ))}
        </div>
        {totals.agreed > 0 && (
          <div className="relative mt-5">
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div className="anim-fill h-full rounded-full bg-[repeating-linear-gradient(90deg,#1f7a3a_0_16px,#2a8f47_16px_32px)]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-white/75"><b className="text-white">{pct}%</b> cobrado de los acuerdos firmados</p>
          </div>
        )}
      </section>

      {(totals.overdue > 0 || expiring.length > 0) && (
        <div className="mb-5 space-y-1.5 rounded-2xl bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
          {totals.overdue > 0 && <p className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle size={16} className="shrink-0" /> <span>{totals.overdue === 1 ? "Hay un plazo" : `Hay ${totals.overdue} plazos`} sin cobrar con la fecha pasada.</span></p>}
          {expiring.map((a) => (
            <p key={a.id} className="flex items-center gap-2 text-amber-900"><CalendarClock size={16} className="shrink-0" /> <span>El acuerdo con <b>{sponsors.find((x) => x.id === a.sponsor_id)?.name}</b> vence el {fecha(a.ends_on)}.</span></p>
          ))}
        </div>
      )}

      {!sponsors.length ? (
        <Empty>Todavía no hay patrocinadores.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{activeSponsors.map(card)}</ul>
      )}

      {former.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-bold text-negro/65">Antiguos patrocinadores · {former.length}</summary>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{former.map(card)}</ul>
        </details>
      )}

      <section className="card mt-8">
        <h2 className="mb-1">Dónde se muestran los logos</h2>
        <p className="mb-3 text-xs text-negro/65">Solo salen los patrocinadores actuales que tienen logo. Nunca se enseñan importes.</p>
        <DisplayForm action={saveDisplay} display={display} canEdit={s.can("sponsors", "update")} />
      </section>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-negro/65"><Handshake size={14} /> Los jugadores no ven los importes ni los contratos: solo los logos.</p>
    </>
  );
}
