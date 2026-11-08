import Link from "next/link";

const TABS = [
  { href: "/admin/auditoria", label: "Cambios" },
  { href: "/admin/auditoria/accesos", label: "Accesos" },
  { href: "/admin/auditoria/sesiones", label: "Sesiones" },
];

/** Pestañas internas de Auditoría. */
export function AuditTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Auditoría" className="mb-4 flex w-full gap-1 rounded-xl bg-black/5 p-1 text-sm font-bold sm:w-max">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} prefetch aria-current={t.href === current ? "page" : undefined}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center transition sm:flex-none ${
            t.href === current ? "bg-white text-negro shadow" : "text-negro/60 hover:text-rojo"
          }`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
