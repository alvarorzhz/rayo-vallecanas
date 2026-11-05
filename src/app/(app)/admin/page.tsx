import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function AdminHome() {
  const s = await getSession();
  if (s.can("users")) redirect("/admin/usuarios");
  if (s.profile.role === "superadmin") redirect("/admin/auditoria");
  redirect("/admin/avisos");
}
