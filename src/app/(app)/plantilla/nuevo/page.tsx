import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchRoster } from "@/lib/squad-queries";
import { seasonFromSlug, seasonSlug, shirtName } from "@/lib/squad";
import { PageHeader } from "@/components/ui";
import { PlayerForm } from "@/components/squad/player-form";
import { createPlayer } from "../actions";

export const metadata = { title: "Nuevo jugador" };

export default async function NewPlayerPage({ searchParams }: { searchParams: Promise<{ temporada?: string; ok?: string }> }) {
  const sp = await searchParams;
  const s = await requirePerm("squad", "create");
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const supabase = await createClient();
  const roster = await fetchRoster(supabase, season);
  const used = roster
    .filter((r) => r.number != null && r.status !== "left")
    .map((r) => ({ number: r.number!, name: shirtName(r.player) }))
    .sort((a, b) => a.number - b.number);
  return (
    <>
      <PageHeader title="Fichar jugador" subtitle={`Alta en la plantilla de la temporada ${season}`} back={{ href: `/plantilla?temporada=${seasonSlug(season)}`, label: "Plantilla" }} />
      {sp.ok && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">¡Fichado! Puedes dar de alta al siguiente.</p>}
      <PlayerForm key={sp.ok ?? "new"} action={createPlayer} season={season} usedNumbers={used} canCreate={s.can("squad", "create")} canPrivate={s.can("squad_private", "update")} />
    </>
  );
}
