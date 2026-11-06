import { kindFromSlug, seasonOf, seasonRange, type FinanceKind } from "@/lib/finance";
import { fecha } from "@/lib/format";

/** Filtros de movimientos, compartidos por la lista, los informes y las exportaciones (vienen de la URL). */
export type FinanceFilterParams = { t?: string; desde?: string; hasta?: string; tipo?: string; cat?: string; q?: string; anulados?: string };

export type FinanceFilters = {
  season: string | null; // null = todas o rango de fechas
  from: string | null;
  to: string | null;
  kind: FinanceKind | null;
  cat: string | null;
  q: string;
  voided: boolean;
};

const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function parseFilters(sp: FinanceFilterParams): FinanceFilters {
  const from = isDate(sp.desde) ? sp.desde! : null;
  const to = isDate(sp.hasta) ? sp.hasta! : null;
  // Si hay fechas, mandan las fechas; si no, la temporada (por defecto, la actual)
  const season = from || to ? null : sp.t === "todas" ? null : sp.t && seasonRange(sp.t) ? sp.t : seasonOf();
  return {
    season,
    from,
    to,
    kind: kindFromSlug(sp.tipo),
    cat: sp.cat && /^[0-9a-f-]{36}$/.test(sp.cat) ? sp.cat : null,
    q: (sp.q ?? "").trim().slice(0, 80),
    voided: sp.anulados === "1",
  };
}

/** Aplica los filtros a una consulta de finance_movements. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters<Q extends Record<string, any>>(query: Q, f: FinanceFilters, opts: { includeVoided?: boolean } = {}): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query;
  if (f.season) q = q.eq("season", f.season);
  if (f.from) q = q.gte("op_date", f.from);
  if (f.to) q = q.lte("op_date", f.to);
  if (f.kind) q = q.eq("kind", f.kind);
  if (f.cat) q = q.eq("category_id", f.cat);
  if (f.q) {
    const like = `%${f.q.replace(/[%_,()*]/g, " ")}%`;
    q = q.or(`concept.ilike.${like},counterparty.ilike.${like},notes.ilike.${like}`);
  }
  if (!(opts.includeVoided ?? f.voided)) q = q.is("voided_at", null);
  return q as Q;
}

/** Descripción legible del periodo, para títulos de informes y exportaciones. */
export function periodLabel(f: FinanceFilters): string {
  if (f.from || f.to) return f.from && f.to ? `Del ${fecha(f.from)} al ${fecha(f.to)}` : f.from ? `Desde el ${fecha(f.from)}` : `Hasta el ${fecha(f.to)}`;
  return f.season ? `Temporada ${f.season}` : "Todas las temporadas";
}

/** Vuelve a montar la query string (para enlaces de exportar y paginar). */
export function filtersQuery(sp: FinanceFilterParams, extra: Record<string, string> = {}): string {
  const entries = Object.entries({ ...sp, ...extra }).filter(([k, v]) => v && ["t", "desde", "hasta", "tipo", "cat", "q", "anulados", "p", "formato"].includes(k));
  return new URLSearchParams(entries as [string, string][]).toString();
}
