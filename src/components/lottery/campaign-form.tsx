"use client";
import { useActionState, useState } from "react";
import type { Campaign } from "@/lib/types";
import type { ActionState } from "@/app/(app)/loteria/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

const eurosInput = (c?: number | null) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

export function CampaignForm({
  action,
  campaign,
  hasSales = false,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  campaign?: Campaign;
  hasSales?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const year = new Date().getFullYear();
  const [kind, setKind] = useState<"lottery" | "raffle">(campaign?.kind ?? "lottery");
  const raffle = kind === "raffle";
  const unit = raffle ? "número" : "participación";
  return (
    <form action={formAction} className="space-y-6">
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">Datos del sorteo</h2>
        <fieldset className="sm:col-span-2">
          <legend className="label">Tipo de campaña</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["lottery", "Lotería", "Participaciones de un mismo número de lotería."],
              ["raffle", "Rifa", "Números del 1 al total; cada número se vende a una persona."],
            ] as const).map(([value, title, help]) => (
              <label key={value}
                className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${kind === value ? "border-rojo bg-rojo/5" : "border-negro/10"} ${hasSales ? "cursor-not-allowed opacity-60" : ""}`}>
                <input type="radio" name="kind" value={value} checked={kind === value} disabled={hasSales}
                  onChange={() => setKind(value)} className="mt-1 accent-rojo" />
                <span>
                  <span className="block font-bold">{title}</span>
                  <span className="block text-sm text-negro/60">{help}</span>
                </span>
              </label>
            ))}
          </div>
          {hasSales && <input type="hidden" name="kind" value={kind} />}
          {hasSales && <p className="mt-1 text-xs text-negro/50">No se puede cambiar con ventas registradas.</p>}
        </fieldset>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">Nombre de la campaña</label>
          <input id="name" name="name" required className="input" defaultValue={campaign?.name ?? `Lotería de Navidad ${year}`} />
        </div>
        {!raffle && (
          <div>
            <label className="label" htmlFor="lottery_number">Número de lotería</label>
            <input id="lottery_number" name="lottery_number" required inputMode="numeric" pattern="\d{1,5}" maxLength={5}
              className="input text-center font-mono text-2xl tracking-[0.4em]" defaultValue={campaign?.lottery_number ?? ""} placeholder="00000" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="year">Año</label>
          <input id="year" name="year" type="number" required className="input" defaultValue={campaign?.year ?? year} />
        </div>
        <div>
          <label className="label" htmlFor="draw_type">Tipo de sorteo</label>
          <input id="draw_type" name="draw_type" list="draw_types" className="input" key={kind}
            defaultValue={campaign?.kind === kind ? campaign.draw_type : raffle ? "Rifa" : "Sorteo Extraordinario de Navidad"} />
          <datalist id="draw_types">
            <option value="Sorteo Extraordinario de Navidad" />
            <option value="Sorteo Extraordinario del Niño" />
            <option value="Lotería Nacional (jueves)" />
            <option value="Lotería Nacional (sábado)" />
            <option value="Rifa" />
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="draw_date">Fecha del sorteo</label>
          <input id="draw_date" name="draw_date" type="date" className="input" defaultValue={campaign?.draw_date ?? `${year}-12-22`} />
        </div>
      </section>

      <section className="card grid gap-4 sm:grid-cols-3">
        <h2 className="font-bold sm:col-span-3">{raffle ? "Números e importes" : "Participaciones e importes"}</h2>
        <div>
          <label className="label" htmlFor="price">Precio por {unit} (€)</label>
          <input id="price" name="price" required inputMode="decimal" className="input" defaultValue={eurosInput(campaign?.price_cents)}
            placeholder="5,00" disabled={hasSales} />
          {hasSales && <input type="hidden" name="price" value={eurosInput(campaign?.price_cents)} />}
          {hasSales && <p className="mt-1 text-xs text-negro/50">No se puede cambiar con ventas registradas.</p>}
        </div>
        {!raffle && (
          <>
            <div>
              <label className="label" htmlFor="played">Importe jugado (€)</label>
              <input id="played" name="played" inputMode="decimal" className="input" defaultValue={eurosInput(campaign?.played_cents)} placeholder="4,00" />
            </div>
            <div>
              <label className="label" htmlFor="donation">Donativo (€)</label>
              <input id="donation" name="donation" inputMode="decimal" className="input" defaultValue={eurosInput(campaign?.donation_cents)} placeholder="1,00" />
            </div>
          </>
        )}
        <div>
          <label className="label" htmlFor="total_shares">{raffle ? "Cantidad de números" : "Total de participaciones"}</label>
          <input id="total_shares" name="total_shares" type="number" min={1} required className="input" defaultValue={campaign?.total_shares ?? (raffle ? 100 : 500)} />
          {raffle && <p className="mt-1 text-xs text-negro/50">Se crean los números del 1 al total.</p>}
        </div>
        <div>
          <label className="label" htmlFor="numbering_mode">Numeración</label>
          <select id="numbering_mode" name="numbering_mode" className="input" key={kind}
            defaultValue={campaign?.kind === kind ? campaign.numbering_mode : raffle ? "manual" : "auto"}>
            <option value="auto">Automática (el sistema asigna)</option>
            <option value="booklet">Talonarios por vendedor</option>
            <option value="manual">El vendedor elige los números</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ref_prefix">Prefijo de referencia</label>
          <input id="ref_prefix" name="ref_prefix" className="input uppercase" maxLength={6} defaultValue={campaign?.ref_prefix ?? "RV"} />
          <p className="mt-1 text-xs text-negro/50">Ej.: RV-{campaign?.year ?? year}-0001</p>
        </div>
        <div className="sm:col-span-3">
          <label className="label" htmlFor="notes">Observaciones</label>
          <textarea id="notes" name="notes" rows={2} className="input" defaultValue={campaign?.notes ?? ""} />
        </div>
      </section>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton className="btn-primary w-full sm:w-auto">{campaign ? "Guardar cambios" : "Crear campaña"}</SubmitButton>
      </div>
    </form>
  );
}
