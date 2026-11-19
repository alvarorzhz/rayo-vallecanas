import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { POSITION_LABEL, fullName, nextSeason, seasonFromSlug, seasonSlug, type Membership, type Player } from "@/lib/squad";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { CapsuleVault } from "@/components/capsule/capsule-vault";
import { PrepareSeasonForm, type Candidate } from "@/components/squad/prepare-season-form";
import { prepareSeason } from "../actions";

export const metadata = { title: "Preparar temporada" };

export default async function PrepareSeasonPage({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const sp = await searchParams;
  await requirePerm("squad", "create");
  const from = seasonFromSlug(sp.desde) ?? seasonOf();
  const to = nextSeason(from);
  const supabase = await createClient();
  const [{ data: rows }, { data: target }, { data: capsule }] = await Promise.all([
    supabase.from("squad_members").select("*, player:players!inner(*)").lte("season", from).order("season", { ascending: false }).returns<(Membership & { player: Player })[]>(),
    supabase.from("squad_members").select("player_id").eq("season", to),
    // 4.24.0 · ¿Ya hay cápsula del tiempo para la temporada nueva?
    supabase.from("time_capsules").select("season").eq("season", to).maybeSingle(),
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
      <Link href={`/partidos/capsula?temporada=${seasonSlug(to)}${capsule ? "" : "&nueva=1"}`} prefetch
        className="group franja relative mx-auto mt-6 flex max-w-2xl items-center gap-4 overflow-hidden rounded-2xl bg-negro p-4 text-white shadow-lg transition hover:shadow-xl">
        <CapsuleVault size={56} className="relative" />
        <span className="relative min-w-0 flex-1">
          <span className="sport block text-xs font-black tracking-[0.2em] text-dorado">CÁPSULA DEL TIEMPO {to}</span>
          <span className="sport block text-xl font-black leading-tight">{capsule ? "Ya está creada" : "Créala para la temporada nueva"}</span>
          <span className="block text-sm text-white/75">Predicciones y mensajes de todo el equipo, bajo llave hasta el último partido.</span>
        </span>
        <span className="relative shrink-0 text-sm font-bold text-dorado transition group-hover:translate-x-0.5">→</span>
      </Link>
    </>
  );
}
