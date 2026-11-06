import { notFound, redirect } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { MovementForm } from "@/components/finance/movement-form";
import { KIND_LABEL, today, type Category, type Movement } from "@/lib/finance";
import { updateMovement } from "../../actions";

export const metadata = { title: "Editar movimiento" };

export default async function EditMovementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePerm("finances", "update");
  const supabase = await createClient();
  const { data: m } = await supabase.from("finance_movements").select("*").eq("id", id).single<Movement>();
  if (!m) notFound();
  if (m.voided_at) redirect(`/finanzas/${id}`);
  const { data: cats } = await supabase.from("finance_categories").select("*").eq("kind", m.kind).order("sort").order("name").returns<Category[]>();
  return (
    <>
      <PageHeader title={`Editar ${KIND_LABEL[m.kind].toLowerCase()}`} subtitle="Los cambios quedan registrados en la auditoría." back={{ href: `/finanzas/${id}`, label: "Volver" }} />
      <MovementForm kind={m.kind} categories={cats ?? []} action={updateMovement.bind(null, id)} movement={m} today={today()} />
    </>
  );
}
