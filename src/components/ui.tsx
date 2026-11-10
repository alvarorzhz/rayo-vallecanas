import Link from "next/link";
import { PAYMENT_STATUS_LABEL, CAMPAIGN_STATUS_LABEL } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="group mb-3 inline-flex items-center gap-1.5 rounded-full bg-white py-1 pl-2 pr-3 text-[13px] font-bold text-negro/70 ring-1 ring-black/10 transition hover:text-rojo hover:ring-rojo/40 active:scale-95">
          <span aria-hidden className="transition-transform duration-200 group-hover:-translate-x-0.5">←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div aria-hidden className="title-ticks mb-2 flex gap-1">
            <span className="h-1.5 w-10 -skew-x-[25deg] bg-rojo" />
            <span className="h-1.5 w-3 -skew-x-[25deg] bg-dorado" />
          </div>
          <h1 className="h1">{title}</h1>
          {subtitle && <div className="mt-1.5 text-sm text-negro/60">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Bloque destacado en negro con la franja del Rayo (saldo, perfil, cabeceras con peso). */
export function Hero({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`relative overflow-hidden rounded-3xl bg-negro text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.65)] ${className}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.12),transparent_55%)]" />
      <div aria-hidden className="anim-sweep franja pointer-events-none absolute inset-0 opacity-90" />
      <div className="relative">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "red" | "gold" | "dark";
}) {
  const tones = {
    default: "bg-white text-negro ring-1 ring-black/5",
    red: "bg-gradient-to-br from-rojo to-rojo-oscuro text-white",
    gold: "bg-white text-negro ring-1 ring-black/5",
    dark: "bg-gradient-to-br from-negro-2 to-negro text-white",
  };
  const accent = { default: "bg-negro/10", red: "bg-white/25", gold: "bg-dorado", dark: "bg-rojo" }[tone];
  const muted = tone === "default" || tone === "gold" ? "text-negro/65" : "text-white/70";
  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 shadow-[0_10px_30px_-16px_rgba(0,0,0,0.3)] ${tones[tone]}`}>
      <span aria-hidden className={`absolute -right-3 top-0 h-full w-6 -skew-x-[20deg] ${accent}`} />
      <div className={`relative text-[11px] font-bold uppercase tracking-wider ${muted}`}>{label}</div>
      <div className="anim-score relative mt-1 text-3xl leading-none font-black tabular-nums [font-family:var(--font-display)] italic sm:text-4xl">{value}</div>
      {hint && <div className={`relative mt-1 text-xs ${muted}`}>{hint}</div>}
    </div>
  );
}

const PAY_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  partial: "bg-orange-100 text-orange-800",
  paid: "bg-green-100 text-green-800",
  cancelled: "bg-black/10 text-negro/60 line-through",
};
export function PaymentBadge({ status }: { status: string }) {
  return <span className={`badge ${PAY_TONE[status] ?? ""}`}>{PAYMENT_STATUS_LABEL[status] ?? status}</span>;
}

const CAMP_TONE: Record<string, string> = {
  draft: "bg-black/10 text-negro/70",
  active: "bg-green-100 text-green-800",
  closed: "bg-amber-100 text-amber-800",
  drawn: "bg-dorado/20 text-negro",
};
export function CampaignBadge({ status }: { status: string }) {
  return <span className={`badge ${CAMP_TONE[status] ?? ""}`}>{CAMPAIGN_STATUS_LABEL[status] ?? status}</span>;
}

/** Sin datos: un balón botando sobre el césped y el mensaje. */
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-black/10 bg-white/50 px-6 py-8 text-center text-sm text-negro/65">
      <span aria-hidden className="relative mb-3 flex h-14 w-14 items-end justify-center">
        <svg viewBox="0 0 32 32" className="empty-ball h-8 w-8">
          <circle cx="16" cy="16" r="14.5" fill="#fff" stroke="#080808" strokeWidth="2" />
          <path d="M16 9.5l5.6 4.1-2.1 6.6h-7l-2.1-6.6z" fill="#080808" />
          <path d="M16 9.5V3.2M21.6 13.6l6-2M19.5 20.2l3.8 5.2M12.5 20.2l-3.8 5.2M10.4 13.6l-6-2" stroke="#080808" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="empty-shadow absolute -bottom-1 h-1.5 w-8 rounded-full bg-negro" />
      </span>
      <div className="max-w-sm">{children}</div>
    </div>
  );
}

export function Progress({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/10">
      <div
        className="h-full origin-left animate-[grow_0.8s_cubic-bezier(0.22,1,0.36,1)_both] rounded-full bg-[repeating-linear-gradient(115deg,var(--color-rojo)_0_10px,var(--color-rojo-oscuro)_10px_14px)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
