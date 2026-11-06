import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, Cross, Mail, Pencil, Phone, Plane, ShieldAlert, Unlink, UserCheck } from "lucide-react";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { seasonOf } from "@/lib/finance";
import { fecha, phoneE164 } from "@/lib/format";
import {
  ARMBAND_LABEL, FOOT_LABEL, LINE_LABEL, LINE_TONE, POSITION_LABEL, STATUS_LABEL, STATUS_TONE,
  ageOf, fullName, lineOf, seasonFromSlug, seasonSlug, shirtName,
  type Membership, type Player, type PlayerPrivate,
} from "@/lib/squad";
import { Avatar } from "@/components/avatar";
import { AvatarUpload } from "@/components/avatar-upload";
import { Jersey } from "@/components/squad/jersey";
import { Armband, PositionChip } from "@/components/squad/player-card";
import { CreateAccessForm, DeletePlayerForm, LinkUserForm, MyContactForm } from "@/components/squad/squad-forms";
import { createAccess, deletePlayer, linkUser, removePlayerPhoto, unlinkUser, updateMyContact, uploadPlayerPhoto } from "../actions";

export const metadata = { title: "Ficha del jugador" };

type Own = { birth_date: string | null; phone: string | null; email: string | null; emergency_name: string | null; emergency_phone: string | null };

