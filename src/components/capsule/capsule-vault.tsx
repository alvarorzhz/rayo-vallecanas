/**
 * 4.24.0 · La cápsula: un cofre negro con aros dorados, el escudo y un candado.
 * state: "sealed" (cerrada, el candado respira), "unlock" (tiembla y salta el candado), "open" (se abre la tapa y sale la luz).
 */
export function CapsuleVault({ state = "sealed", size = 150, className = "" }: { state?: "sealed" | "unlock" | "open"; size?: number; className?: string }) {
  return (
    <div aria-hidden className={`cap-vault cap-${state} relative ${className}`} style={{ width: size, height: size * 1.05 }}>
      <span className="cap-rays" />
      <span className="cap-glow" />
      <span className="cap-lid">
        <span className="cap-ring" />
      </span>
      <span className="cap-body">
        <span className="cap-ring cap-ring-b" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/escudo.png" alt="" className="cap-crest" />
      </span>
      <span className="cap-lock">
        <span className="cap-shackle" />
        <span className="cap-keyhole" />
      </span>
    </div>
  );
}
