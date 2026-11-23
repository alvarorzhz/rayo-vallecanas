/**
 * 4.29.0 · Material deportivo: el inventario del club.
 * Un artículo (balones, camiseta de juego…) se guarda en lotes: piezas iguales en el mismo estado,
 * con su talla y dorsal si los tiene, y quién las tiene si están prestadas.
 * Sin dependencias de servidor: lo usan las páginas y las pruebas.
 */

export type MaterialCategory = "kit" | "balls" | "training" | "goalkeeper" | "medical" | "other";
export type Condition = "new" | "used" | "broken";

export type MaterialItem = {
  id: string;
  name: string;
  category: MaterialCategory;
  min_qty: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MaterialLot = {
  id: string;
  item_id: string;
  qty: number;
  condition: Condition;
  size: string | null;
  number: number | null;
  holder_player_id: string | null;
  lent_on: string | null;
  notes: string | null;
  updated_at: string;
};

export const CATEGORIES: MaterialCategory[] = ["kit", "balls", "training", "goalkeeper", "medical", "other"];
export const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  kit: "Equipaciones",
  balls: "Balones",
  training: "Entrenamiento",
  goalkeeper: "Portero",
  medical: "Botiquín",
  other: "Otros",
};
/** Ejemplos para el formulario de alta (así se entiende qué va en cada sitio). */
export const CATEGORY_HINT: Record<MaterialCategory, string> = {
  kit: "Camisetas, pantalones, medias, chándales…",
  balls: "Balones de partido y de entrenamiento",
  training: "Petos, conos, picas, escalera, porterías pequeñas…",
  goalkeeper: "Guantes, camiseta de portero…",
  medical: "Botiquín, spray de frío, vendas…",
  other: "Bolsas, bomba de hinchar, pizarra…",
};

export const CONDITIONS: Condition[] = ["new", "used", "broken"];
export const CONDITION_LABEL: Record<Condition, string> = { new: "Nuevo", used: "Usado", broken: "Roto" };
/** Colores de cada estado (fondo de la barra y de la etiqueta). */
export const CONDITION_BAR: Record<Condition, string> = { new: "bg-green-600", used: "bg-dorado", broken: "bg-rojo" };
export const CONDITION_TONE: Record<Condition, string> = {
  new: "bg-green-100 text-green-800",
  used: "bg-amber-100 text-amber-900",
  broken: "bg-red-100 text-red-800",
};

/** Tallas en el orden de la tienda; cualquier otra (p. ej. «42» en botas o «10 años») va al final. */
export const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
export const sizeRank = (s: string | null) => {
  if (!s) return 999;
  const i = SIZES.indexOf(s.toUpperCase());
  if (i >= 0) return i;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? 100 + n : 500;
};

/** Talla tal como se guarda: «m» → «M», «xxl» → «XXL», «2xl» → «XXL»; los números se quedan igual. */
export function normalizeSize(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, 8);
  if (!v) return null;
  const up = v.toUpperCase();
  if (up === "2XL") return "XXL";
  if (up === "XXXL") return "3XL";
  return SIZES.includes(up) ? up : v;
}

export type Tally = { total: number; new: number; used: number; broken: number; usable: number; lent: number };

/** Cuántas piezas hay de cada estado, cuántas sirven (nuevas y usadas) y cuántas están prestadas. */
export function tally(lots: Pick<MaterialLot, "qty" | "condition" | "holder_player_id">[]): Tally {
  const t: Tally = { total: 0, new: 0, used: 0, broken: 0, usable: 0, lent: 0 };
  for (const l of lots) {
    t.total += l.qty;
    t[l.condition] += l.qty;
    if (l.condition !== "broken") t.usable += l.qty;
    if (l.holder_player_id) t.lent += l.qty;
  }
  return t;
}

/**
 * «Lo que falta»: cuántas piezas en buen estado faltan para llegar al mínimo (0 si no hay mínimo o se llega).
 * Un artículo sin ninguna pieza apuntada todavía no se ha contado: no avisa (si no, al preparar el almacén saldría todo).
 */
export const shortfall = (item: Pick<MaterialItem, "min_qty">, t: Pick<Tally, "usable" | "total">) =>
  item.min_qty && t.total > 0 ? Math.max(0, item.min_qty - t.usable) : 0;

/** Orden de las piezas en la lista: dorsal, talla, estado (las rotas al final). */
export function sortLots<T extends Pick<MaterialLot, "number" | "size" | "condition" | "qty">>(lots: T[]): T[] {
  const cond = { new: 0, used: 1, broken: 2 } as const;
  return [...lots].sort((a, b) =>
    (a.number ?? 1000) - (b.number ?? 1000) ||
    sizeRank(a.size) - sizeRank(b.size) ||
    cond[a.condition] - cond[b.condition] ||
    b.qty - a.qty);
}

/** Resumen por tallas («M ×4 · L ×6»), solo con las piezas que sirven. */
export function sizeSummary(lots: Pick<MaterialLot, "qty" | "size" | "condition">[]): { size: string; qty: number }[] {
  const by = new Map<string, number>();
  for (const l of lots) if (l.size && l.condition !== "broken") by.set(l.size, (by.get(l.size) ?? 0) + l.qty);
  return [...by.entries()].map(([size, qty]) => ({ size, qty })).sort((a, b) => sizeRank(a.size) - sizeRank(b.size));
}

/** Dorsales repetidos dentro de un mismo artículo (dos camisetas con el 7 en buen estado): para avisar, no para impedir. */
export function repeatedNumbers(lots: Pick<MaterialLot, "number" | "qty" | "condition">[]): number[] {
  const seen = new Map<number, number>();
  for (const l of lots) if (l.number !== null && l.condition !== "broken") seen.set(l.number, (seen.get(l.number) ?? 0) + l.qty);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([num]) => num).sort((a, b) => a - b);
}

/** Dorsales de la plantilla que aún no tienen pieza en este artículo (para «Rellenar con la plantilla»). */
export function missingNumbers(squadNumbers: (number | null)[], lots: Pick<MaterialLot, "number" | "condition">[]): number[] {
  const have = new Set(lots.filter((l) => l.condition !== "broken" && l.number !== null).map((l) => l.number));
  return [...new Set(squadNumbers.filter((n): n is number => n !== null && !have.has(n)))].sort((a, b) => a - b);
}

/** Enlace a «Nuevo gasto» de Finanzas con el concepto y la categoría ya puestos. */
export const purchaseHref = (item: Pick<MaterialItem, "name">, missing?: number) =>
  `/finanzas/nuevo?tipo=gasto&categoria=${encodeURIComponent("Material deportivo")}&concepto=${encodeURIComponent(
    `Compra de material: ${item.name}${missing ? ` (${missing})` : ""}`,
  )}`;
