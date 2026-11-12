"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/session";
import { sendPush } from "@/lib/push";
import { fetchFees, fetchRoster } from "@/lib/squad-queries";
import { parseEuros, phoneE164 } from "@/lib/format";
import { feeOf, fullName, shirtName } from "@/lib/squad";
import type { ActionState } from "@/app/(app)/plantilla/actions";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const SEASON = /^\d{4}\/\d{2}$/;
const METHODS = ["cash", "bizum", "transfer", "card", "other"];
const msg = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  return /row-level security|42501/.test(m) ? "No tienes permiso para hacer esto" : m;
};

function refresh(playerId?: string) {
  revalidatePath("/plantilla/cuotas");
  revalidatePath("/finanzas", "layout");
  if (playerId) revalidatePath(`/plantilla/${playerId}`);
}

/** Cuota general de la temporada. */
export async function saveFeePlan(season: string, _: ActionState, f: FormData): Promise<ActionState> {
  if (!SEASON.test(season)) return { error: "Temporada no válida" };
  try {
    const amount_cents = parseEuros(f.get("amount"));
    const due = str(f, "due_on");
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error("Fecha no válida");
    const supabase = await createClient();
    const { error } = await supabase.from("squad_fee_plans").upsert({ season, amount_cents, due_on: due || null, notes: str(f, "notes").slice(0, 300) || null });
    if (error) throw error;
  } catch (e) {
    return { error: msg(e) };
  }
  refresh();
  return { ok: "Cuota de la temporada guardada" };
}

