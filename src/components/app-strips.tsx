import Link from "next/link";
import { Construction, Eye, Megaphone, TriangleAlert } from "lucide-react";
import { activeBanner, type AppSettings } from "@/lib/app-settings";
import { stopViewAs } from "@/app/(app)/admin/mandos/actions";

/**
 * 4.31.0 · Franjas de arriba, en todas las pantallas:
 * · «Ver como»: el superadministrador está mirando la app como otro perfil (con botón para volver).
 * · Mantenimiento puesto (solo la ve el superadministrador, que es el único que entra).
 * · El mensaje fijo para todos, informativo (dorado) o urgente (rojo).
 */
export function AppStrips({ settings, isSuper, viewingAs }: { settings: AppSettings; isSuper: boolean; viewingAs: { key: string; name: string } | null }) {
  const banner = activeBanner(settings);
  return (
    <>
      {viewingAs && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-sky-900 px-4 py-2 text-sm text-white">
          <Eye size={16} className="shrink-0 text-sky-200" aria-hidden />
          <span className="min-w-0 flex-1">Estás viendo la app como <b>{viewingAs.name}</b>. Cambian los menús y apartados; los datos siguen siendo los tuyos.</span>
          <form action={stopViewAs}>
            <button className="rounded-lg bg-white px-3 py-1 text-xs font-black text-sky-900 hover:bg-sky-100">Volver a superadmin</button>
          </form>
        </div>
      )}
      {isSuper && settings.maintenance && (
        <Link href="/admin/mandos" className="flex items-center gap-2 bg-amber-400 px-4 py-2 text-sm font-semibold text-negro hover:bg-amber-300">
          <Construction size={16} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">Modo mantenimiento puesto: solo entras tú.</span>
          <span className="shrink-0 font-black underline">Quitar</span>
        </Link>
      )}
      {banner && (
        <div role={banner.tone === "urgent" ? "alert" : "status"} data-testid="app-banner"
          className={`flex items-start gap-2 px-4 py-2 text-sm font-semibold ${banner.tone === "urgent" ? "bg-rojo text-white" : "bg-dorado/25 text-negro ring-1 ring-inset ring-dorado/40"}`}>
          {banner.tone === "urgent" ? <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden /> : <Megaphone size={16} className="mt-0.5 shrink-0 text-rojo" aria-hidden />}
          <span className="min-w-0 flex-1 break-words">{banner.text}</span>
        </div>
      )}
    </>
  );
}
