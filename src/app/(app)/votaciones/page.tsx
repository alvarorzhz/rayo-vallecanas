import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader } from "@/components/ui";
import { PollCard } from "@/components/polls/poll-card";
import type { Poll } from "@/lib/polls";

export const metadata = { title: "Votaciones" };

export default async function PollsPage({ searchParams }: { searchParams: Promise<{ nueva?: string }> }) {
  const { nueva } = await searchParams;
  const s = await getSession();
  const canManage = s.can("users", "update") || s.can("lottery_admin", "update");
  const supabase = await createClient();
  const { data } = await supabase.rpc("poll_board", { p_limit: 50 });
  const polls = (data ?? []) as Poll[];
  const open = polls.filter((p) => p.open);
  const closed = polls.filter((p) => !p.open);

  return (
    <>
      <PageHeader title="Votaciones" subtitle="Preguntas de sí o no para decidir entre todos."
        actions={canManage ? <Link href="/admin/avisos?tipo=votacion" prefetch className="btn-primary"><Plus size={16} /> Nueva votación</Link> : undefined} />
      {nueva && <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">¡Votación lanzada! Les ha llegado el aviso a quienes lo tienen activado.</div>}

      <section aria-label="Abiertas" className="mb-8 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-negro/65">Abiertas · {open.length}</h2>
        {open.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{open.map((p) => <PollCard key={p.id} p={p} canManage={canManage} />)}</div>
        ) : (
          <Empty>No hay ninguna votación abierta ahora mismo.</Empty>
        )}
      </section>

      {closed.length > 0 && (
        <section aria-label="Cerradas" className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-negro/65">Cerradas</h2>
          <div className="grid gap-4 lg:grid-cols-2">{closed.map((p) => <PollCard key={p.id} p={p} canManage={canManage} />)}</div>
        </section>
      )}
    </>
  );
}