export default async function PlayerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ temporada?: string; ok?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await requirePerm("squad", "read");
  const supabase = await createClient();
  const isManager = s.can("squad", "update");

  const [{ data: player }, { data: history }, { data: priv }] = await Promise.all([
    supabase.from("players").select("*").eq("id", id).maybeSingle<Player>(),
    supabase.from("squad_members").select("*").eq("player_id", id).order("season", { ascending: false }).returns<Membership[]>(),
    isManager ? supabase.from("player_private").select("*").eq("player_id", id).maybeSingle<PlayerPrivate>() : Promise.resolve({ data: null }),
  ]);
  if (!player) notFound();
  const isMe = player.user_id === s.user.id;
  const own = isMe ? ((await supabase.rpc("squad_my_private")).data as Own | null) : null;
  const contact: Own | null = priv ?? own;

  const wanted = seasonFromSlug(sp.temporada) ?? seasonOf();
  const seasons = history ?? [];
  const member = seasons.find((m) => m.season === wanted) ?? seasons[0] ?? null;
  const season = member?.season ?? wanted;
  const line = member ? lineOf(member.position) : null;
  const age = ageOf(contact?.birth_date);
  const back = `/plantilla?temporada=${seasonSlug(season)}`;

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
      <Link href={back} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-negro/50 hover:text-rojo">← Plantilla</Link>
      {sp.ok && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{sp.ok === "1" ? "¡Jugador fichado!" : "Cambios guardados."}</p>
      )}

      {/* Cabecera de la ficha */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-negro text-white shadow-2xl">
        <div aria-hidden className={`absolute inset-0 ${line === "GK" ? "bg-[linear-gradient(150deg,#3a2f0b_0%,#080808_60%)]" : "bg-[linear-gradient(150deg,#3b0609_0%,#080808_60%)]"}`} />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0_60%,var(--color-rojo)_60%_73%,var(--color-dorado)_73%_75%,transparent_75%)] opacity-80" />
        {member?.number != null && (
          <span aria-hidden className="sport pointer-events-none absolute -bottom-10 right-2 select-none text-[13rem] font-black leading-none text-white/[0.07] sm:right-8 sm:text-[17rem]">
            {member.number}
          </span>
        )}
        <div className="relative flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-end sm:p-8">
          <div className="relative shrink-0">
            {player.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.photo_url} alt="" className="h-36 w-36 rounded-3xl object-cover shadow-2xl ring-4 ring-dorado sm:h-44 sm:w-44" />
            ) : (
              <div className="flex h-36 w-36 items-center justify-center rounded-3xl bg-white/5 ring-4 ring-dorado/60 sm:h-44 sm:w-44">
                <Jersey number={member?.number ?? null} goalkeeper={line === "GK"} size={110} />
              </div>
            )}
            {member?.armband && <Armband kind={member.armband} className="absolute -right-2 -top-2 h-8 min-w-8 text-sm" />}
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {member && <PositionChip code={member.position} long />}
              {member && (
                <span className={`badge ${STATUS_TONE[member.status]}`}>
                  {member.status === "injured" && <Cross size={11} className="mr-1" strokeWidth={3} />}
                  {member.status === "away" && <Plane size={11} className="mr-1" />}
                  {STATUS_LABEL[member.status]}
                </span>
              )}
            </div>
            <h1 className="sport mt-2 text-5xl leading-[0.85] font-black sm:text-6xl">
              {member?.number != null && <span className="mr-2 text-dorado">{member.number}</span>}
              {shirtName(player)}
            </h1>
            <p className="mt-2 text-white/70">{fullName(player)}</p>
            {member && <p className="mt-1 text-xs text-white/50">Temporada {member.season}{member.armband ? ` · ${ARMBAND_LABEL[member.armband]}` : ""}</p>}
          </div>
          {isManager && (
            <div className="flex gap-2 sm:ml-auto sm:self-start">
              <Link href={`/plantilla/${id}/editar?temporada=${seasonSlug(season)}`} prefetch className="btn-primary"><Pencil size={16} /> Editar</Link>
            </div>
          )}
        </div>
      </section>

      {/* Datos deportivos */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Dorsal", member?.number ?? "–"],
          ["Línea", line ? LINE_LABEL[line] : "–"],
          ["Pierna", player.foot ? FOOT_LABEL[player.foot] : "–"],
          ["Altura", player.height_cm ? `${(player.height_cm / 100).toFixed(2).replace(".", ",")} m` : "–"],
          ["Edad", age != null ? `${age} años` : "–"],
          ["Temporadas", seasons.length || "–"],
        ].map(([k, v], i) => (
          <div key={k} className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <span aria-hidden className={`absolute -right-3 top-0 h-full w-5 -skew-x-[20deg] ${i === 0 ? "bg-rojo" : i === 1 && line ? LINE_TONE[line].dot : "bg-negro/10"}`} />
            <div className="relative text-[11px] font-bold uppercase tracking-wider text-negro/50">{k}</div>
            <div className="sport relative mt-1 text-2xl font-black leading-none sm:text-3xl">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {/* Trayectoria en el club */}
          <section className="card">
            <h2 className="mb-3">Trayectoria en el Rayo</h2>
            {player.joined_club_on && <p className="mb-3 text-sm text-negro/60">En el club desde el <b>{fecha(player.joined_club_on)}</b>.</p>}
            {seasons.length ? (
              <ol className="relative space-y-3 border-l-2 border-dashed border-black/10 pl-5">
                {seasons.map((m) => (
                  <li key={m.id} className="relative">
                    <span aria-hidden className={`absolute -left-[1.64rem] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-white ${LINE_TONE[lineOf(m.position)].dot}`} />
                    <Link href={`/plantilla/${id}?temporada=${seasonSlug(m.season)}`} className={`flex flex-wrap items-center gap-2 rounded-xl p-2 transition hover:bg-gris ${m.season === season ? "bg-gris" : ""}`}>
                      <span className="sport w-16 text-lg font-black">{m.season}</span>
                      <span className="sport flex h-8 min-w-8 items-center justify-center rounded-md bg-negro px-1 text-base font-black text-white">{m.number ?? "–"}</span>
                      <PositionChip code={m.position} />
                      <span className="text-sm text-negro/60">{POSITION_LABEL[m.position]}</span>
                      <span className={`badge ml-auto ${STATUS_TONE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                      {m.armband && <Armband kind={m.armband} />}
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-negro/50">Aún no está en ninguna plantilla.</p>
            )}
            {isManager && !seasons.some((m) => m.season === seasonOf()) && (
              <Link href={`/plantilla/${id}/editar?temporada=${seasonSlug(seasonOf())}`} className="btn-ghost mt-4">Añadir a la temporada {seasonOf()}</Link>
            )}
          </section>

          {/* Contacto: gestores y el propio jugador */}
          {contact && (isManager || isMe) && (
            <section className="card">
              <h2 className="mb-1">{isMe && !isManager ? "Mis datos" : "Contacto"}</h2>
              <p className="mb-4 text-xs text-negro/50">Solo lo ven los gestores{isMe ? " y tú" : " y el propio jugador"}.</p>
              {isMe && !isManager ? (
                <MyContactForm action={updateMyContact} data={contact} />
              ) : (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <Field label="Teléfono" value={contact.phone} actions={contact.phone && <PhoneLinks phone={contact.phone} />} />
                  <Field label="Email" value={contact.email} actions={contact.email && <a href={`mailto:${contact.email}`} className="btn-ghost px-2.5 py-1.5" aria-label="Enviar email"><Mail size={15} /></a>} />
                  <Field label="Fecha de nacimiento" value={contact.birth_date ? `${fecha(contact.birth_date)}${age != null ? ` (${age} años)` : ""}` : null} />
                  <Field label="Emergencia" icon={<ShieldAlert size={14} className="text-rojo" />}
                    value={contact.emergency_name || contact.emergency_phone ? [contact.emergency_name, contact.emergency_phone].filter(Boolean).join(" · ") : null}
                    actions={contact.emergency_phone && <a href={`tel:${contact.emergency_phone}`} className="btn-ghost px-2.5 py-1.5" aria-label="Llamar"><Phone size={15} /></a>} />
                </dl>
              )}
            </section>
          )}

          {isManager && priv && (priv.sport_notes || priv.internal_notes) && (
            <section className="card">
              <h2 className="mb-1">Observaciones</h2>
              <p className="mb-3 text-xs text-negro/50">Solo para gestores.</p>
              {priv.sport_notes && <><h3 className="text-xs font-bold uppercase tracking-wide text-negro/50">Deportivas</h3><p className="mb-3 whitespace-pre-line text-sm">{priv.sport_notes}</p></>}
              {priv.internal_notes && <><h3 className="text-xs font-bold uppercase tracking-wide text-negro/50">Internas</h3><p className="whitespace-pre-line text-sm">{priv.internal_notes}</p></>}
            </section>
          )}
        </div>

        <div className="space-y-6">
          {isMe && (
            <section className="card">
              <h2 className="mb-2">Tu foto</h2>
              <p className="mb-3 text-sm text-negro/60">La foto de tu ficha es la de tu perfil.</p>
              <Link href="/perfil" className="btn-ghost"><Camera size={16} /> Cambiar mi foto</Link>
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
                      <span className="block truncate text-xs text-negro/50">{linked.email}{linked.active ? "" : " · acceso deshabilitado"}</span>
                    </span>
                  </Link>
                  <form action={unlinkUser.bind(null, id)}>
                    <button className="flex items-center gap-1.5 text-xs font-semibold text-negro/50 hover:text-rojo"><Unlink size={13} /> Desvincular (no borra el usuario)</button>
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
        <dt className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-negro/50">{icon}{label}</dt>
        <dd className="mt-0.5 font-semibold">{value || <span className="font-normal text-negro/40">Sin indicar</span>}</dd>
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