/** Cuota distinta para un jugador (descuento, hermanos, exento...). Vacío = vuelve a la general. */
export async function saveFeeOverride(season: string, playerId: string, _: ActionState, f: FormData): Promise<ActionState> {
  if (!SEASON.test(season)) return { error: "Temporada no válida" };
  const supabase = await createClient();
  try {
    if (f.get("reset") === "1" || str(f, "amount") === "") {
      const { error } = await supabase.from("squad_fee_overrides").delete().eq("season", season).eq("player_id", playerId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("squad_fee_overrides").upsert({
        season, player_id: playerId, amount_cents: parseEuros(f.get("amount")), reason: str(f, "reason").slice(0, 120) || null,
      });
      if (error) throw error;
    }
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(playerId);
  return { ok: "Cuota del jugador guardada" };
}

/** Apunta un pago de cuota: es un ingreso de Finanzas (categoría «Cuotas de jugadores») enlazado al jugador. */
export async function registerFeePayment(season: string, playerId: string, _: ActionState, f: FormData): Promise<ActionState> {
  if (!SEASON.test(season)) return { error: "Temporada no válida" };
  const supabase = await createClient();
  let amount: number;
  try {
    amount = parseEuros(f.get("amount"));
    if (amount <= 0) throw new Error("Indica el importe");
    const op_date = str(f, "op_date") || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(op_date)) throw new Error("Fecha no válida");
    const method = METHODS.includes(str(f, "method")) ? str(f, "method") : "cash";
    const [{ data: player }, { data: cats }] = await Promise.all([
      supabase.from("players").select("first_name, last_name").eq("id", playerId).single(),
      supabase.from("finance_categories").select("id, name").eq("kind", "income").eq("active", true).order("sort"),
    ]);
    if (!player) throw new Error("Jugador no encontrado");
    const cat = cats?.find((c) => /cuota/i.test(c.name)) ?? cats?.[0];
    if (!cat) throw new Error("No hay ninguna categoría de ingresos en Finanzas");
    const name = fullName(player);
    const { error } = await supabase.from("finance_movements").insert({
      kind: "income",
      op_date,
      concept: `Cuota ${season} · ${name}`.slice(0, 200),
      category_id: cat.id,
      amount_cents: amount,
      method,
      counterparty: name,
      notes: str(f, "notes").slice(0, 300) || null,
      player_id: playerId,
      fee_season: season,
    });
    if (error) throw error;
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(playerId);
  return { ok: `Pago de ${(amount / 100).toFixed(2).replace(".", ",")} € apuntado en Finanzas` };
}

export type FeeReminderState = {
  error?: string;
  ok?: string;
  /** Mensaje neutro (no ha salido ningún aviso). */
  info?: string;
  /** Los que deben y no tienen avisos: para mandárselo por WhatsApp con el mensaje ya escrito. */
  whatsapp?: { name: string; amount: string; url: string | null }[];
} | undefined;

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",").replace(",00", "")} €`;

/**
 * «Recordar»: aviso solo a los jugadores que deben cuota esta temporada, cada uno con lo que le falta.
 * Como mucho una vez al día por temporada. A los que no tienen avisos se les prepara un WhatsApp.
 */
export async function remindFees(season: string): Promise<FeeReminderState> {
  if (!SEASON.test(season)) return { error: "Temporada no válida" };
  const s = await getSession();
  if (!s.can("finances", "update") && !s.can("finances", "create")) return { error: "No tienes permiso para hacer esto" };
  const supabase = await createClient();
  const [roster, fees] = await Promise.all([fetchRoster(supabase, season), fetchFees(supabase, season)]);
  const owing = roster
    .filter((r) => r.status !== "left")
    .map((r) => ({ r, left: Math.max(0, (feeOf(fees.plan, fees.overrides.get(r.player_id)) ?? 0) - (fees.paid.get(r.player_id) ?? 0)) }))
    .filter((x) => x.left > 0);
  if (!owing.length) return { ok: "Nadie debe la cuota. ¡Todo cobrado!" };

  const admin = createAdminClient();
  const tag = `cuota-${season}`;
  const { data: recent } = await admin.from("push_log").select("created_at").eq("tag", tag)
    .gt("created_at", new Date(Date.now() - 20 * 3600_000).toISOString()).limit(1);
  const already = !!recent?.length;

  const ids = owing.map((x) => x.r.player_id);
  const [{ data: players }, { data: priv }] = await Promise.all([
    admin.from("players").select("id, user_id").in("id", ids),
    admin.from("player_private").select("player_id, phone").in("player_id", ids),
  ]);
  const userOf = new Map((players ?? []).map((p) => [p.id as string, p.user_id as string | null]));
  const users = [...new Set((players ?? []).map((p) => p.user_id as string | null).filter((u): u is string => !!u))];
  const { data: subs } = users.length ? await admin.from("push_subscriptions").select("user_id").in("user_id", users) : { data: [] };
  const withPush = new Set((subs ?? []).map((x) => x.user_id as string));
  const phoneOf = new Map((priv ?? []).map((p) => [p.player_id as string, p.phone as string | null]));
  const leftOfUser = new Map<string, number>();
  for (const x of owing) {
    const u = userOf.get(x.r.player_id);
    if (u) leftOfUser.set(u, x.left);
  }

  const due = fees.plan?.due_on ? ` antes del ${new Date(fees.plan.due_on + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" })}` : "";
  const whatsapp = owing
    .filter((x) => { const u = userOf.get(x.r.player_id); return !u || !withPush.has(u); })
    .map((x) => {
      const phone = phoneE164(phoneOf.get(x.r.player_id));
      const text = `¡Hola, ${shirtName(x.r.player)}! ⚡ Te recordamos que te faltan ${eur(x.left)} de la cuota del Rayo Vallecañas de la temporada ${season}${due}. Puedes pagársela a cualquier gestor. ¡Gracias!`;
      return { name: shirtName(x.r.player), amount: eur(x.left), url: phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}` : null };
    });

  const targets = [...leftOfUser.keys()].filter((u) => withPush.has(u));
  let sent = 0;
  if (targets.length && !already) {
    sent = await sendPush(targets, { title: "💶 Cuota del Rayo", body: `Te falta parte de la cuota de ${season}.`, url: "/perfil#mi-cuota", tag },
      (u) => ({ body: `Te faltan ${eur(leftOfUser.get(u) ?? 0)} de la cuota de ${season}${due}. Mira el detalle en Mi perfil.` }));
  }
  const pushed = already ? "Hoy ya se mandó el aviso a los que lo tienen activado; vuelve a probar mañana." :
    targets.length ? (sent ? `Aviso enviado a ${targets.length} ${targets.length === 1 ? "jugador" : "jugadores"}.` : "No se pudo enviar el aviso.") : "Ninguno de los que deben tiene los avisos activados.";
  return sent ? { ok: pushed, whatsapp } : { info: pushed, whatsapp };
}
