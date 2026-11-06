import type { NextConfig } from "next";

// Origen de Supabase (fotos, archivos y datos en directo desde el navegador)
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const supabaseWs = supabase.replace(/^http/, "ws");

// Política de contenido: solo se cargan cosas de la propia app y de Supabase; nadie puede meter la app en un marco
const csp = [
  "default-src 'self'",
  // Next.js necesita scripts en línea para arrancar la página
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabaseWs}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // El escudo se lee del disco para el justificante en PDF
  outputFileTracingIncludes: {
    "/api/loteria/venta/[saleId]/pdf": ["./public/escudo.png"],
    "/api/finanzas/exportar": ["./public/escudo.png"],
    "/api/plantilla/exportar": ["./public/escudo.png"],
  },
  experimental: {
    // Las pantallas ya visitadas o precargadas se muestran al instante desde memoria;
    // después se refrescan sus datos en segundo plano (ver components/refresh-on-visit.tsx).
    staleTimes: { dynamic: 120, static: 300 },
  },
};

export default nextConfig;
