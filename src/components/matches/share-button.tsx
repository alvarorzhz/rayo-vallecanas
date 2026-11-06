"use client";
import { Share2 } from "lucide-react";

/** Compartir por WhatsApp (api.whatsapp.com: wa.me estropea los emojis). */
export function ShareButton({ text, label = "Compartir", className = "btn-ghost px-3 py-1.5 text-sm" }: { text: string; label?: string; className?: string }) {
  return (
    <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" className={className}>
      <Share2 size={15} className="text-green-700" /> {label}
    </a>
  );
}
