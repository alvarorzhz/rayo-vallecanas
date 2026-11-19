import { ChevronDown } from "lucide-react";
import { deltaLabel, pct, type Fixture, type Forecast } from "@/lib/league-forecast";

const ord = (n: number) => `${n}º`;

/** Barra de tres colores con victoria, empate y derrota. */
function OddsBar({ win, draw, loss }: { win: number; draw: number; loss: number }) {
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-black/10" aria-hidden>
      <span className="bg-green-600" style={{ width: `${win * 100}%` }} />
      <span className="bg-dorado" style={{ width: `${draw * 100}%` }} />
      <span className="bg-rojo" style={{ width: `${loss * 100}%` }} />
    </div>
  );
}

/**
 * 4.25.0 · «¿Ganamos?»: probabilidad de victoria, empate y derrota del próximo partido de liga.
 * Sale de jugar el resto de la liga 10.000 veces con la fuerza de cada equipo.
 */
export function MatchOdds({ odds, className = "" }: { odds: Fixture; className?: string }) {
  const rows = [
    ["Victoria", odds.win, "text-green-700"],
    ["Empate", odds.draw, "text-[#6b5410]"],
    ["Derrota", odds.loss, "text-rojo"],
  ] as const;
  return (
    <section className={`rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-black/5 ${className}`} aria-label="¿Ganamos? Probabilidades del partido">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="sport text-sm font-black tracking-[0.12em]">¿GANAMOS?</h3>
        <span className="text-[11px] text-negro/55">según cómo vienen los dos</span>
      </div>
      <OddsBar win={odds.win} draw={odds.draw} loss={odds.loss} />
      <dl className="mt-2 grid grid-cols-3 text-center">
        {rows.map(([k, v, tone]) => (
          <div key={k}>
            <dd className={`sport text-2xl font-black leading-none tabular-nums ${tone}`}>{pct(v)}</dd>
            <dt className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-negro/55">{k}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * 4.25.0 · «¿Subimos?»: una sola línea discreta bajo la clasificación («Ascenso 63 % ▲12»).
 * Al tocarla se abre el detalle: arriba/mitad/abajo, puesto más probable y qué pasa según el próximo partido.
 */
export function ForecastLine({ f }: { f: Forecast }) {
  const d = deltaLabel(f.delta);
  const n = f.next;
  const up = pct(f.pUp, f.upSure, f.upGone);
  const maxPos = Math.max(...f.posDist);
  const zones = [
    { key: "up", label: `Ascenso · los ${f.upN} primeros`, p: f.pUp, sure: f.upSure, gone: f.upGone, bar: "bg-green-600" },
    ...(f.teams - f.upN - f.downN > 0 ? [{ key: "mid", label: "En medio", p: f.pMid, sure: false, gone: false, bar: "bg-dorado" }] : []),
    ...(f.downN ? [{ key: "down", label: `Descenso · los ${f.downN} últimos`, p: f.pDown, sure: f.downSure, gone: f.downGone, bar: "bg-rojo" }] : []),
  ];
  return (
    <details className="group mt-3 rounded-2xl bg-white shadow-sm ring-1 ring-black/5 open:ring-dorado/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
        <span className="font-bold text-negro/70">¿Subimos?</span>
        <span className="sport text-lg font-black">Ascenso {up}</span>
        {d && <span className={`text-xs font-black ${d.up ? "text-green-700" : "text-rojo"}`} title="Cambio tras nuestra última jornada">{d.text}</span>}
        <ChevronDown size={16} className="ml-auto text-negro/50 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-4 border-t border-black/5 px-4 pb-4 pt-3">
        <ul className="space-y-2">
          {zones.map((z) => (
            <li key={z.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{z.label}</span>
                <b className="sport text-base tabular-nums">{pct(z.p, z.sure, z.gone)}</b>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10"><span className={`block h-full ${z.bar}`} style={{ width: `${(z.sure ? 1 : z.gone ? 0 : z.p) * 100}%` }} /></div>
            </li>
          ))}
        </ul>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">Puesto más probable</span>
            <b className="sport text-xl">{ord(f.likelyPos)}</b>
          </div>
          <ol className="mt-1.5 flex h-12 items-end gap-0.5" aria-label="Probabilidad de acabar en cada puesto">
            {f.posDist.map((p, i) => (
              <li key={i} className="flex h-full flex-1 flex-col items-center justify-end" title={`${ord(i + 1)}: ${pct(p)}`}>
                <span className={`block w-full rounded-t ${i + 1 === f.likelyPos ? "bg-rojo" : i < f.upN ? "bg-green-600/60" : i >= f.teams - f.downN ? "bg-rojo/30" : "bg-dorado/60"}`}
                  style={{ height: `${maxPos ? Math.max(p > 0 ? 6 : 2, (p / maxPos) * 100) : 2}%` }} />
              </li>
            ))}
          </ol>
          <div className="mt-0.5 flex gap-0.5 text-center text-[9px] text-negro/50" aria-hidden>
            {f.posDist.map((_, i) => <span key={i} className="flex-1">{i + 1}</span>)}
          </div>
        </div>

        {n && (
          <div className="rounded-xl bg-gris/70 p-3">
            <div className="text-sm font-semibold">Próximo: {n.home ? "contra" : "en casa de"} {n.oppName}</div>
            <dl className="mt-2 grid grid-cols-3 gap-1 text-center">
              {([["Si ganamos", n.ifWin, "text-green-700"], ["Si empatamos", n.ifDraw, "text-[#6b5410]"], ["Si perdemos", n.ifLoss, "text-rojo"]] as const).map(([k, v, tone]) => (
                <div key={k}>
                  <dd className={`sport text-xl font-black leading-none tabular-nums ${tone}`}>{pct(v, f.upSure, f.upGone)}</dd>
                  <dt className="mt-0.5 text-[11px] text-negro/60">{k}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-negro/55">Probabilidad de ascenso según cómo acabe ese partido.</p>
          </div>
        )}

        {d && f.lastGame && (
          <p className="text-xs text-negro/65">
            La probabilidad de ascenso {d.up ? "sube" : "baja"} <b>{Math.abs(f.delta!)} %</b> tras la {f.lastGame.round.toLowerCase()} ({f.lastGame.gf}-{f.lastGame.ga} ante {f.lastGame.oppName}).
          </p>
        )}
        <p className="text-[11px] text-negro/55">
          Se juega el resto de la liga {f.sims.toLocaleString("es-ES")} veces con la fuerza de cada equipo (sus goles a favor y en contra, y cómo llega en los últimos partidos). Es una previsión, no una promesa.
        </p>
      </div>
    </details>
  );
}
