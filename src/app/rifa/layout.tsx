import { redirect } from "next/navigation";
import { getPublicStatus } from "@/lib/app-settings-server";

/** 4.31.0 · En mantenimiento con «cerrar también las páginas públicas», la rifa pública también se cierra. */
export default async function PublicRaffleLayout({ children }: { children: React.ReactNode }) {
  if ((await getPublicStatus()).public_closed) redirect("/mantenimiento");
  return children;
}
