"use client";
import { useActionState, useState } from "react";
import { Minus, Plus, Mail, MessageCircle, Ban, Check, Lock } from "lucide-react";
import type { ActionState } from "@/app/(app)/loteria/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { euros, parseRanges, ranges } from "@/lib/format";

function Step({ n, title, help, done }: { n: number; title: string; help: React.ReactNode; done?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`sport flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-black transition-colors ${done ? "bg-dorado text-negro" : "bg-negro text-white ring-2 ring-dorado/70"}`}>
        {done ? <Check size={18} strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 pt-0.5">
        <h2 className="sport text-xl leading-tight font-black">{title}</h2>
        <p className="mt-0.5 text-sm text-negro/60">{help}</p>
      </div>
    </div>
  );
}

/** Botones de elegir una opción, juntos en una pastilla gris (el elegido, en relieve). */
function Segmented<T extends string>({ name, value, onChange, options, tone = "rojo", disabled }: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string, React.ComponentType<{ size?: number }>?])[];
  tone?: "rojo" | "negro";
  disabled?: (v: T) => boolean;
}) {
  const on = tone === "rojo" ? "bg-rojo text-white shadow-md shadow-rojo/25" : "bg-negro text-white shadow-md shadow-black/20";
  return (
    <div className="grid gap-1 rounded-xl bg-gris p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, l, Icon]) => {
        const off = disabled?.(v) ?? false;
        return (
          <label key={v} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-bold transition ${
            off ? "cursor-not-allowed text-negro/30" : value === v ? `${on} cursor-pointer` : "cursor-pointer text-negro/70 hover:bg-white/70"}`}>
            <input type="radio" name={name} value={v} checked={value === v} disabled={off} onChange={() => onChange(v)} className="sr-only" />
            {Icon && <Icon size={16} />} {l}
          </label>
        );
      })}
    </div>
  );
}

type Props = {
  emailEnabled?: boolean;
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  priceCents: number;
  available: number;
  mode: "auto" | "booklet" | "manual";
  availableHint?: string;
  sellers?: { id: string; full_name: string }[];
  currentUserId: string;
  whatsappApi: boolean;
  raffle?: boolean;
  /** Números libres para elegir tocando (modo manual) */
  availableNumbers?: number[];
};

export function SaleForm({ action, priceCents, available, mode, availableHint, sellers, currentUserId, whatsappApi, emailEnabled = false, raffle = false, availableNumbers }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const [qty, setQty] = useState(1);
  const [manual, setManual] = useState("");
  const [paid, setPaid] = useState<"full" | "none" | "partial">("full");
  const [channel, setChannel] = useState<"whatsapp" | "email" | "none">("whatsapp");
  const [buyer, setBuyer] = useState("");

  let manualCount = 0;
  let manualError = "";
  if (mode === "manual" && manual.trim()) {
    try {
      manualCount = parseRanges(manual).length;
    } catch (e) {
      manualError = (e as Error).message;
    }
  }
  const quantity = mode === "manual" ? manualCount : qty;
  let picked = new Set<number>();
  try {
    picked = new Set(parseRanges(manual));
  } catch {}
  const toggle = (n: number) => {
    const next = new Set(picked);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    setManual(ranges([...next].sort((a, b) => a - b)));
  };
  const total = quantity * priceCents;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="unit_price_cents" value={priceCents} />
      <input type="hidden" name="quantity" value={quantity} />

      <p className="px-1 text-sm text-negro/60">
        Rellena los pasos y pulsa <b className="text-negro">Registrar venta</b> abajo. Si te equivocas, un gestor puede anular la venta.
      </p>

      <section className="card reveal space-y-4">
        <Step n={1} done={buyer.trim().length > 2} title="¿Quién compra?" help="Su nombre y su móvil: ahí le llega el justificante por WhatsApp." />
        <div>
          <label className="label" htmlFor="buyer_name">Nombre y apellidos</label>
          <input id="buyer_name" name="buyer_name" required autoComplete="off" className="input" value={buyer} onChange={(e) => setBuyer(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="buyer_phone">Teléfono</label>
            <input id="buyer_phone" name="buyer_phone" type="tel" inputMode="tel" autoComplete="off" className="input" placeholder="600 000 000"
              required={channel === "whatsapp"} />
          </div>
          <div>
            <label className="label" htmlFor="buyer_email">Email</label>
            <input id="buyer_email" name="buyer_email" type="email" autoComplete="off" className="input" required={channel === "email"} />
          </div>
        </div>
        <p className="flex gap-2 rounded-xl bg-gris p-3 text-xs text-negro/60">
          <Lock size={14} className="mt-0.5 shrink-0 text-negro/40" />
          <span>
            Hace falta un teléfono o un email. Díselo al comprador: sus datos solo se usan para su compra y su justificante
            (<a href="/privacidad" target="_blank" className="font-semibold text-rojo underline">Protección de datos</a>).
          </span>
        </p>
      </section>

      <section className="card reveal space-y-4">
        <Step n={2} done={quantity > 0 && !manualError} title={raffle ? "¿Qué números le das?" : "¿Cuántas participaciones?"}
          help={
            mode === "manual"
              ? raffle
                ? "Toca los números que se lleva. Si vuelves a tocar uno, se quita. Solo salen los libres."
                : "Toca o escribe los números que le entregas (por ejemplo 12, 13, 40-42)."
              : mode === "booklet"
                ? "Con + y − dices cuántas le das. Salen solas de tu talonario, en orden."
                : "Con + y − dices cuántas compra. La app le da las siguientes libres."
          } />
        {mode === "manual" ? (
          <div>
            {availableNumbers && availableNumbers.length > 0 && (
              <div className="mb-3">
                <div className="grid max-h-80 grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5 overflow-y-auto rounded-xl bg-gris p-2">
                  {availableNumbers.map((n) => {
                    const on = picked.has(n);
                    return (
                      <button key={n} type="button" onClick={() => toggle(n)} aria-pressed={on}
                        className={`relative rounded-lg border-2 py-2.5 text-center font-mono text-base font-black transition active:scale-95 ${
                          on ? "scale-105 border-dorado bg-rojo text-white shadow-md shadow-rojo/30" : "border-dashed border-black/15 bg-white text-negro hover:border-rojo/40"}`}>
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <label className="label" htmlFor="share_numbers">{availableNumbers?.length ? "O escríbelos" : raffle ? "Números que vendes" : "Números de participación que entregas"}</label>
            <input id="share_numbers" name="share_numbers" value={manual} onChange={(e) => setManual(e.target.value)} required
              className="input font-mono" placeholder="Ej.: 12, 13, 40-42" inputMode="numeric" />
            <p className={`mt-1 text-xs ${manualError ? "text-rojo" : "text-negro/65"}`}>
              {manualError || `${manualCount} ${raffle ? "seleccionados" : "seleccionadas"}. ${availableNumbers?.length ? "" : availableHint ?? ""}`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-gris py-4">
            <div className="flex items-center gap-4">
              <button type="button" aria-label="Menos" disabled={qty <= 1}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-negro shadow-sm ring-1 ring-black/10 transition active:scale-90 disabled:opacity-40"
                onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Minus size={22} strokeWidth={3} />
              </button>
              <input aria-label="Cantidad" type="number" min={1} max={available} value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(available || 1, Number(e.target.value) || 1)))}
                className="sport w-24 bg-transparent text-center text-6xl leading-none font-black tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
              <button type="button" aria-label="Más" disabled={qty >= available}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-rojo text-white shadow-md shadow-rojo/30 transition active:scale-90 disabled:opacity-40"
                onClick={() => setQty((q) => Math.min(available || 1, q + 1))}>
                <Plus size={22} strokeWidth={3} />
              </button>
            </div>
            <div className="text-xs text-negro/60">
              Quedan {available}{mode === "booklet" ? " en tu talonario" : ""}
              {availableHint && <> · {availableHint}</>}
            </div>
          </div>
        )}
        <div className="relative flex items-center justify-between overflow-hidden rounded-xl bg-negro px-4 py-3 text-white">
          <div aria-hidden className="franja pointer-events-none absolute inset-0 opacity-70" />
          <span className="relative text-sm text-white/70">{quantity} × {euros(priceCents)}</span>
          <span className="sport relative text-3xl leading-none font-black tabular-nums text-dorado">{euros(total)}</span>
        </div>
      </section>

      <section className="card reveal space-y-4">
        <Step n={3} title="¿Ha pagado?" help={
          paid === "full" ? "Te ha dado todo el dinero." : paid === "none" ? "Pagará más tarde: queda apuntado y lo cobras desde «Mis ventas»." : "Te ha dado solo una parte: escribe cuánto."
        } />
        <Segmented name="paid_mode" value={paid} onChange={setPaid} options={[["full", "Pagado"], ["none", "Pendiente"], ["partial", "Parcial"]] as const} />
        {paid !== "none" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {paid === "partial" && (
              <div>
                <label className="label" htmlFor="paid_amount">Importe cobrado (€)</label>
                <input id="paid_amount" name="paid_amount" inputMode="decimal" required className="input" placeholder="0,00" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="payment_method">Forma de pago</label>
              <select id="payment_method" name="payment_method" className="input" defaultValue="cash">
                <option value="cash">Efectivo</option>
                <option value="bizum">Bizum</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
                <option value="other">Otro</option>
              </select>
            </div>
          </div>
        )}
      </section>

      <section className="card reveal space-y-4">
        <Step n={4} title="¿Cómo le mandas el justificante?" help="Su comprobante, con sus números y una referencia. Lo mejor: WhatsApp." />
        <Segmented name="channel" value={channel} onChange={setChannel} tone="negro"
          options={(emailEnabled
            ? [["whatsapp", "WhatsApp", MessageCircle], ["email", "Email", Mail], ["none", "No enviar", Ban]]
            : [["whatsapp", "WhatsApp", MessageCircle], ["none", "No enviar", Ban]]) as readonly (readonly ["whatsapp" | "email" | "none", string, typeof Ban])[]} />
        {channel === "whatsapp" && !whatsappApi && (
          <p className="text-xs text-negro/65">
            Después de registrar la venta verás el botón <b>Abrir en WhatsApp</b>: se abrirá WhatsApp con el mensaje ya escrito y solo tendrás que pulsar enviar.
          </p>
        )}
        <label className="flex items-start gap-2 text-sm text-negro/70">
          <input type="checkbox" name="marketing_consent" className="mt-1" />
          El comprador acepta recibir otras comunicaciones del club (opcional; el justificante se envía igualmente).
        </label>
      </section>

      {(sellers?.length ?? 0) > 0 && (
        <section className="card reveal">
          <Step n={5} title="¿Quién lo ha vendido?" help="Normalmente tú. Cámbialo solo si estás apuntando una venta que hizo otro compañero." />
          <label className="label mt-3" htmlFor="seller_id">Vendedor</label>
          <select id="seller_id" name="seller_id" className="input" defaultValue={currentUserId}>
            {sellers!.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}{s.id === currentUserId ? " (yo)" : ""}</option>
            ))}
          </select>
        </section>
      )}

      <section className="card reveal">
        <label className="label" htmlFor="notes">Observaciones (opcional)</label>
        <textarea id="notes" name="notes" rows={2} className="input" placeholder="Por ejemplo: «paga el viernes» o «es el padre de Javi»" />
      </section>

      <FormMessage state={state} />
      <div className="sticky bottom-20 z-10 rounded-2xl bg-gris/80 p-1.5 backdrop-blur lg:bottom-4">
        <SubmitButton pendingText="Registrando venta…" className="btn-primary w-full py-4 text-base shadow-lg shadow-rojo/30"
          disabled={quantity < 1 || (mode !== "manual" && quantity > available) || Boolean(manualError)}>
          Registrar venta · {euros(total)}
        </SubmitButton>
      </div>
    </form>
  );
}
