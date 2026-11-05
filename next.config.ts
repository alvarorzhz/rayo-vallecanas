import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las pantallas ya visitadas o precargadas se muestran al instante desde memoria;
    // después se refrescan sus datos en segundo plano (ver components/refresh-on-visit.tsx).
    staleTimes: { dynamic: 120, static: 300 },
  },
};

export default nextConfig;
