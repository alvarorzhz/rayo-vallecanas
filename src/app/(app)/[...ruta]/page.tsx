import { notFound } from "next/navigation";

/**
 * 4.32.3 · Direcciones que no existen, con sesión iniciada: así la página de «no existe» sale dentro de la app,
 * con la barra de abajo, en vez de a pantalla completa. Solo entra si ninguna otra ruta coincide.
 */
export default function UnknownRoute() {
  notFound();
}
