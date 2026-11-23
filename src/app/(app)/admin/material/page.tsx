import Link from "next/link";
import { AlertTriangle, PackageOpen, Plus, ShoppingCart, Warehouse } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIES, CATEGORY_LABEL, purchaseHref, shortfall, sizeSummary, tally, type MaterialCategory, type MaterialItem, type MaterialLot,
} from "@/lib/material";
import { PageHeader } from "@/components/ui";
import { CategoryIcon } from "@/components/material/icons";
import { StockBar, StockLegend } from "@/components/material/stock";
import { StarterForm } from "@/components/material/forms";
import { createStarter } from "./actions";

export const metadata = { title: "Material" };

type Lot = Pick<MaterialLot, "item_id" | "qty" | "condition" | "size" | "number" | "holder_player_id">;

export default async function MaterialPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const sp = await searchParams;
  const s = await requirePerm("material", "read");
  const supabase = await createClient();
  const [{ data: itemRows }, { data: lotRows }] = await Promise.all([
    supabase.from("material_items").select("*").order("name").returns<MaterialItem[]>(),
    supabase.from("material_lots").select("item_id, qty, condition, size, number, holder_player_id").returns<Lot[]>(),
  ]);
  const items = itemRows ?? [];
  const lots = lotRows ?? [];
  const byItem = new Map<string, Lot[]>();
  for (const l of lots) byItem.set(l.item_id, [...(byItem.get(l.item_id) ?? []), l]);
  const rows = items.map((it) => {
    const its = byItem.get(it.id) ?? [];
    const t = tally(its);
    return { it, lots: its, t, short: shortfall(it, t) };
  });

  const all = tally(lots);
  const missing = rows.filter((r) => r.short > 0);
  const broken = rows.filter((r) => r.t.broken > 0);
  const filter = (CATEGORIES as string[]).includes(sp.tipo ?? "") ? (sp.tipo as MaterialCategory) : null;
  const present = CATEGORIES.filter((c) => rows.some((r) => r.it.category === c));
  const groups = (filter ? [filter] : present).map((c) => ({ c, rows: rows.filter((r) => r.it.category === c) })).filter((g) => g.rows.length);
  const canCreate = s.can("material", "create");
  const canBuy = s.can("finances", "create");

  return (
    <>
      <PageHeader title="Material" subtitle="El almacén del club: qué hay, en qué estado está y quién tiene cada cosa."
        actions={canCreate && items.length > 0 ? <Link href="/admin/material/nuevo" prefetch className="btn-primary"><Plus size={18} /> Nuevo artículo</Link> : undefined} />

      {!items.length ? (
        <section className="card stock-tag overflow-hidden">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rojo text-white"><Warehouse size={24} /></span>
            <div>
              <h2>El almacén está vacío</h2>
              <p className="mt-1 text-sm text-negro/70">
                {canCreate ? "Empieza con lo típico de un equipo de fútbol 7 y luego apunta cuántas piezas hay de cada cosa. También puedes crear los artículos uno a uno." : "Todavía no se ha apuntado nada."}
              </p>
            </div>
          </div>
          {canCreate && (
            <>
              <div className="mt-4"><StarterForm action={createStarter} /></div>
              <p className="mt-3 text-sm"><Link href="/admin/material/nuevo" className="font-bold text-rojo hover:underline">O crea un artículo a tu manera →</Link></p>
            </>
          )}
        </section>
      ) : (
        <>
          <section className="franja relative mb-6 overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl sm:p-6">
            <div className="relative grid grid-cols-2 gap-4 sm:grid-cols-4">
              {([
                ["Piezas", all.total, ""],
                ["En buen estado", all.usable, "text-green-400"],
                ["Prestadas", all.lent, "text-dorado"],
                ["Rotas", all.broken, ""],
              ] as const).map(([k, v, tone], i) => (
                <div key={k} className="anim-score" style={{ animationDelay: `${i * 90}ms` }}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white/60">{k}</div>
                  <div className={`sport text-3xl font-black leading-none tabular-nums sm:text-4xl ${tone}`}>{v}</div>
                </div>
              ))}
            </div>
            {all.total > 0 && <StockBar t={all} className="relative mt-5 h-3 !bg-white/10" />}
          </section>

          {(missing.length > 0 || broken.length > 0) && (
            <section className="mb-6 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
              <h2 className="flex items-center gap-2 text-base text-amber-950"><AlertTriangle size={18} className="shrink-0" /> Lo que falta</h2>
              <ul className="mt-2 divide-y divide-amber-200/70">
                {missing.map(({ it, t, short }) => (
                  <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 text-sm">
                    <Link href={`/admin/material/${it.id}`} className="min-w-0 flex-1 text-amber-950 hover:underline">
                      <b>{it.name}</b>: {t.usable ? `quedan ${t.usable} en buen estado` : "no queda ninguna en buen estado"} y el mínimo es {it.min_qty}. <b>Faltan {short}.</b>
                    </Link>
                    {canBuy && (
                      <Link href={purchaseHref(it, short)} prefetch={false} className="btn-ghost shrink-0 !bg-white !py-1.5 text-xs">
                        <ShoppingCart size={14} /> Apuntar la compra
                      </Link>
                    )}
                  </li>
                ))}
                {broken.filter((r) => !r.short).map(({ it, t }) => (
                  <li key={it.id} className="py-2 text-sm text-amber-950">
                    <Link href={`/admin/material/${it.id}`} className="hover:underline"><b>{it.name}</b>: {t.broken === 1 ? "hay 1 rota" : `hay ${t.broken} rotas`}. Arréglalas o quítalas del inventario.</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {present.length > 1 && (
            <nav aria-label="Tipos de material" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <div className="flex w-max gap-1.5">
                <Link href="/admin/material" className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${!filter ? "bg-negro text-white ring-negro" : "bg-white text-negro/70 ring-black/10 hover:ring-rojo"}`}>
                  Todo · {items.length}
                </Link>
                {present.map((c) => (
                  <Link key={c} href={`/admin/material?tipo=${c}`} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${filter === c ? "bg-negro text-white ring-negro" : "bg-white text-negro/70 ring-black/10 hover:ring-rojo"}`}>
                    <CategoryIcon category={c} size={14} /> {CATEGORY_LABEL[c]} · {rows.filter((r) => r.it.category === c).length}
                  </Link>
                ))}
              </div>
            </nav>
          )}

          <div className="space-y-7">
            {groups.map(({ c, rows: list }) => (
              <section key={c}>
                <h2 className="mb-3 flex items-center gap-2 text-base"><CategoryIcon category={c} size={18} className="text-rojo" /> {CATEGORY_LABEL[c]}</h2>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map(({ it, lots: its, t, short }, i) => {
                    const sizes = sizeSummary(its);
                    return (
                      <li key={it.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                        <Link href={`/admin/material/${it.id}`} prefetch
                          className={`card stock-tag group flex h-full flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:ring-rojo/40 ${short ? "ring-2 ring-amber-300" : ""}`}>
                          <div className="flex items-center gap-3 pr-5">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gris text-negro ring-1 ring-black/5 transition group-hover:bg-rojo group-hover:text-white">
                              <CategoryIcon category={it.category} size={24} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="sport truncate text-lg font-black leading-tight group-hover:text-rojo">{it.name}</p>
                              <p className="mt-0.5 flex items-baseline gap-1.5">
                                <span className="sport text-2xl font-black leading-none tabular-nums">{t.usable}</span>
                                <span className="text-xs font-semibold text-negro/60">{t.usable === 1 ? "pieza útil" : "piezas útiles"}{it.min_qty ? ` · mínimo ${it.min_qty}` : ""}</span>
                              </p>
                            </div>
                          </div>
                          {t.total > 0 ? (
                            <div className="space-y-1.5">
                              <StockBar t={t} />
                              <StockLegend t={t} />
                            </div>
                          ) : (
                            <p className="flex items-center gap-1.5 text-xs text-negro/60"><PackageOpen size={14} /> Sin piezas apuntadas todavía</p>
                          )}
                          {(sizes.length > 0 || t.lent > 0 || short > 0) && (
                            <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-black/5 pt-2 text-xs">
                              {short > 0 && <span className="badge bg-amber-100 text-amber-900">Faltan {short}</span>}
                              {t.lent > 0 && <span className="badge bg-dorado/25 text-negro">{t.lent} {t.lent === 1 ? "prestada" : "prestadas"}</span>}
                              {sizes.map((z) => <span key={z.size} className="rounded-md bg-black/5 px-1.5 py-0.5 font-bold tabular-nums text-negro/75">{z.size} ×{z.qty}</span>)}
                            </div>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-negro/65"><Warehouse size={14} /> Cada jugador ve en su ficha solo el material que tiene él.</p>
    </>
  );
}
