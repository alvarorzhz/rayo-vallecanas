import Link from "next/link";
import type { AuditKind } from "@/lib/audit";

/** 4.32.0 · Tres auditorías: funcional, administrativa y de seguridad. */
const TABS: { kind: AuditKind; href: string; label: string }[] = [
  { kind: "funcional", href: "/admin/auditoria", label: "Funcional" },
  { kind: "administrativa", href: "/admin/auditoria/administrativa", label: "Administrativa" },
  { kind: "seguridad", href: "/admin/auditoria/accesos", label: "Seguridad" },
];
const SECURITY: { key: "accesos" | "sesiones"; href: string; label: string }[] = [
  { key: "accesos", href: "/admin/auditoria/accesos", label: "Historial de accesos" },
  { key: "sesiones", href: "/admin/auditoria/sesiones", label: "Sesiones abiertas" },
];
const ABOUT: Record<AuditKind, string> = {
  funcional: "El día a día del club: quién cambió un partido, una cuota, una venta de la rifa, un patrocinador o el material, con el antes y el ahora.",
  administrativa: "Quién cambió usuarios, perfiles y permisos, los mandos de la app (mantenimiento, mensaje fijo, apartados) y quién sacó datos (exportaciones y copias).",
  seguridad: "Quién entró y salió, desde qué dispositivo, los intentos fallidos y qué sesiones se cerraron y quién las cerró.",
};

/** Pestañas internas de Auditoría (y, en Seguridad, sus dos vistas). */
export function AuditTabs({ current, sub }: { current: AuditKind; sub?: "accesos" | "sesiones" }) {
  return (
    <div className="mb-4">
      <nav aria-label="Tipo de auditoría" className="flex w-full gap-1 rounded-xl bg-black/5 p-1 text-sm font-bold sm:w-max">
        {TABS.map((t) => (
          <Link key={t.kind} href={t.href} prefetch aria-current={t.kind === current ? "page" : undefined}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center transition sm:flex-none ${
              t.kind === current ? "bg-white text-negro shadow" : "text-negro/60 hover:text-rojo"
            }`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-sm text-negro/65">{ABOUT[current]}</p>
      {current === "seguridad" && (
        <nav aria-label="Seguridad" className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          {SECURITY.map((t) => (
            <Link key={t.key} href={t.href} prefetch aria-current={t.key === sub ? "page" : undefined}
              className={`rounded-full px-3 py-1 ring-1 transition ${
                t.key === sub ? "bg-negro text-white ring-negro" : "text-negro/70 ring-black/15 hover:text-rojo"
              }`}>
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
