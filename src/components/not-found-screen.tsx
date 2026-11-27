import { Home } from "lucide-react";
import { TroubleScreen } from "@/components/trouble-screen";

/** 4.32.3 · Página que no existe (enlace viejo, dirección mal escrita o algo que se borró). */
export function NotFoundScreen({ full = false }: { full?: boolean }) {
  return (
    <TroubleScreen
      full={full}
      tag="Fuera de juego"
      title="Esta página no existe"
      actions={
        // <a> y no <Link>: Inicio se carga de cero (desde la ficha de un partido borrado, el salto sin recargar
        // dejaba avisos de React en Inicio)
            <a href="/" className="btn-primary">
          <Home size={18} /> Volver a Inicio
        </a>
      }
    >
      El linier ha levantado la bandera: el enlace está mal escrito, es antiguo o lo que buscabas ya no está.
    </TroubleScreen>
  );
}
