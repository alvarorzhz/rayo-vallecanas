import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { POSITION_LABEL, fullName, nextSeason, seasonFromSlug, seasonSlug, type Membership, type Player } from "@/lib/squad";
import { PageHeader } from "@/components/ui";
import { PrepareSeasonForm, type Candidate } from "@/components/squad/prepare-season-form";
import { prepareSeason } from "../actions";

export const metadata = { title: "Preparar temporada" };

export default async function PrepareSeasonPage({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const sp = await searchParams;
  await requirePerm("squad", "create");
  const from = seasonFromSlug(sp.desde) ?? seasonOf();
  const to = nextSeason(from);
  const supabase = await createClient();
  const [{ data: rows }, { data: target }] = await Promise.all([
    supabase.from("squad_members").select("*, player:players!inner(*)").lte("season", from).order("season", { ascending: false }).returns<(Membership & { player: Player })[]>(),
    supabase.from("squad_members").select("player_id").eq("season", to),
  ]);
  const already = new Set((target ?? []).map((r) => r.player_id));
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const m of rows ?? []) {
    if (seen.has(m.player_id)) continue;
    seen.add(m.player_id);
    if (already.has(m.player_id)) continue;
    const group: Candidate["group"] = m.season !== from ? "former" : m.status === "left" ? "left" : "squad";
    candidates.push({
      id: m.player_id,
      name: fullName(m.player),
      sub: group === "former" ? `Última temporada: ${m.season}` : `${m.number != null ? `#${m.number} · ` : ""}${POSITION_LABEL[m.position] ?? m.position}`,
      number: m.number,
      position: m.position,
      photo: m.player.photo_url,
      checked: group === "squad",
      group,
    });
  }
  candidates.sort((a, b) => (a.number ?? 100) - (b.number ?? 100) || a.name.localeCompare(b.name, "es"));
  return (
    <>
      <PageHeader title={`Preparar temporada ${to}`} subtitle={`Elige quién sigue de la temporada ${from}. Los fichajes nuevos se añaden después.`}
        back={{ href: `/plantilla?temporada=${seasonSlug(from)}`, label: "Plantilla" }} />
      {already.size > 0 && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Ya hay {already.size} jugadores en la temporada {to}; no aparecen en la lista.</p>}
      {candidates.length ? (
        <PrepareSeasonForm action={prepareSeason} from={from} to={to} candidates={candidates} />
      ) : (
        <p className="text-sm text-negro/60">No hay jugadores que copiar.</p>
      )}
    </>
  );
}
