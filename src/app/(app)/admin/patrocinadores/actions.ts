"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { euros, parseEuros } from "@/lib/format";
import { splitInstallments } from "@/lib/sponsors";

export type SponsorState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = (f: FormData, k: string, max: number) => str(f, k).slice(0, max) || null;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEASON = /^\d{4}\/\d{2}$/;
const METHODS = ["cash", "bizum", "transfer", "card", "other"];
const date = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) return null;
  if (!DATE.test(v)) throw new Error("Fecha no válida");
  return v;
};
const msg = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  if (/row-level security|42501/.test(m)) return "No tienes permiso para hacer esto";
  if (/sponsors_name_idx/.test(m)) return "Ya hay un patrocinador con ese nombre";
  if (/finance_movements_installment_idx/.test(m)) return "Ese plazo ya está cobrado";
  return m;
};

function refresh(sponsorId?: string) {
  revalidatePath("/admin/patrocinadores");
  if (sponsorId) revalidatePath(`/admin/patrocinadores/${sponsorId}`);
  revalidatePath("/");
}

function url(f: FormData, k: string) {
  let v = str(f, k);
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    return new URL(v).toString().slice(0, 300);
  } catch {
    throw new Error("La web no es válida");
  }
}

// ---------------------------------------------------------------- Fichas

const LOGO_MIME = ["image/png", "image/jpeg"];
async function uploadLogo(supabase: Awaited<ReturnType<typeof createClient>>, id: string, f: FormData) {
  const file = f.get("logo");
  if (!(file instanceof File) || file.size === 0) return;
  if (!LOGO_MIME.includes(file.type)) throw new Error("El logo tiene que ser una imagen PNG o JPG");
  if (file.size > 1024 * 1024) throw new Error("El logo pesa demasiado (máximo 1 MB)");
  const path = `${id}/${Date.now()}.${file.type === "image/png" ? "png" : "jpg"}`;
  const { data: old } = await supabase.storage.from("sponsor-logos").list(id);
  const { error } = await supabase.storage.from("sponsor-logos").upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  if (old?.length) await supabase.storage.from("sponsor-logos").remove(old.map((o) => `${id}/${o.name}`));
  const logo_url = supabase.storage.from("sponsor-logos").getPublicUrl(path).data.publicUrl;
  const { error: e2 } = await supabase.from("sponsors").update({ logo_url }).eq("id", id);
  if (e2) throw e2;
}

