/** Piezas del «despacho del club» (Gestión): placa de la puerta, calendario de mesa y colores de cada perfil. */

const TZ = "Europe/Madrid";

/** Placa de latón de la puerta con el escudo y, al lado, el calendario de mesa con la fecha de hoy. */
export function OfficePlaque() {
  const now = new Date();
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-ES", { timeZone: TZ, ...o }).format(now);
  const month = part({ month: "short" }).replace(".", "");
  const day = part({ day: "numeric" });
  const weekday = part({ weekday: "long" });
  return (
    <div className="mb-4 flex items-stretch gap-3">
      <div className="office-plaque flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-white sm:px-5">
        <span aria-hidden className="plaque-screw absolute left-2 top-2" />
        <span aria-hidden className="plaque-screw absolute right-2 top-2" />
        <span aria-hidden className="plaque-screw absolute bottom-2 left-2" />
        <span aria-hidden className="plaque-screw absolute bottom-2 right-2" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/escudo.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain drop-shadow" />
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.25em] text-dorado">Rayo Vallecañas · Gestión</p>
          <p className="sport truncate text-xl font-black leading-tight sm:text-2xl">Despacho del club</p>
        </div>
      </div>
      <div aria-label={`Hoy es ${weekday} ${day} de ${month}`} role="img"
        className="desk-calendar flex w-16 shrink-0 flex-col overflow-hidden rounded-xl bg-white text-center shadow-[0_10px_20px_-12px_rgba(0,0,0,0.5)] ring-1 ring-black/10 sm:w-20">
        <span className="bg-rojo py-0.5 text-[10px] font-black uppercase tracking-widest text-white">{month}</span>
        <span className="sport flex flex-1 items-center justify-center text-3xl font-black leading-none text-negro sm:text-4xl">{day}</span>
        <span className="truncate border-t border-dashed border-black/10 px-1 pb-1 pt-0.5 text-[9px] font-bold uppercase tracking-wide text-negro/60">{weekday}</span>
      </div>
    </div>
  );
}

/** Color de la banda del carnet o la acreditación según el perfil base. */
export const ROLE_BAND: Record<string, string> = {
  superadmin: "bg-rojo text-white",
  admin: "bg-dorado text-negro",
  player: "bg-negro text-white",
};
export const bandOf = (base: string) => ROLE_BAND[base] ?? ROLE_BAND.player;
