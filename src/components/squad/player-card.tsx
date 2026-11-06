import Link from "next/link";
import { Cross, Plane } from "lucide-react";
import { Jersey } from "@/components/squad/jersey";
import { LINE_TONE, POSITION_LABEL, lineOf, shirtName, type RosterEntry } from "@/lib/squad";

/** Brazalete de capitán (C) o de segundo capitán (2C). */
export function Armband({ kind, className = "" }: { kind: "captain" | "vice" | null; className?: string }) {
  if (!kind) return null;
  return (
    <span title={kind === "captain" ? "Capitán" : "Segundo capitán"}
      className={`sport inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-dorado px-1 text-xs font-black text-negro shadow ring-1 ring-black/20 ${className}`}>
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

/** Cromo del jugador: dorsal, posición, foto y nombre de camiseta. */
export function PlayerCard({ entry, href }: { entry: RosterEntry; href: string }) {
  const { player: p } = entry;
  const line = lineOf(entry.position);
  const out = entry.status === "left";
  const gk = line === "GK";
  return (
    <Link href={href} prefetch
      className={`group relative block overflow-hidden rounded-2xl bg-negro text-white shadow-[0_12px_28px_-14px_rgba(0,0,0,0.7)] ring-1 ring-black/40 transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_34px_-14px_rgba(210,13,23,0.55)] active:scale-[0.98] ${out ? "opacity-60 grayscale" : ""}`}>
      {/* Fondo: degradado y franja diagonal */}
      <span aria-hidden className={`absolute inset-0 ${gk ? "bg-[linear-gradient(160deg,#3a2f0b_0%,#0b0b0b_62%)]" : "bg-[linear-gradient(160deg,#2a0507_0%,#0b0b0b_62%)]"}`} />
      <span aria-hidden className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0_62%,rgba(210,13,23,0.85)_62%_74%,rgba(213,175,50,0.9)_74%_76%,transparent_76%)] opacity-70 transition group-hover:opacity-100" />
      <span aria-hidden className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/5" />

      <div className="relative aspect-[3/4] w-full">
        {/* Dorsal y posición */}
        <div className="absolute left-2.5 top-2 z-10 flex flex-col items-center leading-none">
          <span className="sport text-[2.1rem] font-black text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.6)] sm:text-[2.4rem]">{entry.number ?? "–"}</span>
          <span className={`sport mt-1 rounded px-1 py-px text-[11px] font-black ${LINE_TONE[line].chip}`}>{entry.position}</span>
        </div>
        <div className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
          <Armband kind={entry.armband} />
          {entry.status === "injured" && (
            <span title="Lesionado" className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-rojo shadow"><Cross size={14} strokeWidth={3} /></span>
          )}
          {entry.status === "away" && (
            <span title="Baja temporal" className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-negro shadow"><Plane size={13} /></span>
          )}
        </div>

        {/* Foto (o camiseta si no hay) */}
        <div className="absolute inset-x-0 bottom-0 top-6 flex items-end justify-center">
          {p.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photo_url} alt="" loading="lazy"
              className="h-[82%] w-[82%] rounded-t-[999px] object-cover object-top [mask-image:linear-gradient(to_bottom,black_70%,transparent)] transition duration-300 group-hover:scale-[1.03]" />
          ) : (
            <span className="mb-[18%] drop-shadow-[0_10px_14px_rgba(0,0,0,0.6)]"><Jersey number={entry.number} goalkeeper={gk} size={92} /></span>
          )}
        </div>
      </div>

      {/* Nombre */}
      <div className="relative -mt-7 px-2 pb-2.5 text-center">
        <div className="sport truncate text-lg font-black leading-tight sm:text-xl">{shirtName(p)}</div>
        <div className="mx-auto mt-1 h-[3px] w-10 -skew-x-[25deg] bg-dorado" />
        <div className="mt-1 truncate text-[11px] text-white/60">{p.first_name} {p.last_name.split(" ")[0]}</div>
      </div>
    </Link>
  );
}
