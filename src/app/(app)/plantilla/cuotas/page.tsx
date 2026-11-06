import Link from "next/link";
import { Wallet } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { euros, fecha } from "@/lib/format";
import { fetchFees, fetchRoster, fetchSeasons } from "@/lib/squad-queries";
import {
  FEE_STATUS_LABEL, FEE_STATUS_TONE, feeOf, feeStatus, fullName, lineOf, seasonFromSlug, seasonSlug, shirtName, type FeeStatus,
} from "@/lib/squad";
import { Empty, PageHeader } from "@/components/ui";
import { Jersey } from "@/components/squad/jersey";
import { Ball } from "@/components/squad/ball";
import { CountUp } from "@/components/squad/count-up";
import { FeeOverrideForm, FeePaymentForm, FeePlanForm } from "@/components/squad/fee-forms";
import { registerFeePayment, saveFeeOverride, saveFeePlan } from "./actions";

export const metadata = { title: "Cuotas de la plantilla" };

const FILTERS: { key: FeeStatus | "debe" | "todos"; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "debe", label: "Deben" },
  { key: "paid", label: "Pagadas" },
  { key: "exempt", label: "Exentos" },
];

export default async function FeesPage({ searchParams }: { searchParams: Promise<{ temporada?: string; filtro?: string }> }) {
  const sp = await searchParams;
  const s = await requirePerm("finances", "read");
  const supabase = await createClient();
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const filter = FILTERS.some((f) => f.key === sp.filtro) ? sp.filtro! : "todos";
  const [roster, seasons, fees] = await Promise.all([fetchRoster(supabase, season), fetchSeasons(supabase), fetchFees(supabase, season)]);

  // En la lista: los de la plantilla y los que se fueron pero pagaron algo
  const rows = roster
    .filter((r) => r.status !== "left" || fees.paid.has(r.player_id))
    .map((r) => {
      const due = feeOf(fees.plan, fees.overrides.get(r.player_id));
      const paid = fees.paid.get(r.player_id) ?? 0;
      return { r, due, paid, status: feeStatus(due, paid), override: fees.overrides.get(r.player_id) ?? null };
    });
  const expected = rows.reduce((a, x) => a + (x.due ?? 0), 0);
  const collected = rows.reduce((a, x) => a + x.paid, 0);
  const pendingTotal = rows.reduce((a, x) => a + Math.max(0, (x.due ?? 0) - x.paid), 0);
  const owing = rows.filter((x) => x.status === "pending" || x.status === "partial");
  const shown = rows
    .filter((x) => filter === "todos" || (filter === "debe" ? x.status === "pending" || x.status === "partial" : x.status === filter))
    .sort((a, b) => Math.max(0, (b.due ?? 0) - b.paid) - Math.max(0, (a.due ?? 0) - a.paid) || (a.r.number ?? 99) - (b.r.number ?? 99));
  const pct = expected ? Math.min(100, Math.round((collected / expected) * 100)) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const canPay = s.can("finances", "create");
  const canEdit = s.can("finances", "update");
  const link = (p: { temporada?: string; filtro?: string }) => {
    const qs = new URLSearchParams({ temporada: seasonSlug(season), ...(filter !== "todos" ? { filtro: filter } : {}), ...p });
    if (qs.get("filtro") === "todos") qs.delete("filtro");
    return `/plantilla/cuotas?${qs}`;
  };

  return (
    <>
      <PageHeader title="Cuotas" subtitle={<>Lo que paga cada jugador en la temporada <b>{season}</b>. Cada pago se apunta como ingreso en Finanzas.</>}
        back={{ href: `/plantilla?temporada=${seasonSlug(season)}`, label: "Plantilla" }} />

      {seasons.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {seasons.map((t) => (
            <Link key={t} href={link({ temporada: seasonSlug(t) })} prefetch
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 ${t === season ? "bg-rojo text-white ring-rojo" : "bg-white text-negro/70 ring-black/10 hover:ring-rojo"}`}>{t}</Link>
          ))}
        </div>
      )}

      {/* Marcador de la recaudación */}
      <section className="franja relative mb-6 overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl sm:p-6">
        <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Cuota general", fees.plan ? euros(fees.plan.amount_cents) : "Sin poner", null],
            ["Cobrado", euros(collected), "text-green-400"],
            ["Pendiente", euros(pendingTotal), pendingTotal ? "text-red-400" : ""],
            ["Deben", owing.length, ""],
          ].map(([k, v, tone], i) => (
            <div key={String(k)} className="anim-score" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">{k}</div>
              <div className={`sport text-3xl font-black leading-none sm:text-4xl ${tone ?? ""}`}>{typeof v === "number" ? <CountUp value={v} /> : v}</div>
            </div>
          ))}
        </div>
        {expected > 0 && (
          <div className="relative mt-5">
            <div className="relative h-4 rounded-full bg-white/10">
              <div className="anim-fill absolute inset-y-0 left-0 rounded-full bg-[repeating-linear-gradient(90deg,#1f7a3a_0_16px,#2a8f47_16px_32px)]" style={{ width: `${pct}%` }} />
              <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${Math.max(pct, 2)}%` }}><Ball size={24} className="anim-spin drop-shadow" /></span>
            </div>
            <p className="mt-2 text-xs text-white/75"><b className="text-white">{pct}%</b> cobrado de {euros(expected)}{fees.plan?.due_on ? ` · hay que pagar antes del ${fecha(fees.plan.due_on)}` : ""}</p>
          </div>
        )}
      </section>

      {canEdit && (
        <section className="card mb-6">
          <h2 className="mb-1">Cuota general de {season}</h2>
          <p className="mb-3 text-xs text-negro/65">La pagan todos, salvo a quien le pongas una cuota especial (descuento o exento) desde su fila.</p>
          <FeePlanForm action={saveFeePlan.bind(null, season)} plan={fees.plan} />
          {fees.plan?.notes && <p className="mt-2 text-sm text-negro/60">{fees.plan.notes}</p>}
        </section>
      )}

      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <Link key={f.key} href={link({ filtro: f.key })} prefetch
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition ${filter === f.key ? "bg-negro text-white" : "bg-white text-negro/70 ring-1 ring-black/10 hover:ring-negro/30"}`}>
            {f.label}{f.key === "debe" ? ` · ${owing.length}` : ""}
          </Link>
        ))}
      </div>

      {!roster.length ? (
        <Empty>No hay plantilla en {season}.</Empty>
      ) : !shown.length ? (
        <Empty>Nadie en este filtro. {filter === "debe" && "¡Todo cobrado!"}</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map(({ r, due, paid, status, override }, i) => {
            const left = due != null ? Math.max(0, due - paid) : 0;
            const p = due ? Math.min(100, Math.round((paid / due) * 100)) : paid > 0 ? 100 : 0;
            return (
              <li key={r.id} className="anim-rise card p-3 sm:p-4" style={{ animationDelay: `${Math.min(i, 20) * 35}ms` }}>
                <div className="flex items-center gap-3">
                  <Link href={`/plantilla/${r.player_id}?temporada=${seasonSlug(season)}`} className="group flex min-w-0 flex-1 items-center gap-3">
                    {r.player.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.player.photo_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-dorado" />
                    ) : (
                      <span className="shrink-0 transition group-hover:-rotate-6"><Jersey number={r.number} goalkeeper={lineOf(r.position) === "GK"} size={42} /></span>
                    )}
                    <span className="min-w-0">
                      <span className="sport block truncate text-lg font-black leading-tight group-hover:text-rojo">{r.number != null && <span className="mr-1 text-negro/60">{r.number}</span>}{shirtName(r.player)}</span>
                      <span className="block truncate text-xs text-negro/65">{fullName(r.player)}{override ? ` · cuota especial${override.reason ? `: ${override.reason}` : ""}` : ""}{r.status === "left" ? " · se fue" : ""}</span>
                    </span>
                  </Link>
                  <span className="text-right">
                    <span className={`badge ${FEE_STATUS_TONE[status]}`}>{FEE_STATUS_LABEL[status]}</span>
                    <span className="mt-1 block text-sm font-bold tabular-nums">{euros(paid)}<span className="font-normal text-negro/60"> / {due != null ? euros(due) : "–"}</span></span>
                  </span>
                </div>
                {due != null && due > 0 && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
                    <div className="anim-fill h-full rounded-full bg-green-600" style={{ width: `${p}%`, animationDelay: `${200 + Math.min(i, 20) * 35}ms` }} />
                  </div>
                )}
                {(canPay && left > 0) || canEdit ? (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {canPay && left > 0 && (
                      <details className="w-full">
                        <summary className="cursor-pointer text-sm font-bold text-rojo">Cobrar {euros(left)}</summary>
                        <div className="mt-2"><FeePaymentForm action={registerFeePayment.bind(null, season, r.player_id)} suggested={left} today={today} compact /></div>
                      </details>
                    )}
                    {canEdit && (
                      <details className="w-full">
                        <summary className="cursor-pointer text-xs font-bold text-negro/65">Cuota especial</summary>
                        <div className="mt-2"><FeeOverrideForm action={saveFeeOverride.bind(null, season, r.player_id)} current={override} general={fees.plan?.amount_cents ?? null} /></div>
                      </details>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-negro/65"><Wallet size={14} /> Los jugadores no ven las cuotas: solo quien tiene acceso a Finanzas.</p>
    </>
  );
}
