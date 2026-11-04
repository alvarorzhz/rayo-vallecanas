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
        <Link href={back.href} className="mb-2 inline-block text-sm text-negro/50 hover:text-rojo">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="h1">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-negro/60">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
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
    red: "bg-rojo text-white",
    gold: "bg-white text-negro ring-2 ring-dorado",
    dark: "bg-negro text-white",
  };
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${tones[tone]}`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${tone === "default" || tone === "gold" ? "text-negro/50" : "text-white/70"}`}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-black tabular-nums sm:text-3xl">{value}</div>
      {hint && <div className={`mt-0.5 text-xs ${tone === "default" || tone === "gold" ? "text-negro/50" : "text-white/70"}`}>{hint}</div>}
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

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border-2 border-dashed border-black/10 p-8 text-center text-sm text-negro/50">{children}</div>;
}

export function Progress({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
      <div className="h-full rounded-full bg-rojo" style={{ width: `${pct}%` }} />
    </div>
  );
}
