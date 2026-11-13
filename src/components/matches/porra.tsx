import Link from "next/link";
import { Target, Trophy } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchPorra } from "@/lib/porra-queries";
import { porraOpen } from "@/lib/porra";
import { rivalShort, type MatchRow } from "@/lib/matches";
import { seasonSlug } from "@/lib/squad";
import { savePorra } from "@/app/(app)/partidos/porra-actions";
import { PorraBox } from "@/components/matches/porra-box";

/** La porra dentro de la tarjeta negra «¡Estás convocado!», justo debajo de «Voy / No voy». */
export async function PorraInline({ m }: { m: MatchRow }) {
  if (!porraOpen(m)) return null;
  const [s, supabase] = await Promise.all([getSession(), createClient()]);
  const board = await fetchPorra(supabase, m, s.user.id);
  return <PorraBox dark action={savePorra.bind(null, m.id)} mine={board.mine} rival={m.rival} isHome={m.is_home} count={board.count} />;
}

/** Tarjeta suelta de la porra, para quien no va convocado (Inicio). Solo mientras está abierta. */
export async function PorraCard({ m, withMatch = false }: { m: MatchRow; withMatch?: boolean }) {
  if (!porraOpen(m)) return null;
  const [s, supabase] = await Promise.all([getSession(), createClient()]);
  const board = await fetchPorra(supabase, m, s.user.id);
  return (
    <section className="card mb-6 space-y-2">
      {withMatch && (
        <p className="text-sm font-bold"><Link href={`/partidos/${m.id}#porra`} className="hover:text-rojo">La porra del {m.is_home ? "Rayo – " + rivalShort(m.rival) : rivalShort(m.rival) + " – Rayo"} →</Link></p>
      )}
      <PorraBox action={savePorra.bind(null, m.id)} mine={board.mine} rival={m.rival} isHome={m.is_home} count={board.count} />
    </section>
  );
}

/**
 * La porra en la ficha del partido. Abierta: para jugarla (si no sale ya en la tarjeta de la convocatoria).
 * Cerrada: los pronósticos de todos y, con el resultado, los puntos de cada uno.
 */
export async function PorraSection({ m, inlineShown }: { m: MatchRow; inlineShown: boolean }) {
  if (m.status === "cancelled") return null;
  const [s, supabase] = await Promise.all([getSession(), createClient()]);
  const board = await fetchPorra(supabase, m, s.user.id);
  if (board.open) {
    if (inlineShown) return null;
    return (
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2"><Target size={18} className="text-rojo" /> La porra</h2>
        <PorraBox action={savePorra.bind(null, m.id)} mine={board.mine} rival={m.rival} isHome={m.is_home} count={board.count} />
      </section>
    );
  }
  if (!board.picks.length) return null;
  const played = m.status === "played";
  const winners = played ? board.picks.filter((p) => p.points === 3) : [];
  const score = (gf: number, ga: number) => (m.is_home ? `${gf}-${ga}` : `${ga}-${gf}`);
  return (
    <section className="card space-y-3" id="porra">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2"><Target size={18} className="text-rojo" /> La porra</h2>
        <Link href={`/partidos/porra?temporada=${seasonSlug(m.season)}`} prefetch className="flex items-center gap-1 text-sm font-bold text-rojo hover:underline"><Trophy size={15} /> Clasificación</Link>
      </div>
      <p className="text-sm text-negro/70">
        {!played ? `${board.picks.length} ${board.picks.length === 1 ? "pronóstico" : "pronósticos"}. Los puntos, en cuanto entre el resultado.`
          : winners.length ? `🎯 ${winners.length === 1 ? `${winners[0].name} lo clavó` : `Lo clavaron ${winners.map((w) => w.name).join(", ")}`}: ${score(m.goals_for!, m.goals_against!)}.`
          : "Nadie clavó el resultado."}
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {board.picks.map((p) => (
          <li key={p.user_id} className={`flex items-center gap-2 rounded-xl bg-gris px-2.5 py-1.5 text-sm ${p.me ? "ring-2 ring-dorado" : ""}`}>
            <span className="min-w-0 flex-1 truncate font-bold">{p.name}{p.me ? " (tú)" : ""}</span>
            <span className="sport text-lg font-black tabular-nums">{score(p.goals_for, p.goals_against)}</span>
            {p.points != null && (
              <span className={`badge w-12 justify-center ${p.points === 3 ? "bg-dorado text-negro" : p.points === 1 ? "bg-green-100 text-green-800" : "bg-white text-negro/50"}`}>+{p.points}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
