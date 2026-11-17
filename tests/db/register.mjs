// Permite importar el código de la app en las pruebas de node: resuelve «@/…» como src/…
// (igual que tsconfig) y deja «server-only» vacío, que fuera de Next solo sirve de aviso.
import { register } from "node:module";

register(new URL("./hooks.mjs", import.meta.url));
