import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush } from "@/lib/push";
import { euros } from "@/lib/format";
import { daysTo } from "@/lib/sponsors";

const WEEK = 7 * 24 * 3600 * 1000;

/**
 * Avisos de patrocinadores para quien los gestiona (permiso «Patrocinadores · modificar»):
 * · Plazos sin cobrar con la fecha pasada: como mucho uno por semana por plazo.
 * · Acuerdos firmados que vencen en 30 días o menos: una sola vez por acuerdo.
 * Todo va en un único aviso. Lo lanza el cron diario. Nunca lanza error.
 */
export async function sponsorReminders(today: string) {
  try {
    const admin = createAdminClient();
    const in30 = new Date(Date.parse(today + "T12:00:00Z") + 30 * 86_400_000).toISOString().slice(0, 10);
    const [{ data: insts }, { data: ags }] = await Promise.all([
      admin.from("sponsor_installments")
        .select("id, due_on, amount_cents, reminded_at, agreement:sponsor_agreements!inner(status, sponsor:sponsors!inner(id, name)), payments:finance_movements(id, voided_at)")
        .lt("due_on", today).eq("agreement.status", "signed"),
      admin.from("sponsor_agreements").select("id, ends_on, sponsor:sponsors!inner(id, name)")
        .eq("status", "signed").is("expiry_reminded_at", null).gte("ends_on", today).lte("ends_on", in30),
    ]);
    type Inst = { id: string; due_on: string; amount_cents: number; reminded_at: string | null; agreement: { sponsor: { id: string; name: string } }; payments: { voided_at: string | null }[] };
    const due = ((insts ?? []) as unknown as Inst[]).filter((i) =>
      !i.payments.some((p) => !p.voided_at) && (!i.reminded_at || Date.now() - Date.parse(i.reminded_at) > WEEK));
    const expiring = (ags ?? []) as unknown as { id: string; ends_on: string; sponsor: { id: string; name: string } }[];
    if (!due.length && !expiring.length) return 0;

    const lines = [
      ...due.map((i) => `${i.agreement.sponsor.name}: ${euros(i.amount_cents)} sin cobrar desde el ${i.due_on.split("-").reverse().join("/")}`),
      ...expiring.map((a) => `El acuerdo con ${a.sponsor.name} vence ${daysTo(a.ends_on, today) === 0 ? "hoy" : `en ${daysTo(a.ends_on, today)} días`}`),
    ];
    const one = new Set([...due.map((i) => i.agreement.sponsor.id), ...expiring.map((a) => a.sponsor.id)]);
    const { data: users } = await admin.rpc("users_with_perm", { p_module: "sponsors", p_action: "update" });
    const now = new Date().toISOString();
    if (due.length) await admin.from("sponsor_installments").update({ reminded_at: now }).in("id", due.map((i) => i.id));
    if (expiring.length) await admin.from("sponsor_agreements").update({ expiry_reminded_at: now }).in("id", expiring.map((a) => a.id));
    return await sendPush((users ?? []) as string[], {
      title: "🤝 Patrocinadores",
      body: lines.slice(0, 3).join(" · ") + (lines.length > 3 ? ` · y ${lines.length - 3} más` : ""),
      url: one.size === 1 ? `/admin/patrocinadores/${[...one][0]}` : "/admin/patrocinadores",
      tag: "patrocinadores",
    });
  } catch {
    return 0;
  }
}
