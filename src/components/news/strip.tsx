import Link from "next/link";
import type { NewsStrip } from "@/lib/news-queries";

const OUTCOME = { W: { label: "Victoria", tone: "text-green-700" }, D: { label: "Empate", tone: "text-[#8a6d12]" }, L: { label: "Derrota", tone: "text-rojo" } } as const;

/** Los tres datos de un vistazo bajo la cabecera: último resultado, puesto en liga y próximo partido. */
export function NewsStripBar({ strip }: { strip: NewsStrip }) {
  const cells: { key: string; href: string; label: string; value: string; note: string; tone?: string }[] = [];
  if (strip.last) {
    const o = OUTCOME[strip.last.outcome];
    cells.push({ key: "last", href: `/partidos/${strip.last.id}`, label: "Último", value: strip.last.score, note: `${o.label} · ${strip.last.rival}`, tone: o.tone });
  }
  if (strip.league) cells.push({ key: "league", href: "/partidos/liga", label: "Liga", value: `${strip.league.pos}º`, note: `${strip.league.points} ${strip.league.points === 1 ? "pt" : "pts"}` });
  if (strip.next)
    cells.push({
      key: "next",
      href: `/partidos/${strip.next.id}`,
      label: "Próximo",
      value: strip.next.day,
      note: `${strip.next.time ? `${strip.next.time} · ` : ""}${strip.next.home ? "vs" : "en casa de"} ${strip.next.rival}`,
    });
  if (!cells.length) return null;
  return (
    <nav aria-label="El equipo de un vistazo" className="news-strip press-in-2 mt-3 grid" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
      {cells.map((c) => (
        <Link key={c.key} href={c.href} prefetch className="group min-w-0 px-1.5 py-2 text-center hover:bg-black/[0.03]">
          <span className="news-meta block !text-[10px]">{c.label}</span>
          <span className="sport block truncate text-2xl font-black leading-none tabular-nums first-letter:uppercase group-hover:text-rojo">{c.value}</span>
          <span className={`mt-0.5 block truncate text-[11px] font-bold ${c.tone ?? "text-[#141210]/60"}`}>{c.note}</span>
        </Link>
      ))}
    </nav>
  );
}
