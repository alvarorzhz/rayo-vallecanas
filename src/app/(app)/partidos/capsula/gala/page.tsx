import { redirect } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonFromSlug, seasonSlug } from "@/lib/squad";
import { fetchCapsule, fetchCapsuleSeasons, fetchGala } from "@/lib/capsule-server";
import { CapsuleGala } from "@/components/capsule/capsule-gala";

export const metadata = { title: "Gala de la cápsula" };

/** La gala de apertura a pantalla completa. Si la cápsula aún está cerrada, vuelve a su página. */
export default async function CapsuleGalaPage({ searchParams }: { searchParams: Promise<{ temporada?: string }> }) {
  const sp = await searchParams;
  const s = await requirePerm("matches", "read");
  const supabase = await createClient();
  const season = seasonFromSlug(sp.temporada) ?? (await fetchCapsuleSeasons(supabase))[0];
  const state = season ? await fetchCapsule(supabase, season) : null;
  const back = season ? `/partidos/capsula?temporada=${seasonSlug(season)}` : "/partidos/capsula";
  if (!state || state.stage !== "open") redirect(back);
  const gala = await fetchGala(supabase, state.capsule, s.user.id);
  return <CapsuleGala g={gala} closeHref={back} />;
}
