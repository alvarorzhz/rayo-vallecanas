import { getSession } from "@/lib/session";
import { DeskNav, type DeskDrawer } from "@/components/admin-tabs";

/**
 * Panel «Gestión» (el despacho del club). 4.30.0 · Cuatro cajones en vez de diez pestañas:
 * Equipo (usuarios y perfiles), Avisos, Material y, solo superadministradores, Control (uso, auditoría y copia).
 * Los patrocinadores viven en Finanzas.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const drawers: DeskDrawer[] = [];
  if (s.can("users")) drawers.push({ key: "equipo", pages: [{ href: "/admin/usuarios", label: "Personas" }, { href: "/admin/perfiles", label: "Perfiles" }] });
  if (s.can("users", "update") || s.can("lottery_admin", "update")) drawers.push({ key: "avisos", pages: [{ href: "/admin/avisos", label: "Avisos" }] });
  if (s.can("material")) drawers.push({ key: "material", pages: [{ href: "/admin/material", label: "Material" }] });
  if (s.profile.role === "superadmin")
    drawers.push({ key: "control", pages: [
      { href: "/admin/mandos", label: "Mandos" },
      { href: "/admin/uso", label: "Uso" },
      { href: "/admin/auditoria", label: "Auditoría", prefix: true },
      { href: "/admin/copia", label: "Copia" },
    ] });
  return (
    <>
      <DeskNav drawers={drawers} />
      {children}
    </>
  );
}
