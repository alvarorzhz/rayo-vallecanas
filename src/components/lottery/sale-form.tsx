"use client";
import { useActionState, useState } from "react";
import { Minus, Plus, Mail, MessageCircle, Ban } from "lucide-react";
import type { ActionState } from "@/app/(app)/loteria/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { euros, parseRanges, ranges } from "@/lib/format";

type Props = {
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

export function SaleForm({ action, priceCents, available, mode, availableHint, sellers, currentUserId, whatsappApi, raffle = false, availableNumbers }: Props) {
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
  const units = raffle ? "Números" : "Participaciones";
  const total = quantity * priceCents;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="unit_price_cents" value={priceCents} />
      <input type="hidden" name="quantity" value={quantity} />

      <section className="card space-y-4">
        <h2 className="font-bold">1. Comprador</h2>
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
        <p className="text-xs text-negro/50">Necesitamos al menos un teléfono o un email para enviar el justificante.</p>
      </section>

      <section className="card space-y-4">
        <h2 className="font-bold">2. {units}</h2>
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
            <p className={`mt-1 text-xs ${manualError ? "text-rojo" : "text-negro/50"}`}>
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
        <h2 className="font-bold">3. Pago</h2>
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
        <h2 className="font-bold">4. Justificante</h2>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["whatsapp", "WhatsApp", MessageCircle],
            ["email", "Email", Mail],
            ["none", "No enviar", Ban],
          ] as const).map(([v, l, Icon]) => (
            <label key={v} className={`btn cursor-pointer ring-1 ${channel === v ? "bg-negro text-white ring-negro" : "bg-white ring-black/10"}`}>
              <input type="radio" name="channel" value={v} checked={channel === v} onChange={() => setChannel(v)} className="sr-only" />
              <Icon size={16} /> {l}
            </label>
          ))}
        </div>
        {channel === "whatsapp" && !whatsappApi && (
          <p className="text-xs text-negro/50">
            Tras registrar la venta podrás abrir WhatsApp con el mensaje ya escrito para enviarlo desde tu móvil.
          </p>
        )}
        <label className="flex items-start gap-2 text-sm text-negro/70">
          <input type="checkbox" name="marketing_consent" className="mt-1" />
          El comprador acepta recibir otras comunicaciones del club (opcional; el justificante se envía igualmente).
        </label>
      </section>

      {(sellers?.length ?? 0) > 0 && (
        <section className="card">
          <label className="label" htmlFor="seller_id">Vendedor</label>
          <select id="seller_id" name="seller_id" className="input" defaultValue={currentUserId}>
            {sellers!.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}{s.id === currentUserId ? " (yo)" : ""}</option>
            ))}
          </select>
        </section>
      )}

      <section className="card">
        <label className="label" htmlFor="notes">Observaciones (opcional)</label>
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
