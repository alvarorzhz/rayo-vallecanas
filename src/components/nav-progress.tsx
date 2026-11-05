"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Barra de carga arriba del todo mientras se abre otra página. */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [active, setActive] = useState(false);

  // Al llegar la nueva página se oculta
  useEffect(() => setActive(false), [pathname, search]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), 15000);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimeout(timer);
    };
  }, []);

  if (!active) return null;
  return (
    <div role="progressbar" aria-label="Cargando" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden bg-dorado/20">
      <div className="h-full w-2/5 animate-progress rounded-full bg-dorado" />
    </div>
  );
}
