import { rivalColor, rivalShort, type Rival } from "@/lib/matches";

/** Escudo del rival (el suyo o uno genérico con sus siglas) o el nuestro. */
export function Crest({ rival, us = false, size = 48, className = "" }: { rival?: Pick<Rival, "name" | "short_name" | "color" | "crest_url"> | null; us?: boolean; size?: number; className?: string }) {
  if (us || !rival) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/escudo.png" alt="" width={size} height={Math.round(size * 1.19)} style={{ width: size, height: size * 1.19 }} className={`object-contain drop-shadow-lg ${className}`} />;
  }
  if (rival.crest_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={rival.crest_url} alt="" width={size} height={size} style={{ width: size, height: size * 1.19 }} className={`object-contain drop-shadow-lg ${className}`} />;
  }
  const c = rivalColor(rival);
  return (
    <svg viewBox="0 0 40 48" width={size} height={size * 1.2} aria-hidden className={`drop-shadow-lg ${className}`}>
      <path d="M20 1 L38 6 V22 C38 34 30 42 20 47 C10 42 2 34 2 22 V6 Z" fill={c} stroke="#fff" strokeWidth="2" />
      <path d="M2 16 H38 V22 H2 Z" fill="rgba(255,255,255,0.18)" />
      <text x="20" y="31" textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontWeight="900" fontStyle="italic" fontSize={rivalShort(rival).length > 3 ? 10 : 12} fill="#fff">
        {rivalShort(rival)}
      </text>
    </svg>
  );
}
