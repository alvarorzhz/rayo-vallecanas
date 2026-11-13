import { Medal } from "lucide-react";
import { LEVEL_NAME, type Badge, type NextBadge } from "@/lib/achievements";

/** Color de la medalla según el nivel. */
const MEDAL = [
  "",
  "bg-[linear-gradient(150deg,#f3c9a0_0%,#c47a3f_45%,#7a4320_100%)]",   // bronce
  "bg-[linear-gradient(150deg,#ffffff_0%,#c9ccd1_45%,#868c95_100%)]",   // plata
  "bg-[linear-gradient(150deg,#fbeaa6_0%,#e3c255_40%,#a87f14_100%)]",   // oro
  "bg-[linear-gradient(150deg,#ff6a6f_0%,#d20d17_40%,#3b0609_100%)]",   // leyenda
];
const medal = (level: number) => MEDAL[Math.min(level, 4)];

/** Logros del jugador en su ficha: insignias conseguidas y lo que tiene a tiro. */
export function Achievements({ badges, next, isMe }: { badges: Badge[]; next: NextBadge[]; isMe: boolean }) {
  if (!badges.length && !next.length) return null;
  return (
    <section className="card mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2"><Medal size={18} className="text-dorado" /> Logros</h2>
        <span className="text-xs font-bold uppercase tracking-wider text-negro/55">{badges.length} {badges.length === 1 ? "conseguido" : "conseguidos"}</span>
      </div>

      {badges.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {badges.map((b, i) => (
            <li key={b.key} className="ach-in flex flex-col items-center text-center" style={{ animationDelay: `${i * 70}ms` }}>
              <span className={`ach-medal relative grid h-16 w-16 place-items-center ${medal(b.level)} ${b.level >= 3 ? "ach-shine" : ""}`} title={LEVEL_NAME[b.level]}>
                <span aria-hidden className="absolute inset-[3px] bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.55),transparent_55%)]" style={{ clipPath: "inherit" }} />
                <span className="relative text-2xl drop-shadow">{b.icon}</span>
              </span>
              <span className="sport mt-1.5 text-sm font-black leading-tight">{b.title}</span>
              <span className="text-[11px] text-negro/60">{b.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-negro/65">{isMe ? "Aún no tienes ninguno: el primero llega con tu debut." : "Aún no tiene ninguno: el primero llega con su debut."}</p>
      )}

      {next.length > 0 && (
        <div className="mt-4 border-t border-black/5 pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-negro/55">A tiro</p>
          <ul className="space-y-2">
            {next.slice(0, 3).map((n) => (
              <li key={n.key} className="flex items-center gap-3 text-sm">
                <span aria-hidden className="ach-medal grid h-9 w-9 shrink-0 place-items-center bg-gris text-base grayscale">{n.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold">{n.title} <span className="font-normal text-negro/60">· {n.detail}</span></span>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-negro/65">{n.value}/{n.goal}</span>
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gris">
                    <span className="ach-bar block h-full rounded-full bg-dorado" style={{ width: `${Math.round((n.value / n.goal) * 100)}%` }} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
