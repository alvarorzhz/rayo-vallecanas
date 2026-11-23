import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, PackagePlus, Pencil, ShoppingCart, UserRound, Users, Warehouse, X } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fecha } from "@/lib/format";
import { fullName } from "@/lib/squad";
import {
  CATEGORY_LABEL, CONDITION_LABEL, CONDITION_TONE, missingNumbers, purchaseHref, repeatedNumbers, shortfall, sizeSummary, sortLots, tally,
  type MaterialItem, type MaterialLot,
} from "@/lib/material";
import { PageHeader } from "@/components/ui";
import { FoldCard } from "@/components/squad/fold-card";
import { CategoryIcon, KitShirt } from "@/components/material/icons";
import { StockBar, StockLegend } from "@/components/material/stock";
import { AddLotForm, DeleteItemButton, FillFromSquadForm, ItemForm, LotEditor, type HolderOption } from "@/components/material/forms";
import { addLot, deleteItem, deleteLot, fillFromSquad, quickLot, saveItem, updateLot } from "../actions";

export const metadata = { title: "Material" };

type Member = { number: number | null; player_id: string; player: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export default async function MaterialItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pieza?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await requirePerm("material", "read");
  const supabase = await createClient();
  const [{ data: item }, { data: lotRows }, { data: squad }] = await Promise.all([
    supabase.from("material_items").select("*").eq("id", id).maybeSingle<MaterialItem>(),
    supabase.from("material_lots").select("*").eq("item_id", id).returns<MaterialLot[]>(),
    supabase.from("squad_members").select("number, player_id, player:players(first_name, last_name)").eq("season", seasonOf()).neq("status", "left").returns<Member[]>(),
  ]);
  if (!item) notFound();
  const lots = sortLots(lotRows ?? []);

  // Quién puede tener material: la plantilla de esta temporada (y quien ya tenga algo aunque se haya ido)
  const holders: HolderOption[] = (squad ?? []).flatMap((m) => {
    const p = one(m.player);
    return p ? [{ id: m.player_id, name: fullName(p), number: m.number }] : [];
  }).sort((a, b) => (a.number ?? 1000) - (b.number ?? 1000) || a.name.localeCompare(b.name, "es"));
  const away = [...new Set(lots.map((l) => l.holder_player_id).filter((h): h is string => !!h && !holders.some((x) => x.id === h)))];
  if (away.length) {
    const { data } = await supabase.from("players").select("id, first_name, last_name").in("id", away);
    for (const p of data ?? []) holders.push({ id: p.id, name: fullName(p), number: null });
  }
  const nameOf = (pid: string | null) => (pid ? holders.find((h) => h.id === pid)?.name ?? "Jugador" : null);

  const t = tally(lots);
  const short = shortfall(item, t);
  const sizes = sizeSummary(lots);
  const numbered = lots.filter((l) => l.number !== null);
  const loose = lots.filter((l) => l.number === null);
  const showRail = item.category === "kit" || item.category === "goalkeeper" || numbered.length > 0;
  const repeated = repeatedNumbers(lots);
  const missing = item.category === "kit" ? missingNumbers((squad ?? []).map((m) => m.number), lots) : [];
  const selected = lots.find((l) => l.id === sp.pieza) ?? null;
  const canCreate = s.can("material", "create");
  const canUpdate = s.can("material", "update");
  const canEdit = canUpdate || canCreate;
  const pieceHref = (l: MaterialLot) => `/admin/material/${id}?pieza=${l.id}#pieza`;
  const lent = lots.filter((l) => l.holder_player_id);

  const lotTitle = (l: MaterialLot) =>
    [l.number !== null ? `Dorsal ${l.number}` : l.qty === 1 ? "1 pieza" : `${l.qty} piezas`, l.size ? `talla ${l.size}` : null, CONDITION_LABEL[l.condition].toLowerCase()].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader title={item.name} back={{ href: "/admin/material", label: "Material" }}
        subtitle={<span className="inline-flex items-center gap-1.5"><CategoryIcon category={item.category} size={16} className="text-rojo" /> {CATEGORY_LABEL[item.category]}{item.notes ? ` · ${item.notes}` : ""}</span>} />

      {/* Resumen del artículo */}
      <section className="card stock-tag mb-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pr-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-negro/55">En buen estado</p>
            <p className="sport text-5xl font-black leading-none tabular-nums">{t.usable}<span className="ml-1.5 text-lg text-negro/45">/ {t.total}</span></p>
          </div>
          {t.lent > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-negro/55">Prestadas</p>
              <p className="sport text-3xl font-black leading-none tabular-nums">{t.lent}</p>
            </div>
          )}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-negro/55">Mínimo</p>
            <p className="sport text-3xl font-black leading-none tabular-nums">{item.min_qty ?? "—"}</p>
          </div>
        </div>
        {t.total > 0 && (
          <div className="mt-4 space-y-1.5">
            <StockBar t={t} className="h-3" />
            <StockLegend t={t} />
          </div>
        )}
        {sizes.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {sizes.map((z) => <span key={z.size} className="rounded-md bg-black/5 px-2 py-0.5 font-bold tabular-nums">{z.size} ×{z.qty}</span>)}
          </p>
        )}
        {short > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-200">
            <AlertTriangle size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">Faltan <b>{short}</b> para llegar al mínimo de {item.min_qty}.</span>
            {s.can("finances", "create") && (
              <Link href={purchaseHref(item, short)} prefetch={false} className="btn-ghost !bg-white !py-1.5 text-xs"><ShoppingCart size={14} /> Apuntar la compra en Finanzas</Link>
            )}
          </div>
        )}
        {repeated.length > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-900"><AlertTriangle size={14} /> Dorsal repetido: {repeated.join(", ")}. Revisa si sobra alguna pieza.</p>
        )}
      </section>

      {/* Pieza elegida: se edita aquí, a la vista */}
      {selected && (
        <section id="pieza" className="card mb-5 scroll-mt-24 ring-2 ring-rojo/30">
          <div className="mb-4 flex items-start gap-3">
            {selected.number !== null || showRail ? (
              <KitShirt number={selected.number} size={selected.size} condition={selected.condition} className="h-16 w-16 shrink-0" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gris"><CategoryIcon category={item.category} size={28} /></span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="leading-tight">{lotTitle(selected)}</h2>
              <p className="mt-1 text-sm text-negro/65">
                {selected.holder_player_id ? <>La tiene <b>{nameOf(selected.holder_player_id)}</b>{selected.lent_on ? ` desde el ${fecha(selected.lent_on)}` : ""}.</> : "Está en el almacén del club."}
              </p>
            </div>
            <Link href={`/admin/material/${id}`} scroll={false} aria-label="Cerrar" className="rounded-lg p-2 text-negro/60 ring-1 ring-black/10 hover:text-rojo"><X size={18} /></Link>
          </div>
          {canUpdate ? (
            <LotEditor key={selected.id} lot={selected} holders={holders}
              update={updateLot.bind(null, id, selected.id)} quick={quickLot.bind(null, id, selected.id)} remove={deleteLot.bind(null, id, selected.id)}
              canDelete={canUpdate || s.can("material", "delete")} />
          ) : selected.notes ? <p className="text-sm">{selected.notes}</p> : null}
        </section>
      )}

      {/* Burra de camisetas: una por dorsal, colgada en su percha */}
      {showRail && (
        <section className="card mb-5">
          <h2 className="flex items-center gap-2">Por dorsal <span className="text-sm font-semibold text-negro/55">{numbered.length}</span></h2>
          {numbered.length ? (
            <>
              <p className="mt-1 text-xs text-negro/60">Toca una camiseta para cambiar su talla, su estado o quién la tiene.</p>
              <ul className="kit-rail mt-3 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
                {numbered.map((l) => (
                  <li key={l.id} className="kit-hanger">
                    <Link href={pieceHref(l)} scroll={false} prefetch={false} aria-current={selected?.id === l.id ? "true" : undefined}
                      className={`group flex flex-col items-center rounded-2xl p-1.5 text-center transition hover:bg-gris ${selected?.id === l.id ? "bg-rojo/10 ring-2 ring-rojo/40" : ""}`}>
                      <KitShirt number={l.number} size={l.size} condition={l.condition} className="h-20 w-20 transition-transform duration-300 group-hover:-rotate-3" />
                      <span className={`mt-1 max-w-full truncate text-xs font-bold ${l.holder_player_id ? "text-negro" : "text-negro/50"}`}>
                        {nameOf(l.holder_player_id) ?? "En el almacén"}
                      </span>
                      {l.condition !== "new" && <span className={`badge mt-0.5 !text-[10px] ${CONDITION_TONE[l.condition]}`}>{CONDITION_LABEL[l.condition]}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-sm text-negro/65">Todavía no hay piezas con dorsal. {item.category === "kit" ? "Añádelas abajo una a una o crea una por cada dorsal de la plantilla." : ""}</p>
          )}
        </section>
      )}

      {/* Piezas sin dorsal, agrupadas */}
      {(loose.length > 0 || !showRail) && (
        <section className="card mb-5">
          <h2 className="flex items-center gap-2">{showRail ? "Sin dorsal" : "Piezas"} <span className="text-sm font-semibold text-negro/55">{tally(loose).total}</span></h2>
          {loose.length ? (
            <ul className="mt-2 divide-y divide-black/5">
              {loose.map((l) => (
                <li key={l.id}>
                  <Link href={pieceHref(l)} scroll={false} prefetch={false}
                    className={`-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-gris ${selected?.id === l.id ? "bg-rojo/10" : ""}`}>
                    <span className="sport w-14 shrink-0 text-right text-2xl font-black tabular-nums">×{l.qty}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={`badge ${CONDITION_TONE[l.condition]}`}>{CONDITION_LABEL[l.condition]}</span>
                        {l.size && <span className="rounded-md bg-black/5 px-1.5 py-0.5 text-xs font-bold">Talla {l.size}</span>}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-negro/65">
                        {l.holder_player_id ? <><UserRound size={12} className="shrink-0" /> La tiene <b className="text-negro">{nameOf(l.holder_player_id)}</b></> : <><Warehouse size={12} className="shrink-0" /> En el almacén</>}
                        {l.notes ? ` · ${l.notes}` : ""}
                      </span>
                    </span>
                    {canUpdate && <Pencil size={16} className="shrink-0 text-negro/35" aria-hidden />}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-negro/65">Todavía no hay piezas apuntadas.</p>
          )}
        </section>
      )}

      {lent.length > 0 && (
        <FoldCard className="mb-5" title={<><Users size={18} className="shrink-0 text-rojo" /> Quién tiene qué</>} meta={<span className="text-xs font-bold uppercase tracking-wider text-negro/55">{t.lent}</span>}>
          <ul className="divide-y divide-black/5 text-sm">
            {[...lent].sort((a, b) => (nameOf(a.holder_player_id) ?? "").localeCompare(nameOf(b.holder_player_id) ?? "", "es")).map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-2">
                <b className="min-w-0 flex-1 truncate">{nameOf(l.holder_player_id)}</b>
                <span className="text-negro/70">{lotTitle(l)}</span>
                {l.lent_on && <span className="hidden text-xs text-negro/50 sm:inline">desde el {fecha(l.lent_on)}</span>}
              </li>
            ))}
          </ul>
        </FoldCard>
      )}

      {canEdit && (
        <section className="card mb-5">
          <h2 className="mb-3 flex items-center gap-2"><PackagePlus size={20} className="text-rojo" /> Añadir piezas</h2>
          <AddLotForm action={addLot.bind(null, id)} holders={holders} numbered={showRail} />
        </section>
      )}

      {canEdit && missing.length > 0 && (
        <FoldCard className="mb-5" title={<><Users size={18} className="shrink-0 text-rojo" /> Una por dorsal de la plantilla</>}
          meta={<span className="text-xs font-bold uppercase tracking-wider text-negro/55">Faltan {missing.length}</span>}>
          <FillFromSquadForm action={fillFromSquad.bind(null, id)} missing={missing} />
        </FoldCard>
      )}

      {canUpdate && (
        <FoldCard className="mb-5" title={<><Pencil size={18} className="shrink-0 text-rojo" /> Editar artículo</>}>
          <ItemForm action={saveItem.bind(null, id)} item={item} />
          {s.can("material", "delete") && (
            <div className="mt-5 border-t border-black/5 pt-4"><DeleteItemButton action={deleteItem.bind(null, id)} name={item.name} /></div>
          )}
        </FoldCard>
      )}
    </>
  );
}
