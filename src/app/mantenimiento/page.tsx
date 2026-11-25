import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getPublicStatus } from "@/lib/app-settings-server";
import { backAtLabel } from "@/lib/app-settings";
import { createClient } from "@/lib/supabase/server";
import { RetrySoon } from "./retry";

export const metadata = { title: "En mantenimiento" };
export const dynamic = "force-dynamic";

/** 4.31.0 · Lo que ve todo el mundo (menos el superadministrador) mientras la app está en mantenimiento. */
export default async function Maintenance() {
  const st = await getPublicStatus();
  if (!st.maintenance) redirect("/");
  // El superadministrador sigue entrando con normalidad
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (uid) {
    const { data: me } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
    if (me?.role === "superadmin") redirect("/");
  }
  const back = backAtLabel(st.until);
  return (
    <AuthShell title="Estamos de obras" subtitle="VOLVEMOS ENSEGUIDA">
      <div className="space-y-4 text-center">
        <p className="text-5xl" aria-hidden>🚧</p>
        <p className="whitespace-pre-line text-negro/80">{st.message || "Estamos mejorando la app del Rayo. En un rato vuelve a estar disponible."}</p>
        {back && <p className="rounded-xl bg-dorado/15 px-3 py-2 text-sm font-bold ring-1 ring-dorado/40">Volvemos {back}</p>}
        <RetrySoon />
        {uid && <a href="/auth/salir" className="block text-xs text-negro/50 underline hover:text-rojo">Cerrar sesión</a>}
      </div>
    </AuthShell>
  );
}
