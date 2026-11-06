import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fetchRoster } from "@/lib/squad-queries";
import { fullName, seasonFromSlug, seasonSlug, shirtName, type Membership, type Player, type PlayerPrivate } from "@/lib/squad";
import { PageHeader } from "@/components/ui";
import { PlayerForm } from "@/components/squad/player-form";
import { updatePlayer } from "../../actions";

export const metadata = { title: "Editar jugador" };

export default async function EditPlayerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ temporada?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requirePerm("squad", "update");
  const canPrivate = s.can("squad_private", "update");
  const season = seasonFromSlug(sp.temporada) ?? seasonOf();
  const supabase = await createClient();
  const [{ data: player }, { data: priv }, { data: member }, roster] = await Promise.all([
    supabase.from("players").select("*").eq("id", id).maybeSingle<Player>(),
    canPrivate ? supabase.from("player_private").select("*").eq("player_id", id).maybeSingle<PlayerPrivate>() : Promise.resolve({ data: null }),
    supabase.from("squad_members").select("*").eq("player_id", id).eq("season", season).maybeSingle<Membership>(),
    fetchRoster(supabase, season),
  ]);
  if (!player) notFound();
  // Si no estaba en esta temporada, se propone lo de su última temporada
  let base = member;
  if (!base) {
    const { data } = await supabase.from("squad_members").select("*").eq("player_id", id).order("season", { ascending: false }).limit(1).returns<Membership[]>();
    base = data?.[0] ? { ...data[0], status: data[0].status === "left" ? "active" : data[0].status } : null;
  }
  const used = roster
    .filter((r) => r.number != null && r.status !== "left" && r.player_id !== id)
    .map((r) => ({ number: r.number!, name: shirtName(r.player) }))
    .sort((a, b) => a.number - b.number);
  return (
    <>
      <PageHeader title={`Editar · ${fullName(player)}`}
        subtitle={member ? `Datos de la temporada ${season}` : `No estaba en la plantilla ${season}: al guardar se añade`}
        back={{ href: `/plantilla/${id}?temporada=${seasonSlug(season)}`, label: "Ficha" }} />
      <PlayerForm action={updatePlayer.bind(null, id)} season={season} player={player} member={base} priv={priv} usedNumbers={used} canPrivate={canPrivate} />
    </>
  );
}
