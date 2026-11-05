"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { lotteryManagers, sendPush } from "@/lib/push";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { euros, parseEuros, parseRanges, phoneE164 } from "@/lib/format";
import { loadReceipt } from "@/lib/lottery/receipt-data";
import { receiptText } from "@/lib/receipt";
import { sendReceiptEmail, sendReceiptWhatsApp } from "@/lib/notify";

export type ActionState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);

// ---------------------------------------------------------------- Campañas
function campaignFromForm(f: FormData) {
  const kind = str(f, "kind") === "raffle" ? "raffle" : "lottery";
  const lottery_number = kind === "raffle" ? null : str(f, "lottery_number").padStart(5, "0");
  if (lottery_number !== null && !/^\d{5}$/.test(lottery_number)) throw new Error("El número de lotería debe tener 5 cifras");
  const total_shares = Number(str(f, "total_shares"));
  if (!Number.isInteger(total_shares) || total_shares < 1) throw new Error("Número de participaciones no válido");
  const price_cents = parseEuros(f.get("price"));
  if (price_cents <= 0) throw new Error("Indica el precio de la participación");
  const played_cents = kind === "raffle" ? 0 : parseEuros(f.get("played"));
  const donation_cents = kind === "raffle" ? 0 : parseEuros(f.get("donation"));
  if (played_cents && played_cents + donation_cents > price_cents)
    throw new Error("Importe jugado + donativo no puede superar el precio");
  const name = str(f, "name");
  if (!name) throw new Error("Pon un nombre a la campaña");
  return {
    kind,
    name,
    year: Number(str(f, "year")),
    lottery_number,
    draw_type: str(f, "draw_type") || (kind === "raffle" ? "Rifa" : "Sorteo Extraordinario de Navidad"),
    draw_date: str(f, "draw_date") || null,
    price_cents,
    played_cents,
    donation_cents,
    total_shares,
    numbering_mode: str(f, "numbering_mode") || "auto",
    ref_prefix: (str(f, "ref_prefix") || "RV").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "RV",
    notes: str(f, "notes") || null,
  };
}

export async function createCampaign(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("lottery_campaigns").insert(campaignFromForm(f)).select("id").single();
    if (error) throw error;
    id = data.id;
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath("/loteria");
  redirect(`/loteria/${id}`);
}

export async function updateCampaign(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("lottery_campaigns").update(campaignFromForm(f)).eq("id", id);
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath(`/loteria/${id}`);
  redirect(`/loteria/${id}`);
}

// ---------------------------------------------------------------- Archivar / eliminar (solo superadmin)
export async function archiveCampaign(id: string, archive: boolean) {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { archived_at: archive ? new Date().toISOString() : null };
  if (archive) {
    const { data } = await supabase.from("lottery_campaigns").select("status").eq("id", id).single();
    if (data?.status === "active") patch.status = "closed";
  }
  const { error } = await supabase.from("lottery_campaigns").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/loteria/${id}`);
  revalidatePath("/loteria");
  revalidatePath("/");
}

export async function deleteCampaign(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("lottery_delete_campaign", { p_campaign_id: id, p_confirm_name: str(f, "confirm_name") });
  if (error) return { error: errMsg(error) };
  revalidatePath("/loteria");
  revalidatePath("/");
  redirect("/loteria?eliminada=1");
}

export async function setCampaignStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: c, error } = await supabase.from("lottery_campaigns").update({ status }).eq("id", id).select("name").single();
  if (error) throw new Error(error.message);
  if (status === "active") {
    after(async () => {
      const { data: sellers } = await supabase.from("lottery_campaign_sellers").select("user_id").eq("campaign_id", id);
      await sendPush((sellers ?? []).map((r) => r.user_id), {
        title: "¡Ya puedes vender! 🎟️",
        body: `${c.name} está abierta. Entra y registra tus ventas.`,
        url: `/loteria/${id}`,
        tag: `campaign-${id}`,
      });
    });
  }
  revalidatePath(`/loteria/${id}`);
  revalidatePath("/loteria");
}

export async function setWinningPrize(id: string, f: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lottery_campaigns")
    .update({ winning_prize_cents: parseEuros(f.get("prize")), status: "drawn" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/loteria/${id}`);
}

