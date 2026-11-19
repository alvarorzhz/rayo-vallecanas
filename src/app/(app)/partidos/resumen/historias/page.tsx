import { redirect } from "next/navigation";
import { getSession, requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fetchMyPlayerId } from "@/lib/match-queries";
import { loadWrapped } from "@/lib/wrapped-server";
import { WrappedStories } from "@/components/matches/wrapped-stories";

export const metadata = { title: "Rayo Wrapped" };

/** Rayo Wrapped (4.23.0): la temporada de un jugador en historias. ?de=alcance&jugador=id (sin jugador, el tuyo). */
export default async function WrappedPage({ searchParams }: { searchParams: Promise<{ de?: string; jugador?: string }> }) {
  const sp = await searchParams;
  await requirePerm("matches", "read");
  const [s, supabase] = await Promise.all([getSession(), createClient()]);
  const back = (de?: string, jugador?: string) => `/partidos/resumen?${new URLSearchParams({ ...(de ? { de } : {}), ...(jugador ? { jugador } : {}) })}`;
  const playerId = sp.jugador && /^[0-9a-f-]{36}$/.test(sp.jugador) ? sp.jugador : await fetchMyPlayerId(supabase, s.user.id);
  if (!playerId) redirect(back(sp.de));
  const w = await loadWrapped(supabase, playerId, sp.de, s.user.id);
  if (!w) redirect(back(sp.de, playerId));

  const m = w.summary;
  const totals = w.gk
    ? [{ label: "Partidos", value: m.apps }, { label: "A cero", value: m.cleanSheets }, { label: "Encajados", value: m.conceded }, { label: "MVP", value: m.mvps }]
    : [{ label: "Partidos", value: m.apps }, { label: "Goles", value: m.goals }, { label: "Asist.", value: m.assists }, { label: "MVP", value: m.mvps }];
  return (
    <WrappedStories
      slides={w.slides}
      // El cromo con las cifras de este resumen (las de la ficha son de toda la temporada)
      entry={{ ...w.entry, apps: m.apps, goals: m.goals, assists: m.assists, mvps: m.mvps, yellows: m.yellows, reds: m.reds, conceded: m.conceded, clean_sheets: m.cleanSheets }}
      imgBase={`/api/resumen/${playerId}/${w.slug}`}
      fileBase={w.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}
      backHref={back(w.slug, playerId)}
      scope={w.scopeLabel[0].toUpperCase() + w.scopeLabel.slice(1)}
      totals={totals}
      you={w.entry.player.user_id === s.user.id}
    />
  );
}
