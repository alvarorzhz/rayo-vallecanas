import { Jersey } from "@/components/squad/jersey";
import { shirtName, type Player } from "@/lib/squad";
import { slotsOf } from "@/lib/callups";

type Placed = { player: Pick<Player, "first_name" | "last_name" | "nickname">; number: number | null } | null;

/**
 * Alineación de fútbol 7 sobre medio campo (nuestra portería abajo).
 * Los huecos sin jugador salen punteados.
 */
export function LineupPitch({ formation, at, compact = false }: { formation: string | null; at: (slot: number) => Placed; compact?: boolean }) {
  const spots = slotsOf(formation);
  const jersey = compact ? 38 : 48;
  return (
    <div className={`relative mx-auto w-full overflow-hidden rounded-3xl bg-[#1f7a3a] shadow-xl ring-4 ring-negro ${compact ? "max-w-sm" : "max-w-md"}`} style={{ aspectRatio: "4 / 5" }}>
      <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0_44px,transparent_44px_88px)]" />
      <div aria-hidden className="absolute inset-3">
        <div className="absolute inset-0 rounded-md border-2 border-white/60" />
        {/* Medio campo arriba, área y portería abajo */}
        <div className="absolute left-1/2 top-0 aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60" />
        <div className="absolute bottom-0 left-1/2 h-[22%] w-[62%] -translate-x-1/2 border-2 border-b-0 border-white/60" />
        <div className="absolute bottom-[16%] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/70" />
        <div className="absolute -bottom-2.5 left-1/2 h-2 w-[18%] -translate-x-1/2 rounded-sm border-2 border-white/80 bg-white/10" />
        <span className="sport absolute right-[2%] top-[1%] text-[10px] font-black tracking-widest text-white/40">{formation ?? ""}</span>
      </div>
      <ol className="absolute inset-0">
        {spots.map((sp, i) => {
          const p = at(sp.slot);
          return (
            <li key={sp.slot} className="anim-walkout absolute flex w-[5.2rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center sm:w-24"
              style={{ left: `${sp.x}%`, top: `${sp.y}%`, animationDelay: `${i * 70}ms` }}>
              {p ? (
                <>
                  <span className="drop-shadow-[0_6px_6px_rgba(0,0,0,0.45)]"><Jersey number={p.number} goalkeeper={sp.line === "GK"} size={jersey} /></span>
                  <span className="mt-0.5 max-w-full truncate rounded bg-black/60 px-1.5 text-[11px] font-bold leading-5 text-white">{shirtName(p.player)}</span>
                </>
              ) : (
                <>
                  <span className="flex items-center justify-center rounded-full border-2 border-dashed border-white/60 text-[10px] font-black text-white/70" style={{ width: jersey * 0.8, height: jersey * 0.8 }}>{sp.label}</span>
                  <span className="sr-only">{sp.label} sin asignar</span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
