import Link from "next/link";

export function Pager({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-negro/50">Página {page} de {pages} · {total} registros</span>
      <div className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className="btn-ghost">Anterior</Link>}
        {page < pages && <Link href={href(page + 1)} className="btn-ghost">Siguiente</Link>}
      </div>
    </div>
  );
}
