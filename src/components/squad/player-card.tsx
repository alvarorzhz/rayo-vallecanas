import { Cross, Flame, Plane } from "lucide-react";
import { Jersey } from "@/components/squad/jersey";
import { LegendCard } from "@/components/squad/legend-card";
import { LINE_TONE, POSITION_LABEL, STAT_LABEL, cardStats, lineOf, shirtName, type RosterEntry } from "@/lib/squad";

/** Brazalete de capitán (C) o de segundo capitán (2C). */
export function Armband({ kind, className = "" }: { kind: "captain" | "vice" | null; className?: string }) {
  if (!kind) return null;
  return (
    <span title={kind === "captain" ? "Capitán" : "Segundo capitán"}
      className={`sport inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-rojo px-1 text-xs font-black text-white shadow ring-1 ring-black/20 ${className}`}>
      {kind === "captain" ? "C" : "2C"}
    </span>
  );
}

export function PositionChip({ code, long = false }: { code: string; long?: boolean }) {
  const tone = LINE_TONE[lineOf(code)];
  return (
    <span title={POSITION_LABEL[code]} className={`sport inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-black ${tone.chip}`}>
      {code}
      {long && <span className="ml-1.5 font-bold normal-case not-italic opacity-90 [font-family:var(--font-sans)]">{POSITION_LABEL[code]}</span>}
    </span>
  );
}

// Silueta del cromo: esquinas superiores recortadas y punta abajo
const SHAPE = "polygon(12% 0, 88% 0, 100% 7%, 100% 89%, 50% 100%, 0 89%, 0 7%)";

/**
 * Cromo de jugador al estilo de los juegos de fútbol: foto grande, dorsal y posición
 * en pequeño arriba a la izquierda, nombre y seis estadísticas de la temporada.
 * Dorado si está disponible; plateado si está lesionado o de baja.
 * «En forma» (rojo y negro, letras doradas): el MVP de la última jornada, si está disponible.
 */
