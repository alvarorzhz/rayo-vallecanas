import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, FileDown, HandHeart, Lock, LockOpen, ShieldCheck, Ticket, Trophy } from "lucide-react";
import { euros, fecha, fechaLarga } from "@/lib/format";
import { DRAW_MODE_LABEL, lastClose, type RafflePublicEvent } from "@/lib/lottery/public";
import { CheckNumberForm, CopyButton, VerifyFingerprint } from "@/components/lottery/public-raffle";
import { checkRaffleNumber } from "../actions";
import { loadPublicRaffle } from "./data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await loadPublicRaffle((await params).slug);
  if (!r) return { title: "Rifa no encontrada", robots: { index: false } };
  const desc = r.winning_number
    ? `Número ganador: ${r.winning_number}. Comprueba tu número y el acta del sorteo.`
    : `${r.prize ? `${r.prize}. ` : ""}Sorteo ${r.draw_date ? `el ${fechaLarga(r.draw_date)}` : "próximamente"}. Comprueba tu número.`;
  return { title: `${r.name} · Rayo Vallecañas`, description: desc, robots: { index: false, follow: false } };
}

const STATUS = {
  active: { label: "A la venta", cls: "bg-green-500 text-white" },
  closed: { label: "Ventas cerradas", cls: "bg-white text-negro" },
  drawn: { label: "Sorteada", cls: "bg-dorado text-negro" },
} as const;

