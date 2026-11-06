import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { AddCategoryForm, CategoryRow, OpeningForm } from "@/components/finance/client-forms";
import type { Category } from "@/lib/finance";
import { addCategory, renameCategory, saveOpening, toggleCategory } from "../actions";

export const metadata = { title: "Ajustes de Finanzas" };

export default async function FinanceSettingsPage() {
  await requirePerm("finances", "update");
  const supabase = await createClient();
  const [{ data: settings }, { data: cats }] = await Promise.all([
    supabase.from("finance_settings").select("*").eq("id", 1).single(),
    supabase.from("finance_categories").select("*").order("sort").order("name").returns<Category[]>(),
  ]);

  return (
    <>
      <PageHeader title="Ajustes de Finanzas" back={{ href: "/finanzas", label: "Finanzas" }} />
      <section className="card mb-6">
        <h2 className="sport mb-1 text-xl font-black">Saldo inicial</h2>
        <p className="mb-4 text-sm text-negro/60">
          El dinero que había en caja en una fecha. El saldo actual se calcula sumando los ingresos y restando los gastos desde ese día;
          los movimientos anteriores se guardan, pero no cambian el saldo.
        </p>
        <OpeningForm action={saveOpening} cents={settings?.opening_balance_cents ?? 0} date={settings?.opening_date ?? "2026-09-01"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {(["income", "expense"] as const).map((k) => (
          <section key={k} className="card">
            <h2 className="sport mb-1 text-xl font-black">Categorías de {k === "income" ? "ingresos" : "gastos"}</h2>
            <p className="mb-2 text-xs text-negro/65">Las categorías no se borran para no perder el histórico: si ya no la usáis, ocúltala.</p>
            <ul className="divide-y divide-black/5">
              {cats?.filter((c) => c.kind === k).map((c) => (
                <CategoryRow key={c.id} name={c.name} active={c.active}
                  rename={renameCategory.bind(null, c.id)} toggle={toggleCategory.bind(null, c.id, !c.active)} />
              ))}
            </ul>
            <AddCategoryForm action={addCategory} kind={k === "income" ? "ingreso" : "gasto"} />
          </section>
        ))}
      </div>
    </>
  );
}
