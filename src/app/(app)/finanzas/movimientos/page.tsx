import Link from "next/link";
import { FileSpreadsheet, FileText } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { Pager } from "@/components/pager";
import { MovementsTable } from "@/components/finance/movements-table";
import { MOVEMENT_SELECT, seasonOf, type Category, type MovementRow } from "@/lib/finance";
import { applyFilters, filtersQuery, parseFilters, periodLabel, type FinanceFilterParams } from "@/lib/finance-filters";

export const metadata = { title: "Movimientos" };
const PAGE = 50;

export default async function MovementsPage({ searchParams }: { searchParams: Promise<FinanceFilterParams & { p?: string }> }) {
  const sp = await searchParams;
  await requirePerm("finances");
  const supabase = await createClient();
  const f = parseFilters(sp);
  const page = Math.max(1, Number(sp.p) || 1);

  const query = applyFilters(
    supabase.from("finance_movements").select(MOVEMENT_SELECT, { count: "exact" }),
    f,
  ).order("op_date", { ascending: false }).order("created_at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  const totals = applyFilters(supabase.from("finance_movements").select("kind, amount_cents"), f, { includeVoided: false });

  const [{ data: rows, count }, { data: tot }, { data: cats }, { data: seasons }] = await Promise.all([
    query.returns<MovementRow[]>(),
    totals.returns<{ kind: string; amount_cents: number }[]>(),
    supabase.from("finance_categories").select("*").order("kind").order("sort").order("name").returns<Category[]>(),
    supabase.rpc("finance_seasons"),
  ]);
  let inc = 0, exp = 0;
  for (const r of tot ?? []) {
    if (r.kind === "income") inc += r.amount_cents;
    else exp += r.amount_cents;
  }
  const seasonValue = f.from || f.to ? "" : f.season ?? "todas";

  return (
    <>
      <PageHeader title="Movimientos" subtitle={periodLabel(f)} back={{ href: "/finanzas", label: "Finanzas" }}
        actions={
          <>
            <a href={`/api/finanzas/exportar?${filtersQuery(sp, { formato: "xlsx" })}`} className="btn-ghost"><FileSpreadsheet size={16} /> Excel</a>
            <a href={`/api/finanzas/exportar?${filtersQuery(sp, { formato: "pdf" })}`} target="_blank" rel="noopener" className="btn-ghost"><FileText size={16} /> PDF</a>
          </>
        } />
      <form className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <div>
          <label className="label" htmlFor="t">Temporada</label>
          <select id="t" name="t" defaultValue={seasonValue} className="input">
            {seasonValue === "" && <option value="">Por fechas</option>}
            {[...new Set([...((seasons as string[]) ?? []), seasonOf()])].sort().reverse().map((x) => <option key={x} value={x}>{x}</option>)}
            <option value="todas">Todas</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="desde">Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={f.from ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="hasta">Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={f.to ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""} className="input">
            <option value="">Ingresos y gastos</option>
            <option value="ingreso">Solo ingresos</option>
            <option value="gasto">Solo gastos</option>
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="label" htmlFor="cat">Categoría</label>
          <select id="cat" name="cat" defaultValue={f.cat ?? ""} className="input">
            <option value="">Todas</option>
            <optgroup label="Ingresos">{cats?.filter((c) => c.kind === "income").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
            <optgroup label="Gastos">{cats?.filter((c) => c.kind === "expense").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label className="label" htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={f.q} className="input" placeholder="Concepto, persona, proveedor, observaciones…" />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <label className="flex items-center gap-1.5 text-sm text-negro/70">
            <input type="checkbox" name="anulados" value="1" defaultChecked={f.voided} className="accent-rojo" /> Ver anulados
          </label>
          <button className="btn-dark flex-1">Filtrar</button>
          <Link href="/finanzas/movimientos" className="text-sm font-semibold text-negro/50 hover:text-rojo">Limpiar</Link>
        </div>
        <p className="text-xs text-negro/50 sm:col-span-2 lg:col-span-6">Si pones fechas, se usan en lugar de la temporada.</p>
      </form>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-xl bg-white p-3 ring-1 ring-black/5"><div className="text-xs text-negro/50">Ingresos</div><b className="tabular-nums text-green-700">{euros(inc)}</b></div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-black/5"><div className="text-xs text-negro/50">Gastos</div><b className="tabular-nums text-rojo">{euros(exp)}</b></div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-black/5"><div className="text-xs text-negro/50">Resultado</div><b className="tabular-nums">{euros(inc - exp)}</b></div>
      </div>

      <section className="card">
        {rows?.length ? <MovementsTable rows={rows} /> : <Empty>No hay movimientos con estos filtros.</Empty>}
        <Pager page={page} pageSize={PAGE} total={count ?? 0} href={(p) => `/finanzas/movimientos?${filtersQuery(sp, { p: String(p) })}`} />
      </section>
    </>
  );
}
