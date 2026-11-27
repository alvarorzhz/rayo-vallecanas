# ⚡ Rayo Vallecañas · Plataforma de gestión

App web instalable (PWA) para llevar todo el Rayo Vallecañas, equipo amateur de **fútbol 7**, en un único sitio: sorteos, dinero, plantilla, partidos, patrocinadores, material, periódico del club y avisos al móvil. Sustituye a los Excel y a los procesos a mano.

- **Producción:** <https://rayo-vallecanas.vercel.app>
- **Versión actual:** 4.31.6. El historial de la app está en la propia app (*Novedades*) y en `src/lib/changelog.ts`; el de la base de datos, en [docs/cambios-base-de-datos.md](docs/cambios-base-de-datos.md).
- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, RLS) · Web Push · Vercel (región Frankfurt).

## Documentación técnica

| Documento | Qué cuenta |
|---|---|
| [Arquitectura](docs/arquitectura.md) | Diagrama de las piezas, cómo habla la app con la base de datos, tareas automáticas y estructura del código |
| [Base de datos](docs/base-de-datos.md) | Relaciones principales por módulo y funciones SQL críticas (qué hacen y qué no tocar) |
| [Cambios de la base de datos](docs/cambios-base-de-datos.md) | Cada migración, con su versión de la app y si ya está en producción |
| [Variables de entorno](docs/variables-de-entorno.md) | Obligatorias, opcionales y de pruebas, y qué pasa si falta cada una |
| [Recuperación de copias](docs/recuperacion.md) | Qué copias hay y el procedimiento, probado, para volver a montar la app desde una copia |

Unas pruebas (`npm test`) fallan si una migración, una tabla o una variable de entorno nueva no está apuntada en estos documentos.

## Qué hace la app

La barra inferior del móvil tiene seis apartados: **Inicio · Partidos · Plantilla · Sorteos · Finanzas · Gestión**. Cada persona ve solo lo que le permiten sus permisos.

### Inicio
- Portada centrada en el partido, en tres momentos: semana normal, víspera/día de partido (**Especial Matchday**, con cuenta atrás y el tiempo previsto) y post partido (resultado, MVP y la siguiente convocatoria).
- «¡Estás convocado!» para responder sin salir de Inicio, votaciones abiertas, la votación del MVP, la noticia destacada de La Voz y cumpleaños.
- Logos de patrocinadores (discretos, se pueden apagar), tutorial de bienvenida y ventana de novedades al actualizar.

### Partidos
- Calendario y resultados de liga, copa, amistosos y torneos; rivales con escudo, color y campo.
- **Sincronización con la liga** (futormes): calendario, resultados y **clasificación**, con histórico por competición (Apertura y Clausura en la misma temporada). El día del partido la app mira sola la web y avisa «Ya están los datos del partido». Aviso de jugadores nuevos en la liga.
- **Convocatorias**: lista, hora y lugar de quedada, notas; Voy / No voy / Duda con comentario, también desde el propio aviso del móvil. Recordatorio automático e historial. Los fichajes entran solos en la convocatoria abierta.
- **Actas**, también **en directo** durante el partido: alineación, goles, asistencias, tarjetas (con ciclo de amarillas), portero y goles encajados. Las estadísticas se calculan solas.
- **MVP votado por el equipo** y **notas 1–10** de cada partido (se ve el podio al cerrar), con desempate por votos, nota, goles o un gestor.
- **La porra**, **objetivos de temporada**, rachas, «¿Subimos? ¿Ganamos?» (simulación de la liga), **cápsula del tiempo** de la temporada, **Rayo Wrapped** y resumen de temporada de cada jugador.
- **Imágenes para compartir** en WhatsApp o Instagram: convocatoria con cromos, «Hoy jugamos» y resultado, en formato publicación o historia.

