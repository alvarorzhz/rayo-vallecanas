import { BriefcaseMedical, Hand, Package, Shirt, TrafficCone } from "lucide-react";
import { Ball } from "@/components/squad/ball";
import type { Condition, MaterialCategory } from "@/lib/material";

/** Icono de cada tipo de material (el balón es el del club, no el de voleibol de la librería). */
export function CategoryIcon({ category, size = 22, className = "" }: { category: MaterialCategory; size?: number; className?: string }) {
  if (category === "balls") return <Ball size={size} className={className} />;
  const Icon = { kit: Shirt, training: TrafficCone, goalkeeper: Hand, medical: BriefcaseMedical, other: Package }[category];
  return <Icon size={size} className={className} />;
}

/**
 * Camiseta del Rayo dibujada: blanca con la franja roja, el dorsal en negro y la talla en la etiqueta.
 * Usada: tono algo apagado. Rota: gris, con la franja tachada.
 */
export function KitShirt({ number, size, condition, className = "" }: {
  number: number | null; size: string | null; condition: Condition; className?: string;
}) {
  const broken = condition === "broken";
  const body = broken ? "#d9d9d9" : condition === "used" ? "#f1ece1" : "#ffffff";
  const stripe = broken ? "#9a9a9a" : condition === "used" ? "#c6343d" : "#D20D17";
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <defs>
        <clipPath id="rv-kit-body">
          <path d="M33 8 L18 13 L3 30 L14 42 L22 35 L22 94 L78 94 L78 35 L86 42 L97 30 L82 13 L67 8 Q50 20 33 8 Z" />
        </clipPath>
      </defs>
      <path d="M33 8 L18 13 L3 30 L14 42 L22 35 L22 94 L78 94 L78 35 L86 42 L97 30 L82 13 L67 8 Q50 20 33 8 Z"
        fill={body} stroke="#080808" strokeWidth="3" strokeLinejoin="round" />
      {/* La franja del Rayo, de hombro a cadera */}
      <g clipPath="url(#rv-kit-body)">
        <path d="M8 4 L28 4 L96 80 L96 100 L80 100 Z" fill={stripe} opacity={broken ? 0.5 : 1} />
        <path d="M27 4 L31 4 L99 80 L96 84 Z" fill={broken ? "#bdbdbd" : "#D5AF32"} opacity={broken ? 0.5 : 0.9} />
      </g>
      <path d="M33 8 Q50 20 67 8" fill="none" stroke="#080808" strokeWidth="3" />
      {number !== null && (
        <text x="50" y="72" textAnchor="middle" fontSize={number > 9 ? 34 : 38} fontWeight="900" fontStyle="italic"
          fontFamily="var(--font-display), system-ui, sans-serif" fill={broken ? "#6b6b6b" : "#080808"}
          stroke={body} strokeWidth="5" paintOrder="stroke">{number}</text>
      )}
      {size && (
        <g>
          <rect x="40" y="13" width="20" height="11" rx="2" fill="#080808" />
          <text x="50" y="21.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#ffffff" fontFamily="system-ui, sans-serif">{size}</text>
        </g>
      )}
      {broken && <path d="M26 30 L74 88 M74 30 L26 88" stroke="#D20D17" strokeWidth="4" strokeLinecap="round" opacity="0.75" />}
    </svg>
  );
}
