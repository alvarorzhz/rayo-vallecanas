import Link from "next/link";
import { CLUB } from "@/lib/club";

export const metadata = { title: "Protección de datos" };

const contacto = CLUB.contact
  ? <>escribiendo a <b>{CLUB.contact}</b> o hablando con cualquier gestor del club</>
  : <>hablando con cualquier gestor o con la persona que te vendió la lotería o la rifa</>;

function S({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="sport text-xl font-black text-negro">{title}</h2>
      <div className="space-y-2 text-[15px] leading-relaxed text-negro/80">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-gris">
      <header className="franja bg-negro px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/escudo.png" alt="" width={48} height={57} className="relative drop-shadow" />
          <div className="relative">
            <h1 className="sport text-3xl font-black">Protección de datos</h1>
            <p className="text-sm text-dorado">Cómo trata el {CLUB.name} tus datos personales</p>
          </div>
        </div>
      </header>
      <article className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <p className="rounded-2xl bg-white p-4 text-[15px] ring-1 ring-black/5">
          <b>En resumen:</b> solo guardamos los datos necesarios para organizar el equipo y las ventas de lotería y rifas.
          No los vendemos ni los cedemos a nadie, y no te enviaremos publicidad si no lo has aceptado expresamente.
        </p>

        <S title="1. Quién es el responsable">
          <p>El responsable del tratamiento es el <b>{CLUB.name}</b>, {CLUB.description}. Puedes contactar con nosotros {contacto}.</p>
        </S>

        <S title="2. Qué datos tratamos y para qué">
          <p><b>Si compras lotería o una rifa:</b> nombre y apellidos, teléfono y/o email, los números o participaciones que compras,
            el importe, lo que has pagado y quién te lo vendió. Los usamos para registrar tu compra, enviarte el justificante,
            controlar los cobros y avisarte si te toca.</p>
          <p><b>Si eres jugador o miembro del club y usas la app:</b> nombre, email, teléfono, tu foto de perfil si la subes, tu perfil
            y permisos, las ventas que registras y un registro de las operaciones importantes que haces (auditoría). Los usamos para
            darte acceso, organizar el equipo y llevar unas cuentas claras.</p>
          <p><b>Si estás en la plantilla:</b> nombre y apellidos, foto, dorsal, posición, estado (activo, lesionado o de baja),
            pierna y altura, y las temporadas en el club. Además, solo para los gestores y para ti: fecha de nacimiento, teléfono,
            email, un contacto de emergencia, observaciones deportivas o internas y los documentos que se suban a tu ficha (DNI,
            ficha federativa, certificado médico, autorizaciones o seguro), que se guardan en un almacén privado. Los usamos para
            organizar el equipo, tramitar las fichas y poder avisar a alguien si te pasa algo en un partido o entrenamiento. Si pagas
            una cuota, el pago queda apuntado en las cuentas del club con tu nombre. No guardamos tu dirección.</p>
          <p><b>Notificaciones:</b> si activas los avisos en tu dispositivo, guardamos el identificador técnico que da tu navegador
            para poder enviártelos. Puedes desactivarlos cuando quieras.</p>
        </S>

        <S title="3. Por qué podemos tratarlos (base jurídica)">
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Compras de lotería y rifas:</b> es necesario para gestionar la compra que nos pides (art. 6.1.b RGPD).</li>
            <li><b>Miembros del club:</b> la relación que tienes con el equipo y el interés legítimo del club en organizarse (art. 6.1.b y 6.1.f).</li>
            <li><b>Registro de operaciones económicas:</b> el interés legítimo en poder justificar las cuentas y evitar errores o fraudes (art. 6.1.f).</li>
            <li><b>Otras comunicaciones del club</b> (avisos de futuras campañas, eventos…): solo si lo aceptas expresamente (art. 6.1.a).
              El justificante de compra no implica ese permiso.</li>
          </ul>
        </S>

        <S title="4. Quién puede ver tus datos">
          <p>Dentro del club, solo quien lo necesita: los gestores ven todas las ventas; cada vendedor ve solo las suyas; los jugadores
            no ven los datos de los compradores. De la plantilla, los compañeros solo ven tu nombre, foto, dorsal, posición y estado;
            tus datos personales y documentos solo los ven los gestores con permiso para ello, y tus cuotas solo quien lleva las
            cuentas. Los permisos los controla la propia base de datos.</p>
          <p>Usamos estos proveedores, que tratan los datos por cuenta del club:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Supabase</b> (base de datos y archivos), con los datos alojados en Frankfurt (Unión Europea).</li>
            <li><b>Vercel</b> (alojamiento de la app), con servidores en Frankfurt. Es una empresa de EE. UU. adherida al Marco de
              Privacidad de Datos UE-EE. UU. y con cláusulas contractuales tipo.</li>
            <li><b>WhatsApp</b>, cuando el vendedor te manda el justificante desde su propio WhatsApp.</li>
            <li>Los servicios de notificaciones de tu navegador (Google, Apple o Mozilla), solo si activas los avisos.</li>
          </ul>
        </S>

        <S title="5. Cuánto tiempo los guardamos">
          <p>Los datos de cada campaña se guardan mientras dura y, después, el tiempo necesario para justificar las cuentas del club
            y atender posibles reclamaciones (como máximo 6 años). Los datos de los miembros se guardan mientras pertenezcan al club;
            al darse de baja se deshabilita su acceso y se conservan solo los registros económicos y de auditoría necesarios.</p>
        </S>

        <S title="6. Tus derechos">
          <p>Puedes pedir en cualquier momento <b>acceder</b> a tus datos, <b>corregirlos</b>, <b>borrarlos</b>, <b>oponerte</b> o
            <b> limitar</b> su uso, o recibirlos en un formato que puedas llevarte (<b>portabilidad</b>), {contacto}.
            Si das permiso para recibir comunicaciones, puedes retirarlo cuando quieras.</p>
          <p>Si crees que no hemos tratado bien tus datos, puedes reclamar ante la Agencia Española de Protección de Datos
            (<a className="font-semibold text-rojo" href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>).</p>
        </S>

        <S title="7. Seguridad">
          <p>El acceso a la app es individual y con contraseña, las comunicaciones van cifradas (HTTPS), cada persona ve solo lo que le
            corresponde y las operaciones importantes quedan registradas.</p>
        </S>

        <p className="text-xs text-negro/65">Última actualización: {CLUB.updated}.</p>
        <Link href="/" className="btn-ghost">Volver a la app</Link>
      </article>
    </main>
  );
}
