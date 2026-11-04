import "server-only";
import { Resend } from "resend";
import { receiptHtml, receiptText, type ReceiptData } from "@/lib/receipt";

export type SendResult = { ok: true; providerId: string | null } | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reintenta errores transitorios (red / 5xx / 429) hasta 3 veces con espera creciente. */
async function withRetry(fn: () => Promise<SendResult & { retryable?: boolean }>, attempts = 3) {
  let last: SendResult & { retryable?: boolean } = { ok: false, error: "Sin intentos" };
  for (let i = 0; i < attempts; i++) {
    try {
      last = await fn();
    } catch (e) {
      last = { ok: false, error: e instanceof Error ? e.message : String(e), retryable: true };
    }
    if (last.ok || !last.retryable) return { result: last as SendResult, attempts: i + 1 };
    await sleep(500 * 3 ** i);
  }
  return { result: last as SendResult, attempts };
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
export const whatsappConfigured = () =>
  Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE);

export async function sendReceiptEmail(to: string, d: ReceiptData) {
  if (!emailConfigured()) {
    return { result: { ok: false, error: "El envío de email no está configurado (RESEND_API_KEY / RESEND_FROM)" } as SendResult, attempts: 0 };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  return withRetry(async () => {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM!,
      to,
      replyTo: process.env.RESEND_REPLY_TO || undefined,
      subject: `Tu lotería del Rayo Vallecañas · ${d.reference}`,
      html: receiptHtml(d),
      text: receiptText(d).replace(/[*_]/g, ""),
    });
    if (error) {
      const status = (error as { statusCode?: number }).statusCode ?? 0;
      return { ok: false, error: error.message, retryable: status === 429 || status >= 500 };
    }
    return { ok: true, providerId: data?.id ?? null };
  });
}

/**
 * WhatsApp Business Platform (Cloud API). Los mensajes iniciados por la empresa
 * requieren una plantilla aprobada por Meta. Parámetros del cuerpo de la plantilla:
 * {{1}} nombre, {{2}} número, {{3}} participaciones, {{4}} referencia, {{5}} importe.
 */
export async function sendReceiptWhatsApp(toE164: string, d: ReceiptData, amount: string) {
  if (!whatsappConfigured()) {
    return { result: { ok: false, error: "WhatsApp Business no está configurado" } as SendResult, attempts: 0 };
  }
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  return withRetry(async () => {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toE164,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "es" },
          components: [
            {
              type: "body",
              parameters: [d.buyerName, d.lotteryNumber, String(d.quantity), d.reference, amount].map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}`, retryable: res.status === 429 || res.status >= 500 };
    }
    return { ok: true, providerId: json.messages?.[0]?.id ?? null };
  });
}
