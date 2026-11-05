"use client";
import { getPushKey, removePushSubscription, savePushSubscription } from "@/app/(app)/perfil/push-actions";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

function urlB64ToUint8Array(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

/** Pide permiso (debe llamarse desde un toque del usuario) y guarda la suscripción. */
export async function enablePush(): Promise<{ ok?: true; error?: string }> {
  if (!pushSupported()) return { error: "Este dispositivo no admite avisos." };
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { error: "Has bloqueado los avisos. Puedes activarlos en los ajustes del navegador." };
  return syncSubscription();
}

/** Con el permiso ya concedido, asegura que este dispositivo está registrado en el servidor. */
export async function syncSubscription(): Promise<{ ok?: true; error?: string }> {
  try {
    const reg = await registration();
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = await getPushKey();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(key) });
    }
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const r = await savePushSubscription(json, navigator.userAgent);
    return r.error ? { error: r.error } : { ok: true };
  } catch (e) {
    return { error: "No se pudieron activar los avisos: " + (e as Error).message };
  }
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await removePushSubscription(sub.endpoint);
    await sub.unsubscribe();
  }
}
