"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseEuros } from "@/lib/format";
import { kindFromSlug } from "@/lib/finance";

export type ActionState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
const METHODS = ["cash", "bizum", "transfer", "card", "other"];

function refresh() {
  revalidatePath("/finanzas", "layout");
  revalidatePath("/");
}

function movementFromForm(f: FormData) {
  const op_date = str(f, "op_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(op_date)) throw new Error("Indica la fecha");
  const concept = str(f, "concept");
  if (!concept) throw new Error("Indica el concepto");
  const category_id = str(f, "category_id");
  if (!category_id) throw new Error("Elige una categoría");
  const amount_cents = parseEuros(f.get("amount"));
  if (amount_cents <= 0) throw new Error("Indica el importe");
  const method = METHODS.includes(str(f, "method")) ? str(f, "method") : "cash";
  const path = str(f, "attachment_path");
  if (path && !/^[0-9a-f-]{36}\/[^/]+$/.test(path)) throw new Error("Justificante no válido");
  return {
    op_date,
    concept: concept.slice(0, 200),
    category_id,
    amount_cents,
    method,
    counterparty: str(f, "counterparty") || null,
    notes: str(f, "notes") || null,
    attachment_path: path || null,
    attachment_name: path ? str(f, "attachment_name").slice(0, 120) || "justificante" : null,
  };
}

export async function createMovement(_: ActionState, f: FormData): Promise<ActionState> {
  const kind = kindFromSlug(str(f, "kind"));
  if (!kind) return { error: "Tipo de movimiento no válido" };
  let id: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("finance_movements").insert({ kind, ...movementFromForm(f) }).select("id").single();
    if (error) throw error;
    id = data.id;
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh();
  redirect(f.get("again") === "1" ? `/finanzas/nuevo?tipo=${str(f, "kind")}&ok=1` : `/finanzas/${id}?ok=1`);
}

export async function updateMovement(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("finance_movements").update(movementFromForm(f)).eq("id", id);
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh();
  redirect(`/finanzas/${id}?ok=2`);
}

export async function voidMovement(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finance_void_movement", { p_id: id, p_reason: str(f, "reason") });
  if (error) return { error: errMsg(error) };
  refresh();
  return { ok: "Movimiento anulado." };
}

// ---------------------------------------------------------------- Ajustes
export async function saveOpening(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const raw = str(f, "opening");
    const negative = raw.startsWith("-");
    const cents = parseEuros(negative ? raw.slice(1) : raw) * (negative ? -1 : 1);
    const date = str(f, "opening_date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Indica la fecha del saldo inicial");
    const supabase = await createClient();
    const { error } = await supabase.from("finance_settings").update({ opening_balance_cents: cents, opening_date: date }).eq("id", 1);
    if (error) throw error;
  } catch (e) {
    return { error: errMsg(e) };
  }
  refresh();
  return { ok: "Saldo inicial guardado." };
}

export async function addCategory(_: ActionState, f: FormData): Promise<ActionState> {
  const kind = kindFromSlug(str(f, "kind"));
  const name = str(f, "name");
  if (!kind || !name) return { error: "Escribe el nombre de la categoría" };
  const supabase = await createClient();
  const { error } = await supabase.from("finance_categories").insert({ kind, name: name.slice(0, 60), sort: 80 });
  if (error) return { error: error.code === "23505" ? "Ya existe una categoría con ese nombre" : errMsg(error) };
  refresh();
  return { ok: `Categoría «${name}» añadida.` };
}

export async function renameCategory(id: string, _: ActionState, f: FormData): Promise<ActionState> {
  const name = str(f, "name");
  if (!name) return { error: "El nombre no puede estar vacío" };
  const supabase = await createClient();
  const { error } = await supabase.from("finance_categories").update({ name: name.slice(0, 60) }).eq("id", id);
  if (error) return { error: error.code === "23505" ? "Ya existe una categoría con ese nombre" : errMsg(error) };
  refresh();
  return { ok: "Guardado." };
}

export async function toggleCategory(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("finance_categories").update({ active }).eq("id", id);
  if (error) throw new Error(errMsg(error));
  refresh();
}

// ---------------------------------------------------------------- Sorteos → Finanzas
export async function importCampaign(campaignId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finance_import_campaign", { p_campaign_id: campaignId });
  if (error) return { error: errMsg(error) };
  refresh();
  revalidatePath(`/loteria/${campaignId}`);
  return { ok: "Apuntado en Finanzas." };
}
