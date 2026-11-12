import { Images } from "lucide-react";
import { ShareImageTile } from "@/components/matches/share-image";
import type { MatchRow } from "@/lib/matches";

/**
 * «Imágenes para compartir» (v4.4.0): todas las imágenes del partido en un sitio, cada una en
 * publicación o historia. La convocatoria, en cuanto se publica; «Hoy jugamos», mientras el
 * partido está por jugar; el resultado, cuando ya se ha jugado.
 */
export function ShareImages({ m, hasCallup }: { m: MatchRow; hasCallup: boolean }) {
  const base = `/api/partidos/${m.id}/imagen`;
  const tiles = [
    hasCallup && { key: "convocatoria", url: `${base}/convocatoria`, name: `convocatoria-${m.match_date}.jpg`, title: "Convocatoria", hint: "Los que han dicho «Voy», por líneas, con el día, la hora y el campo.", word: "CONVOCATORIA", glow: "oro" as const },
    m.status === "scheduled" && { key: "hoy", url: `${base}/hoy`, name: `hoy-jugamos-${m.match_date}.jpg`, title: "Hoy jugamos", hint: "El rival, la hora, el campo y cómo llegamos.", word: "¡HOY JUGAMOS!", glow: "rojo" as const },
    m.status === "played" && { key: "resultado", url: base, name: `resultado-${m.match_date}.jpg`, title: "Resultado", hint: "El marcador, los goles y el MVP.", word: "RESULTADO", glow: "oro" as const },
  ].filter((t) => !!t);
  if (!tiles.length) return null;

  return (
    <section id="imagenes" className="card scroll-mt-24 space-y-3">
      <div>
        <h2 className="flex items-center gap-2"><Images size={18} className="text-rojo" /> Imágenes para compartir</h2>
        <p className="text-sm text-negro/65">Para el grupo, los estados de WhatsApp o Instagram.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {tiles.map(({ key, ...t }) => <ShareImageTile key={key} {...t} />)}
      </div>
    </section>
  );
}
