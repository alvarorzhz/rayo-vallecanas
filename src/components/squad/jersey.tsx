/**
 * Camiseta del Rayo Vallecañas con el dorsal: negra con la franja roja y dorada.
 * La del portero es dorada. Se usa en el campo y cuando no hay foto.
 */
export function Jersey({ number, goalkeeper = false, size = 56, dim = false }: { number: number | null; goalkeeper?: boolean; size?: number; dim?: boolean }) {
  const body = goalkeeper ? "#D5AF32" : "#111111";
  const text = goalkeeper ? "#080808" : "#FFFFFF";
  const id = `j${goalkeeper ? "g" : "f"}`;
  return (
    <svg viewBox="0 0 64 60" width={size} height={(size * 60) / 64} aria-hidden className={dim ? "opacity-50 grayscale" : ""}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d="M20 2 L26 6 Q32 9 38 6 L44 2 L62 12 L56 26 L50 23 L50 58 L14 58 L14 23 L8 26 L2 12 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="64" height="60" fill={body} />
        {/* Franja diagonal */}
        <path d="M2 50 L52 0 L62 0 L62 4 L10 58 L2 58 Z" fill={goalkeeper ? "#080808" : "#D20D17"} opacity={goalkeeper ? 0.18 : 1} />
        <path d="M10 58 L62 4 L62 7 L13 58 Z" fill={goalkeeper ? "#080808" : "#D5AF32"} opacity={goalkeeper ? 0.25 : 1} />
        <path d="M26 6 Q32 9 38 6 L36 11 Q32 13 28 11 Z" fill={goalkeeper ? "#080808" : "#D5AF32"} opacity="0.85" />
      </g>
      <path d="M20 2 L26 6 Q32 9 38 6 L44 2 L62 12 L56 26 L50 23 L50 58 L14 58 L14 23 L8 26 L2 12 Z" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
      {number != null && (
        <text x="32" y="43" textAnchor="middle" fontSize={number > 9 ? 22 : 25} fontWeight="900" fontStyle="italic"
          fontFamily="var(--font-display), 'Arial Narrow', sans-serif" fill={text} stroke={goalkeeper ? "none" : "#080808"} strokeWidth="0.6" paintOrder="stroke">
          {number}
        </text>
      )}
    </svg>
  );
}
