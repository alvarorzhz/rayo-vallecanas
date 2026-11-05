import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ShareStatusForm } from "@/components/lottery/client-forms";
import { setShareStatus } from "../../actions";
import { fetchNumbers } from "@/lib/lottery/queries";

export const metadata = { title: "Números" };
const STATUS_LABEL: Record<string, string> = { available: "Libre", reserved: "Reservado", sold: "Vendido", voided: "Anulado" };
const BLOCK = 500;
const TONE: Record<string, string> = {
  available: "bg-white ring-1 ring-black/10 text-negro/70",
  reserved: "bg-dorado/30 text-negro",
  sold: "bg-rojo text-white",
  voided: "bg-black/20 text-negro/40 line-through",
};

export default async function SharesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string; v?: string; q?: string }> }) {
  const { id } = await params;
  const { b, v, q } = await searchParams;
  const s = await requirePerm("lottery_admin", "read");
  const supabase = await createClient();
  const { data: c } = await supabase.from("lottery_campaigns").select("id, name, total_shares, kind").eq("id", id).single();
  if (!c) notFound();
  const blocks = Math.ceil(c.total_shares / BLOCK);
  const block = Math.min(Math.max(1, Number(b) || 1), blocks);
  const from = (block - 1) * BLOCK + 1;
  const raffle = c.kind === "raffle";
  const view = v === "lista" || v === "cuadricula" ? v : raffle ? "lista" : "cuadricula";
  const title = raffle ? "Números" : "Participaciones";
  let shares = await fetchNumbers(supabase, id, { from, to: from + BLOCK - 1 });
  const term = (q ?? "").trim().toLowerCase();
  if (term) {
    shares = shares.filter((sh) =>
      [String(sh.share_number), sh.buyer_name, sh.seller_name, sh.reference, sh.buyer_phone].some((x) => x?.toLowerCase().includes(term)),
    );
  }
  const link = (p: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const all = { b: block, v: view, q: term || undefined, ...p };
    for (const [k, val] of Object.entries(all)) if (val !== undefined && val !== "") sp.set(k, String(val));
    return `?${sp}`;
  };

  return (
    <>
      <PageHeader title={title} subtitle={`${c.name} · ${c.total_shares} en total`} back={{ href: `/loteria/${id}`, label: c.name }} />
      {s.can("lottery_admin", "update") && (
        <div className="card mb-4">
          <h2 className="mb-1 font-bold">Cambiar estado</h2>
          <p className="mb-3 text-xs text-negro/50">{raffle ? "Los vendidos" : "Las vendidas"} solo cambian anulando su venta.</p>
          <ShareStatusForm action={setShareStatus.bind(null, id)} />
        </div>
      )}
      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            <Link href={link({ v: "lista" })} className={`badge px-3 py-1.5 ${view === "lista" ? "bg-negro text-white" : "bg-gris"}`}>Lista</Link>
            <Link href={link({ v: "cuadricula" })} className={`badge px-3 py-1.5 ${view === "cuadricula" ? "bg-negro text-white" : "bg-gris"}`}>Cuadrícula</Link>
          </div>
          <form className="flex gap-2">
            <input type="hidden" name="v" value={view} />
            <input type="hidden" name="b" value={block} />
            <input name="q" defaultValue={term} className="input py-1.5" placeholder="Buscar número, comprador o vendedor" />
          </form>
        </div>
        <div className="mb-3 flex flex-wrap gap-3 text-xs">
          {[["available", "Disponible"], ["reserved", "Reservada"], ["sold", "Vendida"], ["voided", "Anulada"]].map(([k, l]) => (
            <span key={k} className="flex items-center gap-1"><span className={`inline-block h-3 w-3 rounded ${TONE[k]}`} /> {l}</span>
          ))}
        </div>
        {blocks > 1 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {Array.from({ length: blocks }, (_, i) => (
              <Link key={i} href={link({ b: i + 1 })} className={`badge px-2 py-1 ${block === i + 1 ? "bg-negro text-white" : "bg-gris"}`}>
                {i * BLOCK + 1}–{Math.min((i + 1) * BLOCK, c.total_shares)}
              </Link>
            ))}
          </div>
        )}
        {view === "lista" ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Nº</th><th>Estado</th><th>Comprador</th><th>Teléfono</th><th>Vendedor</th><th>Venta</th></tr>
              </thead>
              <tbody>
                {shares.map((sh) => (
                  <tr key={sh.share_number}>
                    <td><span className={`inline-block min-w-10 rounded-md px-2 py-1 text-center font-mono text-xs font-semibold ${TONE[sh.status]}`}>{sh.share_number}</span></td>
                    <td className="text-sm">{STATUS_LABEL[sh.status]}</td>
                    <td className="font-semibold">{sh.buyer_name ?? "—"}</td>
                    <td className="whitespace-nowrap text-sm">{sh.buyer_phone ?? ""}</td>
                    <td className="text-sm">{sh.seller_name ?? ""}</td>
                    <td className="whitespace-nowrap">
                      {sh.sale_id && <Link href={`/loteria/venta/${sh.sale_id}`} className="font-mono text-sm font-semibold text-rojo">{sh.reference}</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shares.length && <p className="py-6 text-center text-sm text-negro/50">Sin resultados.</p>}
          </div>
        ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5">
          {shares.map((sh) =>
            sh.sale_id ? (
              <Link key={sh.share_number} href={`/loteria/venta/${sh.sale_id}`} title={`${sh.buyer_name ?? ""} · vendió ${sh.seller_name ?? ""}`} className={`rounded-md py-1.5 text-center font-mono text-xs font-semibold ${TONE[sh.status]}`}>
                {sh.share_number}
              </Link>
            ) : (
              <span key={sh.share_number} className={`rounded-md py-1.5 text-center font-mono text-xs ${TONE[sh.status]}`}>{sh.share_number}</span>
            ),
          )}
        </div>
        )}
      </div>
    </>
  );
}
