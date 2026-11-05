/** Foto de perfil o, si no hay, las iniciales sobre fondo rojo. */
export function Avatar({ name, url, size = 40, className = "" }: { name: string; url?: string | null; size?: number; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} style={style} className={`shrink-0 rounded-full object-cover ring-2 ring-dorado ${className}`} />;
  return (
    <span aria-hidden style={style} className={`sport inline-flex shrink-0 items-center justify-center rounded-full bg-rojo font-black text-white ring-2 ring-dorado ${className}`}>
      {initials}
    </span>
  );
}
