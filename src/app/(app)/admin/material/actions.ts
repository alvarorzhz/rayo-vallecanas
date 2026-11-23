"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { CATEGORIES, CONDITIONS, missingNumbers, normalizeSize, type Condition, type MaterialCategory, type MaterialLot } from "@/lib/material";

export type MaterialState = { error?: string; ok?: string } | undefined;
type DB = Awaited<ReturnType<typeof createClient>>;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = (f: FormData, k: string, max: number) => str(f, k).slice(0, max) || null;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const msg = (e: unknown) => {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  if (/row-level security|42501/.test(m)) return "No tienes permiso para hacer esto";
  if (/material_items_name_idx/.test(m)) return "Ya hay un artículo con ese nombre";
  return m;
};
const int = (v: string, min: number, max: number) => {
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
};

function refresh(itemId?: string) {
  revalidatePath("/admin/material");
  revalidatePath("/admin");
  if (itemId) revalidatePath(`/admin/material/${itemId}`);
}

// ---------------------------------------------------------------- Artículos

function itemFromForm(f: FormData) {
  const name = str(f, "name").replace(/\s+/g, " ").slice(0, 60);
  if (name.length < 2) throw new Error("Escribe el nombre del artículo");
  const category = (CATEGORIES as string[]).includes(str(f, "category")) ? (str(f, "category") as MaterialCategory) : "other";
  const minRaw = str(f, "min_qty");
  const min_qty = minRaw ? int(minRaw, 1, 999) : null;
  if (minRaw && min_qty === null) throw new Error("El mínimo tiene que ser un número entre 1 y 999");
  return { name, category, min_qty, notes: opt(f, "notes", 500) };
}

