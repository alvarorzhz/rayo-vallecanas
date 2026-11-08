import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, ClipboardList, Cross, FolderLock, Mail, Pencil, Phone, Plane, ShieldAlert, Unlink, UserCheck, Wallet } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { euros, fecha, phoneE164, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { fetchFees } from "@/lib/squad-queries";
import {
  ARMBAND_LABEL, FEE_STATUS_LABEL, FEE_STATUS_TONE, FOOT_LABEL, LINE_LABEL, STATUS_LABEL, STATUS_TONE,
  ageOf, feeOf, feeStatus, fullName, lineOf, ratio, seasonFromSlug, seasonSlug, shirtName, sumStats,
  type Membership, type Player, type PlayerDocument, type PlayerPrivate,
} from "@/lib/squad";
import { OutcomeDot } from "@/components/matches/match-bits";
import { shortDay, type MatchRow } from "@/lib/matches";
import type { Appearance } from "@/lib/reports";
import { REPLY_LABEL, REPLY_TONE, callupRecord, type Callup } from "@/lib/callups";
import { Avatar } from "@/components/avatar";
import { AvatarUpload } from "@/components/avatar-upload";
import { Jersey } from "@/components/squad/jersey";
import { Armband, FutCard, PositionChip } from "@/components/squad/player-card";
import { CreateAccessForm, DeletePlayerForm, LinkUserForm, MyContactForm, RetireForm } from "@/components/squad/squad-forms";
import { PlayerDocs } from "@/components/squad/player-docs";
import { FeeBar } from "@/components/squad/fee-bar";
import { FeeOverrideForm, FeePaymentForm } from "@/components/squad/fee-forms";
import { CountUp } from "@/components/squad/count-up";
import { createAccess, deletePlayer, deletePlayerDoc, linkUser, rejoinPlayer, removePlayerPhoto, retirePlayer, savePlayerDoc, unlinkUser, updateMyContact, uploadPlayerPhoto } from "../actions";
import { registerFeePayment, saveFeeOverride } from "../cuotas/actions";

export const metadata = { title: "Ficha del jugador" };

type Own = { birth_date: string | null; phone: string | null; email: string | null; emergency_name: string | null; emergency_phone: string | null };

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ temporada?: string; ok?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requirePerm("squad", "read");
  const supabase = await createClient();
  const isManager = s.can("squad", "update");
  const canPrivate = s.can("squad_private", "read");
  const canFees = s.can("finances", "read");

  const [{ data: player }, { data: history }, { data: priv }] = await Promise.all([
    supabase.from("players").select("*").eq("id", id).maybeSingle<Player>(),
    supabase.from("squad_members_full").select("*").eq("player_id", id).order("season", { ascending: false }).returns<Membership[]>(),
    canPrivate ? supabase.from("player_private").select("*").eq("player_id", id).maybeSingle<PlayerPrivate>() : Promise.resolve({ data: null }),
  ]);
  if (!player) notFound();
  const isMe = player.user_id === s.user.id;
  const showDocs = canPrivate || isMe;
  const { data: docs } = showDocs
    ? await supabase.from("player_documents").select("*").eq("player_id", id).order("created_at", { ascending: false }).returns<PlayerDocument[]>()
    : { data: [] as PlayerDocument[] };
  const deletable = (docs ?? []).filter((d) => s.can("squad_private", "delete") || (isMe && d.uploaded_by === s.user.id)).map((d) => d.id);
  const own = isMe ? ((await supabase.rpc("squad_my_private")).data as Own | null) : null;
  const contact: Own | null = priv ?? own;

  const wanted = seasonFromSlug(sp.temporada) ?? seasonOf();
  const seasons = history ?? [];
  const member = seasons.find((m) => m.season === wanted) ?? seasons[0] ?? null;
  const season = member?.season ?? wanted;
  const line = member ? lineOf(member.position) : null;
  const age = ageOf(contact?.birth_date);
  const back = `/plantilla?temporada=${seasonSlug(season)}`;
  const total = sumStats(seasons);
  const today = new Date().toISOString().slice(0, 10);
  const fees = canFees && member ? await fetchFees(supabase, season, id) : null;
  // Partidos de la temporada según las actas
  const { data: appsData } = await supabase.from("match_appearances").select("*, match:matches!inner(*, rival:rivals!inner(*))")
    .eq("player_id", id).eq("match.season", season).eq("match.status", "played").returns<(Appearance & { match: MatchRow })[]>();
  const log = (appsData ?? []).sort((a, b) => b.match.match_date.localeCompare(a.match.match_date));
  const { data: myGoals } = log.length
    ? await supabase.from("match_goals").select("match_id, scorer_id, assist_id").in("match_id", log.map((a) => a.match_id)).or(`scorer_id.eq.${id},assist_id.eq.${id}`)
    : { data: [] as { match_id: string; scorer_id: string | null; assist_id: string | null }[] };
  const gOf = (mid: string) => (myGoals ?? []).filter((g) => g.match_id === mid && g.scorer_id === id).length;
  const aOf = (mid: string) => (myGoals ?? []).filter((g) => g.match_id === mid && g.assist_id === id).length;
  // Historial de convocatorias de la temporada (partidos ya jugados o suspendidos)
  const { data: callupData } = await supabase.from("match_callups").select("id, match_id, reply, reply_note, match:matches!inner(*, rival:rivals!inner(*))")
    .eq("player_id", id).eq("match.season", season).in("match.status", ["played", "cancelled"]).not("match.callup_published_at", "is", null)
    .returns<(Pick<Callup, "id" | "match_id" | "reply" | "reply_note"> & { match: MatchRow })[]>();
  const playedIds = new Set(log.map((a) => a.match_id));
  const callupLog = (callupData ?? []).sort((a, b) => b.match.match_date.localeCompare(a.match.match_date))
    .map((c) => ({ ...c, played: c.match.status === "played" && c.match.report_saved_at ? playedIds.has(c.match_id) : null }));
  const cRec = callupRecord(callupLog.filter((c) => c.match.status === "played"));
  const feeDue = fees ? feeOf(fees.plan, fees.overrides.get(id)) : null;
  const feePaid = fees?.paid.get(id) ?? 0;

  // Usuario vinculado y usuarios libres para vincular (solo gestores con acceso a Usuarios)
  const canUsers = s.can("users", "read") && isManager;
  let linked: { id: string; full_name: string; email: string | null; avatar_url: string | null; active: boolean } | null = null;
  let free: { id: string; full_name: string; email: string | null }[] = [];
  if (canUsers) {
    const [{ data: lk }, { data: all }, { data: taken }] = await Promise.all([
      player.user_id ? supabase.from("profiles").select("id, full_name, email, avatar_url, active").eq("id", player.user_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("profiles").select("id, full_name, email").eq("active", true).order("full_name"),
      supabase.from("players").select("user_id").not("user_id", "is", null),
    ]);
    linked = lk;
    const used = new Set((taken ?? []).map((t) => t.user_id));
    free = (all ?? []).filter((u) => !used.has(u.id));
  }

  return (
    <>
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-negro/65 hover:text-rojo">← Plantilla</Link>
      {sp.ok && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{sp.ok === "1" ? "¡Jugador fichado!" : "Cambios guardados."}</p>
      )}

      {/* Cabecera de la ficha */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-negro text-white shadow-2xl">
        <div aria-hidden className={`absolute inset-0 ${line === "GK" ? "bg-[linear-gradient(150deg,#3a2f0b_0%,#080808_60%)]" : "bg-[linear-gradient(150deg,#3b0609_0%,#080808_60%)]"}`} />
        <div aria-hidden className="anim-sweep absolute inset-0 bg-[linear-gradient(115deg,transparent_0_60%,var(--color-rojo)_60%_73%,var(--color-dorado)_73%_75%,transparent_75%)] opacity-80" />
        {member?.number != null && (
          <span aria-hidden className="anim-number-in sport pointer-events-none absolute -bottom-10 right-2 select-none text-[13rem] font-black leading-none text-white/[0.07] sm:right-8 sm:text-[17rem]">
            {member.number}
          </span>
        )}
        <div className="relative flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="anim-deal group w-52 shrink-0 drop-shadow-[0_18px_24px_rgba(0,0,0,0.6)] sm:w-60" style={{ animationDelay: "120ms" }}>
            {member ? (
              <FutCard entry={{ ...member, player }} size="lg" />
            ) : player.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.photo_url} alt="" className="aspect-square w-full rounded-3xl object-cover ring-4 ring-dorado" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-3xl bg-white/5 ring-4 ring-dorado/60"><Jersey number={null} size={120} /></div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {member && <PositionChip code={member.position} long />}
              {member && (
                <span className={`badge ${STATUS_TONE[member.status]}`}>
                  {member.status === "injured" && <Cross size={11} className="mr-1" strokeWidth={3} />}
                  {member.status === "away" && <Plane size={11} className="mr-1" />}
                  {STATUS_LABEL[member.status]}
                </span>
              )}
              {member?.armband && <span className="badge bg-rojo text-white">{ARMBAND_LABEL[member.armband]}</span>}
            </div>
            <h1 className="anim-rise sport mt-2 text-5xl leading-[0.85] font-black sm:text-6xl">
              {member?.number != null && <span className="mr-2 text-dorado">{member.number}</span>}
              {shirtName(player)}
            </h1>
            <p className="mt-2 text-white/70">{fullName(player)}</p>
            {/* Perfil del jugador */}
            <dl className="mt-5 grid max-w-xl grid-cols-2 gap-x-4 gap-y-3 text-left sm:grid-cols-3">
              {[
                ["Línea", line ? LINE_LABEL[line] : "–"],
                ["Pierna", player.foot ? FOOT_LABEL[player.foot] : "–"],
                ["Altura", player.height_cm ? `${(player.height_cm / 100).toFixed(2).replace(".", ",")} m` : "–"],
                ["Edad", age != null ? `${age} años` : "–"],
                ["En el club", player.joined_club_on ? `desde ${player.joined_club_on.slice(0, 4)}` : "–"],
                ["Temporadas", seasons.length || "–"],
              ].map(([k, v], i) => (
                <div key={k} className="anim-rise border-l-2 border-dorado/70 pl-2" style={{ animationDelay: `${250 + i * 60}ms` }}>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-white/50">{k}</dt>
                  <dd className="sport truncate text-lg font-black leading-tight">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          {isManager && (
            <div className="flex gap-2 sm:self-start">
              <Link href={`/plantilla/${id}/editar?temporada=${seasonSlug(season)}`} prefetch className="btn-primary"><Pencil size={16} /> Editar</Link>
            </div>
          )}
        </div>
      </section>

      {/* Estadísticas de la temporada */}
      {member && (
        <section className="mb-6">
          <h2 className="sport mb-3 text-2xl font-black">Temporada {member.season}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {(line === "GK"
              ? [["Partidos", member.apps, null], ["Porterías a cero", member.clean_sheets, null], ["Encajados", member.conceded, `${ratio(member.conceded, member.apps)} por partido`], ["MVP", member.mvps, "mejor del partido"]]
              : [["Partidos", member.apps, null], ["Goles", member.goals, `${ratio(member.goals, member.apps)} por partido`], ["Asistencias", member.assists, null], ["MVP", member.mvps, "mejor del partido"]]
            ).map(([k, v, hint], i) => (
              <div key={String(k)} style={{ animationDelay: `${i * 90}ms` }} className={`anim-score relative col-span-1 overflow-hidden rounded-2xl p-4 shadow-sm sm:col-span-1 lg:col-span-2 ${i === 1 ? "bg-gradient-to-br from-rojo to-rojo-oscuro text-white" : i === 0 ? "bg-gradient-to-br from-negro-2 to-negro text-white" : "bg-white ring-1 ring-black/5"}`}>
                <span aria-hidden className={`absolute -right-3 top-0 h-full w-6 -skew-x-[20deg] ${i === 1 ? "bg-white/25" : i === 0 ? "bg-rojo" : "bg-dorado"}`} />
                <div className={`relative text-[11px] font-bold uppercase tracking-wider ${i < 2 ? "text-white/70" : "text-negro/65"}`}>{k}</div>
                <div className="sport relative mt-1 text-4xl leading-none font-black sm:text-5xl"><CountUp value={Number(v)} /></div>
                {hint && <div className={`relative mt-1 text-xs ${i < 2 ? "text-white/70" : "text-negro/65"}`}>{hint}</div>}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-black/5"><span className="anim-card-show inline-block h-3.5 w-2.5 rounded-sm bg-amber-400" /> {member.yellows} {member.yellows === 1 ? "amarilla" : "amarillas"}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-black/5"><span className="anim-card-show inline-block h-3.5 w-2.5 rounded-sm bg-rojo" style={{ animationDelay: "150ms" }} /> {member.reds} {member.reds === 1 ? "roja" : "rojas"}</span>
            {line !== "GK" && member.apps > 0 && <span className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-black/5">{member.goals + member.assists} goles + asistencias</span>}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {log.length > 0 && (
            <section className="card">
              <h2 className="mb-3">Sus partidos {season}</h2>
              <ol className="space-y-1.5">
                {log.map((a) => {
                  const g = gOf(a.match_id), as = aOf(a.match_id), m = a.match;
                  return (
                    <li key={a.id}>
                      <Link href={`/partidos/${m.id}`} prefetch={false} className="flex items-center gap-2 rounded-xl bg-gris px-2 py-1.5 text-sm transition hover:ring-1 hover:ring-rojo/40">
                        <OutcomeDot m={m} size="sm" />
                        <span className="w-20 shrink-0 text-xs text-negro/65">{shortDay(m.match_date)}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{m.is_home ? "vs" : "en"} {m.rival.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs font-bold">
                          {g > 0 && <span title={`${g} goles`}>⚽{g > 1 ? `×${g}` : ""}</span>}
                          {as > 0 && <span title={`${as} asistencias`} className="rounded bg-sky-100 px-1 text-sky-800">A{as > 1 ? `×${as}` : ""}</span>}
                          {a.goalkeeper && <span title="Goles encajados">🧤{a.conceded}</span>}
                          {a.yellows > 0 && <span>{"🟨".repeat(a.yellows)}</span>}
                          {a.red && <span>🟥</span>}
                          {m.mvp_player_id === id && <span className="rounded bg-dorado px-1 text-negro">MVP</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {callupLog.length > 0 && (
            <section className="card">
              <h2 className="mb-1 flex items-center gap-2"><ClipboardList size={18} className="text-rojo" /> Sus convocatorias {season}</h2>
              <p className="mb-3 text-sm text-negro/65">
                Convocado <b className="text-negro">{callupLog.length} {callupLog.length === 1 ? "vez" : "veces"}</b>
                {cRec.called > 0 && <> · dijo «Voy» en <b className="text-negro">{cRec.yes}</b> de {cRec.called} partidos jugados</>}
                {cRec.withReport > 0 && <> · jugó <b className="text-negro">{cRec.played}</b> de {cRec.withReport} con acta</>}
                {cRec.pending > 0 && <> · sin contestar {cRec.pending}</>}
              </p>
              <ol className="space-y-1.5">
                {callupLog.map((c) => {
                  const m = c.match;
                  return (
                    <li key={c.id}>
                      <Link href={`/partidos/${m.id}#convocatoria`} prefetch={false} className="flex items-center gap-2 rounded-xl bg-gris px-2 py-1.5 text-sm transition hover:ring-1 hover:ring-rojo/40">
                        <OutcomeDot m={m} size="sm" />
                        <span className="w-20 shrink-0 text-xs text-negro/65">{shortDay(m.match_date)}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{m.is_home ? "vs" : "en"} {m.rival.name}{m.status === "cancelled" && <span className="font-normal text-negro/65"> · suspendido</span>}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          <span className={`badge ${REPLY_TONE[c.reply]}`}>{REPLY_LABEL[c.reply]}</span>
                          {c.played !== null && <span className={`badge ${c.played ? "bg-green-100 text-green-800" : "bg-black/10 text-negro/70"}`}>{c.played ? "Jugó" : "No jugó"}</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {/* Trayectoria y estadísticas por temporada */}
          <section className="card">
            <h2 className="mb-1">Trayectoria en el Rayo</h2>
            {player.joined_club_on && <p className="mb-3 text-sm text-negro/60">En el club desde el <b>{fecha(player.joined_club_on)}</b>.</p>}
            {seasons.length ? (
              <div className="-mx-4 overflow-x-auto sm:-mx-5">
                <table className="table min-w-[34rem]">
                  <thead>
                    <tr>
                      <th className="pl-4 sm:pl-5">Temporada</th><th className="text-center">#</th><th>Pos.</th>
                      {(line === "GK" ? ["PJ", "P0", "GC", "MVP", "TA", "TR"] : ["PJ", "GOL", "ASI", "MVP", "TA", "TR"]).map((h) => <th key={h} className="text-center">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {seasons.map((m) => (
                      <tr key={m.id} className={m.season === season ? "bg-gris" : ""}>
                        <td className="pl-4 sm:pl-5">
                          <Link href={`/plantilla/${id}?temporada=${seasonSlug(m.season)}`} className="sport text-base font-black hover:text-rojo">{m.season}</Link>
                          {m.status !== "active" && <span className={`badge ml-2 ${STATUS_TONE[m.status]}`}>{STATUS_LABEL[m.status]}</span>}
                          {m.armband && <Armband kind={m.armband} className="ml-1 h-5 min-w-5 text-[10px]" />}
                          {m.status === "left" && m.left_on && <span className="block text-[11px] text-negro/65">Baja el {fecha(m.left_on)}</span>}
                        </td>
                        <td className="text-center"><span className="sport font-black">{m.number ?? "–"}</span></td>
                        <td><PositionChip code={m.position} /></td>
                        {(line === "GK" ? [m.apps, m.clean_sheets, m.conceded, m.mvps, m.yellows, m.reds] : [m.apps, m.goals, m.assists, m.mvps, m.yellows, m.reds]).map((v, i) => (
                          <td key={i} className="text-center font-semibold tabular-nums">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {seasons.length > 1 && (
                    <tfoot>
                      <tr className="bg-negro text-white">
                        <td className="sport rounded-bl-xl py-2 pl-4 font-black sm:pl-5" colSpan={3}>Total en el club</td>
                        {(line === "GK" ? [total.apps, total.clean_sheets, total.conceded, total.mvps, total.yellows, total.reds] : [total.apps, total.goals, total.assists, total.mvps, total.yellows, total.reds]).map((v, i) => (
                          <td key={i} className="sport py-2 text-center text-base font-black tabular-nums">{v}</td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <p className="text-sm text-negro/65">Aún no está en ninguna plantilla.</p>
            )}
            <p className="mt-3 text-xs text-negro/65">PJ partidos · {line === "GK" ? "P0 porterías a cero · GC goles encajados" : "GOL goles · ASI asistencias"} · MVP mejor del partido · TA/TR tarjetas. Con los partidos (fase 4) se calcularán solas.</p>
            {isManager && !seasons.some((m) => m.season === seasonOf()) && (
              <Link href={`/plantilla/${id}/editar?temporada=${seasonSlug(seasonOf())}`} className="btn-ghost mt-4">Añadir a la temporada {seasonOf()}</Link>
            )}
          </section>

          {/* Contacto: gestores y el propio jugador */}
          {contact && (canPrivate || isMe) && (
            <section className="card">
              <h2 className="mb-1">{isMe && !canPrivate ? "Mis datos" : "Contacto"}</h2>
              <p className="mb-4 text-xs text-negro/65">Solo lo ven los gestores con permiso de datos personales{isMe ? " y tú" : " y el propio jugador"}.</p>
              {isMe && !canPrivate ? (
                <MyContactForm action={updateMyContact} data={contact} />
              ) : (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <Field label="Teléfono" value={contact.phone} actions={contact.phone && <PhoneLinks phone={contact.phone} />} />
                  <Field label="Email" value={contact.email} actions={contact.email && <a href={`mailto:${contact.email}`} className="btn-ghost px-2.5 py-1.5" aria-label="Enviar email"><Mail size={15} /></a>} />
                  <Field label="Fecha de nacimiento" value={contact.birth_date ? `${fecha(contact.birth_date)}${age != null ? ` (${age} años)` : ""}` : null} />
                  <Field label="Emergencia" icon={<ShieldAlert size={14} className="text-rojo" />}
                    value={contact.emergency_name || contact.emergency_phone ? [contact.emergency_name, contact.emergency_phone].filter(Boolean).join(" · ") : null}
                    actions={contact.emergency_phone && <a href={`tel:${contact.emergency_phone}`} className="btn-ghost px-2.5 py-1.5" aria-label="Llamar"><Phone size={15} /></a>} />
                </div>
              )}
            </section>
          )}

          {showDocs && (
            <section className="card">
              <h2 className="mb-1 flex items-center gap-2"><FolderLock size={20} className="text-rojo" /> {isMe && !canPrivate ? "Mis documentos" : "Documentos"}</h2>
              <p className="mb-3 text-xs text-negro/65">Privados: solo los ven los gestores con permiso de datos personales{isMe ? " y tú" : " y el propio jugador"}.</p>
              <PlayerDocs playerId={id} docs={docs ?? []} canUpload={s.can("squad_private", "create") || isMe} deletable={deletable}
                save={savePlayerDoc.bind(null, id)} remove={deletePlayerDoc} />
            </section>
          )}

          {canPrivate && priv && (priv.sport_notes || priv.internal_notes) && (
            <section className="card">
              <h2 className="mb-1">Observaciones</h2>
              <p className="mb-3 text-xs text-negro/65">Solo para gestores.</p>
              {priv.sport_notes && <><h3 className="text-xs font-bold uppercase tracking-wide text-negro/65">Deportivas</h3><p className="mb-3 whitespace-pre-line text-sm">{priv.sport_notes}</p></>}
              {priv.internal_notes && <><h3 className="text-xs font-bold uppercase tracking-wide text-negro/65">Internas</h3><p className="whitespace-pre-line text-sm">{priv.internal_notes}</p></>}
            </section>
          )}
        </div>

        <div className="space-y-6">
          {fees && (
            <section className="card">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2"><Wallet size={20} className="text-rojo" /> Cuota {season}</h2>
                <span className={`badge ${FEE_STATUS_TONE[feeStatus(feeDue, feePaid)]}`}>{FEE_STATUS_LABEL[feeStatus(feeDue, feePaid)]}</span>
              </div>
              <FeeBar due={feeDue} paid={feePaid} />
              {fees.overrides.get(id) && <p className="mt-2 text-xs text-negro/60">Cuota especial{fees.overrides.get(id)!.reason ? `: ${fees.overrides.get(id)!.reason}` : ""}.</p>}
              {!fees.plan && !fees.overrides.get(id) && <p className="mt-2 text-xs text-negro/60">Aún no hay cuota para {season}. <Link href={`/plantilla/cuotas?temporada=${seasonSlug(season)}`} className="font-semibold text-rojo">Ponerla</Link></p>}
              {fees.payments.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {fees.payments.map((p) => (
                    <li key={p.id}>
                      <Link href={`/finanzas/${p.id}`} className="flex justify-between gap-2 rounded-lg bg-gris px-2.5 py-1.5 hover:ring-1 hover:ring-rojo">
                        <span>{fecha(p.op_date)} · {PAYMENT_METHOD_LABEL[p.method] ?? p.method}</span>
                        <b className="tabular-nums text-green-700">+{euros(p.amount_cents)}</b>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {s.can("finances", "create") && feeStatus(feeDue, feePaid) !== "paid" && feeStatus(feeDue, feePaid) !== "exempt" && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-bold text-rojo">Apuntar pago</summary>
                  <div className="mt-2"><FeePaymentForm action={registerFeePayment.bind(null, season, id)} suggested={feeDue != null ? Math.max(0, feeDue - feePaid) : null} today={today} /></div>
                </details>
              )}
              {s.can("finances", "update") && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-bold text-negro/60">Cuota especial</summary>
                  <div className="mt-2"><FeeOverrideForm action={saveFeeOverride.bind(null, season, id)} current={fees.overrides.get(id) ?? null} general={fees.plan?.amount_cents ?? null} /></div>
                </details>
              )}
              <p className="mt-3 text-xs text-negro/65">Los pagos se apuntan como ingresos en Finanzas. El jugador no ve esta información.</p>
            </section>
          )}

          {isMe && (
            <section className="card">
              <h2 className="mb-2">Tu foto</h2>
              <p className="mb-3 text-sm text-negro/60">La foto de tu ficha es la de tu perfil.</p>
              <Link href="/perfil" className="btn-ghost"><Camera size={16} /> Cambiar mi foto</Link>
            </section>
          )}

          {isManager && member && (
            <section className="card">
              <h2 className="mb-2">Situación en {member.season}</h2>
              <p className="mb-3 text-sm text-negro/60">
                {member.status === "left"
                  ? <>Se fue del equipo{member.left_on ? <> el <b>{fecha(member.left_on)}</b></> : ""}. Sus estadísticas y su historia se conservan.</>
                  : "Si deja el equipo, dale de baja: deja libre su dorsal y su historia se conserva."}
              </p>
              <RetireForm retire={retirePlayer.bind(null, id, member.season)} rejoin={rejoinPlayer.bind(null, id, member.season)}
                left={member.status === "left"} today={today} />
            </section>
          )}

          {isManager && (
            <section className="card">
              <h2 className="mb-4">Foto de la ficha</h2>
              <AvatarUpload name={fullName(player)} url={player.photo_url} upload={uploadPlayerPhoto.bind(null, id)} remove={removePlayerPhoto.bind(null, id)} />
            </section>
          )}

          {canUsers && (
            <section className="card space-y-4">
              <h2>Acceso a la app</h2>
              {linked ? (
                <>
                  <Link href={`/admin/usuarios/${linked.id}`} className="flex items-center gap-3 rounded-xl bg-gris p-3 hover:ring-1 hover:ring-rojo">
                    <Avatar name={linked.full_name} url={linked.avatar_url} size={40} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold"><UserCheck size={15} className="text-green-700" /> {linked.full_name}</span>
                      <span className="block truncate text-xs text-negro/65">{linked.email}{linked.active ? "" : " · acceso deshabilitado"}</span>
                    </span>
                  </Link>
                  <form action={unlinkUser.bind(null, id)}>
                    <button className="flex items-center gap-1.5 text-xs font-semibold text-negro/65 hover:text-rojo"><Unlink size={13} /> Desvincular (no borra el usuario)</button>
                  </form>
                </>
              ) : (
                <>
                  <p className="text-sm text-negro/60">Esta ficha no tiene usuario. Con usuario, el jugador ve la plantilla y corrige sus propios datos.</p>
                  <LinkUserForm action={linkUser.bind(null, id)} users={free} />
                  {s.can("users", "create") && (
                    <div className="border-t border-black/5 pt-4"><CreateAccessForm action={createAccess.bind(null, id)} email={priv?.email ?? null} /></div>
                  )}
                </>
              )}
            </section>
          )}

          {s.can("squad", "delete") && (
            <section className="card">
              <h2 className="mb-2">Eliminar ficha</h2>
              <p className="mb-3 text-sm text-negro/60">Solo para fichas creadas por error. Si se va del equipo, márcalo como <b>baja definitiva</b> y se conserva su historia.</p>
              <DeletePlayerForm action={deletePlayer.bind(null, id)} />
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value, icon, actions }: { label: string; value: string | null; icon?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-gris p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-negro/65">{icon}{label}</div>
        <div className="mt-0.5 font-semibold">{value || <span className="font-normal text-negro/60">Sin indicar</span>}</div>
      </div>
      {actions && <div className="flex shrink-0 gap-1">{actions}</div>}
    </div>
  );
}

function PhoneLinks({ phone }: { phone: string }) {
  const wa = phoneE164(phone);
  return (
    <>
      <a href={`tel:${phone}`} className="btn-ghost px-2.5 py-1.5" aria-label="Llamar"><Phone size={15} /></a>
      {wa && <a href={`https://api.whatsapp.com/send?phone=${wa}`} target="_blank" rel="noopener" className="btn-ghost px-2.5 py-1.5 text-green-700" aria-label="WhatsApp">WA</a>}
    </>
  );
}
