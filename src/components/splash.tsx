"use client";
import { useEffect } from "react";

const KEY = "rv-splash-visto";

/** Oculta la pantalla de carga cuando la app ya está lista (como mínimo un instante para que se vea el escudo). */
function SplashHide() {
  useEffect(() => {
    const el = document.getElementById("splash");
    if (!el || el.classList.contains("splash-gone")) return;
    const start = performance.now();
    const hide = () => {
      const wait = Math.max(0, 700 - (performance.now() - start));
      setTimeout(() => {
        el.classList.add("splash-out");
        setTimeout(() => el.classList.add("splash-gone"), 450);
        try {
          sessionStorage.setItem(KEY, "1");
        } catch {}
      }, wait);
    };
    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide, { once: true });
  }, []);
  return null;
}

/** Pantalla de carga con el escudo. Se pinta con el HTML, antes de que cargue nada más. */
export function Splash() {
  return (
    <>
      <div id="splash" aria-hidden className="splash">
        <div className="splash-franja" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/escudo.png" alt="" width={132} height={156} className="splash-escudo" />
        <div className="splash-titulo">
          Rayo <span>Vallecañas</span>
        </div>
        <div className="splash-barra"><span /></div>
      </div>
      {/* Solo se muestra al abrir la app, no en cada recarga de la misma sesión */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem("${KEY}")){var s=document.getElementById("splash");s&&s.classList.add("splash-gone")}}catch(e){}`,
        }}
      />
      <SplashHide />
    </>
  );
}
