"use client";
import { useActionState, useState, useTransition } from "react";
import { CornerDownLeft, Trash2, Unplug } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  CATEGORIES, CATEGORY_HINT, CATEGORY_LABEL, CONDITIONS, CONDITION_LABEL, SIZES, type MaterialItem, type MaterialLot,
} from "@/lib/material";
import type { MaterialState } from "@/app/(app)/admin/material/actions";

type A = (s: MaterialState, f: FormData) => Promise<MaterialState>;
export type HolderOption = { id: string; name: string; number: number | null };

/** Selector de estado en botones (más rápido que un desplegable en el móvil). */
function ConditionPicker({ name = "condition", value }: { name?: string; value?: string }) {
  return (
    <div role="radiogroup" aria-label="Estado" className="grid grid-cols-3 gap-1.5">
      {CONDITIONS.map((c) => (
        <label key={c} className="cond-pick cursor-pointer">
          <input type="radio" name={name} value={c} defaultChecked={(value ?? "new") === c} className="peer sr-only" />
          <span className={`block rounded-xl py-2 text-center text-sm font-bold ring-1 ring-black/10 transition peer-focus-visible:ring-2 peer-focus-visible:ring-dorado cond-${c}`}>
            {CONDITION_LABEL[c]}
          </span>
        </label>
      ))}
    </div>
  );
}

/** Talla: las de siempre en botones y «Otra» para números (botas, niños…). */
function SizePicker({ id, value }: { id: string; value?: string | null }) {
  const known = !value || SIZES.includes(value);
  const [other, setOther] = useState(!known);
  return (
    <div>
      <span className="label">Talla</span>
      <div role="radiogroup" aria-label="Talla" className="flex flex-wrap gap-1.5">
        {["", ...SIZES].map((s) => (
          <label key={s || "none"} className="cursor-pointer">
            <input type="radio" name="size" value={s} defaultChecked={known && (value ?? "") === s} onChange={() => setOther(false)} className="peer sr-only" />
            <span className="block min-w-10 rounded-lg px-2 py-1.5 text-center text-xs font-bold ring-1 ring-black/10 transition peer-checked:bg-negro peer-checked:text-white peer-checked:ring-negro peer-focus-visible:ring-2 peer-focus-visible:ring-dorado">
              {s || "Sin talla"}
            </span>
          </label>
        ))}
        <label className="cursor-pointer">
          <input type="radio" name="size" value="__other" defaultChecked={!known} onChange={() => setOther(true)} className="peer sr-only" />
          <span className="block rounded-lg px-2 py-1.5 text-center text-xs font-bold ring-1 ring-black/10 transition peer-checked:bg-negro peer-checked:text-white peer-checked:ring-negro">Otra</span>
        </label>
      </div>
      {other && <input id={id} name="size_other" maxLength={8} defaultValue={known ? "" : value ?? ""} placeholder="Ej.: 42 o 10 años" className="input mt-2 max-w-40" aria-label="Otra talla" />}
    </div>
  );
}

function HolderSelect({ id, holders, value }: { id: string; holders: HolderOption[]; value?: string | null }) {
  return (
    <div>
      <label className="label" htmlFor={id}>¿Quién lo tiene?</label>
      <select id={id} name="holder_player_id" defaultValue={value ?? ""} className="input">
        <option value="">En el almacén del club</option>
        {holders.map((h) => <option key={h.id} value={h.id}>{h.number !== null ? `${h.number} · ` : ""}{h.name}</option>)}
      </select>
    </div>
  );
}

