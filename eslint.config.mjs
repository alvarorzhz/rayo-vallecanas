import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Reglas nuevas de react-hooks 7 pensadas para el React Compiler (que no usamos): marcan patrones
    // que funcionan bien aquí, como leer localStorage al montar o Date.now() en componentes de servidor.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      // 4.32.3 · Con la ruta comodín (app)/[...ruta] (la página de «no existe» dentro de la app) esta regla cree
      // que cualquier dirección es una página y marca todos los <a>, también descargas y /api. Los <a> que quedan
      // son a propósito: cargan de cero (tras un fallo, descargas, cerrar sesión).
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  globalIgnores(["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
