import Link from "next/link";
import { Jersey } from "@/components/squad/jersey";
import { Ball } from "@/components/squad/ball";
import { LINES, lineOf, shirtName, type Line, type RosterEntry } from "@/lib/squad";

/**
 * La plantilla sobre el campo: cada jugador en su línea (portería abajo, delanteros arriba).
 * Los lesionados y las bajas temporales aparecen atenuados.
 */
export function Pitch({ roster, hrefFor }: { roster: RosterEntry[]; hrefFor: (id: string) => string }) {
  const byLine = (l: Line) => roster.filter((r) => lineOf(r.position) === l);
  const rows = [...LINES].reverse();
  return (
    <div className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl bg-[#1f7a3a] shadow-xl ring-4 ring-negro">
      {/* Césped a franjas */}
      <div aria-hidden className="anim-grass absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0_56px,transparent_56px_112px)]" />
      {/* Líneas de un campo de fútbol 7 (unos 60 × 40 m): áreas de 12 m, punto de penalti a 9 m y porterías de 6 m */}
      <div aria-hidden className="absolute inset-3 sm:inset-4">
        <div className="absolute inset-0 rounded-md border-2 border-white/60" />
        <div className="absolute inset-x-0 top-1/2 border-t-2 border-white/60" />
        <div className="absolute left-1/2 top-1/2 aspect-square w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
        <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
        {/* Balón en el centro del campo */}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[130%]"><Ball size={22} className="anim-bounce-ball drop-shadow-[0_6px_4px_rgba(0,0,0,0.45)]" /></span>
        {(["top", "bottom"] as const).map((side) => (
          <div key={side}>
            <div className={`absolute left-1/2 h-[17%] w-[65%] -translate-x-1/2 border-2 border-white/60 ${side === "top" ? "top-0 border-t-0" : "bottom-0 border-b-0"}`} />
            <div className={`absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/70 ${side === "top" ? "top-[13%]" : "bottom-[13%]"}`} />
            <div className={`absolute left-1/2 h-2 w-[15%] -translate-x-1/2 rounded-sm border-2 border-white/80 bg-white/10 ${side === "top" ? "-top-2.5" : "-bottom-2.5"}`} />
          </div>
        ))}
        <span className="sport absolute bottom-[1%] right-[2%] text-[10px] font-black tracking-widest text-white/40">FÚTBOL 7</span>
      </div>

      <div className="relative flex min-h-[36rem] flex-col justify-between gap-4 px-3 py-8 sm:min-h-[44rem]  sm:px-8">
        {rows.map((l, li) => {
          const players = byLine(l.key);
          return (
            <div key={l.key} className="flex flex-col items-center gap-1.5">
              <span className="sport rounded bg-black/35 px-2 py-0.5 text-[11px] font-black tracking-wider text-white/85">
                {l.plural} · {players.length}
              </span>
              <div className="flex flex-wrap justify-center gap-x-1 gap-y-2 sm:gap-x-3">
                {players.length === 0 && <span className="py-3 text-xs text-white/60">Sin jugadores</span>}
                {players.map((r, pi) => {
                  const dim = r.status !== "active";
                  return (
                    <Link key={r.id} href={hrefFor(r.player_id)} prefetch style={{ animationDelay: `${(rows.length - 1 - li) * 160 + pi * 70}ms` }}
                      className="anim-walkout group flex w-[4.4rem] flex-col items-center text-center transition hover:-translate-y-0.5 sm:w-20">
                      <span className="relative drop-shadow-[0_6px_6px_rgba(0,0,0,0.45)] transition group-hover:scale-110">
                        <Jersey number={r.number} goalkeeper={l.key === "GK"} size={50} dim={dim} />
                        {r.armband && (
                          <span className="sport absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded bg-dorado px-0.5 text-[10px] font-black text-negro ring-1 ring-black/30">
                            {r.armband === "captain" ? "C" : "2C"}
                          </span>
                        )}
                        {r.status === "injured" && (
                          <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-rojo ring-1 ring-black/20">+</span>
                        )}
                      </span>
                      <span className="mt-0.5 w-full truncate rounded bg-black/55 px-1 text-[11px] font-bold leading-5 text-white">{shirtName(r.player)}</span>
                      <span className="sport text-[10px] font-black text-white/75">{r.position}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