export default async function PublicRafflePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await loadPublicRaffle(slug);
  if (!r) notFound();

  const sold = new Set(r.sold_numbers);
  const voided = new Set(r.voided_numbers);
  const close = lastClose(r.events);
  const winnerSold = r.winning_number != null && sold.has(r.winning_number);
  const st = STATUS[r.status];

  return (
    <main className="min-h-dvh bg-gris pb-12">
      <header className="franja bg-negro px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-white">
        <div className="mx-auto flex max-w-3xl items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/escudo.png" alt="Escudo del Rayo Vallecañas" width={56} height={66} className="relative shrink-0 drop-shadow" />
          <div className="relative min-w-0">
            <p className="text-xs font-bold tracking-[0.3em] text-dorado">RIFA · RAYO VALLECAÑAS</p>
            <h1 className="sport text-3xl font-black leading-tight sm:text-4xl">{r.name}</h1>
            {r.prize && <p className="mt-1 text-[15px] text-white/85"><Trophy size={15} className="mr-1 inline text-dorado" />{r.prize}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className={`badge ${st.cls}`}>{st.label}</span>
              <span className="text-white/75"><CalendarDays size={14} className="mr-1 inline" />
                {r.draw_date ? `Sorteo: ${fechaLarga(r.draw_date)}` : "Fecha del sorteo por anunciar"}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 pt-5">
        {r.status === "drawn" && r.winning_number != null && (
          <section className="overflow-hidden rounded-2xl bg-dorado text-negro shadow-lg">
            <div className="flex flex-wrap items-center gap-5 p-5">
              <div className="rounded-xl bg-negro px-5 py-3 text-center text-white">
                <div className="text-[10px] font-bold tracking-[0.3em] text-dorado">NÚMERO GANADOR</div>
                <div className="font-mono text-5xl font-black tabular-nums">{r.winning_number}</div>
              </div>
              <div className="min-w-0 flex-1 text-[15px]">
                <p className="sport text-2xl font-black">{winnerSold ? "¡Ya tenemos ganador!" : "Número sin vender"}</p>
                <p>
                  {winnerSold
                    ? "Si es tu número, el club se pondrá en contacto contigo. Puedes comprobarlo abajo con la referencia de tu justificante."
                    : "El número que ha salido no se había vendido."}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-3 gap-3">
          <Fact label="Precio" value={euros(r.price_cents)} hint="por número" />
          <Fact label="Vendidos" value={`${r.sold_numbers.length}`} hint={`de ${r.total}`} />
          <Fact label={r.status === "active" ? "Libres" : "Sin vender"} value={`${Math.max(0, r.total - r.sold_numbers.length - r.voided_numbers.length)}`} hint="números" />
        </section>

        {(r.purpose || r.raised_cents != null) && (
          <section className="card">
            <h2 className="mb-2 flex items-center gap-2 font-bold"><HandHeart size={18} className="text-rojo" /> A qué se destina lo recaudado</h2>
            {r.purpose && <p className="whitespace-pre-line text-[15px] text-negro/80">{r.purpose}</p>}
            {r.raised_cents != null && (
              <p className="mt-3 flex flex-wrap items-baseline gap-x-2 rounded-xl bg-negro px-4 py-3 text-white">
                <span className="text-sm text-white/70">Recaudado:</span>
                <span className="sport text-3xl font-black text-dorado">{euros(r.raised_cents)}</span>
                <span className="text-xs text-white/60">cobrado de {r.sold_numbers.length} números vendidos</span>
              </p>
            )}
            {r.raised_cents == null && <p className="mt-2 text-xs text-negro/65">Cuando se haga el sorteo publicaremos aquí lo recaudado.</p>}
          </section>
        )}

        <section className="card">
          <h2 className="mb-1 flex items-center gap-2 font-bold"><Ticket size={18} className="text-rojo" /> Comprueba tu número</h2>
          <p className="mb-3 text-sm text-negro/65">Confirma que tu número está registrado y pagado. Nadie más puede ver tus datos.</p>
          <CheckNumberForm action={checkRaffleNumber.bind(null, slug)} total={r.total} />
        </section>

        <section className="card">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-bold">Números</h2>
            <p className="text-xs text-negro/65">
              {r.status === "active" ? "Se actualiza con cada venta." : close ? `Lista cerrada el ${fecha(close.at, true)}.` : "Ventas cerradas."}
            </p>
          </div>
          <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-negro/70" aria-label="Leyenda">
            <Legend cls="bg-negro" label="Vendido" />
            <Legend cls="bg-white ring-1 ring-black/15" label={r.status === "active" ? "Libre" : "Sin vender"} />
            {r.voided_numbers.length > 0 && <Legend cls="bg-black/10 line-through" label="Anulado" />}
            {r.winning_number != null && <Legend cls="bg-dorado" label="Ganador" />}
          </ul>
          <ol className="grid grid-cols-[repeat(auto-fill,minmax(2.6rem,1fr))] gap-1.5" aria-label={`Números del 1 al ${r.total}`}>
            {Array.from({ length: r.total }, (_, i) => i + 1).map((n) => {
              const win = n === r.winning_number;
              const cls = win
                ? "bg-dorado text-negro font-black ring-2 ring-negro"
                : sold.has(n)
                  ? "bg-negro text-white"
                  : voided.has(n)
                    ? "bg-black/10 text-negro/40 line-through"
                    : "bg-white text-negro/70 ring-1 ring-black/10";
              const state = win ? "ganador" : sold.has(n) ? "vendido" : voided.has(n) ? "anulado" : "libre";
              return (
                <li key={n} title={`${n}: ${state}`} aria-label={`${n}, ${state}`}
                  className={`flex h-10 items-center justify-center rounded-lg font-mono text-sm tabular-nums ${cls}`}>
                  {n}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-negro/65">Solo se ve si cada número está vendido. Nunca a quién.</p>
        </section>

        <section className="card space-y-4">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} className="text-rojo" /> Transparencia del sorteo</h2>
            <p className="mt-1 text-sm text-negro/70">
              Al cerrar las ventas, la app congela la lista de números vendidos y guarda su <b>huella digital</b>: un código que cambiaría
              por completo si se añadiera o quitara una sola venta. Así nadie puede colar un número después. Todo queda apuntado en el
              acta y no se puede modificar.
            </p>
          </div>

          {r.events.length ? (
            <ol className="space-y-3 border-l-2 border-black/10 pl-4">
              {r.events.map((e, i) => <EventItem key={i} e={e} />)}
            </ol>
          ) : (
            <p className="rounded-xl bg-gris px-4 py-3 text-sm text-negro/70">
              Las ventas siguen abiertas. Cuando se cierren, aquí aparecerá la lista congelada con su huella.
            </p>
          )}

          {close?.fingerprint && close.sold_numbers && (
            <div className="space-y-2 rounded-xl bg-gris p-4">
              <p className="text-sm font-semibold">Huella de la lista cerrada ({close.sold_count} números)</p>
              <p className="break-all font-mono text-xs text-negro/80">{close.fingerprint}</p>
              <div className="flex flex-wrap gap-2">
                <VerifyFingerprint numbers={close.sold_numbers} fingerprint={close.fingerprint} />
                <CopyButton text={close.fingerprint} label="Copiar huella" />
              </div>
              <details className="text-xs text-negro/65">
                <summary className="cursor-pointer font-semibold">¿Cómo se calcula?</summary>
                <p className="mt-1">
                  Es el SHA-256 de los números vendidos, de menor a mayor y separados por comas, sin espacios (por ejemplo «1,4,7»).
                  Cualquiera puede recalcularlo con una calculadora SHA-256 de internet y compararlo con el de aquí o con el que
                  compartimos al cerrar las ventas.
                </p>
              </details>
            </div>
          )}

          {r.status !== "active" && (
            <a href={`/api/rifa/${slug}/acta`} className="btn-ghost"><FileDown size={16} /> Descargar el acta en PDF</a>
          )}
        </section>

        <footer className="space-y-1 pt-2 text-center text-xs text-negro/60">
          <p>Página informativa del Rayo Vallecañas. No muestra datos personales de compradores ni vendedores.</p>
          <p>¿Dudas? Habla con cualquier gestor del club · <Link href="/privacidad" className="font-semibold text-rojo">Protección de datos</Link></p>
        </footer>
      </div>
    </main>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center ring-1 ring-black/5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-negro/60">{label}</div>
      <div className="sport text-2xl font-black tabular-nums">{value}</div>
      <div className="text-[11px] text-negro/60">{hint}</div>
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return <li className="flex items-center gap-1.5"><span className={`inline-block h-3.5 w-3.5 rounded ${cls}`} aria-hidden /> {label}</li>;
}

function EventItem({ e }: { e: RafflePublicEvent }) {
  const by = e.actor ? ` · lo registró ${e.actor}` : "";
  const Icon = e.kind === "closed" ? Lock : e.kind === "reopened" ? LockOpen : Trophy;
  const title =
    e.kind === "closed" ? `Ventas cerradas con ${e.sold_count} números vendidos`
    : e.kind === "reopened" ? "Ventas reabiertas"
    : `Sorteo: número ganador ${e.winning_number}`;
  return (
    <li className="relative">
      <span className="absolute -left-[1.6rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-negro text-white">
        <Icon size={11} />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-negro/65">{fecha(e.at, true)}{by}</p>
      {e.kind === "drawn" && e.draw_mode && <p className="text-xs text-negro/65">Cómo se sorteó: {DRAW_MODE_LABEL[e.draw_mode]}</p>}
      {e.kind === "closed" && e.fingerprint && <p className="font-mono text-[11px] text-negro/55">Huella: {e.fingerprint.slice(0, 16)}…</p>}
      {e.kind === "reopened" && <p className="text-xs text-negro/65">Al volver a cerrar se guarda una lista y una huella nuevas.</p>}
    </li>
  );
}

