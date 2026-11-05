import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ShareStatusForm } from "@/components/lottery/client-forms";
import { setShareStatus } from "../../actions";

export const metadata = { title: "Participaciones" };
const BLOCK = 500;
const TONE: Record<string, string> = {
  available: "bg-white ring-1 ring-black/10 text-negro/70",
  reserved: "bg-dorado/30 text-negro",
  sold: "bg-rojo text-white",
  voided: "bg-black/20 text-negro/40 line-through",
};

export default async function SharesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string }> }) {
  const { id } = await params;
  const { b } = await searchParams;
  const s = await requirePerm("lottery_admin", "read");
  const supabase = await createClient();
  const { data: c } = await supabase.from("lottery_campaigns").select("id, name, total_shares").eq("id", id).single();
  if (!c) notFound();
  const blocks = Math.ceil(c.total_shares / BLOCK);
  const block = Math.min(Math.max(1, Number(b) || 1), blocks);
  const from = (block - 1) * BLOCK + 1;
  const { data: shares } = await supabase
    .from("lottery_shares")
    .select("share_number, status, sale_id")
    .eq("campaign_id", id)
    .gte("share_number", from)
    .lt("share_number", from + BLOCK)
    .order("share_number");

  return (
    <>
      <PageHeader title="Participaciones" subtitle={`${c.name} · ${c.total_shares} en total`} back={{ href: `/loteria/${id}`, label: c.name }} />
      {s.can("lottery_admin", "update") && (
        <div className="card mb-4">
          <h2 className="mb-1 font-bold">Cambiar estado</h2>
          <p className="mb-3 text-xs text-negro/50">Las vendidas solo cambian anulando su venta.</p>
          <ShareStatusForm action={setShareStatus.bind(null, id)} />
        </div>
      )}
      <div className="card">
        <div className="mb-3 flex flex-wrap gap-3 text-xs">
          {[["available", "Disponible"], ["reserved", "Reservada"], ["sold", "Vendida"], ["voided", "Anulada"]].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded ${TONE[k]}`} /> {l}</span>
          ))}
        </div>
        {blocks > 1 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {Array.from({ length: blocks }, (_, i) => (
              <Link key={i} href={`?b=${i + 1}`} className={`badge px-2 py-1 ${block === i + 1 ? "bg-negro text-white" : "bg-gris"}`}>
                {i * BLOCK + 1}–{Math.min((i + 1) * BLOCK, c.total_shares)}
              </Link>
            ))}
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5">
          {(shares ?? []).map((sh) =>
            sh.sale_id ? (
              <Link key={sh.share_number} href={`/loteria/venta/${sh.sale_id}`} className={`rounded-md py-1.5 text-center font-mono text-xs font-semibold ${TONE[sh.status]}`}>
                {sh.share_number}
              </Link>
            ) : (
              <span key={sh.share_number} className={`rounded-md py-1.5 text-center font-mono text-xs ${TONE[sh.status]}`}>{sh.share_number}</span>
            ),
          )}
        </div>
      </div>
    </>
  );
}
