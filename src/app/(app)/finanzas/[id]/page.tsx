import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip, Pencil, Shirt, Ticket } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fecha, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { Amount } from "@/components/finance/movements-table";
import { VoidMovementForm } from "@/components/finance/client-forms";
import { KIND_LABEL, MOVEMENT_SELECT, type MovementRow } from "@/lib/finance";
import { voidMovement } from "../actions";

export const metadata = { title: "Movimiento" };

export default async function MovementPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requirePerm("finances");
  const supabase = await createClient();
  const { data: m } = await supabase.from("finance_movements").select(MOVEMENT_SELECT).eq("id", id).single<MovementRow>();
  if (!m) notFound();
  const [{ data: voider }, { data: campaign }, { data: player }] = await Promise.all([
    m.voided_by ? supabase.from("member_directory").select("full_name").eq("id", m.voided_by).single() : Promise.resolve({ data: null }),
    m.campaign_id ? supabase.from("lottery_campaigns").select("id, name").eq("id", m.campaign_id).single() : Promise.resolve({ data: null }),
    m.player_id ? supabase.from("players").select("id, first_name, last_name").eq("id", m.player_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const income = m.kind === "income";

  const rows: [string, React.ReactNode][] = [
    ["Fecha", fecha(m.op_date)],
    ["Temporada", m.season],
    ["Categoría", m.category?.name],
    [income ? "Método de cobro" : "Método de pago", PAYMENT_METHOD_LABEL[m.method] ?? m.method],
    [income ? "Persona o entidad" : "Proveedor o destinatario", m.counterparty ?? "—"],
    ["Observaciones", m.notes ? <span className="whitespace-pre-line">{m.notes}</span> : "—"],
    ["Apuntado por", `${m.author?.full_name ?? "—"} · ${fecha(m.created_at, true)}`],
  ];
  if (m.updated_at !== m.created_at && !m.voided_at) rows.push(["Última modificación", fecha(m.updated_at, true)]);

  return (
    <>
      <PageHeader title={m.concept} subtitle={KIND_LABEL[m.kind]} back={{ href: "/finanzas", label: "Finanzas" }}
        actions={!m.voided_at && s.can("finances", "update") && (
          <Link href={`/finanzas/${id}/editar`} className="btn-ghost"><Pencil size={16} /> Editar</Link>
        )} />
      {sp.ok && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{sp.ok === "2" ? "Cambios guardados." : "Movimiento guardado."}</p>}
      {m.voided_at && (
        <div className="mb-4 rounded-xl bg-black/5 p-4 text-sm">
          <b>Anulado</b> el {fecha(m.voided_at, true)}{voider ? ` por ${voider.full_name}` : ""}. Motivo: {m.void_reason}. No cuenta en el saldo.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="card">
          <div className="mb-4 text-4xl [font-family:var(--font-display)] italic"><Amount kind={m.kind} cents={m.amount_cents} voided={!!m.voided_at} /></div>
          <dl className="divide-y divide-black/5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 py-2.5"><dt className="text-negro/65">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
            ))}
          </dl>
        </section>
        <aside className="space-y-4">
          {m.attachment_path && (
            <a href={`/api/finanzas/justificante/${m.id}`} target="_blank" rel="noopener" className="btn-ghost w-full">
              <Paperclip size={16} /> Ver justificante
            </a>
          )}
          {player && (
            <Link href={`/plantilla/${player.id}${m.fee_season ? `?temporada=${m.fee_season.replace("/", "-")}` : ""}`} className="btn-ghost w-full">
              <Shirt size={16} /> {m.fee_season ? `Cuota ${m.fee_season} · ` : ""}{`${player.first_name} ${player.last_name}`.trim()}
            </Link>
          )}
          {campaign && (
            <Link href={`/loteria/${campaign.id}`} className="btn-ghost w-full"><Ticket size={16} /> {campaign.name}</Link>
          )}
          {!m.voided_at && s.can("finances", "delete") && <VoidMovementForm action={voidMovement.bind(null, id)} />}
        </aside>
      </div>
    </>
  );
}
