import Link from "next/link";
import { Lock, PartyPopper, Settings } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fecha, fechaLarga } from "@/lib/format";
import { madridDay } from "@/lib/dates";
import { nextSeason, seasonFromSlug, seasonSlug } from "@/lib/squad";
import { plural } from "@/lib/stats-board";
import { defaultDates, numberText, untilLabel, MAX_MESSAGES, QUESTION, QUESTIONS } from "@/lib/capsule";
import { fetchCapsule, fetchCapsuleSeasons, fetchGala, fetchMine, fetchPickPlayers } from "@/lib/capsule-server";
import { PageHeader } from "@/components/ui";
import { CapsuleVault } from "@/components/capsule/capsule-vault";
import { CapsuleSettingsForm, MessageForm, MyMessage, PredictionsForm, type Pick } from "@/components/capsule/capsule-forms";

export const metadata = { title: "Cápsula del tiempo" };

type SP = { temporada?: string; nueva?: string; creada?: string };

/** Fechas por defecto para crear la cápsula de una temporada, con el calendario que haya. */
async function proposal(supabase: Awaited<ReturnType<typeof createClient>>, season: string) {
  const { data } = await supabase.from("matches").select("match_date").eq("season", season).neq("status", "cancelled").order("match_date");
  const days = (data ?? []).map((r) => r.match_date as string);
  return defaultDates(season, days[0] ?? null, days.at(-1) ?? null, madridDay());
}

