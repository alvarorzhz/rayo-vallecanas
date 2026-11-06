import Link from "next/link";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { MovementForm } from "@/components/finance/movement-form";
import { kindFromSlug, today, type Category } from "@/lib/finance";
import { createMovement } from "../actions";

export const metadata = { title: "Nuevo movimiento" };

export default async function NewMovementPage({ searchParams }: { searchParams: Promise<{ tipo?: string; ok?: string }> }) {
  const sp = await searchParams;
  await requirePerm("finances", "create");
  const kind = kindFromSlug(sp.tipo) ?? "expense";
  const supabase = await createClient();
  const { data: cats } = await supabase.from("finance_categories").select("*").eq("kind", kind).order("sort").order("name").returns<Category[]>();
  const income = kind === "income";
  return (
    <>
      <PageHeader title={income ? "Nuevo ingreso" : "Nuevo gasto"} back={{ href: "/finanzas", label: "Finanzas" }}
        actions={
          <Link href={`/finanzas/nuevo?tipo=${income ? "gasto" : "ingreso"}`} className="btn-ghost">
            Cambiar a {income ? "gasto" : "ingreso"}
          </Link>
        } />
      {sp.ok && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">Guardado. Puedes apuntar el siguiente.</p>}
      <MovementForm key={`${kind}-${sp.ok ?? ""}`} kind={kind} categories={cats ?? []} action={createMovement} today={today()} />
    </>
  );
}
