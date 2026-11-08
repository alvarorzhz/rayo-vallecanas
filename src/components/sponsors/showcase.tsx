import type { Showcase } from "@/lib/sponsors";

/**
 * Patrocinadores al pie de Inicio: una línea discreta con los logos en gris,
 * que recuperan su color al pasar por encima. Sin tarjeta ni importes.
 */
export function SponsorStrip({ sponsors }: { sponsors: Showcase[] }) {
  const shown = sponsors.filter((s) => s.logo_url);
  if (!shown.length) return null;
  return (
    <aside aria-label="Patrocinadores" className="mt-10 mb-2 flex flex-col items-center gap-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-negro/40">Con el apoyo de</span>
      <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
        {shown.map((s) => {
          // eslint-disable-next-line @next/next/no-img-element
          const img = <img src={s.logo_url!} alt={s.name} loading="lazy"
            className={`${s.tier === "main" ? "h-9 max-w-28" : "h-7 max-w-24"} w-auto object-contain opacity-55 grayscale transition hover:opacity-100 hover:grayscale-0`} />;
          return (
            <li key={s.id}>
              {s.website ? <a href={s.website} target="_blank" rel="noopener" title={s.name}>{img}</a> : img}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