### Plantilla
- Fichas estilo **cromo** con foto, posición, dorsal, logros y estadísticas por temporada, agrupadas por líneas.
- Datos personales y contactos de emergencia (solo con permiso), documentos con caducidad (DNI, ficha, reconocimiento médico…).
- Historia del club, **presentación animada de fichajes**, preparar la temporada nueva (junio–agosto) y exportación a Excel/PDF.

### La Voz del Rayo
- El periódico del club: crónicas, previas, entrevistas que contesta el propio jugador, comunicados y promociones de patrocinadores. Borradores con IA (Gemini, solo con apodos), reacciones con emoji, **rueda de prensa de Don Rayo** con voz, y noticias públicas en `/noticias`.

### Sorteos (lotería y rifas)
- Campañas de **lotería** (un número) o **rifa** (números del 1 al N): precio, importe jugado, donativo, fecha, premio.
- Numeración automática, por **talonarios** (eligiendo números dentro del talonario) o a mano. Venta desde el móvil, sin números repetidos aunque vendan muchos a la vez.
- Cobros totales o parciales, anulaciones controladas, cuentas y ranking de vendedores y **Mis ventas** para cada vendedor.
- **Justificante** para el comprador en PDF o por WhatsApp con el mensaje ya escrito.
- **Página pública de la rifa**: transparencia, «comprueba tu número» y acta del sorteo con huella digital; solo se sortea con las ventas cerradas.
- Lo cobrado pasa a Finanzas con un botón. Exportación a Excel.

### Finanzas
- Ingresos y gastos con categorías, justificantes adjuntos, saldo inicial y temporadas (septiembre–agosto).
- Los movimientos no se borran: se anulan con motivo y queda registrado.
- **Cuotas** de los jugadores (con cuotas especiales y botón para recordarlas) y **Patrocinadores** (acuerdos por temporada, plazos de cobro y avisos de vencimiento).
- Informes con filtros y exportación a Excel y PDF. Los jugadores **nunca** acceden a Finanzas (bloqueado también en la base de datos).

### Gestión
Cuatro cajones: **Equipo**, **Avisos**, **Material** y **Control**.
- **Usuarios**: altas con contraseña provisional, deshabilitar accesos, bajas que borran los datos personales («Antiguo miembro»).
- **Perfiles y permisos**: superadministrador, gestor y jugador, más **perfiles a medida** y excepciones por persona (ver, crear, editar, borrar en cada módulo).
- **Avisos**: mensajes push al equipo, **votaciones sí/no** (también «en directo») y registro de todo lo enviado.
- **Material**: inventario del club (equipaciones por talla y dorsal, balones, petos, botiquín…), quién tiene cada cosa, aviso «Lo que falta» y compra apuntada en Finanzas. Cada jugador ve en su ficha solo lo suyo.
- **Control** (solo superadministrador):
  - *Auditoría*: cambios con el valor anterior y el nuevo, accesos (entradas, fallos, cambios de contraseña con dispositivo e IP) y sesiones abiertas con botón para cerrarlas.
  - *Uso*: qué pantallas abre el equipo, quién entra, app instalada o navegador, participación.
  - *Copia de seguridad*: Excel o JSON a mano y copia automática cada lunes con los archivos, ver [docs/recuperacion.md](docs/recuperacion.md).
  - *Mandos*: modo mantenimiento, mensaje fijo para todos, apagar apartados, cerrar sesión a todos, forzar actualización y «ver como» otro perfil.

### Para todos
- PWA instalable con el escudo, en móvil y ordenador; pantallas ya vistas sin conexión y `/reparar` si la app se queda en blanco.
- **Avisos al móvil** (Web Push) configurables por cada persona; cambiar la contraseña en *Perfil*.
- Página de privacidad. Identidad del club: rojo, negro, dorado y blanco.

