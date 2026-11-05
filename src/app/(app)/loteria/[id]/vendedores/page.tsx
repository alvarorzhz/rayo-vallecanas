import { notFound } from "next/navigation";
import { X } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/format";
import { Empty, PageHeader } from "@/components/ui";
import { BookletForm } from "@/components/lottery/client-forms";
import { addBooklet, assignSellers, removeSeller } from "../../actions";

export const metadata = { title: "Vendedores" };

export default async function SellersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePerm("lottery_admin", "read");
  const canEdit = s.can("lottery_admin", "update");
  const supabase = await createClient();
  const { data: c } = await supabase.from("lottery_campaigns").select("id, name, numbering_mode, total_shares").eq("id", id).single();
  if (!c) notFound();

  const [{ data: assigned }, { data: members }, { data: booklets }] = await Promise.all([
    supabase.from("lottery_campaign_sellers").select("user_id").eq("campaign_id", id),
    supabase.from("member_directory").select("id, full_name, role").eq("active", true).order("full_name"),
    supabase.from("lottery_booklets").select("*").eq("campaign_id", id).order("from_number"),
  ]);
  const assignedIds = new Set((assigned ?? []).map((a) => a.user_id));
  const sellers = (members ?? []).filter((m) => assignedIds.has(m.id));
  const others = (members ?? []).filter((m) => !assignedIds.has(m.id));
  const nameOf = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  return (
    <>
      <PageHeader title="Vendedores" subtitle={c.name} back={{ href: `/loteria/${id}`, label: c.name }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-bold">Asignados ({sellers.length})</h2>
          {sellers.length ? (
            <ul className="divide-y divide-black/5">
              {sellers.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-semibold">{m.full_name}</div>
                    <div className="text-xs text-negro/50">{ROLE_LABEL[m.role]}</div>
                  </div>
                  {canEdit && (
                    <form action={removeSeller.bind(null, id, m.id)}>
                      <button aria-label={`Quitar a ${m.full_name}`} className="rounded-lg p-2 text-negro/40 hover:bg-rojo/10 hover:text-rojo"><X size={16} /></button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nadie asignado todavía.</Empty>
          )}
        </section>
        {canEdit && (
          <section className="card">
            <h2 className="mb-3 font-bold">Añadir vendedores</h2>
            {others.length ? (
              <form action={assignSellers.bind(null, id)} className="space-y-3">
                <div className="max-h-80 space-y-1 overflow-y-auto">
                  {others.map((m) => (
                    <label key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gris">
                      <input type="checkbox" name="user_id" value={m.id} className="h-4 w-4 accent-rojo" />
                      <span className="flex-1">{m.full_name}</span>
                      <span className="text-xs text-negro/50">{ROLE_LABEL[m.role]}</span>
                    </label>
                  ))}
                </div>
                <button className="btn-primary w-full">Asignar seleccionados</button>
              </form>
            ) : (
              <p className="text-sm text-negro/50">Todos los usuarios activos ya están asignados. Da de alta más en Usuarios.</p>
            )}
          </section>
        )}
      </div>

      <section className="card mt-6">
        <h2 className="mb-1 font-bold">Talonarios</h2>
        <p className="mb-4 text-sm text-negro/50">
          {c.numbering_mode === "booklet"
            ? "Cada vendedor solo vende participaciones de sus talonarios."
            : "Esta campaña no usa talonarios (puedes cambiarlo en Editar). Aun así puedes registrar qué rangos físicos tiene cada vendedor."}
        </p>
        {booklets?.length ? (
          <table className="table mb-4">
            <thead><tr><th>Talonario</th><th>Vendedor</th><th>Participaciones</th></tr></thead>
            <tbody>
              {booklets.map((b) => (
                <tr key={b.id}>
                  <td>{b.label ?? "—"}</td>
                  <td>{nameOf.get(b.seller_id)}</td>
                  <td className="font-mono">{b.from_number}–{b.to_number} ({b.to_number - b.from_number + 1})</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {canEdit && <BookletForm action={addBooklet.bind(null, id)} sellers={members ?? []} />}
      </section>
    </>
  );
}
