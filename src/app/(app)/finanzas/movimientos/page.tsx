import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { Pager } from "@/components/pager";
import { MovementsTable } from "@/components/finance/movements-table";
import { kindFromSlug, MOVEMENT_SELECT, seasonOf, type Category, type MovementRow } from "@/lib/finance";

export const metadata = { title: "Movimientos" };
const PAGE = 50;

type SP = { t?: string; tipo?: string; cat?: string; q?: string; anulados?: string; p?: string };

export default async function MovementsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  await requirePerm("finances");
  const supabase = await createClient();
  const season = sp.t ?? seasonOf();
  const kind = kindFromSlug(sp.tipo);
  const page = Math.max(1, Number(sp.p) || 1);
  const q = (sp.q ?? "").trim().slice(0, 80);

  let query = supabase.from("finance_movements").select(MOVEMENT_SELECT, { count: "exact" })
    .order("op_date", { ascending: false }).order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  let totals = supabase.from("finance_movements").select("kind, amount_cents").is("voided_at", null);
  if (season !== "todas") { query = query.eq("season", season); totals = totals.eq("season", season); }
  if (kind) { query = query.eq("kind", kind); totals = totals.eq("kind", kind); }
  if (sp.cat) { query = query.eq("category_id", sp.cat); totals = totals.eq("category_id", sp.cat); }
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`concept.ilike.${like},counterparty.ilike.${like},notes.ilike.${like}`);
    totals = totals.or(`concept.ilike.${like},counterparty.ilike.${like},notes.ilike.${like}`);
  }
  if (sp.anulados !== "1") query = query.is("voided_at", null);

  const [{ data: rows, count }, { data: tot }, { data: cats }, { data: seasons }] = await Promise.all([
    query.returns<MovementRow[]>(),
    totals,
    supabase.from("finance_categories").select("*").order("kind").order("sort").order("name").returns<Category[]>(),
    supabase.rpc("finance_seasons"),
  ]);
  let inc = 0, exp = 0;
  for (const r of tot ?? []) {
    if (r.kind === "income") inc += r.amount_cents;
    else exp += r.amount_cents;
  }

  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries({ ...sp, p: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/finanzas/movimientos?${u}`;
  };

  return (
    <>
      <PageHeader title="Movimientos" subtitle="Todos los ingresos y gastos. Filtra por temporada, tipo, categoría o busca por texto." back={{ href: "/finanzas", label: "Finanzas" }} />
      <form className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto] lg:items-end">
        <div>
          <label className="label" htmlFor="t">Temporada</label>
          <select id="t" name="t" defaultValue={season} className="input">
            {[...new Set([...((seasons as string[]) ?? []), seasonOf()])].sort().reverse().map((x) => <option key={x} value={x}>{x}</option>)}
            <option value="todas">Todas</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""} className="input">
            <option value="">Ingresos y gastos</option>
            <option value="ingreso">Solo ingresos</option>
            <option value="gasto">Solo gastos</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cat">Categoría</label>
          <select id="cat" name="cat" defaultValue={sp.cat ?? ""} className="input">
            <option value="">Todas</option>
            <optgroup label="Ingresos">{cats?.filter((c) => c.kind === "income").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
            <optgroup label="Gastos">{cats?.filter((c) => c.kind === "expense").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="Concepto, persona, proveedor…" />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-1">
          <label className="flex items-center gap-1.5 text-sm text-negro/70">
            <input type="checkbox" name="anulados" value="1" defaultChecked={sp.anulados === "1"} className="accent-rojo" /> Anulados
          </label>
          <button className="btn-dark flex-1">Filtrar</button>
        </div>
      </form>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-xl bg-white p-3 ring-1 ring-black/5"><div className="text-xs text-negro/50">Ingresos</div><b className="tabular-nums text-green-700">{euros(inc)}</b></div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-black/5"><div className="text-xs text-negro/50">Gastos</div><b className="tabular-nums text-rojo">{euros(exp)}</b></div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-black/5"><div className="text-xs text-negro/50">Resultado</div><b className="tabular-nums">{euros(inc - exp)}</b></div>
      </div>

      <section className="card">
        {rows?.length ? <MovementsTable rows={rows} /> : <Empty>No hay movimientos con estos filtros.</Empty>}
        <Pager page={page} pageSize={PAGE} total={count ?? 0} href={qs} />
      </section>
    </>
  );
}
