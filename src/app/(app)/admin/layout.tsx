import { getSession } from "@/lib/session";
import { AdminTabs, type AdminTab } from "@/components/admin-tabs";
import { OfficePlaque } from "@/components/admin-office";

/** Panel «Gestión» (el despacho del club): la mesa, usuarios, perfiles, patrocinadores, avisos y, para superadministradores, auditoría y copias. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const isSuper = s.profile.role === "superadmin";
  const tabs: AdminTab[] = [{ href: "/admin", label: "Mesa", icon: "BriefcaseBusiness", exact: true }];
  if (s.can("users")) {
    tabs.push({ href: "/admin/usuarios", label: "Usuarios", icon: "Users" });
    tabs.push({ href: "/admin/perfiles", label: "Perfiles", icon: "IdCard" });
  }
  if (s.can("sponsors")) tabs.push({ href: "/admin/patrocinadores", label: "Patrocinadores", icon: "Handshake" });
  if (s.can("users", "update") || s.can("lottery_admin", "update")) tabs.push({ href: "/admin/avisos", label: "Avisos", icon: "BellRing" });
  if (isSuper) {
    tabs.push({ href: "/admin/auditoria", label: "Auditoría", icon: "ScrollText" });
    tabs.push({ href: "/admin/copia", label: "Copia de seguridad", icon: "DatabaseBackup" });
  }
  return (
    <>
      <OfficePlaque />
      <AdminTabs tabs={tabs} />
      {children}
    </>
  );
}
