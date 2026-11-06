import { FileSpreadsheet, FileText } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros } from "@/lib/format";
import { PageHeader, Stat } from "@/components/ui";
import { BalanceLine, MonthlyBars, type MonthPoint } from "@/components/finance/charts";
import { seasonOf, seasonRange, type FinanceSummary } from "@/lib/finance";

export const metadata = { title: "Informes de Finanzas" };

type Row = { kind: "income" | "expense"; amount_cents: number; op_date: string; season: string; category: { name: string } | null };

const MONTHS = ["sep", "oct", "nov", "dic", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago"];
const MONTHS_LONG = ["septiembre", "octubre", "noviembre", "diciembre", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const sp = await searchParams;
  await requirePerm("finances");
  const supabase = await createClient();
  const season = sp.t && seasonRange(sp.t) ? sp.t : seasonOf();
  const range = seasonRange(season)!;
  const startYear = Number(season.slice(0, 4));

  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("finance_movements").select("kind, amount_cents, op_date, season, category:finance_categories(name)")
      .is("voided_at", null).order("op_date").range(from, from + 999).returns<Row[]>();
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const { data: sum } = await supabase.rpc("finance_summary", {});
  const s = sum as FinanceSummary;
  const opening = s.opening_date;
  const signed = (r: Row) => (r.kind === "income" ? r.amount_cents : -r.amount_cents);

  // Saldo a una fecha: saldo inicial + movimientos desde la fecha del saldo inicial
  const balanceAt = (date: string) =>
    date < opening ? null : s.opening_cents + rows.filter((r) => r.op_date >= opening && r.op_date <= date).reduce((a, r) => a + signed(r), 0);

  // Evolución mensual de la temporada
  const months: MonthPoint[] = MONTHS.map((label, i) => {
    const y = i < 4 ? startYear : startYear + 1;
    const m = ((i + 8) % 12) + 1;
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const inMonth = rows.filter((r) => r.op_date.startsWith(prefix));
    return {
      label,
      long: `${MONTHS_LONG[i]} ${y}`,
      income: inMonth.filter((r) => r.kind === "income").reduce((a, r) => a + r.amount_cents, 0),
      expense: inMonth.filter((r) => r.kind === "expense").reduce((a, r) => a + r.amount_cents, 0),
      balance: prefix <= new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date()).slice(0, 7) ? balanceAt(last) : null,
    };
  });
  const sIncome = months.reduce((a, m) => a + m.income, 0);
  const sExpense = months.reduce((a, m) => a + m.expense, 0);

  // Balance por temporada
  const seasons = [...new Set([...rows.map((r) => r.season), seasonOf()])].sort().reverse();
  const bySeason = seasons.map((t) => {
    const rr = rows.filter((r) => r.season === t);
    const inc = rr.filter((r) => r.kind === "income").reduce((a, r) => a + r.amount_cents, 0);
    const exp = rr.filter((r) => r.kind === "expense").reduce((a, r) => a + r.amount_cents, 0);
    const end = seasonRange(t)!.to;
    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
    return { t, inc, exp, close: balanceAt(end < today ? end : today), current: end >= today };
  });

  // Categorías de la temporada
  const cat = (kind: "income" | "expense") => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.season === season && r.kind === kind) m.set(r.category?.name ?? "—", (m.get(r.category?.name ?? "—") ?? 0) + r.amount_cents);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const exportQs = (f: string) => `/api/finanzas/exportar?t=${encodeURIComponent(season)}&formato=${f}`;

  return (
    <>
      <PageHeader title="Informes" subtitle={`Temporada ${season} (${range.from.slice(0, 4)}-09 a ${range.to.slice(0, 4)}-08)`} back={{ href: "/finanzas", label: "Finanzas" }}
        actions={
          <>
            <a href={exportQs("xlsx")} className="btn-ghost"><FileSpreadsheet size={16} /> Excel</a>
            <a href={exportQs("pdf")} target="_blank" rel="noopener" className="btn-ghost"><FileText size={16} /> PDF</a>
          </>
        } />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="t" className="text-sm font-semibold text-negro/60">Temporada</label>
        <select id="t" name="t" defaultValue={season} className="input w-auto py-1.5">
          {seasons.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <button className="btn-ghost px-3 py-1.5 text-xs">Ver</button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ingresos" value={euros(sIncome)} hint={`Temporada ${season}`} />
        <Stat label="Gastos" value={euros(sExpense)} hint={`Temporada ${season}`} />
        <Stat label="Resultado" value={euros(sIncome - sExpense)} tone={sIncome - sExpense >= 0 ? "gold" : "red"} />
        <Stat label="Saldo actual" value={euros(s.balance_cents)} tone="dark" />
      </div>

      <section className="card mb-6">
        <h2 className="sport mb-3 text-xl font-black">Ingresos y gastos por mes</h2>
        <MonthlyBars data={months} />
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-negro/60">Ver en tabla</summary>
          <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla (desliza para ver más)">
            <table className="table">
              <thead><tr><th>Mes</th><th className="text-right">Ingresos</th><th className="text-right">Gastos</th><th className="text-right">Resultado</th><th className="text-right">Saldo a fin de mes</th></tr></thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.label}>
                    <td className="capitalize">{m.long}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{euros(m.income)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{euros(m.expense)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{euros(m.income - m.expense)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{m.balance === null ? "—" : euros(m.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="card mb-6">
        <h2 className="sport mb-3 text-xl font-black">Saldo a final de cada mes</h2>
        <BalanceLine data={months} />
      </section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {(["income", "expense"] as const).map((k) => {
          const list = cat(k);
          const total = k === "income" ? sIncome : sExpense;
          return (
            <section key={k} className="card">
              <h2 className="sport mb-3 text-xl font-black">{k === "income" ? "Ingresos" : "Gastos"} por categoría</h2>
              {list.length ? (
                <ul className="space-y-2.5 text-sm">
                  {list.map(([name, cents]) => (
                    <li key={name}>
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{name}</span>
                        <span className="shrink-0 tabular-nums"><b>{euros(cents)}</b> <span className="text-negro/65">· {total ? Math.round((cents / total) * 100) : 0}%</span></span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10">
                        <div className={`h-full rounded-full ${k === "income" ? "bg-green-600" : "bg-rojo"}`} style={{ width: `${total ? (cents / total) * 100 : 0}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-negro/65">Sin {k === "income" ? "ingresos" : "gastos"} en esta temporada.</p>}
            </section>
          );
        })}
      </div>

      <section className="card">
        <h2 className="sport mb-3 text-xl font-black">Balance por temporada</h2>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla (desliza para ver más)">
          <table className="table">
            <thead><tr><th>Temporada</th><th className="text-right">Ingresos</th><th className="text-right">Gastos</th><th className="text-right">Resultado</th><th className="text-right">Saldo al cierre</th></tr></thead>
            <tbody>
              {bySeason.map((r) => (
                <tr key={r.t}>
                  <td className="font-semibold">{r.t}{r.current && <span className="ml-2 badge bg-green-100 text-green-800">En curso</span>}</td>
                  <td className="whitespace-nowrap text-right tabular-nums text-green-700">{euros(r.inc)}</td>
                  <td className="whitespace-nowrap text-right tabular-nums text-rojo">{euros(r.exp)}</td>
                  <td className="whitespace-nowrap text-right font-bold tabular-nums">{euros(r.inc - r.exp)}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{r.close === null ? "—" : `${euros(r.close)}${r.current ? " (hoy)" : ""}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-negro/65">El saldo se cuenta desde el saldo inicial; las temporadas anteriores a esa fecha muestran «—».</p>
      </section>
    </>
  );
}
