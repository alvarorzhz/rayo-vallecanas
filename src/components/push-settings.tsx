"use client";
import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { FormMessage } from "@/components/form-message";
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupported } from "@/lib/push-client";
import { sendTestPush, setNotifySales } from "@/app/(app)/perfil/push-actions";

export function PushSettings({ isManager, notifySales }: { isManager: boolean; notifySales: boolean }) {
  const [state, setState] = useState<"loading" | "on" | "off" | "blocked" | "unsupported" | "ios">("loading");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>();
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!pushSupported()) return setState(isIOS() && !isStandalone() ? "ios" : "unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      setState((await currentSubscription()) && Notification.permission === "granted" ? "on" : "off");
    })();
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          {state === "on" ? <Bell size={18} className="text-green-700" /> : <BellOff size={18} className="text-negro/60" />}
          {state === "on" ? "Avisos activados en este dispositivo" : state === "loading" ? "Comprobando…" : "Avisos desactivados en este dispositivo"}
        </div>
        {state === "off" && (
          <button className="btn-primary" disabled={pending}
            onClick={() => start(async () => { const r = await enablePush(); if (r.ok) { setState("on"); setMsg({ ok: "¡Avisos activados!" }); } else setMsg({ error: r.error }); })}>
            Activar
          </button>
        )}
        {state === "on" && (
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={pending} onClick={() => start(async () => setMsg(await sendTestPush()))}>Probar</button>
            <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { await disablePush(); setState("off"); setMsg({ ok: "Avisos desactivados" }); })}>Desactivar</button>
          </div>
        )}
      </div>
      {state === "blocked" && <p className="text-sm text-negro/60">Tienes los avisos bloqueados para esta app. Actívalos en los ajustes del navegador o del móvil y vuelve aquí.</p>}
      {state === "ios" && <p className="text-sm text-negro/60">En iPhone los avisos solo funcionan con la app instalada: pulsa <b>Compartir</b> → <b>Añadir a pantalla de inicio</b> y ábrela desde el icono.</p>}
      {state === "unsupported" && <p className="text-sm text-negro/60">Este navegador no admite avisos. Prueba con Chrome, Safari o Edge actualizados.</p>}
      {isManager && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" defaultChecked={notifySales} className="mt-1 accent-rojo"
            onChange={(e) => start(() => setNotifySales(e.target.checked))} />
          <span>Avisarme de cada venta nueva <span className="text-negro/65">(si hay muchas ventas, puedes quitarlo)</span></span>
        </label>
      )}
      <p className="text-xs text-negro/65">
        Cada dispositivo (móvil, ordenador…) se activa por separado. En Android y en el ordenador (Chrome o Edge) puedes
        contestar a la convocatoria con los botones «Voy» y «No voy» del propio aviso; en iPhone, toca el aviso y contesta en la app.
      </p>
      <FormMessage state={msg} />
    </div>
  );
}
