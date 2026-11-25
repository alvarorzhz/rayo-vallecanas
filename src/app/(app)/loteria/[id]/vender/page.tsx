import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { euros, fecha, ranges } from "@/lib/format";
import { TicketHead, TicketNumber, TICKET_CARD } from "@/components/lottery/ticket";
import { Empty, PageHeader } from "@/components/ui";
import { SaleForm } from "@/components/lottery/sale-form";
import { emailConfigured, whatsappConfigured } from "@/lib/notify";
import { registerSale } from "../../actions";
import type { Campaign } from "@/lib/types";

export const metadata = { title: "Nueva venta" };

export default async function SellPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  // 4.21.1 · Sesión, campaña y vendedores asignados a la vez
  const [s, { data: c }, { data: assigned }] = await Promise.all([
    getSession(),
    supabase.from("lottery_campaigns").select("*").eq("id", id).single<Campaign>(),
    supabase.from("lottery_campaign_sellers").select("user_id").eq("campaign_id", id),
  ]);
  if (!c) notFound();
  const isAdmin = s.can("lottery_admin", "create");

  const back = { href: `/loteria/${id}`, label: c.name };
  if (c.status !== "active") {
    return (
      <>
        <PageHeader title="Nueva venta" back={back} />
        <Empty>La campaña no está activa ahora mismo.</Empty>
      </>
    );
  }

  const assignedIds = (assigned ?? []).map((a) => a.user_id as string);
  if (!isAdmin && !assignedIds.includes(s.user.id)) {
    return (
      <>
        <PageHeader title="Nueva venta" back={back} />
        <Empty>No estás asignado como vendedor en esta campaña. Pídeselo a un gestor.</Empty>
      </>
    );
  }

  // Disponibilidad y lista de vendedores, todo a la vez
  const booklet = c.numbering_mode === "booklet";
  const free = supabase.from("lottery_shares").select("id", { count: "exact", head: true }).eq("status", "available");
  const [bookletsRes, countRes, numbersRes, sellersRes, bookletFreeRes] = await Promise.all([
    booklet ? supabase.from("lottery_booklets").select("id").eq("campaign_id", id).eq("seller_id", s.user.id) : Promise.resolve(null),
    booklet
      // Libres en los talonarios de este vendedor
      ? supabase.from("lottery_shares").select("id, booklet:lottery_booklets!inner(seller_id)", { count: "exact", head: true })
          .eq("campaign_id", id).eq("status", "available").eq("booklet.seller_id", s.user.id)
      : free.eq("campaign_id", id),
    c.numbering_mode === "manual"
      ? supabase.from("lottery_shares").select("share_number").eq("campaign_id", id).eq("status", "available").order("share_number").range(0, 999)
      : Promise.resolve(null),
    isAdmin && assignedIds.length
      ? supabase.from("member_directory").select("id, full_name").in("id", [...new Set([...assignedIds, s.user.id])]).order("full_name")
      : Promise.resolve(null),
    // 4.31.1 · Números libres de cada talonario, para poder elegirlos (la directiva ve los de todos)
    booklet
      ? (() => {
          let q = supabase.from("lottery_shares").select("share_number, booklet:lottery_booklets!inner(seller_id)")
            .eq("campaign_id", id).eq("status", "available");
          if (!isAdmin) q = q.eq("booklet.seller_id", s.user.id);
          return q.order("share_number").range(0, 4999);
        })()
      : Promise.resolve(null),
  ]);

  let bookletNumbers: Record<string, number[]> | undefined;
  if (bookletFreeRes) {
    bookletNumbers = {};
    for (const r of (bookletFreeRes.data ?? []) as unknown as { share_number: number; booklet: { seller_id: string } }[]) {
      (bookletNumbers[r.booklet.seller_id] ??= []).push(r.share_number);
    }
  }

  const available = countRes.count ?? 0;
  let hint: string | undefined;
  let freeNumbers: number[] | undefined;
  if (booklet && !(bookletsRes?.data ?? []).length) hint = "No tienes talonario asignado.";
  if (numbersRes) {
    const nums = (numbersRes.data ?? []).map((d) => d.share_number as number);
    freeNumbers = nums;
    hint = nums.length ? `Libres: ${ranges(nums)}${available > nums.length ? "…" : ""}` : "No quedan libres.";
  }
  const sellers: { id: string; full_name: string }[] | undefined = sellersRes ? (sellersRes.data ?? []) : undefined;

  return (
    <>
      <PageHeader title="Nueva venta" back={back} />
      <div className="mx-auto max-w-2xl">
        <div className={`${TICKET_CARD} mb-5 animate-fade-up`}>
          <TicketHead
            eyebrow={<>{c.kind === "raffle" ? "Rifa" : "Lotería"}{c.draw_date ? ` · ${fecha(c.draw_date)}` : ""}</>}
            title={c.name}
            sub={c.draw_type}
            aside={
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-dorado">{c.kind === "raffle" ? "Cada número" : "Cada una"}</div>
                <div className="sport text-2xl leading-tight font-black">{euros(c.price_cents)}</div>
              </div>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              {c.kind !== "raffle" && <TicketNumber label="NÚMERO"><span className="tracking-[0.2em]">{c.lottery_number}</span></TicketNumber>}
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                {available} {c.kind === "raffle" ? (available === 1 ? "número libre" : "números libres") : (available === 1 ? "libre" : "libres")}
                {c.numbering_mode === "booklet" ? " en tu talonario" : ""}
              </span>
            </div>
          </TicketHead>
        </div>
        <SaleForm
          action={registerSale.bind(null, id)}
          priceCents={c.price_cents}
          available={available}
          mode={c.numbering_mode}
          availableHint={hint}
          sellers={sellers}
          currentUserId={s.user.id}
          whatsappApi={whatsappConfigured()}
          emailEnabled={emailConfigured()}
          raffle={c.kind === "raffle"}
          availableNumbers={freeNumbers}
          bookletNumbers={bookletNumbers}
        />
      </div>
    </>
  );
}
