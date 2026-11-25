import { requireOn } from "@/lib/session";

/** 4.31.0 · Clasificación de la porra: se cierra si un superadministrador apaga el apartado en Gestión → Control → Mandos. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireOn("porra");
  return children;
}
