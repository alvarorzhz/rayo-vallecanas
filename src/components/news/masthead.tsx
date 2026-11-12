import Link from "next/link";
import { NEWS_NAME } from "@/lib/news";

const dayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });
const shortFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });

/** Texto del sello de la edición: «Recién salido» si hay pieza de las últimas 48 h; si no, la fecha de la última. */
export function editionStamp(lastPublished: string | null | undefined, now = Date.now()): string | null {
  if (!lastPublished) return null;
  const at = new Date(lastPublished);
  if (now - at.getTime() < 48 * 3_600_000) return "¡Recién salido!";
  return `Edición del ${shortFmt.format(at).replace(".", "")}`;
}

/** La cabecera del periódico: nombre entre filetes, número y fecha. Con `stamp`, el sello de la edición y el rayo que se enciende. */
export function Masthead({ count, size = "lg", href, stamp }: { count?: number; size?: "lg" | "sm"; href?: string; stamp?: string | null }) {
  const date = dayFmt.format(new Date());
  const title = (
    <span className={`masthead-title block text-center ${size === "lg" ? "text-[2.6rem] sm:text-6xl lg:text-7xl" : "text-[2rem] sm:text-5xl"}`}>
      La Voz <span className={`bolt${stamp !== undefined ? " bolt-on" : ""}`}>⚡</span> del Rayo
    </span>
  );
  return (
    <div className="relative">
      <header className="press-in">
        <div className="news-meta flex items-center justify-between gap-2 pb-1.5">
          <span>{count ? `Nº ${count}` : "Edición digital"}</span>
          <span className="hidden sm:inline">Periódico del Rayo Vallecañas</span>
          <span>Salamanca</span>
        </div>
        <div className="masthead-rule" />
        <div className="py-2.5 sm:py-3">
          {href ? <Link href={href} prefetch aria-label={NEWS_NAME} className="block hover:opacity-90">{title}</Link> : <h1>{title}</h1>}
        </div>
        <div className="masthead-rule" />
        <p className="news-meta pt-1.5 text-center first-letter:uppercase">{date}</p>
      </header>
      {stamp && <span className={`news-stamp ${size === "lg" ? "lg" : "sm"}`}>{stamp}</span>}
    </div>
  );
}
