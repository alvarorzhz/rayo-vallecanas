"use client";

/**
 * 4.21.0 · Al contestar «Voy»: un balón sale del botón y se mete en una portería que aparece a la derecha;
 * la red se hunde y todo se va. Va encima de los botones sin tapar los toques. Dura menos de un segundo.
 */
export function VoyShot({ onDone }: { onDone: () => void }) {
  return (
    <span aria-hidden className="voy-shot pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-2xl" onAnimationEnd={(e) => { if (e.animationName === "voy-out") onDone(); }}>
      <span className="voy-goal"><span className="voy-net" /></span>
      <span className="voy-ball" />
    </span>
  );
}
