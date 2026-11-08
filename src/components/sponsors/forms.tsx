"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { FileText, Paperclip, Trash2, X } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/shrink-image";
import { PAYMENT_METHOD_LABEL } from "@/lib/format";
import { KIND_LABEL, STATUS_LABEL, TIER_LABEL, type Agreement, type AgreementKind, type Sponsor } from "@/lib/sponsors";
import type { SponsorState } from "@/app/(app)/admin/patrocinadores/actions";
import { SponsorLogo } from "./logo";

type A = (s: SponsorState, f: FormData) => Promise<SponsorState>;
const eurosInput = (c?: number | null) => (c ? (c / 100).toFixed(2).replace(".", ",").replace(",00", "") : "");

/** Ficha del patrocinador: logo, nivel, web y contacto. */
export function SponsorForm({ action, sponsor }: { action: A; sponsor?: Sponsor }) {
  const [state, formAction] = useActionState(action, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const id = sponsor?.id ?? "new";
  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-white p-2 ring-1 ring-black/10">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <SponsorLogo sponsor={{ name: sponsor?.name ?? "Logo", logo_url: sponsor?.logo_url ?? null }} className="max-h-16" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor={`logo-${id}`}>Logo (PNG o JPG, máx. 1 MB)</label>
          <input id={`logo-${id}`} name="logo" type="file" accept="image/png,image/jpeg"
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-negro file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white"
            onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
          <p className="mt-1 text-xs text-negro/60">Mejor en PNG con el fondo transparente.</p>
          {sponsor?.logo_url && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="remove_logo" /> Quitar el logo</label>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div><label className="label" htmlFor={`name-${id}`}>Nombre *</label><input id={`name-${id}`} name="name" required maxLength={80} defaultValue={sponsor?.name ?? ""} placeholder="Bar El Barrio" className="input" /></div>
        <div>
          <label className="label" htmlFor={`tier-${id}`}>Nivel</label>
          <select id={`tier-${id}`} name="tier" defaultValue={sponsor?.tier ?? "partner"} className="input">
            {Object.entries(TIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`web-${id}`}>Web</label><input id={`web-${id}`} name="website" inputMode="url" maxLength={300} defaultValue={sponsor?.website ?? ""} placeholder="www.ejemplo.es" className="input" /></div>
        <div><label className="label" htmlFor={`ig-${id}`}>Instagram</label><input id={`ig-${id}`} name="instagram" maxLength={60} defaultValue={sponsor?.instagram ?? ""} placeholder="@barelbarrio" className="input" /></div>
      </div>
      <fieldset className="grid gap-3 rounded-2xl bg-gris/60 p-3 sm:grid-cols-3">
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-negro/65">Contacto (solo gestores)</legend>
        <div><label className="label" htmlFor={`cn-${id}`}>Persona</label><input id={`cn-${id}`} name="contact_name" maxLength={80} defaultValue={sponsor?.contact_name ?? ""} className="input" /></div>
        <div><label className="label" htmlFor={`cp-${id}`}>Teléfono</label><input id={`cp-${id}`} name="contact_phone" type="tel" maxLength={30} defaultValue={sponsor?.contact_phone ?? ""} className="input" /></div>
        <div><label className="label" htmlFor={`ce-${id}`}>Email</label><input id={`ce-${id}`} name="contact_email" type="email" maxLength={120} defaultValue={sponsor?.contact_email ?? ""} className="input" /></div>
      </fieldset>
      <div><label className="label" htmlFor={`notes-${id}`}>Notas</label><textarea id={`notes-${id}`} name="notes" rows={2} maxLength={2000} defaultValue={sponsor?.notes ?? ""} placeholder="Dirección, horario para pasar a cobrar…" className="input" /></div>
      {sponsor && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={sponsor.active} className="mt-0.5 h-4 w-4 accent-rojo" />
          <span>Patrocinador actual <span className="block text-xs text-negro/60">Si lo desmarcas, su logo deja de salir en la app pero se guardan su ficha y sus acuerdos.</span></span>
        </label>
      )}
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Guardando…">{sponsor ? "Guardar ficha" : "Crear patrocinador"}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Acuerdo de una temporada (alta o edición). Al crearlo se reparten los plazos de cobro. */
export function AgreementForm({ action, agreement, seasons, defaultSeason, today }: {
  action: A; agreement?: Agreement; seasons: string[]; defaultSeason: string; today: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [kind, setKind] = useState<AgreementKind>(agreement?.kind ?? "money");
  const id = agreement?.id ?? "new";
  return (
    <form action={formAction} className="space-y-4" key={id}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`season-${id}`}>Temporada</label>
          <select id={`season-${id}`} name="season" defaultValue={agreement?.season ?? defaultSeason} className="input">
            {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`status-${id}`}>Estado</label>
          <select id={`status-${id}`} name="status" defaultValue={agreement?.status ?? "signed"} className="input">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`kind-${id}`}>Aporta</label>
          <select id={`kind-${id}`} name="kind" value={kind} onChange={(e) => setKind(e.target.value as AgreementKind)} className="input">
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {kind !== "in_kind" && (
        <div className={`grid gap-3 ${agreement ? "" : "sm:grid-cols-3"}`}>
          <div>
            <label className="label" htmlFor={`amount-${id}`}>Importe en dinero (€)</label>
            <input id={`amount-${id}`} name="amount" required inputMode="decimal" defaultValue={eurosInput(agreement?.amount_cents)} placeholder="0" className="input sport text-xl font-black" />
          </div>
          {!agreement && (
            <>
              <div>
                <label className="label" htmlFor={`n-${id}`}>Plazos</label>
                <select id={`n-${id}`} name="installments" defaultValue="1" className="input">
                  {Array.from({ length: 12 }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n === 1 ? "Un solo pago" : `${n} plazos (uno al mes)`}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`first-${id}`}>Primer cobro</label>
                <input id={`first-${id}`} name="first_due" type="date" defaultValue={today} className="input" />
              </div>
            </>
          )}
        </div>
      )}
      {kind !== "money" && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div><label className="label" htmlFor={`ik-${id}`}>Qué aporta en especie</label><input id={`ik-${id}`} name="in_kind" required maxLength={500} defaultValue={agreement?.in_kind ?? ""} placeholder="Las camisetas de la temporada, la comida de Navidad…" className="input" /></div>
          <div><label className="label" htmlFor={`ikv-${id}`}>Valor aprox. (€)</label><input id={`ikv-${id}`} name="in_kind_value" inputMode="decimal" defaultValue={eurosInput(agreement?.in_kind_value_cents)} placeholder="Opcional" className="input" /></div>
        </div>
      )}
      <div><label className="label" htmlFor={`ben-${id}`}>Qué recibe a cambio</label><textarea id={`ben-${id}`} name="benefits" rows={2} maxLength={1000} defaultValue={agreement?.benefits ?? ""} placeholder="Logo en el pecho de la camiseta, publicaciones en redes, pancarta en el campo…" className="input" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor={`from-${id}`}>Desde</label><input id={`from-${id}`} name="starts_on" type="date" defaultValue={agreement?.starts_on ?? ""} className="input" /></div>
        <div><label className="label" htmlFor={`to-${id}`}>Hasta</label><input id={`to-${id}`} name="ends_on" type="date" defaultValue={agreement?.ends_on ?? ""} className="input" /></div>
      </div>
      <div><label className="label" htmlFor={`an-${id}`}>Notas</label><input id={`an-${id}`} name="notes" maxLength={2000} defaultValue={agreement?.notes ?? ""} className="input" /></div>
      {agreement && kind !== "in_kind" && <p className="text-xs text-negro/60">Si cambias el importe, ajusta también los plazos de abajo.</p>}
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Guardando…">{agreement ? "Guardar acuerdo" : "Crear acuerdo"}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Plazo: fecha e importe (alta o edición). */
export function InstallmentForm({ action, due, amount, label }: { action: A; due?: string; amount?: number; label: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
        <div><label className="label">Fecha</label><input name="due_on" aria-label="Fecha del plazo" type="date" required defaultValue={due ?? ""} className="input" /></div>
        <div><label className="label">Importe (€)</label><input name="amount" aria-label="Importe del plazo" inputMode="decimal" required defaultValue={eurosInput(amount)} placeholder="0" className="input" /></div>
      </div>
      <SubmitButton className="btn-dark w-full" pendingText="Guardando…">{label}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Apuntar el cobro de un plazo (se guarda como ingreso en Finanzas). */
export function PaymentForm({ action, suggested, today }: { action: A; suggested: number; today: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div><label className="label">Importe (€)</label><input name="amount" aria-label="Importe cobrado" inputMode="decimal" required defaultValue={eurosInput(suggested)} className="input sport text-lg font-black" /></div>
        <div><label className="label">Fecha</label><input name="op_date" aria-label="Fecha del cobro" type="date" defaultValue={today} className="input" /></div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Forma de pago</label>
          <select name="method" aria-label="Forma de pago" defaultValue="transfer" className="input">
            {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Apuntando…">Apuntar cobro en Finanzas</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Contrato en PDF (o foto): se sube al bucket privado y se guarda en el acuerdo. */
export function ContractUpload({ save, current, href, canEdit }: {
  save: (path: string | null, name: string | null) => Promise<SponsorState>; current: string | null; href: string; canEdit: boolean;
}) {
  const [state, setState] = useState<SponsorState>();
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setState(undefined);
    setBusy(true);
    try {
      const f = await shrinkImage(picked);
      if (f.size > 10 * 1024 * 1024) throw new Error("El archivo pesa más de 10 MB");
      const safe = f.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80) || "contrato";
      const path = `${crypto.randomUUID()}/${safe}`;
      const { error } = await createClient().storage.from("sponsor-docs").upload(path, f, { contentType: f.type || undefined });
      if (error) throw error;
      setState(await save(path, picked.name));
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : "No se pudo subir el contrato" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {current ? (
          <a href={href} target="_blank" rel="noopener" className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-gris px-2.5 py-1.5 text-sm font-semibold hover:text-rojo">
            <FileText size={16} className="shrink-0" /> <span className="truncate">{current}</span>
          </a>
        ) : (
          <span className="text-sm text-negro/60">Sin contrato subido.</span>
        )}
        {canEdit && (
          <>
            <input ref={input} type="file" accept="application/pdf,image/*" className="hidden" onChange={onPick} aria-label="Subir contrato" />
            <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => input.current?.click()}>
              <Paperclip size={15} /> {busy ? "Subiendo…" : current ? "Cambiar" : "Subir contrato"}
            </button>
            {current && (
              <button type="button" className="btn-ghost text-sm text-negro/60" disabled={pending}
                onClick={() => { if (confirm("¿Quitar el contrato de este acuerdo?")) start(async () => setState(await save(null, null))); }}>
                <X size={15} /> Quitar
              </button>
            )}
          </>
        )}
      </div>
      <FormMessage state={state} />
    </div>
  );
}

/** Botón de eliminar con confirmación. */
export function DeleteButton({ action, label, confirmText, small = false }: { action: () => Promise<SponsorState>; label: string; confirmText: string; small?: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<SponsorState>();
  return (
    <div className="space-y-1">
      <button type="button" disabled={pending} className={`btn-ghost text-rojo ${small ? "px-2 py-1 text-xs" : ""}`}
        onClick={() => { if (confirm(confirmText)) start(async () => setState(await action())); }}>
        <Trash2 size={small ? 14 : 16} /> {pending ? "Eliminando…" : label}
      </button>
      <FormMessage state={state} />
    </div>
  );
}

/** Dónde se enseñan los logos: Inicio e imagen del resultado. */
export function DisplayForm({ action, display, canEdit }: { action: A; display: { show_home: boolean; show_result: boolean }; canEdit: boolean }) {
  const [state, formAction] = useActionState(action, undefined);
  const opt = (name: string, checked: boolean, title: string, hint: string) => (
    <label className="flex items-start gap-3 rounded-xl bg-gris/60 p-3">
      <input type="checkbox" name={name} defaultChecked={checked} disabled={!canEdit} className="mt-0.5 h-5 w-5 shrink-0 accent-rojo" />
      <span className="text-sm"><b>{title}</b><span className="block text-xs text-negro/65">{hint}</span></span>
    </label>
  );
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {opt("show_home", display.show_home, "Al pie de Inicio", "Una línea discreta «Con el apoyo de» con los logos en gris, al final de la página.")}
        {opt("show_result", display.show_result, "En la imagen del resultado", "El logo del patrocinador principal, pequeño, encima del pie de la imagen para compartir.")}
      </div>
      {canEdit && <SubmitButton className="btn-dark w-full sm:w-auto" pendingText="Guardando…">Guardar</SubmitButton>}
      <FormMessage state={state} />
    </form>
  );
}
