/** Balón de fútbol (SVG): blanco con pentágonos negros. */
export function Ball({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className={className}>
      <defs>
        <radialGradient id="rv-ball" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#e9e9e9" />
          <stop offset="100%" stopColor="#bdbdbd" />
        </radialGradient>
        <clipPath id="rv-ball-clip"><circle cx="50" cy="50" r="47" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="47" fill="url(#rv-ball)" stroke="#080808" strokeWidth="3" />
      <g clipPath="url(#rv-ball-clip)" fill="#080808" stroke="#080808" strokeWidth="2.5" strokeLinejoin="round">
        <polygon points="50,33 66,45 60,64 40,64 34,45" />
        <polygon points="50,-6 64,4 58,20 42,20 36,4" />
        <polygon points="96,38 104,54 94,68 82,58 84,42" />
        <polygon points="4,38 -4,54 6,68 18,58 16,42" />
        <polygon points="72,86 84,92 80,108 64,106 62,92" />
        <polygon points="28,86 16,92 20,108 36,106 38,92" />
        <path d="M50 33 V20 M66 45 L84 42 M60 64 L66 90 M40 64 L34 90 M34 45 L16 42" fill="none" />
      </g>
    </svg>
  );
}