export default async function CapsulePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await requirePerm("matches", "read");
  const supabase = await createClient();
  const canManage = s.can("squad", "create");
  const seasons = await fetchCapsuleSeasons(supabase);
  const asked = seasonFromSlug(sp.temporada);
  const season = asked ?? seasons[0] ?? null;
  const state = season ? await fetchCapsule(supabase, season) : null;
  const current = seasonOf();
  const creatable = [current, nextSeason(current)].filter((x) => !seasons.includes(x));

  const seasonNav = seasons.length > 1 && (
    <nav aria-label="Temporadas" className="mb-4 flex flex-wrap gap-2">
      {seasons.map((x) => (
        <Link key={x} href={`/partidos/capsula?temporada=${seasonSlug(x)}`} prefetch
          className={`sport rounded-full px-3 py-1 text-sm font-black ring-1 ${x === season ? "tab-on bg-negro text-white ring-negro" : "bg-white ring-black/10"}`}>{x}</Link>
      ))}
    </nav>
  );

  // ── Sin cápsula: qué es y, para los gestores, crearla ──────────────────────────
  if (!state) {
    const target = asked && creatable.includes(asked) ? asked : creatable.includes(nextSeason(current)) && sp.nueva ? nextSeason(current) : creatable[0];
    const dates = target ? await proposal(supabase, target) : null;
    return (
      <>
        <PageHeader title="Cápsula del tiempo" subtitle="Mensajes y predicciones bajo llave hasta el final de la temporada"
          back={{ href: "/partidos", label: "Partidos" }} />
        {seasonNav}
        <div className="mx-auto max-w-2xl space-y-5">
          <section className="franja relative overflow-hidden rounded-3xl bg-negro p-6 text-white shadow-xl">
            <div className="relative flex items-center gap-5">
              <CapsuleVault size={96} />
              <div className="min-w-0">
                <p className="sport text-xs font-black tracking-[0.25em] text-dorado">CÓMO FUNCIONA</p>
                <p className="mt-1 text-sm leading-relaxed text-white/85">Al empezar la temporada cada uno escribe sus predicciones (pichichi, puesto final, goles…) y mensajes al equipo, a un compañero o a sí mismo. Se guardan bajo llave: <b>nadie puede leerlos, ni los gestores</b>. El día del último partido se abren todos a la vez en una gala y se ve quién fue el pitoniso.</p>
              </div>
            </div>
          </section>
          {canManage && target && dates ? (
            <section className="card space-y-3 p-4">
              <h2 className="sport text-2xl font-black">Crear la cápsula {target}</h2>
              <CapsuleSettingsForm isNew season={target} seasons={creatable} writeUntil={dates.writeUntil} opensOn={dates.opensOn} />
            </section>
          ) : (
            <p className="rounded-2xl bg-white p-4 text-sm text-negro/70 ring-1 ring-black/10">Todavía no hay cápsula{asked ? ` para la temporada ${asked}` : ""}. La crean los gestores al preparar la temporada.</p>
          )}
        </div>
      </>
    );
  }

  const { capsule, stage, opensAt, counts } = state;

  // ── Abierta: la gala y todo lo que se escribió ─────────────────────────────────
  if (stage === "open") {
    const gala = await fetchGala(supabase, capsule, s.user.id);
    const galaHref = `/partidos/capsula/gala?temporada=${seasonSlug(capsule.season)}`;
    return (
      <>
        <PageHeader title={`Cápsula ${capsule.season}`} subtitle={<>Abierta el <b>{fechaLarga(opensAt)}</b></>} back={{ href: "/partidos", label: "Partidos" }} />
        {seasonNav}
        <div className="mx-auto max-w-2xl space-y-6">
          <Link href={galaHref} prefetch className="group franja relative flex items-center gap-4 overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl transition hover:-translate-y-0.5">
            <CapsuleVault state="open" size={84} />
            <span className="relative min-w-0 flex-1">
              <span className="sport block text-xs font-black tracking-[0.25em] text-dorado">¡SE ABRIÓ LA CÁPSULA!</span>
              <span className="sport block text-3xl font-black leading-tight">Ver la gala</span>
              <span className="block text-sm text-white/75">{gala.writers} {plural(gala.writers, "persona", "personas")} · {gala.messages.length} {plural(gala.messages.length, "mensaje", "mensajes")}</span>
            </span>
            <PartyPopper className="relative shrink-0 text-dorado transition group-hover:scale-110" />
          </Link>

          {gala.seers.length > 0 && (
            <section>
              <h2 className="sport mb-2 text-2xl font-black">El pitoniso</h2>
              <ol className="card divide-y divide-black/5 p-0">
                {gala.seers.map((r) => (
                  <li key={r.user_id} className={`flex items-center gap-3 px-3 py-2 text-sm ${r.me ? "bg-dorado/15 font-bold" : ""}`}>
                    <span className="w-6 tabular-nums text-negro/60">{r.pos}º</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                    <span className="text-xs text-negro/60">{r.hits} ✅{r.closes ? ` · ${r.closes} 🤏` : ""}</span>
                    <span className="sport w-12 text-right text-lg font-black tabular-nums">{r.points}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {gala.questions.length > 0 && (
            <section>
              <h2 className="sport mb-2 text-2xl font-black">Predicciones contra la realidad</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {gala.questions.map((q) => (
                  <article key={q.key} className="card p-3">
                    <p className="text-sm font-bold">{q.emoji} {q.label}</p>
                    <p className="sport text-xl font-black text-rojo">{q.truth ?? "Sin datos"}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {q.picks.map((p) => (
                        <li key={p.user} className={`flex justify-between gap-2 ${p.me ? "font-bold" : ""}`}>
                          <span className="min-w-0 truncate">{p.name}: {p.answer}</span>
                          <span aria-hidden>{p.verdict?.hit === "exact" ? "✅" : p.verdict?.hit === "close" ? "🤏" : p.verdict ? "❌" : ""}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          )}

          {gala.messages.length > 0 && (
            <section>
              <h2 className="sport mb-2 text-2xl font-black">Los mensajes</h2>
              <ul className="space-y-3">
                {gala.messages.map((m) => (
                  <li key={m.id} className={`capsule-note rounded-2xl p-4 ring-1 ${m.toMe ? "ring-dorado" : "ring-black/10"}`}>
                    <p className="text-[11px] font-black uppercase tracking-wider text-rojo">{m.self ? `${m.from}, para sí mismo` : `Para ${m.to ?? "todo el equipo"}`}{m.toMe ? " · 📬 para ti" : ""}</p>
                    <p className="mt-1 whitespace-pre-wrap font-serif text-lg leading-relaxed">{m.body}</p>
                    <p className="mt-2 text-right text-sm font-bold">— {m.from}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {canManage && (
            <details className="card p-4">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold"><Settings size={15} /> Ajustes de la cápsula</summary>
              <div className="mt-3"><CapsuleSettingsForm season={capsule.season} writeUntil={madridDay(new Date(capsule.write_until))} opensOn={capsule.opens_on} finalPosition={capsule.final_position} isNew={false} open /></div>
            </details>
          )}
        </div>
      </>
    );
  }

  // ── Cerrada (se escribe o se espera a la gala): solo lo mío ─────────────────────
  const [mine, pickers] = await Promise.all([fetchMine(supabase, capsule.season, s.user.id), fetchPickPlayers(supabase, capsule.season)]);
  const players: Pick[] = pickers.map((p) => ({ id: p.id, name: p.name, number: p.number, me: p.userId === s.user.id }));
  const nameOf = new Map(pickers.map((p) => [p.id, p]));
  const writing = stage === "writing";
  const toLabel = (id: string | null) => !id ? "todo el equipo" : nameOf.get(id)?.userId === s.user.id ? "ti mismo (del futuro)" : nameOf.get(id)?.name ?? "un compañero";
  const empty = counts.messages + counts.predictions === 0;

  return (
    <>
      <PageHeader title={`Cápsula ${capsule.season}`} subtitle="Bajo llave hasta el final de la temporada" back={{ href: "/partidos", label: "Partidos" }} />
      {seasonNav}
      <div className="mx-auto max-w-2xl space-y-6">
        {sp.creada && <p className="flash rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-800">Cápsula creada. Ya puede escribir todo el equipo.</p>}
        <section className="franja relative overflow-hidden rounded-3xl bg-negro p-5 text-white shadow-xl">
          <div className="relative flex items-center gap-5">
            <CapsuleVault size={104} />
            <div className="min-w-0 flex-1">
              <p className="sport text-xs font-black tracking-[0.25em] text-dorado">CÁPSULA DEL TIEMPO</p>
              {writing ? (
                <>
                  <p className="sport text-3xl font-black leading-none">Abierta para escribir</p>
                  <p className="mt-1 text-sm text-white/75">Hasta el <b className="text-white">{fecha(capsule.write_until, true)}</b> ({untilLabel(capsule.write_until)}).</p>
                </>
              ) : (
                <>
                  <p className="sport text-3xl font-black leading-none">Cerrada bajo llave</p>
                  <p className="mt-1 text-sm text-white/75">Ya no se puede escribir.</p>
                </>
              )}
              <p className="mt-1 text-sm text-white/75">Se abre en la gala del <b className="text-white">{fechaLarga(opensAt)}</b>{opensAt ? ` (${untilLabel(opensAt)})` : ""}.</p>
            </div>
          </div>
          <p className="relative mt-4 rounded-xl bg-white/[0.07] px-3 py-2 text-sm text-white/85">
            🔒 {counts.writers ? <>{counts.writers} {plural(counts.writers, "persona ha", "personas han")} guardado {counts.messages} {plural(counts.messages, "mensaje", "mensajes")} y {counts.predictions} {plural(counts.predictions, "predicción", "predicciones")}.</> : "Todavía no ha escrito nadie: ¡estrénala!"} Nadie puede leerlos hasta la gala, tampoco los gestores.
          </p>
        </section>

        {writing ? (
          <>
            <section>
              <h2 className="sport mb-1 text-2xl font-black">Tus predicciones</h2>
              <p className="mb-3 text-sm text-negro/65">Puedes cambiarlas hasta que se cierre la cápsula. Deja en blanco las que no quieras mojarte.</p>
              <PredictionsForm season={capsule.season} players={players} mine={mine.preds} />
            </section>
            <section>
              <h2 className="sport mb-1 text-2xl font-black">Tus mensajes</h2>
              <p className="mb-3 text-sm text-negro/65">Para todo el equipo, para un compañero o para ti mismo cuando acabe la temporada. Hasta {MAX_MESSAGES}.</p>
              {mine.msgs.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {mine.msgs.map((m) => <MyMessage key={m.id} season={capsule.season} players={players} msg={m} to={toLabel(m.to_player_id)} editable />)}
                </ul>
              )}
              <div className="card p-4"><MessageForm season={capsule.season} players={players} count={mine.msgs.length} /></div>
            </section>
          </>
        ) : (
          <section className="space-y-3">
            <h2 className="sport text-2xl font-black">Lo que dejaste dentro</h2>
            {mine.preds.length + mine.msgs.length === 0 ? (
              <p className="rounded-2xl bg-white p-4 text-sm text-negro/65 ring-1 ring-black/10">No dejaste nada en esta cápsula. En la gala podrás leer lo de los demás.</p>
            ) : (
              <>
                {mine.preds.length > 0 && (
                  <ul className="card relative divide-y divide-black/5 p-0">
                    <span className="cap-stamp absolute right-3 top-2 text-xs text-rojo">BAJO LLAVE</span>
                    {QUESTIONS.filter((q) => mine.preds.some((p) => p.question === q.key)).map((q) => {
                      const p = mine.preds.find((x) => x.question === q.key)!;
                      return (
                        <li key={q.key} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span>{q.emoji} {QUESTION[q.key].label}</span>
                          <b>{p.player_id ? nameOf.get(p.player_id)?.name ?? "—" : numberText(q, p.number ?? 0)}</b>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {mine.msgs.length > 0 && <ul className="space-y-2">{mine.msgs.map((m) => <MyMessage key={m.id} season={capsule.season} players={players} msg={m} to={toLabel(m.to_player_id)} editable={false} />)}</ul>}
              </>
            )}
          </section>
        )}

        <p className="flex items-start gap-2 text-xs text-negro/60"><Lock size={14} className="mt-0.5 shrink-0 text-rojo" />
          Lo que escribes solo lo ves tú hasta la gala: la base de datos no deja que nadie más lo lea, ni desde la app ni desde la copia de seguridad. Se abre sola el día de la gala, y nunca antes de que acabe el último partido de la temporada.</p>

        {canManage && (
          <details className="card p-4" open={!!sp.nueva}>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold"><Settings size={15} /> Ajustes de la cápsula (gestores)</summary>
            <div className="mt-3"><CapsuleSettingsForm season={capsule.season} writeUntil={madridDay(new Date(capsule.write_until))} opensOn={capsule.opens_on} isNew={false} empty={empty} /></div>
            <p className="mt-2 text-xs text-negro/55">Los gestores tampoco pueden leer nada antes de la gala: solo cambiar las fechas.</p>
          </details>
        )}
      </div>
    </>
  );
}