export async function drawRaffle(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  try {
    const manual = str(f, "mode") === "random" ? "" : str(f, "number");
    if (str(f, "mode") === "manual" && !manual) throw new Error("Escribe el número ganador o pulsa «Sortear al azar»");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("lottery_draw_winner", {
      p_campaign_id: id,
      p_number: manual ? Number(manual) : null,
    });
    if (error) throw error;
    const w = (data as { winning_number: number; buyer_name: string | null }[])[0];
    after(async () => {
      const [{ data: c }, { data: sellers }] = await Promise.all([
        supabase.from("lottery_campaigns").select("name").eq("id", id).single(),
        supabase.from("lottery_campaign_sellers").select("user_id").eq("campaign_id", id),
      ]);
      await sendPush([...(sellers ?? []).map((r) => r.user_id), ...(await lotteryManagers())], {
        title: `🏆 Número ganador: ${w.winning_number}`,
        body: `${c?.name ?? "Sorteo"}${w.buyer_name ? ` · le ha tocado a ${w.buyer_name}` : " · el número no estaba vendido"}`,
        url: `/loteria/${id}`,
      });
    });
    revalidatePath(`/loteria/${id}`);
    return { ok: `Número ganador: ${w.winning_number}${w.buyer_name ? ` · ${w.buyer_name}` : " · no estaba vendido"}` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ---------------------------------------------------------------- Vendedores y talonarios
export async function assignSellers(campaignId: string, f: FormData) {
  const ids = f.getAll("user_id").map(String).filter(Boolean);
  if (!ids.length) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("lottery_campaign_sellers")
    .upsert(
      ids.map((user_id) => ({ campaign_id: campaignId, user_id })),
      { ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  revalidatePath(`/loteria/${campaignId}/vendedores`);
}

export async function removeSeller(campaignId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lottery_campaign_sellers").delete().eq("campaign_id", campaignId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/loteria/${campaignId}/vendedores`);
}

export async function addBooklet(campaignId: string, _: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("lottery_booklets").insert({
      campaign_id: campaignId,
      seller_id: str(f, "seller_id"),
      label: str(f, "label") || null,
      from_number: Number(str(f, "from_number")),
      to_number: Number(str(f, "to_number")),
    });
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath(`/loteria/${campaignId}/vendedores`);
  return { ok: "Talonario asignado" };
}

// ---------------------------------------------------------------- Participaciones
export async function setShareStatus(campaignId: string, _: ActionState, f: FormData): Promise<ActionState> {
  try {
    const numbers = parseRanges(str(f, "numbers"));
    if (!numbers.length) throw new Error("Indica qué participaciones");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("lottery_set_share_status", {
      p_campaign_id: campaignId,
      p_numbers: numbers,
      p_status: str(f, "status"),
    });
    if (error) throw error;
    revalidatePath(`/loteria/${campaignId}/participaciones`);
    return { ok: `${data} participaciones actualizadas (las vendidas no se tocan)` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ---------------------------------------------------------------- Ventas
export async function registerSale(campaignId: string, _: ActionState, f: FormData): Promise<ActionState> {
  let saleId: string;
  let channel: string;
  try {
    const quantity = Number(str(f, "quantity"));
    const manual = str(f, "share_numbers");
    const numbers = manual ? parseRanges(manual) : null;
    const paidMode = str(f, "paid_mode"); // none | full | partial
    const total = Number(str(f, "unit_price_cents")) * quantity;
    const paid = paidMode === "full" ? total : paidMode === "partial" ? parseEuros(f.get("paid_amount")) : 0;
    channel = str(f, "channel");

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("lottery_register_sale", {
      p_campaign_id: campaignId,
      p_buyer_name: str(f, "buyer_name"),
      p_buyer_phone: str(f, "buyer_phone") || null,
      p_buyer_email: str(f, "buyer_email") || null,
      p_quantity: quantity,
      p_share_numbers: numbers,
      p_paid_cents: paid,
      p_payment_method: str(f, "payment_method") || "cash",
      p_seller_id: str(f, "seller_id") || null,
      p_preferred_channel: channel === "email" || channel === "whatsapp" ? channel : null,
      p_notes: str(f, "notes") || null,
      p_marketing_consent: f.get("marketing_consent") === "on",
    });
    if (error) throw error;
    saleId = (data as { id: string }).id;
    const sid = saleId;
    after(async () => {
      const { data: sale } = await supabase
        .from("lottery_sales")
        .select("seller_id, quantity, total_cents, campaign:lottery_campaigns(name, kind)")
        .eq("id", sid)
        .single();
      if (!sale) return;
      const camp = sale.campaign as unknown as { name: string; kind: string };
      const { data: seller } = await supabase.from("member_directory").select("full_name").eq("id", sale.seller_id).single();
      const unit = camp.kind === "raffle" ? (sale.quantity === 1 ? "número" : "números") : sale.quantity === 1 ? "participación" : "participaciones";
      await sendPush(await lotteryManagers(sale.seller_id), {
        title: "Nueva venta 💶",
        body: `${seller?.full_name ?? "Un vendedor"} ha vendido ${sale.quantity} ${unit} de ${camp.name} (${euros(sale.total_cents)})`,
        url: `/loteria/venta/${sid}`,
      });
    });
  } catch (e) {
    return { error: errMsg(e) };
  }

  // Envío automático del justificante. Si falla, la venta ya está registrada y se puede reenviar.
  let sent = "";
  if (channel === "email" || (channel === "whatsapp" && process.env.WHATSAPP_TOKEN)) {
    const r = await deliverReceipt(saleId, channel as "email" | "whatsapp");
    sent = r.ok ? `&enviado=${channel}` : `&envio_error=${encodeURIComponent(r.error ?? "")}`;
  }
  revalidatePath(`/loteria/${campaignId}`);
  redirect(`/loteria/venta/${saleId}?nueva=1${sent}`);
}

export async function addPayment(saleId: string, _: ActionState, f: FormData): Promise<ActionState> {
  try {
    const sign = str(f, "kind") === "refund" ? -1 : 1;
    const amount = parseEuros(f.get("amount")) * sign;
    if (!amount) throw new Error("Indica el importe");
    const supabase = await createClient();
    const { error } = await supabase.rpc("lottery_add_payment", {
      p_sale_id: saleId,
      p_amount_cents: amount,
      p_method: str(f, "method") || "cash",
      p_notes: str(f, "notes") || null,
    });
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath(`/loteria/venta/${saleId}`);
  return { ok: "Cobro registrado" };
}

export async function cancelSale(saleId: string, _: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("lottery_cancel_sale", {
      p_sale_id: saleId,
      p_reason: str(f, "reason"),
      p_release: str(f, "release") !== "void",
    });
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath(`/loteria/venta/${saleId}`);
  return { ok: "Venta anulada" };
}

// ---------------------------------------------------------------- Justificantes
async function deliverReceipt(saleId: string, channel: "email" | "whatsapp"): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const r = await loadReceipt(supabase, saleId);
  if (!r) return { ok: false, error: "Venta no encontrada" };
  if (r.cancelled) return { ok: false, error: "La venta está anulada" };

  const recipient = channel === "email" ? r.buyer.email : phoneE164(r.buyer.phone);
  if (!recipient)
    return { ok: false, error: channel === "email" ? "El comprador no tiene email" : "El comprador no tiene un teléfono válido" };

  const { data: notif, error: insErr } = await supabase
    .from("notifications")
    .insert({ sale_id: saleId, channel, recipient })
    .select("id")
    .single();
  if (insErr) return { ok: false, error: insErr.message };

  const { result, attempts } =
    channel === "email"
      ? await sendReceiptEmail(recipient, r.data)
      : await sendReceiptWhatsApp(recipient, r.data, euros(r.data.totalCents));

  await supabase
    .from("notifications")
    .update({
      status: result.ok ? "sent" : "failed",
      attempts,
      provider_id: result.ok ? result.providerId : null,
      error: result.ok ? null : result.error,
      sent_at: result.ok ? new Date().toISOString() : null,
    })
    .eq("id", notif.id);

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function sendReceipt(saleId: string, channel: "email" | "whatsapp"): Promise<ActionState> {
  const r = await deliverReceipt(saleId, channel);
  revalidatePath(`/loteria/venta/${saleId}`);
  return r.ok
    ? { ok: channel === "email" ? "Justificante enviado por email" : "Justificante enviado por WhatsApp" }
    : { error: r.error };
}

/** Envío manual desde el WhatsApp del propio vendedor (mientras no haya cuenta de WhatsApp Business). */
export async function openWhatsAppManual(saleId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const r = await loadReceipt(supabase, saleId);
  if (!r) return { error: "Venta no encontrada" };
  const phone = phoneE164(r.buyer.phone);
  if (!phone) return { error: "El comprador no tiene un teléfono válido" };
  await supabase.from("notifications").insert({
    sale_id: saleId,
    channel: "whatsapp",
    recipient: phone,
    status: "sent",
    attempts: 1,
    provider_id: "manual (whatsapp)",
    sent_at: new Date().toISOString(),
  });
  // Se devuelve el enlace y lo abre el navegador: una redirección del servidor estropeaba
  // las comillas (&#34;) y los emojis del mensaje. Se usa api.whatsapp.com directamente:
  // la redirección de wa.me vuelve a codificar el texto y rompe los emojis (salen como �).
  return { url: `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(receiptText(r.data))}` };
}
