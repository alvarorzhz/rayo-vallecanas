import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El escudo se lee del disco para el justificante en PDF
  outputFileTracingIncludes: {
    "/api/loteria/venta/[saleId]/pdf": ["./public/escudo.png"],
    "/api/finanzas/exportar": ["./public/escudo.png"],
  },
  experimental: {
    // Las pantallas ya visitadas o precargadas se muestran al instante desde memoria;
    // después se refrescan sus datos en segundo plano (ver components/refresh-on-visit.tsx).
    staleTimes: { dynamic: 120, static: 300 },
  },
};

export default nextConfig;
