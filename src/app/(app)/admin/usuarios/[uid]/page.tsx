import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { bandOf } from "@/components/admin-office";
import { ResetPasswordForm, UserEditForm } from "@/components/admin-forms";
import { resetPassword, setUserAccess, updateUser } from "../actions";
import { Lock, LockOpen } from "lucide-react";
import { EDITABLE_MODULES, fetchProfileDefs, profileKey } from "@/lib/roles";

export const metadata = { title: "Usuario" };

export default async function UserPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const s = await requirePerm("users", "read");
  const supabase = await createClient();
  const [{ data: profile }, defs, { data: userPerms }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).single(),
    fetchProfileDefs(supabase),
    supabase.from("user_permissions").select("*").eq("user_id", uid),
  ]);
  if (!profile) notFound();
  const isSuper = s.profile.role === "superadmin";
  const canEdit = s.can("users", "update") && (isSuper || profile.role !== "superadmin");
  const def = defs.find((d) => d.key === profileKey(profile));
  const band = bandOf(def?.base ?? profile.role);
  const profiles = defs.filter((d) => d.key !== "superadmin" || isSuper || profile.role === "superadmin")
    .map(({ key, name, base, perms }) => ({ key, name, base, perms }));

  return (
    <>
      <PageHeader title={profile.full_name} subtitle={profile.email} back={{ href: "/admin/usuarios", label: "Usuarios" }} />
      {/* Carnet del club, con el sello del acceso (vuelve a caer cada vez que cambia) */}
      <section className="card carnet mb-4 flex items-stretch overflow-hidden p-0 sm:p-0">
        <span aria-hidden className={`w-2.5 shrink-0 ${band.split(" ")[0]}`} />
        <div className="relative flex min-w-0 flex-1 items-center gap-4 p-4 pb-12 sm:p-5 sm:pb-5 sm:pr-48">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={76} className={profile.active ? "" : "opacity-50 grayscale"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-negro/45">Carnet del club</p>
            <p className="sport truncate text-2xl font-black leading-tight">{profile.full_name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-negro/65">
              <span className={`badge ${band}`}>{def?.name ?? profile.role}</span>
              {profile.phone && <span>{profile.phone}</span>}
            </div>
          </div>
          <span key={String(profile.active)} className={`ink-stamp absolute bottom-3 right-4 text-sm sm:bottom-auto sm:top-1/2 sm:-mt-3.5 ${profile.active ? "text-green-700" : "text-rojo"}`}>
            {profile.active ? <><LockOpen size={14} /> Acceso habilitado</> : <><Lock size={14} /> Sin acceso</>}
          </span>
        </div>
      </section>
      <section className={`card mb-6 flex flex-wrap items-center justify-between gap-4 ${profile.active ? "" : "ring-2 ring-rojo/40"}`}>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2">
            {profile.active ? <LockOpen size={18} className="text-green-700" /> : <Lock size={18} className="text-rojo" />}
            Acceso a la app: {profile.active ? "habilitado" : "deshabilitado"}
          </h2>
          <p className="mt-1 text-sm text-negro/60">
            {profile.active
              ? "Si lo deshabilitas, no podrá entrar en la app hasta que lo vuelvas a habilitar. No se borra nada: sus ventas y datos se conservan."
              : "No puede entrar en la app. Sus ventas y datos se conservan. Habilítalo cuando quieras que vuelva a tener acceso."}
          </p>
        </div>
        {canEdit && uid !== s.user.id && (
          <form action={setUserAccess.bind(null, uid, !profile.active)}>
            <button className={profile.active ? "btn-dark" : "btn-primary"}>
              {profile.active ? <><Lock size={16} /> Deshabilitar acceso</> : <><LockOpen size={16} /> Habilitar acceso</>}
            </button>
          </form>
        )}
        {uid === s.user.id && <p className="text-xs text-negro/65">Es tu propio usuario: no puedes deshabilitarlo.</p>}
        {canEdit && uid !== s.user.id && profile.active && (
          <div className="basis-full border-t border-black/5 pt-3">
            <p className="mb-2 text-sm text-negro/60">¿Ha olvidado su contraseña? Crea una provisional y mándasela por WhatsApp.</p>
            <ResetPasswordForm action={resetPassword.bind(null, uid)} />
          </div>
        )}
      </section>
      <UserEditForm
        action={updateUser.bind(null, uid)}
        profile={profile}
        profiles={profiles}
        modules={EDITABLE_MODULES}
        userPerms={userPerms ?? []}
        canEdit={canEdit}
      />
    </>
  );
}
