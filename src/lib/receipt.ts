import { euros, fecha, ranges } from "@/lib/format";

export type ReceiptData = {
  reference: string;
  buyerName: string;
  lotteryNumber: string;
  drawType: string;
  drawDate: string | null;
  quantity: number;
  shareNumbers: number[];
  totalCents: number;
  paidCents: number;
  sellerName: string;
  createdAt: string;
  campaignName: string;
};

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const shareRef = (d: ReceiptData) => (d.shareNumbers.length ? ranges(d.shareNumbers) : "—");

/** Texto del justificante (WhatsApp y versión texto del email). */
export function receiptText(d: ReceiptData) {
  const pending = d.totalCents - d.paidCents;
  return [
    "*RAYO VALLECAÑAS*",
    "",
    "¡Gracias por colaborar con nuestro equipo!",
    "",
    "Tu compra de lotería ha quedado registrada.",
    "",
    `Número: ${d.lotteryNumber}`,
    `Sorteo: ${d.drawType}${d.drawDate ? ` (${fecha(d.drawDate)})` : ""}`,
    `Participaciones: ${d.quantity} (nº ${shareRef(d)})`,
    `Referencia: ${d.reference}`,
    `Importe: ${euros(d.totalCents)}${pending > 0 ? ` · pendiente de pago: ${euros(pending)}` : " · pagado"}`,
    "",
    "¡Mucha suerte y gracias por apoyar al Rayo Vallecañas! ⚡",
    "",
    "_Este mensaje es un justificante de compra y no sustituye a la participación física._",
  ].join("\n");
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** HTML del justificante para email (tablas e estilos en línea por compatibilidad). */
export function receiptHtml(d: ReceiptData) {
  const pending = d.totalCents - d.paidCents;
  const row = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:8px 0;color:#666;font-size:14px">${k}</td><td style="padding:8px 0;text-align:right;font-size:${strong ? 18 : 14}px;font-weight:${strong ? 800 : 600};color:#080808">${esc(v)}</td></tr>`;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F4F4F4;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#080808;padding:24px;text-align:center;border-bottom:4px solid #D20D17">
<img src="${siteUrl()}/escudo.png" width="72" alt="Rayo Vallecañas" style="display:block;margin:0 auto 8px"/>
<div style="color:#fff;font-size:20px;font-weight:900;letter-spacing:1px">RAYO VALLECAÑAS</div>
<div style="color:#D5AF32;font-size:12px;letter-spacing:2px;margin-top:4px">JUSTIFICANTE DE LOTERÍA</div></td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 4px;font-size:16px;color:#080808">Hola ${esc(d.buyerName)},</p>
<p style="margin:0 0 16px;font-size:15px;color:#333">¡Gracias por colaborar con nuestro equipo! Tu compra de lotería ha quedado registrada.</p>
<div style="text-align:center;background:#080808;border-radius:12px;padding:16px;margin-bottom:16px">
<div style="color:#D5AF32;font-size:12px;letter-spacing:2px">NÚMERO</div>
<div style="color:#fff;font-size:40px;font-weight:900;letter-spacing:6px">${esc(d.lotteryNumber)}</div>
<div style="color:#bbb;font-size:12px">${esc(d.drawType)}${d.drawDate ? ` · ${esc(fecha(d.drawDate))}` : ""}</div></div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee">
${row("Referencia", d.reference)}
${row("Participaciones", `${d.quantity} (nº ${shareRef(d)})`)}
${row("Vendedor", d.sellerName)}
${row("Fecha", fecha(d.createdAt, true))}
${row("Estado del pago", pending > 0 ? `Pendiente: ${euros(pending)}` : "Pagado")}
${row("Importe", euros(d.totalCents), true)}
</table>
<p style="margin:20px 0 0;font-size:15px;color:#080808;text-align:center;font-weight:700">¡Mucha suerte y gracias por apoyar al Rayo Vallecañas! ⚡</p>
</td></tr>
<tr><td style="padding:16px 24px;background:#F4F4F4;color:#888;font-size:11px;line-height:1.5">
Este mensaje es un justificante de compra y no sustituye a la participación física ni acredita por sí solo los derechos de participación.
Has recibido este correo porque has comprado lotería del Rayo Vallecañas; no lo utilizaremos para enviarte publicidad sin tu consentimiento.
</td></tr></table></td></tr></table></body></html>`;
}