export async function saveItem(id: string | null, _: MaterialState, f: FormData): Promise<MaterialState> {
  const supabase = await createClient();
  let iid = id;
  try {
    const row = itemFromForm(f);
    if (iid) {
      const { error } = await supabase.from("material_items").update(row).eq("id", iid);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("material_items").insert(row).select("id").single();
      if (error) throw error;
      iid = data.id as string;
      // Lo que ya hay en el almacén al darlo de alta (opcional)
      const qty = int(str(f, "qty") || "0", 0, 999);
      if (qty) {
        const condition = (CONDITIONS as string[]).includes(str(f, "condition")) ? str(f, "condition") : "new";
        const { error: e2 } = await supabase.from("material_lots").insert({ item_id: iid, qty, condition });
        if (e2) throw e2;
      }
    }
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(iid!);
  if (!id) redirect(`/admin/material/${iid}`);
  return { ok: "Artículo guardado" };
}

export async function deleteItem(id: string): Promise<MaterialState> {
  const supabase = await createClient();
  const { error } = await supabase.from("material_items").delete().eq("id", id);
  if (error) return { error: msg(error) };
  refresh();
  redirect("/admin/material");
}

/** Lo típico de un equipo de fútbol 7, para no empezar con el almacén vacío. */
const STARTER: Record<string, { name: string; category: MaterialCategory; min_qty: number | null }> = {
  camiseta: { name: "Camiseta de juego", category: "kit", min_qty: null },
  pantalon: { name: "Pantalón de juego", category: "kit", min_qty: null },
  medias: { name: "Medias", category: "kit", min_qty: null },
  portero: { name: "Camiseta de portero", category: "goalkeeper", min_qty: 1 },
  balones: { name: "Balones", category: "balls", min_qty: 6 },
  petos: { name: "Petos", category: "training", min_qty: 7 },
  conos: { name: "Conos", category: "training", min_qty: null },
  botiquin: { name: "Botiquín", category: "medical", min_qty: 1 },
};
export async function createStarter(_: MaterialState, f: FormData): Promise<MaterialState> {
  const supabase = await createClient();
  const picked = Object.entries(STARTER).filter(([k]) => f.get(k) === "on").map(([, v]) => v);
  if (!picked.length) return { error: "Marca al menos un artículo" };
  const { data: existing } = await supabase.from("material_items").select("name");
  const have = new Set((existing ?? []).map((r) => (r.name as string).toLowerCase()));
  const rows = picked.filter((p) => !have.has(p.name.toLowerCase()));
  if (rows.length) {
    const { error } = await supabase.from("material_items").insert(rows);
    if (error) return { error: msg(error) };
  }
  refresh();
  return { ok: rows.length === 1 ? "Artículo creado" : `${rows.length} artículos creados` };
}

// ---------------------------------------------------------------- Piezas (lotes)

type LotFields = Pick<MaterialLot, "condition" | "size" | "number" | "holder_player_id" | "lent_on" | "notes">;

function lotFromForm(f: FormData): LotFields {
  const condition = (CONDITIONS as string[]).includes(str(f, "condition")) ? (str(f, "condition") as Condition) : "new";
  const numRaw = str(f, "number");
  const number = numRaw ? int(numRaw, 0, 99) : null;
  if (numRaw && number === null) throw new Error("El dorsal tiene que ser un número del 0 al 99");
  const holder = str(f, "holder_player_id");
  const holder_player_id = UUID.test(holder) ? holder : null;
  const lent = str(f, "lent_on");
  return {
    condition,
    size: normalizeSize(str(f, "size") === "__other" ? str(f, "size_other") : str(f, "size")),
    number,
    holder_player_id,
    lent_on: holder_player_id ? (DATE.test(lent) ? lent : new Date().toISOString().slice(0, 10)) : null,
    notes: opt(f, "notes", 200),
  };
}

const same = (a: LotFields, b: LotFields) =>
  a.condition === b.condition && a.size === b.size && a.number === b.number && a.holder_player_id === b.holder_player_id && (a.notes ?? null) === (b.notes ?? null);

/**
 * Junta las piezas iguales en un solo lote («3 balones nuevos» + «2 balones nuevos» = «5 balones nuevos»)
 * para que la lista no se llene de filas repetidas. Las camisetas con dorsal no se juntan nunca.
 */
async function tidy(supabase: DB, itemId: string) {
  const { data } = await supabase.from("material_lots").select("*").eq("item_id", itemId).order("created_at");
  const lots = (data ?? []) as MaterialLot[];
  const keep: MaterialLot[] = [];
  for (const l of lots) {
    const twin = l.number === null ? keep.find((k) => same(k, l)) : undefined;
    if (!twin || twin.qty + l.qty > 999) { keep.push(l); continue; }
    twin.qty += l.qty;
    const { error } = await supabase.from("material_lots").update({ qty: twin.qty }).eq("id", twin.id);
    if (error) throw error;
    const { error: e2 } = await supabase.from("material_lots").delete().eq("id", l.id);
    if (e2) throw e2;
  }
}

export async function addLot(itemId: string, _: MaterialState, f: FormData): Promise<MaterialState> {
  const supabase = await createClient();
  try {
    const qty = int(str(f, "qty") || "1", 1, 999);
    if (!qty) throw new Error("Pon cuántas piezas son (de 1 a 999)");
    const fields = lotFromForm(f);
    if (fields.number !== null && qty > 1) throw new Error("Con dorsal, cada pieza va por separado: pon 1");
    const { error } = await supabase.from("material_lots").insert({ ...fields, qty, item_id: itemId });
    if (error) throw error;
    await tidy(supabase, itemId);
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(itemId);
  return { ok: "Piezas añadidas" };
}

/**
 * Cambia un lote. Si solo se cambian algunas de sus piezas («de los 8 balones, 1 está roto»), se separan
 * en un lote nuevo y el resto se queda como estaba.
 */
export async function updateLot(itemId: string, lotId: string, _: MaterialState, f: FormData): Promise<MaterialState> {
  const supabase = await createClient();
  try {
    const { data: cur, error: e0 } = await supabase.from("material_lots").select("*").eq("id", lotId).single();
    if (e0 || !cur) throw new Error("Esas piezas ya no están");
    const lot = cur as MaterialLot;
    const fields = lotFromForm(f);
    // Si sigue prestado a la misma persona, se conserva la fecha del préstamo
    if (fields.holder_player_id && fields.holder_player_id === lot.holder_player_id && !str(f, "lent_on")) fields.lent_on = lot.lent_on;
    const qty = int(str(f, "qty") || String(lot.qty), 1, 999);
    if (!qty) throw new Error("Pon cuántas piezas son (de 1 a 999)");
    const part = int(str(f, "part") || String(lot.qty), 1, lot.qty) ?? lot.qty;
    if (part < lot.qty) {
      // Solo una parte: el original pierde esas piezas y salen en un lote nuevo con los cambios
      const { error } = await supabase.from("material_lots").update({ qty: lot.qty - part }).eq("id", lotId);
      if (error) throw error;
      const { error: e2 } = await supabase.from("material_lots").insert({ ...fields, item_id: itemId, qty: part, number: null });
      if (e2) throw e2;
    } else {
      if (fields.number !== null && qty > 1) throw new Error("Con dorsal, cada pieza va por separado: pon 1");
      const { error } = await supabase.from("material_lots").update({ ...fields, qty }).eq("id", lotId);
      if (error) throw error;
    }
    await tidy(supabase, itemId);
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(itemId);
  return { ok: "Guardado" };
}

/** Atajos de una pieza: «Devuelta» (vuelve al almacén) y «Una rota» (de un lote, una pasa a rota). */
export async function quickLot(itemId: string, lotId: string, what: "returned" | "break_one"): Promise<MaterialState> {
  const supabase = await createClient();
  try {
    const { data: cur } = await supabase.from("material_lots").select("*").eq("id", lotId).single();
    if (!cur) throw new Error("Esas piezas ya no están");
    const lot = cur as MaterialLot;
    if (what === "returned") {
      const { error } = await supabase.from("material_lots").update({ holder_player_id: null, lent_on: null }).eq("id", lotId);
      if (error) throw error;
    } else if (lot.qty === 1) {
      const { error } = await supabase.from("material_lots").update({ condition: "broken" }).eq("id", lotId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("material_lots").update({ qty: lot.qty - 1 }).eq("id", lotId);
      if (error) throw error;
      const { id: _id, updated_at: _u, ...rest } = lot; // eslint-disable-line @typescript-eslint/no-unused-vars
      const { error: e2 } = await supabase.from("material_lots").insert({ ...rest, qty: 1, condition: "broken", created_at: undefined });
      if (e2) throw e2;
    }
    await tidy(supabase, itemId);
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(itemId);
  return { ok: what === "returned" ? "Devuelto al almacén" : "Apuntada como rota" };
}

export async function deleteLot(itemId: string, lotId: string): Promise<MaterialState> {
  const supabase = await createClient();
  const { error } = await supabase.from("material_lots").delete().eq("id", lotId);
  if (error) return { error: msg(error) };
  refresh(itemId);
  return { ok: "Quitado del inventario" };
}

/**
 * «Una por dorsal»: crea una pieza por cada dorsal de la plantilla de esta temporada que aún no tenga la suya,
 * en la talla y el estado elegidos (la talla de cada uno se cambia luego tocando su camiseta).
 */
export async function fillFromSquad(itemId: string, _: MaterialState, f: FormData): Promise<MaterialState> {
  const supabase = await createClient();
  let n = 0;
  try {
    const condition = (CONDITIONS as string[]).includes(str(f, "condition")) ? (str(f, "condition") as Condition) : "new";
    const lend = f.get("lend") === "on";
    const [{ data: squad }, { data: lots }] = await Promise.all([
      supabase.from("squad_members").select("number, player_id").eq("season", seasonOf()).neq("status", "left"),
      supabase.from("material_lots").select("number, condition").eq("item_id", itemId),
    ]);
    const members = (squad ?? []) as { number: number | null; player_id: string }[];
    const nums = missingNumbers(members.map((m) => m.number), (lots ?? []) as Pick<MaterialLot, "number" | "condition">[]);
    if (!nums.length) throw new Error("Todos los dorsales de la plantilla ya tienen la suya");
    const today = new Date().toISOString().slice(0, 10);
    const rows = nums.map((number) => {
      const holder = lend ? members.find((m) => m.number === number)?.player_id ?? null : null;
      return { item_id: itemId, qty: 1, condition, number, size: normalizeSize(str(f, "size")), holder_player_id: holder, lent_on: holder ? today : null };
    });
    const { error } = await supabase.from("material_lots").insert(rows);
    if (error) throw error;
    n = rows.length;
  } catch (e) {
    return { error: msg(e) };
  }
  refresh(itemId);
  return { ok: n === 1 ? "Añadida 1 pieza" : `Añadidas ${n} piezas` };
}
