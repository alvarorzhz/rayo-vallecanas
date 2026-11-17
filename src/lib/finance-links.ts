import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { fetchRoster } from "@/lib/squad-queries";
import { fullName } from "@/lib/squad";
import { fecha } from "@/lib/format";
import { seasonOf, type MovementLinks } from "@/lib/finance";

type DB = Awaited<ReturnType<typeof createClient>>;
const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",").replace(",00", "")} €`;

/**
 * 4.20.2 · Jugadores de la temporada (para «¿De quién es la cuota?») y plazos de patrocinio sin cobrar
 * (para «¿Qué plazo cobra?»). `keep` es el plazo ya enlazado al movimiento que se edita, para que no desaparezca.
 * Si quien apunta no ve la plantilla o los patrocinios, la lista sale vacía y el ingreso se guarda sin enlazar.
 */
export async function fetchMovementLinks(supabase: DB, opts: { season?: string; keep?: string | null } = {}): Promise<MovementLinks> {
  const season = opts.season ?? seasonOf();
  const [roster, { data: inst }, { data: paid }] = await Promise.all([
    fetchRoster(supabase, season).catch(() => []),
    supabase.from("sponsor_installments")
      .select("id, due_on, amount_cents, agreement:sponsor_agreements!inner(season, sponsor:sponsors!inner(name), installments:sponsor_installments(id, due_on))")
      .order("due_on"),
    supabase.from("finance_movements").select("sponsor_installment_id").not("sponsor_installment_id", "is", null).is("voided_at", null),
  ]);
  const taken = new Set((paid ?? []).map((r) => r.sponsor_installment_id as string));
  type Inst = { id: string; due_on: string; amount_cents: number; agreement: { season: string; sponsor: { name: string }; installments: { id: string; due_on: string }[] } };
  const installments = ((inst ?? []) as unknown as Inst[])
    .filter((i) => i.id === opts.keep || !taken.has(i.id))
    .map((i) => {
      const order = [...i.agreement.installments].sort((a, b) => a.due_on.localeCompare(b.due_on));
      const k = order.findIndex((x) => x.id === i.id) + 1;
      const plazo = order.length > 1 ? ` · plazo ${k}/${order.length}` : "";
      return { id: i.id, label: `${i.agreement.sponsor.name}${plazo} · ${eur(i.amount_cents)} · ${fecha(i.due_on)}` };
    });
  const players = roster.filter((r) => r.status !== "left").map((r) => ({ id: r.player_id, name: fullName(r.player) }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { season, players, installments };
}
