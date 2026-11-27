import { NotFoundScreen } from "@/components/not-found-screen";

export const metadata = { title: "Página no encontrada" };

/** 4.32.3 · Cualquier dirección que no existe, y lo que no se encuentra en las páginas públicas (rifa, noticias). */
export default function NotFound() {
  return <NotFoundScreen full />;
}