export async function saveSponsor(id: string | null, _: SponsorState, f: FormData): Promise<SponsorState> {
  const supabase = await createClient();
  let sid = id;
  try {
    const name = str(f, "name").slice(0, 80);
    if (name.length < 2) throw new Error("Escribe el nombre del patrocinador");
    const email = opt(f, "contact_email", 120);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("El email no es válido");
    const row = {
      name,
      tier: str(f, "tier") === "main" ? "main" : "partner",
      website: url(f, "website"),
      instagram: opt(f, "instagram", 60),
      contact_name: opt(f, "contact_name", 80),
      contact_phone: opt(f, "contact_phone", 30),
      contact_email: email,
      notes: opt(f, "notes", 2000),
      active: id ? f.get("active") === "on" : true,
    };
    if (sid) {
      const { error } = await supabase.from("sponsors").update(row).eq("id", sid);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("sponsors").insert(row).select("id").single();
      if (error) throw error;
      sid = data.id as string;
    }
    if (f.get("remove_logo") === "on") {
      const { data: old } = await supabase.storage.from("sponsor-logos").list(sid!);
      if (old?.length) await supabase.storage.from("sponsor-logos").remove(old.map((o) => `${sid}/${o.name}`));
      await supabase.from("sponsors").update({ logo_url: null }).eq("id", sid);
    } else await uploadLogo(supabase, sid!, f);
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(sid!);
  if (!id) redirect(`/admin/patrocinadores/${sid}`);
  return { ok: "Ficha guardada" };
}

export async function deleteSponsor(id: string): Promise<SponsorState> {
  const supabase = await createClient();
  const { error } = await supabase.from("sponsors").delete().eq("id", id);
  if (error) return { error: msg(error) };
  const { data: old } = await supabase.storage.from("sponsor-logos").list(id);
  if (old?.length) await supabase.storage.from("sponsor-logos").remove(old.map((o) => `${id}/${o.name}`));
  refresh();
  redirect("/admin/patrocinadores");
}

// ---------------------------------------------------------------- Acuerdos

function agreementFromForm(f: FormData) {
  const season = str(f, "season");
  if (!SEASON.test(season)) throw new Error("Elige la temporada");
  const kind = ["money", "in_kind", "mixed"].includes(str(f, "kind")) ? str(f, "kind") : "money";
  const status = ["negotiating", "signed", "cancelled"].includes(str(f, "status")) ? str(f, "status") : "negotiating";
  const amount_cents = kind === "in_kind" ? 0 : parseEuros(f.get("amount"));
  const in_kind = kind === "money" ? null : opt(f, "in_kind", 500);
  const in_kind_value_cents = kind === "money" || !str(f, "in_kind_value") ? null : parseEuros(f.get("in_kind_value"));
  if (kind !== "in_kind" && amount_cents <= 0) throw new Error("Indica el importe en dinero");
  if (kind !== "money" && !in_kind) throw new Error("Cuenta qué aporta en especie");
  const starts_on = date(f, "starts_on");
  const ends_on = date(f, "ends_on");
  if (starts_on && ends_on && ends_on < starts_on) throw new Error("El acuerdo no puede acabar antes de empezar");
  return { season, kind, status, amount_cents, in_kind, in_kind_value_cents, benefits: opt(f, "benefits", 1000), starts_on, ends_on, notes: opt(f, "notes", 2000) };
}

export async function createAgreement(sponsorId: string, _: SponsorState, f: FormData): Promise<SponsorState> {
  const supabase = await createClient();
  try {
    const row = agreementFromForm(f);
    const { data, error } = await supabase.from("sponsor_agreements").insert({ ...row, sponsor_id: sponsorId }).select("id").single();
    if (error) throw error;
    if (row.amount_cents > 0) {
      const n = Number(str(f, "installments") || 1);
      const first = date(f, "first_due") ?? row.starts_on ?? new Date().toISOString().slice(0, 10);
      const plan = splitInstallments(row.amount_cents, n, first).map((p) => ({ ...p, agreement_id: data.id }));
      const { error: e2 } = await supabase.from("sponsor_installments").insert(plan);
      if (e2) throw e2;
    }
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(sponsorId);
  return { ok: "Acuerdo creado" };
}

export async function updateAgreement(sponsorId: string, id: string, _: SponsorState, f: FormData): Promise<SponsorState> {
  const supabase = await createClient();
  try {
    const row = agreementFromForm(f);
    const { error } = await supabase.from("sponsor_agreements").update(row).eq("id", id);
    if (error) throw error;
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(sponsorId);
  return { ok: "Acuerdo guardado" };
}

export async function deleteAgreement(sponsorId: string, id: string): Promise<SponsorState> {
  const supabase = await createClient();
  const { data: a } = await supabase.from("sponsor_agreements").select("contract_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("sponsor_agreements").delete().eq("id", id);
  if (error) return { error: msg(error) };
  if (a?.contract_path) await supabase.storage.from("sponsor-docs").remove([a.contract_path]);
  refresh(sponsorId);
  return { ok: "Acuerdo eliminado" };
}

/** Guarda el contrato ya subido al bucket privado (o lo quita si path está vacío). */
export async function setContract(sponsorId: string, id: string, path: string | null, name: string | null): Promise<SponsorState> {
  const supabase = await createClient();
  if (path && !/^[0-9a-f-]{36}\/[\w.-]{1,80}$/i.test(path)) return { error: "Archivo no válido" };
  const { data: a } = await supabase.from("sponsor_agreements").select("contract_path").eq("id", id).maybeSingle();
  if (!a) return { error: "Acuerdo no encontrado" };
  const { error } = await supabase.from("sponsor_agreements")
    .update({ contract_path: path, contract_name: path ? (name ?? "contrato").slice(0, 120) : null }).eq("id", id);
  if (error) return { error: msg(error) };
  if (a.contract_path && a.contract_path !== path) await supabase.storage.from("sponsor-docs").remove([a.contract_path]);
  refresh(sponsorId);
  return { ok: path ? "Contrato guardado" : "Contrato quitado" };
}

// ---------------------------------------------------------------- Plazos y cobros

export async function addInstallment(sponsorId: string, agreementId: string, _: SponsorState, f: FormData): Promise<SponsorState> {
  const supabase = await createClient();
  try {
    const due_on = date(f, "due_on");
    if (!due_on) throw new Error("Indica la fecha del plazo");
    const amount_cents = parseEuros(f.get("amount"));
    if (amount_cents <= 0) throw new Error("Indica el importe del plazo");
    const { error } = await supabase.from("sponsor_installments").insert({ agreement_id: agreementId, due_on, amount_cents });
    if (error) throw error;
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(sponsorId);
  return { ok: "Plazo añadido" };
}

export async function updateInstallment(sponsorId: string, id: string, _: SponsorState, f: FormData): Promise<SponsorState> {
  const supabase = await createClient();
  try {
    const due_on = date(f, "due_on");
    if (!due_on) throw new Error("Indica la fecha del plazo");
    const amount_cents = parseEuros(f.get("amount"));
    if (amount_cents <= 0) throw new Error("Indica el importe del plazo");
    const { error } = await supabase.from("sponsor_installments").update({ due_on, amount_cents, reminded_at: null }).eq("id", id);
    if (error) throw error;
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(sponsorId);
  return { ok: "Plazo guardado" };
}

export async function deleteInstallment(sponsorId: string, id: string): Promise<SponsorState> {
  const supabase = await createClient();
  const { error } = await supabase.from("sponsor_installments").delete().eq("id", id);
  if (error) return { error: msg(error) };
  refresh(sponsorId);
  return { ok: "Plazo eliminado" };
}

/** Cobro de un plazo: ingreso en Finanzas (categoría «Patrocinios») enlazado al plazo. */
export async function registerPayment(sponsorId: string, installmentId: string, _: SponsorState, f: FormData): Promise<SponsorState> {
  const s = await getSession();
  if (!s.can("finances", "create")) return { error: "Para apuntar cobros necesitas poder crear movimientos en Finanzas" };
  const supabase = await createClient();
  let amount = 0;
  try {
    amount = parseEuros(f.get("amount"));
    if (amount <= 0) throw new Error("Indica el importe");
    const op_date = str(f, "op_date") || new Date().toISOString().slice(0, 10);
    if (!DATE.test(op_date)) throw new Error("Fecha no válida");
    const method = METHODS.includes(str(f, "method")) ? str(f, "method") : "transfer";
    const [{ data: inst }, { data: cats }] = await Promise.all([
      supabase.from("sponsor_installments")
        .select("id, due_on, agreement:sponsor_agreements!inner(id, season, sponsor:sponsors!inner(name), installments:sponsor_installments(id, due_on))")
        .eq("id", installmentId).single(),
      supabase.from("finance_categories").select("id, name").eq("kind", "income").eq("active", true).order("sort"),
    ]);
    if (!inst) throw new Error("Plazo no encontrado");
    const ag = inst.agreement as unknown as { season: string; sponsor: { name: string }; installments: { id: string; due_on: string }[] };
    const cat = cats?.find((c) => /patrocin/i.test(c.name)) ?? cats?.find((c) => /otros/i.test(c.name)) ?? cats?.[0];
    if (!cat) throw new Error("No hay ninguna categoría de ingresos en Finanzas");
    const order = [...ag.installments].sort((a, b) => a.due_on.localeCompare(b.due_on));
    const k = order.findIndex((i) => i.id === installmentId) + 1;
    const plazo = order.length > 1 ? ` (plazo ${k}/${order.length})` : "";
    const { error } = await supabase.from("finance_movements").insert({
      kind: "income",
      op_date,
      concept: `Patrocinio ${ag.season} · ${ag.sponsor.name}${plazo}`.slice(0, 200),
      category_id: cat.id,
      amount_cents: amount,
      method,
      counterparty: ag.sponsor.name,
      notes: opt(f, "notes", 300),
      sponsor_installment_id: installmentId,
    });
    if (error) throw error;
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(sponsorId);
  revalidatePath("/finanzas", "layout");
  return { ok: `Cobro de ${euros(amount)} apuntado en Finanzas` };
}

// ---------------------------------------------------------------- Dónde se muestran

export async function saveDisplay(_: SponsorState, f: FormData): Promise<SponsorState> {
  const supabase = await createClient();
  const { error } = await supabase.from("sponsor_settings")
    .update({ show_home: f.get("show_home") === "on", show_result: f.get("show_result") === "on" }).eq("id", true);
  if (error) return { error: msg(error) };
  refresh();
  revalidatePath("/partidos", "layout");
  return { ok: "Guardado" };
}
