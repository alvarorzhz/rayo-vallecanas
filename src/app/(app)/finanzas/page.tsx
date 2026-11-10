import Link from "next/link";
import { BarChart3, Minus, Plus, Scale, Settings2, List, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros, fecha } from "@/lib/format";
import { Empty, Hero, PageHeader } from "@/components/ui";
import { MovementsTable } from "@/components/finance/movements-table";
import { MOVEMENT_SELECT, seasonOf, seasonRange, type FinanceSummary, type MovementRow } from "@/lib/finance";

export const metadata = { title: "Finanzas" };

export default async function FinancesPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const sp = await searchParams;
  const s = await requirePerm("finances");
  const supabase = await createClient();
  const season = sp.t && seasonRange(sp.t) ? sp.t : seasonOf();
  const range = seasonRange(season)!;

  const [{ data: sum }, { data: seasons }, { data: latest }, { data: byCat }] = await Promise.all([
    supabase.rpc("finance_summary", { p_from: range.from, p_to: range.to }),
    supabase.rpc("finance_seasons"),
    supabase.from("finance_movements").select(MOVEMENT_SELECT).eq("season", season).order("op_date", { ascending: false }).order("created_at", { ascending: false }).limit(8).returns<MovementRow[]>(),
    supabase.from("finance_movements").select("kind, amount_cents, category:finance_categories(name)").eq("season", season).is("voided_at", null).returns<{ kind: string; amount_cents: number; category: { name: string } | null }[]>(),
  ]);
  const summary = sum as FinanceSummary;
  const result = summary.income_cents - summary.expense_cents;

  // Reparto por categorías de la temporada
  const cats: Record<string, Record<string, number>> = { income: {}, expense: {} };
  for (const r of byCat ?? []) {
    const k = r.category?.name ?? "—";
    cats[r.kind][k] = (cats[r.kind][k] ?? 0) + r.amount_cents;
  }
  const top = (kind: "income" | "expense") => Object.entries(cats[kind]).sort((a, b) => b[1] - a[1]);
  const seasonList = [...new Set([...(seasons as string[] ?? []), season])].sort().reverse();

  return (
    <>
      <PageHeader
        title="Finanzas"
        subtitle={<>Temporada {season} · saldo inicial de {euros(summary.opening_cents)} el {fecha(summary.opening_date)}</>}
        actions={
          <>
            {s.can("finances", "create") && (
              <>
                <Link href="/finanzas/nuevo?tipo=ingreso" prefetch className="btn-primary !bg-green-700 hover:!bg-green-800"><Plus size={18} /> Ingreso</Link>
                <Link href="/finanzas/nuevo?tipo=gasto" prefetch className="btn-primary"><Minus size={18} /> Gasto</Link>
              </>
            )}
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="t" className="text-sm font-semibold text-negro/60">Temporada</label>
        <select id="t" name="t" defaultValue={season} className="input w-auto py-1.5">
          {seasonList.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <button className="btn-ghost px-3 py-1.5 text-xs">Ver</button>
      </form>

      <Hero className="mb-6">
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-dorado">
            <Wallet size={14} aria-hidden /> Saldo actual
          </div>
          <div className="anim-score sport mt-1 text-5xl leading-none font-black tabular-nums sm:text-6xl">{euros(summary.balance_cents)}</div>
          <div className="mt-1 text-sm text-white/60">Dinero disponible hoy</div>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 bg-[#0b0b0b]/95">
          {[
            { k: "Ingresos", v: euros(summary.income_cents), icon: <TrendingUp size={14} aria-hidden />, tone: "text-green-400" },
            { k: "Gastos", v: euros(summary.expense_cents), icon: <TrendingDown size={14} aria-hidden />, tone: "text-red-400" },
            { k: "Resultado", v: euros(result), icon: <Scale size={14} aria-hidden />, tone: result >= 0 ? "text-dorado" : "text-red-400" },
          ].map((x, i) => (
            <div key={x.k} className="anim-rise px-3 py-3 sm:px-5" style={{ animationDelay: `${150 + i * 70}ms` }}>
              <dt className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${x.tone}`}>{x.icon} {x.k}</dt>
              <dd className="sport mt-0.5 text-lg leading-tight font-black tabular-nums sm:text-2xl">{x.v}</dd>
            </div>
          ))}
        </dl>
      </Hero>
      {result < 0 && <p className="-mt-3 mb-6 text-xs font-semibold text-rojo">Esta temporada se ha gastado más de lo ingresado.</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="card min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="sport text-xl font-black">Últimos movimientos</h2>
            <Link href={`/finanzas/movimientos?t=${encodeURIComponent(season)}`} prefetch className="flex items-center gap-1 text-sm font-bold text-rojo"><List size={16} /> Ver todos</Link>
          </div>
          {latest?.length ? <MovementsTable rows={latest} /> : <Empty>Aún no hay movimientos en esta temporada.</Empty>}
        </section>
        <aside className="space-y-6">
          {(["income", "expense"] as const).map((k) => (
            <section key={k} className="card">
              <h2 className="sport mb-3 text-xl font-black">{k === "income" ? "Ingresos" : "Gastos"} por categoría</h2>
              {top(k).length ? (
                <ul className="space-y-2.5 text-sm">
                  {top(k).map(([name, cents]) => {
                    const total = k === "income" ? summary.income_cents : summary.expense_cents;
                    return (
                      <li key={name}>
                        <div className="flex justify-between gap-2"><span className="truncate">{name}</span><b className="tabular-nums">{euros(cents)}</b></div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10">
                          <div className={`anim-fill h-full rounded-full ${k === "income" ? "bg-green-600" : "bg-rojo"}`} style={{ width: `${total ? Math.round((cents / total) * 100) : 0}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-negro/65">Sin {k === "income" ? "ingresos" : "gastos"}.</p>
              )}
            </section>
          ))}
          <Link href={`/finanzas/informes?t=${encodeURIComponent(season)}`} prefetch className="btn-dark w-full"><BarChart3 size={16} /> Informes y exportar</Link>
          {s.can("finances", "update") && (
            <Link href="/finanzas/ajustes" prefetch className="btn-ghost w-full"><Settings2 size={16} /> Saldo inicial y categorías</Link>
          )}
        </aside>
      </div>
    </>
  );
}