export function FutCard({ entry, size = "sm", form = false }: { entry: RosterEntry; size?: "sm" | "lg"; form?: boolean }) {
  const { player: p } = entry;
  const line = lineOf(entry.position);
  const lg = size === "lg";
  const silver = entry.status !== "active";
  const hot = form && !silver;
  const stats = cardStats(line);
  const face = silver
    ? "bg-[linear-gradient(160deg,#f4f4f4_0%,#c9ccd1_42%,#9aa0a8_100%)]"
    : hot
      ? "bg-[linear-gradient(160deg,#5a0a10_0%,#1a0405_45%,#080808_70%,#3b0609_100%)]"
      : "bg-[linear-gradient(160deg,#fbeaa6_0%,#e3c255_38%,#b8901f_100%)]";
  const ink = hot ? "text-white" : "text-negro";
  const rule = hot ? "bg-dorado/50" : "bg-negro/25";
  return (
    <div className={`relative w-full ${entry.status === "left" ? "grayscale" : ""}`} style={{ aspectRatio: "0.72" }}>
      {/* Borde exterior oscuro y cara metálica */}
      <div className={`absolute inset-0 ${hot ? "bg-dorado" : "bg-negro"}`} style={{ clipPath: SHAPE }} />
      <div className={`absolute inset-[3px] ${face} ${silver ? "" : "cromo-shine"}`} style={{ clipPath: SHAPE }}>
        {/* Brillo y franja del Rayo */}
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.55)_0_18%,transparent_18%_100%)] opacity-40" />
        <span aria-hidden className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0_70%,rgba(210,13,23,0.9)_70%_78%,rgba(8,8,8,0.85)_78%_80%,transparent_80%)] [mask-image:linear-gradient(to_bottom,black_0%,black_45%,transparent_58%)]" />
        <span aria-hidden className="absolute inset-x-[8%] top-[4%] h-[54%] rounded-[40%] bg-[radial-gradient(circle,rgba(255,255,255,0.45),transparent_65%)]" />

        {/* Dorsal y posición (en pequeño) */}
        <div className={`absolute z-10 flex flex-col items-center leading-none ${hot ? "text-dorado" : "text-negro"} ${lg ? "left-[9%] top-[9%]" : "left-[8%] top-[9%]"}`}>
          <span className={`sport font-black ${lg ? "text-3xl" : "text-[1.35rem] sm:text-2xl"}`}>{entry.number ?? "–"}</span>
          <span className={`sport font-black ${lg ? "mt-0.5 text-sm" : "mt-0.5 text-[10px] sm:text-[11px]"}`}>{entry.position}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/escudo.png" alt="" className={`${lg ? "mt-1.5 w-7" : "mt-1 w-[18px] sm:w-5"} drop-shadow`} />
        </div>
        <div className={`absolute z-10 flex flex-col items-end gap-1 ${lg ? "right-[9%] top-[9%]" : "right-[8%] top-[9%]"}`}>
          {hot && (
            <span title="En forma: MVP de la última jornada"
              className={`sport anim-trophy flex items-center gap-0.5 rounded-md bg-dorado font-black uppercase text-negro shadow ring-1 ring-black/30 ${lg ? "px-1.5 py-0.5 text-xs" : "px-1 text-[9px] leading-4 sm:text-[10px]"}`}>
              <Flame size={lg ? 13 : 10} strokeWidth={3} /> En forma
            </span>
          )}
          <Armband kind={entry.armband} className={lg ? "h-8 min-w-8 text-sm" : "h-5 min-w-5 text-[10px]"} />
          {entry.status === "injured" && (
            <span title="Lesionado" className={`flex items-center justify-center rounded-full bg-white text-rojo shadow ${lg ? "h-8 w-8" : "h-5 w-5"}`}><Cross size={lg ? 18 : 12} strokeWidth={3} /></span>
          )}
          {entry.status === "away" && (
            <span title="Baja temporal" className={`flex items-center justify-center rounded-full bg-negro text-white shadow ${lg ? "h-8 w-8" : "h-5 w-5"}`}><Plane size={lg ? 16 : 11} /></span>
          )}
        </div>

        {/* Foto (o la camiseta con el dorsal si no hay foto) */}
        <div className={`absolute top-[5%] flex h-[53%] items-end justify-center ${p.photo_url ? "left-[24%] right-[7%]" : "inset-x-0"}`}>
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo_url} alt="" loading="lazy"
              className="h-full w-full object-cover object-top [mask-image:linear-gradient(to_bottom,black_70%,transparent)]" />
          ) : (
            <span className={`mb-[6%] ${hot ? "drop-shadow-[0_0_14px_rgba(213,175,50,0.7)]" : "drop-shadow-[0_8px_10px_rgba(0,0,0,0.35)]"}`}><Jersey number={entry.number} goalkeeper={line === "GK"} size={lg ? 120 : 74} /></span>
          )}
        </div>

        {/* Nombre */}
        <div className={`absolute inset-x-[6%] top-[57%] text-center ${ink}`}>
          <div className={`sport truncate font-black leading-none ${hot ? "text-dorado" : ""} ${lg ? "text-2xl" : "text-[0.95rem] sm:text-lg"}`}>{shirtName(p)}</div>
          <div className={`mx-auto mt-[3%] h-px w-[80%] ${rule}`} />
        </div>

        {/* Seis estadísticas en dos columnas */}
        <div className={`absolute inset-x-[14%] top-[66%] grid grid-cols-2 ${ink} ${lg ? "gap-x-4" : "gap-x-2"}`}>
          {[stats.slice(0, 3), stats.slice(3)].map((col, i) => (
            <div key={i} className={`${i === 0 ? `border-r ${hot ? "border-dorado/50" : "border-negro/25"} pr-[6%]` : "pl-[2%]"}`}>
              {col.map((k) => (
                <div key={k} className="flex items-baseline justify-center gap-1 leading-tight" title={STAT_LABEL[k].long}>
                  <span className={`sport font-black tabular-nums ${lg ? "text-lg" : "text-[0.8rem] sm:text-sm"}`}>{entry[k]}</span>
                  <span className={`font-bold opacity-70 ${lg ? "text-xs" : "text-[9px] sm:text-[10px]"}`}>{STAT_LABEL[k].short}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Cromo enlazado a la ficha del jugador (con su cara Leyenda escondida). */
export function PlayerCard({ entry, href, index = 0, form = false }: { entry: RosterEntry; href: string; index?: number; form?: boolean }) {
  const line = lineOf(entry.position);
  const legend = {
    name: shirtName(entry.player),
    number: entry.number,
    position: entry.position,
    photo: entry.player.photo_url,
    goalkeeper: line === "GK",
    stats: cardStats(line).map((k) => STAT_LABEL[k]),
  };
  return (
    <LegendCard href={href} legend={legend} style={{ animationDelay: `${Math.min(index, 16) * 55}ms`, ["--shine-delay" as string]: `${(index % 7) * 0.8}s` }}
      className="anim-deal group block drop-shadow-[0_10px_14px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-1 hover:drop-shadow-[0_16px_20px_rgba(210,13,23,0.35)] active:scale-[0.98]">
      <FutCard entry={entry} form={form} />
    </LegendCard>
  );
}
