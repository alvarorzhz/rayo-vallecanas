/** Logo de un patrocinador (o sus iniciales si no tiene). */
export function SponsorLogo({ sponsor, className = "" }: { sponsor: { name: string; logo_url: string | null }; className?: string }) {
  if (sponsor.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={sponsor.logo_url} alt={sponsor.name} loading="lazy" className={`max-w-full object-contain ${className}`} />;
  }
  const initials = sponsor.name.split(/\s+/).filter((w) => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <span aria-label={sponsor.name} className="sport text-2xl font-black text-negro/40">{initials || "?"}</span>;
}
