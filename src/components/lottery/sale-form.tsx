"use client";
import { useActionState, useState } from "react";
import { Minus, Plus, Mail, MessageCircle, Ban, Info } from "lucide-react";
import type { ActionState } from "@/app/(app)/loteria/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { euros, parseRanges, ranges } from "@/lib/format";

function Step({ n, title, help }: { n: number; title: string; help: React.ReactNode }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-bold">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rojo text-sm font-black text-white">{n}</span>
        {title}
      </h2>
      <p className="mt-1 text-sm text-negro/60">{help}</p>
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

      <div className="flex gap-3 rounded-2xl bg-dorado/15 p-4 text-sm text-negro/80 animate-fade-up">
        <Info size={20} className="mt-0.5 shrink-0 text-dorado" />
        <div>
          <b>Cómo registrar una venta:</b> rellena los {(sellers?.length ?? 0) > 0 ? 5 : 4} pasos de abajo y pulsa el botón rojo{" "}
          <b>Registrar venta</b> del final. Si te equivocas, no pasa nada: un gestor puede anular la venta.
        </div>
      </div>

      <section className="card space-y-4">
        <Step n={1} title="¿Quién compra?" help="Escribe el nombre y apellidos de la persona que compra y su móvil. Al móvil le llegará el justificante por WhatsApp." />
        <div>
          <label className="label" htmlFor="buyer_name">Nombre y apellidos</label>
          <input id="buyer_name" name="buyer_name" required autoComplete="off" className="input" />
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
        <p className="text-xs text-negro/65">Necesitamos al menos un teléfono o un email para enviar el justificante.</p>
        <p className="rounded-xl bg-gris p-3 text-xs text-negro/60">
          🔒 Díselo al comprador: sus datos solo se usan para gestionar su compra y enviarle el justificante.
          Más información en <a href="/privacidad" target="_blank" className="font-semibold text-rojo underline">Protección de datos</a>.
        </p>
      </section>

      <section className="card space-y-4">
        <Step n={2} title={raffle ? "¿Qué números le das?" : "¿Cuántas participaciones?"}
          help={
            mode === "manual"
              ? raffle
                ? "Toca los números que se lleva: se pondrán en rojo. Si tocas otra vez, se quita. Solo aparecen los números que quedan libres."
                : "Toca o escribe los números de las participaciones que le entregas (por ejemplo 12, 13, 40-42)."
              : mode === "booklet"
                ? "Pulsa + o − para indicar cuántas le das. Se cogen automáticamente de tu talonario, en orden."
                : "Pulsa + o − para indicar cuántas compra. El sistema le asigna los números siguientes que estén libres."
          } />
        {mode === "manual" ? (
          <div>
            {availableNumbers && availableNumbers.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 text-sm text-negro/60">Toca los números que vendes:</p>
                <div className="grid max-h-72 grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5 overflow-y-auto p-0.5">
                  {availableNumbers.map((n) => (
                    <button key={n} type="button" onClick={() => toggle(n)} aria-pressed={picked.has(n)}
                      className={`rounded-md py-2 text-center font-mono text-sm font-semibold ${picked.has(n) ? "bg-rojo text-white" : "bg-white text-negro ring-1 ring-black/10"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="label" htmlFor="share_numbers">{raffle ? "Números que vendes" : "Números de participación que entregas"}</label>
            <input id="share_numbers" name="share_numbers" value={manual} onChange={(e) => setManual(e.target.value)} required
              className="input font-mono" placeholder="Ej.: 12, 13, 40-42" inputMode="numeric" />
            <p className={`mt-1 text-xs ${manualError ? "text-rojo" : "text-negro/65"}`}>
              {manualError || `${manualCount} ${raffle ? "seleccionados" : "seleccionadas"}. ${availableNumbers?.length ? "" : availableHint ?? ""}`}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-negro/60">
              {available} disponibles{mode === "booklet" ? " en el talonario" : ""}
              {availableHint && <div className="text-xs">{availableHint}</div>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Menos" className="btn-ghost h-12 w-12 p-0" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                <Minus size={18} />
              </button>
              <input aria-label="Cantidad" type="number" min={1} max={available} value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(available || 1, Number(e.target.value) || 1)))}
                className="input h-12 w-20 text-center text-xl font-black" />
              <button type="button" aria-label="Más" className="btn-ghost h-12 w-12 p-0" onClick={() => setQty((q) => Math.min(available || 1, q + 1))}>
                <Plus size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between rounded-xl bg-negro px-4 py-3 text-white">
          <span className="text-sm text-white/70">{quantity} × {euros(priceCents)}</span>
          <span className="text-2xl font-black tabular-nums">{euros(total)}</span>
        </div>
      </section>

      <section className="card space-y-4">
        <Step n={3} title="¿Ha pagado?" help={<><b>Pagado</b>: te ha dado todo el dinero. <b>Pendiente</b>: pagará más tarde y queda apuntado. <b>Parcial</b>: te ha dado solo una parte; escribe cuánto.</>} />
        <div className="grid grid-cols-3 gap-2">
          {([["full", "Pagado"], ["none", "Pendiente"], ["partial", "Parcial"]] as const).map(([v, l]) => (
            <label key={v} className={`btn cursor-pointer ring-1 ${paid === v ? "bg-rojo text-white ring-rojo" : "bg-white ring-black/10"}`}>
              <input type="radio" name="paid_mode" value={v} checked={paid === v} onChange={() => setPaid(v)} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
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

      <section className="card space-y-4">
        <Step n={4} title="¿Cómo le mandamos el justificante?" help="El justificante es el comprobante de su compra, con sus números y una referencia. Recomendado: WhatsApp." />
        <div className="grid grid-cols-3 gap-2">
          {([
            ["whatsapp", "WhatsApp", MessageCircle],
            ["email", "Email", Mail],
            ["none", "No enviar", Ban],
          ] as const).map(([v, l, Icon]) => {
            const off = v === "email" && !emailEnabled;
            return (
              <label key={v} title={off ? "El envío por email aún no está disponible" : undefined}
                className={`btn ring-1 ${off ? "cursor-not-allowed opacity-40" : "cursor-pointer"} ${channel === v ? "bg-negro text-white ring-negro" : "bg-white ring-black/10"}`}>
                <input type="radio" name="channel" value={v} checked={channel === v} disabled={off} onChange={() => setChannel(v)} className="sr-only" />
                <Icon size={16} /> {l}
              </label>
            );
          })}
        </div>
        {!emailEnabled && <p className="text-xs text-negro/65">El envío por email estará disponible más adelante.</p>}
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
        <section className="card">
          <Step n={5} title="¿Quién lo ha vendido?" help="Normalmente tú. Cámbialo solo si estás apuntando una venta que hizo otro compañero." />
          <label className="label mt-3" htmlFor="seller_id">Vendedor</label>
          <select id="seller_id" name="seller_id" className="input" defaultValue={currentUserId}>
            {sellers!.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}{s.id === currentUserId ? " (yo)" : ""}</option>
            ))}
          </select>
        </section>
      )}

      <section className="card">
        <label className="label" htmlFor="notes">Observaciones (opcional)</label>
        <p className="mb-2 text-xs text-negro/65">Cualquier detalle útil, por ejemplo «paga el viernes» o «es el padre de Javi».</p>
        <textarea id="notes" name="notes" rows={2} className="input" />
      </section>

      <FormMessage state={state} />
      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <SubmitButton pendingText="Registrando venta…" className="btn-primary w-full py-4 text-base shadow-lg"
          disabled={quantity < 1 || (mode !== "manual" && quantity > available) || Boolean(manualError)}>
          Registrar venta · {euros(total)}
        </SubmitButton>
      </div>
    </form>
  );
}