## Seguridad
- Toda la seguridad está también en la base de datos (**RLS** de Postgres): aunque alguien manipule la app, solo lee y cambia lo que su perfil permite.
- Registro abierto desactivado: solo entra quien da de alta un gestor.
- Auditoría automática (disparadores) de todas las tablas importantes; no se puede modificar desde la app.
- Más detalle en [docs/arquitectura.md](docs/arquitectura.md) y [docs/base-de-datos.md](docs/base-de-datos.md).

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com) (región UE, p. ej. Frankfurt).
2. Aplica las migraciones de `supabase/migrations/` en orden (`npx supabase link` + `npx supabase db push`, o pegándolas en el SQL Editor).
3. **Authentication → Providers → Email**: desactiva *Allow new users to sign up*.
4. **Authentication → URL Configuration**: Site URL = la URL de la app; añade `https://TU-DOMINIO/auth/callback` a Redirect URLs.
5. **El primer usuario que se cree será superadministrador.** Créalo en *Authentication → Users → Add user*; al resto se les da de alta desde *Gestión → Usuarios*. (Si vas a restaurar una copia, no crees ninguno: sigue [docs/recuperacion.md](docs/recuperacion.md).)

### 2. Variables de entorno
Copia `.env.example` a `.env.local` (y en Vercel, *Settings → Environment Variables*). Obligatorias: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` y, en producción, `CRON_SECRET`. Las opcionales (Gemini, Vercel Blob, email, WhatsApp) y qué pasa sin cada una: [docs/variables-de-entorno.md](docs/variables-de-entorno.md).

### 3. Tareas automáticas
Vercel Cron, definido en `vercel.json`: recordatorios de convocatorias, plazos y cumpleaños, comprobación de la liga, fichajes nuevos, búsqueda del resultado el día del partido, cierre del MVP, cápsula del tiempo y copia semanal. Horarios en [docs/arquitectura.md](docs/arquitectura.md#tareas-automáticas-verceljson).

### 4. Desarrollo local
```bash
npm install
npx supabase start          # Postgres + Auth locales (requiere Docker); carga los datos de ejemplo
cp .env.example .env.local  # con las claves que imprime supabase start
npm run dev
```
`supabase start` (y `supabase db reset`) cargan `supabase/seed.sql`: un equipo inventado con plantilla, partidos, cuentas, sorteos y votaciones. Usuarios de ejemplo, todos con contraseña `Rayo1234!`: `alvaro@rayo.test` (superadministrador), `ruben@rayo.test` (gestor), `dani@rayo.test` y `javi@rayo.test` (jugadores). Esos datos nunca llegan a producción.

### Pruebas
```bash
npm test             # lógica de cada módulo (node --test), sin base de datos; incluye que la documentación esté al día
npm run test:db      # contra el Supabase local (supabase start): sorteos, Finanzas, convocatorias, votaciones,
                     # MVP, cápsula, bajas, mandos y la sincronización con la liga (con la web de la liga simulada)
npm run test:live    # la web de la liga de verdad: comprueba que se sigue leyendo bien
npm run build && npm start &
npm run test:e2e     # prueba de humo: entra como superadministrador y como jugador y recorre la app
npx tsc --noEmit && npm run lint
```
En cada PR, GitHub Actions pasa las pruebas de lógica, los tipos, el lint, las pruebas contra la base de datos y la prueba de humo contra un Supabase local. `test:db` se niega a correr si la dirección de Supabase no es localhost: escribe datos de prueba.

### 5. Despliegue
Cada cambio que entra en `main` se despliega en Vercel. Si un cambio trae SQL nuevo, se ejecuta primero en el *SQL Editor* de producción, se apunta en [docs/cambios-base-de-datos.md](docs/cambios-base-de-datos.md) y después se fusiona.

## Versiones
Cada cambio sube la versión en `package.json` y añade una entrada en `src/lib/changelog.ts` (MAYOR.MENOR.PARCHE: fase nueva · función nueva · arreglo). Lo que se ve en *Novedades* sale de ahí. Si la versión trae una migración, va también en [docs/cambios-base-de-datos.md](docs/cambios-base-de-datos.md).

## Pendiente
- Email (falta dominio propio + Resend) y WhatsApp Business oficial.
- Página pública de patrocinadores e importación del Excel antiguo de cuentas (aplazadas).