/** Ficha del artículo: nombre, tipo, mínimo para el aviso y notas. Al crearlo se pueden apuntar ya las piezas. */
export function ItemForm({ action, item }: { action: A; item?: MaterialItem }) {
  const [state, formAction] = useActionState(action, undefined);
  const [category, setCategory] = useState(item?.category ?? "kit");
  const id = item?.id ?? "new";
  return (
    <form action={formAction} className="space-y-4">
      <div><label className="label" htmlFor={`name-${id}`}>Nombre *</label>
        <input id={`name-${id}`} name="name" required maxLength={60} defaultValue={item?.name ?? ""} placeholder="Camiseta de juego, Balones, Petos…" className="input" /></div>
      <div>
        <span className="label">Tipo</span>
        <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="category" value={c} checked={category === c} onChange={() => setCategory(c)} className="peer sr-only" />
              <span className="block rounded-xl px-3 py-2 text-sm font-bold ring-1 ring-black/10 transition peer-checked:bg-rojo peer-checked:text-white peer-checked:ring-rojo peer-focus-visible:ring-2 peer-focus-visible:ring-dorado">
                {CATEGORY_LABEL[c]}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-negro/60">{CATEGORY_HINT[category]}</p>
      </div>
      {!item && (
        <fieldset className="grid gap-3 rounded-2xl bg-gris/70 p-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <legend className="px-1 text-xs font-bold uppercase tracking-wider text-negro/65">Lo que hay ahora (opcional)</legend>
          <div><label className="label" htmlFor="qty-new">Piezas</label><input id="qty-new" name="qty" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="input text-center text-lg font-black" /></div>
          <div><span className="label">Estado</span><ConditionPicker /></div>
          <p className="text-xs text-negro/60 sm:col-span-2">{category === "kit" ? "Las camisetas con dorsal y talla se apuntan mejor después, una a una o «una por dorsal» de la plantilla." : "Si hay de varios estados, apunta ahora las de uno y añade el resto después."}</p>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <label className="label" htmlFor={`min-${id}`}>Mínimo en buen estado</label>
          <input id={`min-${id}`} name="min_qty" inputMode="numeric" pattern="[0-9]*" defaultValue={item?.min_qty ?? ""} placeholder="Sin mínimo" className="input" />
        </div>
        <p className="self-end pb-2 text-xs text-negro/60">Si quedan menos piezas nuevas o usadas, sale en «Lo que falta» con un botón para apuntar la compra.</p>
      </div>
      <div><label className="label" htmlFor={`notes-${id}`}>Notas</label>
        <textarea id={`notes-${id}`} name="notes" rows={2} maxLength={500} defaultValue={item?.notes ?? ""} placeholder="Marca, color, dónde se guarda, tienda…" className="input" /></div>
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Guardando…">{item ? "Guardar artículo" : "Crear artículo"}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Añadir piezas a un artículo. */
export function AddLotForm({ action, holders, numbered }: { action: A; holders: HolderOption[]; numbered: boolean }) {
  const [round, setRound] = useState(0);
  // Tras añadir, el formulario se vacía para apuntar las siguientes
  const [state, formAction] = useActionState<MaterialState, FormData>(async (prev, f) => {
    const r = await action(prev, f);
    if (r?.ok) setRound((n) => n + 1);
    return r;
  }, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div key={round} className="space-y-4">
      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
        <div><label className="label" htmlFor="lot-qty">Piezas</label><input id="lot-qty" name="qty" inputMode="numeric" pattern="[0-9]*" defaultValue="1" className="input text-center text-lg font-black" /></div>
        <div><span className="label">Estado</span><ConditionPicker /></div>
      </div>
      <SizePicker id="lot-size" />
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <div><label className="label" htmlFor="lot-number">Dorsal</label><input id="lot-number" name="number" inputMode="numeric" pattern="[0-9]*" maxLength={2} placeholder={numbered ? "7" : "—"} className="input text-center font-black" /></div>
        <HolderSelect id="lot-holder" holders={holders} />
      </div>
      <div><label className="label" htmlFor="lot-notes">Nota</label><input id="lot-notes" name="notes" maxLength={200} placeholder="Ej.: le falta el escudo" className="input" /></div>
      </div>
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Añadiendo…">Añadir al inventario</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Editar unas piezas: estado, talla, dorsal, quién lo tiene. Con varias, se puede cambiar solo una parte. */
export function LotEditor({ lot, holders, update, quick, remove, canDelete }: {
  lot: MaterialLot; holders: HolderOption[]; update: A;
  quick: (what: "returned" | "break_one") => Promise<MaterialState>;
  remove: () => Promise<MaterialState>; canDelete: boolean;
}) {
  const [state, formAction] = useActionState(update, undefined);
  const [side, setSide] = useState<MaterialState>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<MaterialState>) => start(async () => setSide(await fn()));
  const id = lot.id.slice(0, 8);
  return (
    <div className="space-y-4">
      {(lot.holder_player_id || lot.condition !== "broken") && (
        <div className="flex flex-wrap gap-2">
          {lot.holder_player_id && (
            <button type="button" disabled={pending} onClick={() => run(() => quick("returned"))} className="btn-ghost !py-1.5 text-sm">
              <CornerDownLeft size={16} /> Devuelto al almacén
            </button>
          )}
          {lot.condition !== "broken" && (
            <button type="button" disabled={pending} onClick={() => run(() => quick("break_one"))} className="btn-ghost !py-1.5 text-sm">
              <Unplug size={16} /> {lot.qty > 1 ? "Una se ha roto" : "Se ha roto"}
            </button>
          )}
        </div>
      )}
      <FormMessage state={side} />
      {/* El formulario se vuelve a pintar con los datos nuevos tras cada cambio; los mensajes se quedan */}
      <form key={lot.updated_at} action={formAction} className="space-y-4">
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
          <div><label className="label" htmlFor={`q-${id}`}>Piezas</label><input id={`q-${id}`} name="qty" inputMode="numeric" pattern="[0-9]*" defaultValue={lot.qty} className="input text-center text-lg font-black" /></div>
          <div><span className="label">Estado</span><ConditionPicker value={lot.condition} /></div>
        </div>
        {lot.qty > 1 && (
          <div className="flex items-center gap-2 rounded-xl bg-gris/70 px-3 py-2 text-sm">
            <span>Cambiar solo</span>
            <input name="part" inputMode="numeric" pattern="[0-9]*" defaultValue={lot.qty} aria-label="Cuántas piezas cambiar" className="input w-16 !py-1 text-center font-bold" />
            <span>de las {lot.qty}</span>
          </div>
        )}
        <SizePicker id={`s-${id}`} value={lot.size} />
        <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <div><label className="label" htmlFor={`n-${id}`}>Dorsal</label><input id={`n-${id}`} name="number" inputMode="numeric" pattern="[0-9]*" maxLength={2} defaultValue={lot.number ?? ""} placeholder="—" className="input text-center font-black" /></div>
          <HolderSelect id={`h-${id}`} holders={holders} value={lot.holder_player_id} />
        </div>
        <div><label className="label" htmlFor={`no-${id}`}>Nota</label><input id={`no-${id}`} name="notes" maxLength={200} defaultValue={lot.notes ?? ""} className="input" /></div>
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton className="btn-primary" pendingText="Guardando…">Guardar</SubmitButton>
          {canDelete && (
            <button type="button" disabled={pending} onClick={() => { if (confirm("¿Quitar estas piezas del inventario?")) run(remove); }}
              className="btn-ghost !text-rojo"><Trash2 size={16} /> Quitar</button>
          )}
        </div>
        <FormMessage state={state} />
      </form>
    </div>
  );
}

/** «Una por dorsal»: una pieza para cada dorsal de la plantilla que aún no tenga la suya. */
export function FillFromSquadForm({ action, missing }: { action: A; missing: number[] }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-negro/70">
        Faltan {missing.length === 1 ? "el dorsal" : "los dorsales"} <b>{missing.join(", ")}</b> de la plantilla. Se crea una pieza para cada uno; la talla de cada jugador la cambias luego tocando su camiseta.
      </p>
      <ConditionPicker />
      <SizePicker id="fill-size" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="lend" className="mt-0.5 h-4 w-4 accent-rojo" />
        <span>Ya la tiene cada jugador <span className="block text-xs text-negro/60">Se apunta como prestada a quien lleva ese dorsal.</span></span>
      </label>
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Creando…">Crear {missing.length} {missing.length === 1 ? "pieza" : "piezas"}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Primer arranque: lo típico de un equipo de fútbol 7, marcado de serie. */
export function StarterForm({ action }: { action: A }) {
  const [state, formAction] = useActionState(action, undefined);
  const items: [string, string, string][] = [
    ["camiseta", "Camiseta de juego", "con talla y dorsal"], ["pantalon", "Pantalón de juego", "por tallas"], ["medias", "Medias", "por tallas"],
    ["portero", "Camiseta de portero", ""], ["balones", "Balones", "aviso si quedan menos de 6"], ["petos", "Petos", "aviso si quedan menos de 7"],
    ["conos", "Conos", ""], ["botiquin", "Botiquín", ""],
  ];
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {items.map(([k, label, hint]) => (
          <label key={k} className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-black/10 has-[:checked]:ring-rojo/50">
            <input type="checkbox" name={k} defaultChecked className="h-4 w-4 accent-rojo" />
            <span className="font-bold">{label}</span>
            {hint && <span className="ml-auto text-xs text-negro/55">{hint}</span>}
          </label>
        ))}
      </div>
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Preparando…">Preparar el almacén</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function DeleteItemButton({ action, name }: { action: () => Promise<MaterialState>; name: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<MaterialState>();
  return (
    <div>
      <button type="button" disabled={pending} className="btn-ghost !text-rojo"
        onClick={() => { if (confirm(`¿Eliminar «${name}» y todas sus piezas? No se puede deshacer.`)) start(async () => setState(await action())); }}>
        <Trash2 size={16} /> Eliminar artículo
      </button>
      <FormMessage state={state} />
    </div>
  );
}
