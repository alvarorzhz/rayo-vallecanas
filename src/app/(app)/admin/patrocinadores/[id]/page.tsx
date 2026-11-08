import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, AtSign, CalendarRange, Check, Globe, Gift, Mail, MessageCircle, Phone, Plus, Sparkles } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf, today as todayMadrid } from "@/lib/finance";
import { PAYMENT_METHOD_LABEL, euros, fecha, phoneE164 } from "@/lib/format";
import {
  KIND_LABEL, SHOWN_LABEL, SHOWN_TONE, TIER_LABEL, fetchAgreements, hasInKind, hasMoney, instagramUrl, money, seasonChoices, shownStatus,
  type Agreement, type Sponsor,
} from "@/lib/sponsors";
import { PageHeader } from "@/components/ui";
import { SponsorLogo } from "@/components/sponsors/logo";
import { AgreementForm, ContractUpload, DeleteButton, InstallmentForm, PaymentForm, SponsorForm } from "@/components/sponsors/forms";
import {
  addInstallment, createAgreement, deleteAgreement, deleteInstallment, deleteSponsor, registerPayment, saveSponsor, setContract,
  updateAgreement, updateInstallment,
} from "../actions";

export const metadata = { title: "Patrocinador" };

export default async function SponsorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePerm("sponsors", "read");
  const supabase = await createClient();
  const [{ data: sponsor }, agreements] = await Promise.all([
    supabase.from("sponsors").select("*").eq("id", id).maybeSingle<Sponsor>(),
    fetchAgreements(supabase, { sponsorId: id }),
  ]);
  if (!sponsor) notFound();

  const today = todayMadrid();
  const current = seasonOf();
  const seasons = seasonChoices(current, agreements.map((a) => a.season));
  const canCreate = s.can("sponsors", "create");
  const canEdit = s.can("sponsors", "update");
  const canDelete = s.can("sponsors", "delete");
  const canPay = canEdit && s.can("finances", "create");
  const seeFinances = s.can("finances");
  const wa = phoneE164(sponsor.contact_phone);
  const ig = instagramUrl(sponsor.instagram);
  const nextSeason = seasons.find((x) => x > current && !agreements.some((a) => a.season === x)) ?? current;
  const defaultSeason = agreements.some((a) => a.season === current) ? nextSeason : current;

  const agreementCard = (a: Agreement) => {
    const m = money(a, today);
    const st = shownStatus(a, today);
    return (
      <article key={a.id} className="card space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="sport text-2xl font-black leading-none">{a.season}</h3>
            <span className={`badge ${SHOWN_TONE[st]}`}>{SHOWN_LABEL[st]}</span>
            <span className="badge bg-black/5 text-negro/70">{KIND_LABEL[a.kind]}</span>
          </div>
          {(a.starts_on || a.ends_on) && (
            <p className="flex items-center gap-1.5 text-xs text-negro/65"><CalendarRange size={14} /> {a.starts_on ? fecha(a.starts_on) : "…"} – {a.ends_on ? fecha(a.ends_on) : "…"}</p>
          )}
        </header>

        {hasMoney(a) && (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="sport text-3xl font-black tabular-nums leading-none">{euros(m.paid)}<span className="ml-1.5 text-base font-bold text-negro/55">de {euros(m.total)}</span></span>
              {m.pending > 0 ? <span className="text-sm font-semibold text-negro/70">Faltan {euros(m.pending)}</span> : m.total > 0 && <span className="flex items-center gap-1 text-sm font-bold text-green-700"><Check size={16} /> Todo cobrado</span>}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5">
              <div className="anim-fill h-full rounded-full bg-green-600" style={{ width: `${m.total ? Math.min(100, (m.paid / m.total) * 100) : 0}%` }} />
            </div>
            {m.planned !== m.total && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800"><AlertTriangle size={14} /> Los plazos suman {euros(m.planned)} y el acuerdo es de {euros(m.total)}.</p>
            )}
          </div>
        )}

        {(hasInKind(a) || a.benefits) && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {hasInKind(a) && a.in_kind && (
              <div className="rounded-xl bg-gris/60 p-3">
                <dt className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-negro/60"><Gift size={13} /> En especie</dt>
                <dd>{a.in_kind}{a.in_kind_value_cents ? <span className="text-negro/60"> · unos {euros(a.in_kind_value_cents)}</span> : null}</dd>
              </div>
            )}
            {a.benefits && (
              <div className="rounded-xl bg-gris/60 p-3">
                <dt className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-negro/60"><Sparkles size={13} /> Recibe a cambio</dt>
                <dd className="whitespace-pre-line">{a.benefits}</dd>
              </div>
            )}
          </dl>
        )}
        {a.notes && <p className="text-sm text-negro/70">{a.notes}</p>}

        <div>
          <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-negro/60">Contrato</h4>
          <ContractUpload save={setContract.bind(null, sponsor.id, a.id)} current={a.contract_name} href={`/api/patrocinadores/contrato/${a.id}`} canEdit={canEdit} />
        </div>

        {hasMoney(a) && (
          <div>
            <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-negro/60">Plazos de cobro</h4>
            {!a.installments.length ? (
              <p className="text-sm text-negro/60">Sin plazos. Añade uno para poder apuntar el cobro.</p>
            ) : (
              <ul className="divide-y divide-black/5 rounded-xl ring-1 ring-black/10">
                {a.installments.map((i, k) => {
                  const late = !i.payment && i.due_on < today && a.status === "signed";
                  return (
                    <li key={i.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${i.payment ? "bg-green-600 text-white" : late ? "bg-rojo text-white" : "bg-black/5 text-negro/70"}`}>
                          {i.payment ? <Check size={16} /> : k + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold tabular-nums">{euros(i.amount_cents)}</p>
                          <p className={`text-xs ${late ? "font-bold text-rojo" : "text-negro/65"}`}>
                            {i.payment
                              ? <>Cobrado el {fecha(i.payment.op_date)} · {euros(i.payment.amount_cents)} · {PAYMENT_METHOD_LABEL[i.payment.method] ?? i.payment.method}</>
                              : late ? <>Sin cobrar desde el {fecha(i.due_on)}</> : <>Se cobra el {fecha(i.due_on)}</>}
                          </p>
                        </div>
                        {i.payment && seeFinances && (
                          <Link href={`/finanzas/${i.payment.movement_id}`} prefetch className="shrink-0 text-xs font-bold text-rojo">Ver en Finanzas →</Link>
                        )}
                      </div>
                      {!i.payment && (canPay || canEdit) && (
                        <div className="mt-2 space-y-1 pl-11">
                          {canPay && a.status !== "cancelled" && (
                            <details>
                              <summary className="cursor-pointer text-sm font-bold text-rojo">Cobrar {euros(i.amount_cents)}</summary>
                              <div className="mt-2"><PaymentForm action={registerPayment.bind(null, sponsor.id, i.id)} suggested={i.amount_cents} today={today} /></div>
                            </details>
                          )}
                          {canEdit && (
                            <details>
                              <summary className="cursor-pointer text-xs font-bold text-negro/65">Cambiar fecha o importe</summary>
                              <div className="mt-2 space-y-2">
                                <InstallmentForm action={updateInstallment.bind(null, sponsor.id, i.id)} due={i.due_on} amount={i.amount_cents} label="Guardar plazo" />
                                <DeleteButton action={deleteInstallment.bind(null, sponsor.id, i.id)} label="Eliminar plazo" confirmText="¿Eliminar este plazo?" small />
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canEdit && (
              <details className="mt-2">
                <summary className="flex cursor-pointer items-center gap-1 text-sm font-bold text-negro/70"><Plus size={15} /> Añadir plazo</summary>
                <div className="mt-2 max-w-sm"><InstallmentForm action={addInstallment.bind(null, sponsor.id, a.id)} amount={m.total > m.planned ? m.total - m.planned : undefined} label="Añadir plazo" /></div>
              </details>
            )}
            {canEdit && !s.can("finances", "create") && <p className="mt-2 text-xs text-negro/60">Para apuntar cobros hace falta poder crear movimientos en Finanzas.</p>}
          </div>
        )}

        {(canEdit || canDelete) && (
          <div className="flex flex-wrap items-start gap-x-4 border-t border-black/5 pt-3">
            {canEdit && (
              <details className="w-full">
                <summary className="cursor-pointer text-sm font-bold text-negro/70">Editar acuerdo</summary>
                <div className="mt-3"><AgreementForm action={updateAgreement.bind(null, sponsor.id, a.id)} agreement={a} seasons={seasons} defaultSeason={a.season} today={today} /></div>
              </details>
            )}
            {canDelete && (
              <div className="mt-2">
                <DeleteButton action={deleteAgreement.bind(null, sponsor.id, a.id)} label="Eliminar acuerdo" small
                  confirmText={`¿Eliminar el acuerdo de ${a.season} con sus plazos y su contrato? No se puede deshacer.`} />
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <>
      <PageHeader title={sponsor.name} back={{ href: "/admin/patrocinadores", label: "Patrocinadores" }}
        subtitle={<span className="flex flex-wrap items-center gap-1.5">
          <span className={`badge ${sponsor.tier === "main" ? "bg-dorado text-negro" : "bg-black/5 text-negro/70"}`}>{TIER_LABEL[sponsor.tier]}</span>
          {!sponsor.active && <span className="badge bg-black/5 text-negro/60">Antiguo patrocinador</span>}
        </span>} />

      <section className="card mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-2xl bg-white p-3 ring-1 ring-black/10 sm:w-44">
          <SponsorLogo sponsor={sponsor} className="max-h-24" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {sponsor.contact_name && <p className="font-bold">{sponsor.contact_name}</p>}
          <div className="flex flex-wrap gap-2">
            {sponsor.contact_phone && <a href={`tel:${sponsor.contact_phone.replace(/\s/g, "")}`} className="btn-ghost text-sm"><Phone size={15} /> {sponsor.contact_phone}</a>}
            {wa && <a href={`https://api.whatsapp.com/send?phone=${wa.replace("+", "")}`} target="_blank" rel="noopener" className="btn-ghost text-sm"><MessageCircle size={15} /> WhatsApp</a>}
            {sponsor.contact_email && <a href={`mailto:${sponsor.contact_email}`} className="btn-ghost text-sm"><Mail size={15} /> Email</a>}
            {sponsor.website && <a href={sponsor.website} target="_blank" rel="noopener" className="btn-ghost text-sm"><Globe size={15} /> Web</a>}
            {ig && <a href={ig} target="_blank" rel="noopener" className="btn-ghost text-sm"><AtSign size={15} /> Instagram</a>}
          </div>
          {!sponsor.contact_name && !sponsor.contact_phone && !sponsor.contact_email && !sponsor.website && !ig && (
            <p className="text-sm text-negro/60">Sin datos de contacto todavía.</p>
          )}
          {sponsor.notes && <p className="whitespace-pre-line text-sm text-negro/70">{sponsor.notes}</p>}
        </div>
      </section>

      <div className="mb-3 flex items-end justify-between gap-2">
        <h2 className="sport text-2xl font-black">Acuerdos</h2>
      </div>
      {canCreate && (
        <details className="card mb-4" open={!agreements.length}>
          <summary className="flex cursor-pointer items-center gap-1.5 font-bold text-rojo"><Plus size={18} /> Nuevo acuerdo</summary>
          <div className="mt-4"><AgreementForm action={createAgreement.bind(null, sponsor.id)} seasons={seasons} defaultSeason={defaultSeason} today={today} /></div>
        </details>
      )}
      {agreements.length ? (
        <div className="space-y-4">{agreements.map(agreementCard)}</div>
      ) : (
        !canCreate && <p className="text-sm text-negro/60">Sin acuerdos todavía.</p>
      )}

      {canEdit && (
        <details className="card mt-8">
          <summary className="cursor-pointer font-bold">Editar ficha</summary>
          <div className="mt-4"><SponsorForm action={saveSponsor.bind(null, sponsor.id)} sponsor={sponsor} /></div>
        </details>
      )}
      {canDelete && (
        <div className="mt-4">
          <DeleteButton action={deleteSponsor.bind(null, sponsor.id)} label="Eliminar patrocinador"
            confirmText={`¿Eliminar a ${sponsor.name} con todos sus acuerdos? Si solo ha dejado de patrocinar, mejor desmarca «Patrocinador actual» en la ficha.`} />
        </div>
      )}
    </>
  );
}
