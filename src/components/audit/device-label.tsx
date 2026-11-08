import { Monitor, Smartphone, Tablet, HelpCircle } from "lucide-react";
import { parseDevice } from "@/lib/device";

/** «📱 iPhone · Safari» con su icono. */
export function DeviceLabel({ ua, className = "" }: { ua: string | null | undefined; className?: string }) {
  const d = parseDevice(ua);
  const Icon = d.kind === "mobile" ? Smartphone : d.kind === "tablet" ? Tablet : d.kind === "desktop" ? Monitor : HelpCircle;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={ua ?? undefined}>
      <Icon size={14} aria-hidden className="shrink-0" /> {d.label}
    </span>
  );
}
