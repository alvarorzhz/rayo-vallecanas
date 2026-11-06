import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMatch } from "@/lib/match-queries";
import { CLUB_NAME, COMPETITION_LABEL, kickoffDate, mapsLink } from "@/lib/matches";

/** Archivo .ics para añadir el partido al calendario del móvil (Google, Apple, Outlook). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return new NextResponse("Sin sesión", { status: 401 });
  const m = await fetchMatch(supabase, id);
  if (!m) return new NextResponse("No encontrado", { status: 404 });

  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const title = m.is_home ? `⚽ ${CLUB_NAME} vs ${m.rival.name}` : `⚽ ${m.rival.name} vs ${CLUB_NAME}`;
  const desc = [COMPETITION_LABEL[m.competition] + (m.round ? ` · ${m.round}` : ""), m.notes, mapsLink(m)].filter(Boolean).join("\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rayo Vallecañas//Partidos//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:partido-${m.id}@rayo-vallecanas.vercel.app`, `DTSTAMP:${stamp(new Date())}`];
  if (m.kickoff) {
    const start = kickoffDate(m);
    // Fútbol 7: dos partes de 25-30 minutos; se reserva hora y media
    lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 90 * 60000))}`);
  } else {
    const d = m.match_date.replace(/-/g, "");
    const next = new Date(`${m.match_date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`);
  }
  lines.push(`SUMMARY:${esc(title)}`);
  if (m.venue) lines.push(`LOCATION:${esc(m.venue)}`);
  if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
  lines.push("BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR");

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="partido-${m.match_date}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
