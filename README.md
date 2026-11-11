# ⚡ Rayo Vallecañas · Plataforma de gestión

App web instalable (PWA) para llevar todo el Rayo Vallecañas, equipo amateur de **fútbol 7**, en un único sitio: sorteos, dinero, plantilla, partidos, patrocinadores y avisos al móvil. Sustituye a los Excel y a los procesos a mano.

- **Producción:** <https://rayo-vallecanas.vercel.app>
- **Versión actual:** 3.21.0 (el historial completo está en la propia app, en *Novedades*, y en `src/lib/changelog.ts`).
- **Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage, RLS) · Web Push · Vercel (región Frankfurt).

## Qué hace la app

La barra inferior del móvil tiene seis apartados: **Inicio · Partidos · Plantilla · Sorteos · Finanzas · Gestión**. Cada persona ve solo lo que le permiten sus permisos.

### Inicio
- Portada centrada en el partido, en tres momentos: semana normal, víspera/día de partido (**Especial Matchday**, con cuenta atrás y el tiempo previsto) y post partido (resultado, MVP y la siguiente convocatoria).
- Tarjeta «¡Estás convocado!» para responder sin salir de Inicio, votaciones abiertas y la votación del MVP.
- Logos de patrocinadores (discretos, se pueden apagar), tutorial de bienvenida y ventana de novedades al actualizar.

### Partidos
- Calendario y resultados de liga, copa, amistosos y torneos; rivales con escudo, color y campo.
- **Sincronización con la liga** (futormes): importa calendario, resultados y **clasificación**. El día del partido la app mira sola la web y avisa «Ya están los datos del partido».
- **Convocatorias**: lista, hora y lugar de quedada, notas; cada jugador responde Voy / No voy / Duda, también desde el propio aviso del móvil. Recordatorio automático e historial.
- **Actas**: alineación, goles, asistencias, tarjetas, portero y goles encajados. Las estadísticas de la temporada se calculan solas.
- **MVP votado por el equipo**: al guardar el acta se abre la votación (voto secreto, hasta las 23:59), con desempate por goles o por un gestor.
- **Imagen del resultado** para compartir en WhatsApp o Instagram (con los patrocinadores si se quiere).

### Plantilla
- Fichas estilo **cromo** con foto, posición, dorsal y estadísticas, por temporada; vista de campo por líneas.
- Datos personales y contactos de emergencia (solo con permiso), documentos con caducidad (DNI, ficha, reconocimiento médico…).
- **Cuotas** por temporada, cuotas especiales y su cobro (pasa a Finanzas).
- Preparar la temporada nueva, historia del club, **presentación animada de fichajes** y exportación a Excel/PDF.

### Sorteos (lotería y rifas)
- Campañas de **lotería** (un número) o **rifa** (números del 1 al N): precio, importe jugado, donativo, fecha, premio.
- Numeración automática, por talonarios por vendedor o elegida a mano. Venta desde el móvil, sin números repetidos aunque vendan muchos a la vez.
- Cobros totales o parciales, anulaciones controladas, ranking de vendedores y **Mis ventas** para cada vendedor.
- **Justificante** para el comprador en PDF o por WhatsApp con el mensaje ya escrito.
- **Página pública de la rifa**: transparencia, «comprueba tu número» y acta del sorteo con huella digital.
- Lo cobrado pasa a Finanzas con un botón. Exportación a Excel.

### Finanzas
- Ingresos y gastos con categorías, justificantes adjuntos, saldo inicial y temporadas (septiembre–agosto).
- Los movimientos no se borran: se anulan con motivo y queda registrado.
- Informes con filtros y exportación a Excel y PDF. Las cuotas, los sorteos y los plazos de patrocinio llegan aquí.
- Los jugadores **nunca** acceden a Finanzas (bloqueado también en la base de datos).

### Gestión
- **Usuarios**: altas con contraseña provisional, deshabilitar accesos, foto de perfil.
- **Perfiles y permisos**: superadministrador, gestor y jugador, más **perfiles a medida** y excepciones por persona (ver, crear, editar, borrar en cada módulo).
- **Patrocinadores**: fichas, acuerdos por temporada (dinero, especie o mixto), plazos de cobro y avisos de vencimiento.
- **Avisos**: mensajes push al equipo, **votaciones sí/no** y registro de todos los avisos enviados.
- **Auditoría** (solo superadministrador):
  - *Cambios*: quién cambió qué y cuándo, con el **valor anterior y el nuevo** de cada campo, en lenguaje claro. Filtros por apartado, acción, persona y fechas, e historial completo de cualquier registro.
  - *Accesos*: entradas, salidas, intentos fallidos y cambios de contraseña, con dispositivo e IP; última conexión de cada persona (la apunta la app en cada página), de la más reciente a la más antigua.
  - *Sesiones abiertas*: dispositivos con la sesión iniciada, ordenados por última conexión, y botón para cerrarla al momento (por ejemplo, si alguien pierde el móvil).
- **Copia de seguridad** (solo superadministrador): todo en Excel o JSON.

### Para todos
- PWA instalable con el escudo, funciona en móvil y ordenador, pantallas ya vistas sin conexión.
- **Avisos al móvil** (Web Push) configurables por cada persona.
- Página de privacidad. Identidad del club: rojo, negro, dorado y blanco.

## Seguridad
- Toda la seguridad está también en la base de datos (**RLS** de Postgres): aunque alguien manipule la app, solo lee y cambia lo que su perfil permite.
- Registro abierto desactivado: solo entra quien da de alta un gestor.
- Auditoría automática (triggers) de todas las tablas importantes; no se puede modificar desde la app.

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com) (región UE, p. ej. Frankfurt).
2. Aplica las migraciones de `supabase/migrations/` en orden (SQL Editor, o `npx supabase link` + `npx supabase db push`).
3. **Authentication → Providers → Email**: desactiva *Allow new users to sign up*.
4. **Authentication → URL Configuration**: Site URL = la URL de la app; añade `https://TU-DOMINIO/auth/callback` a Redirect URLs.
5. **El primer usuario que se cree será superadministrador.** Créalo en *Authentication → Users → Add user*; al resto se les da de alta desde *Gestión → Usuarios*.

### 2. Variables de entorno
Copia `.env.example` a `.env.local` (y en Vercel, *Settings → Environment Variables*):

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión a Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor: altas de usuarios, avisos, historial de accesos |
| `NEXT_PUBLIC_SITE_URL` | URL pública (enlaces de los emails y del justificante) |
| `CRON_SECRET` | Protege las tareas automáticas de Vercel |
| `RESEND_*` | Email (opcional; desactivado mientras no haya dominio) |
| `WHATSAPP_*` | WhatsApp Business (opcional; sin él se abre WhatsApp con el mensaje escrito) |

Las claves de los avisos push (VAPID) se generan solas y se guardan en la base de datos.

### 3. Tareas automáticas (Vercel Cron, `vercel.json`)
Recordatorio de convocatorias (cada mañana), comprobación de la liga (lunes), búsqueda del resultado el día del partido (varias vueltas) y cierre de la votación del MVP (23:15).

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
npm test             # lógica de cada módulo (node --test), sin base de datos
npm run test:live    # la web de la liga de verdad: comprueba que se sigue leyendo bien
npm run build && npm start &
npm run test:e2e     # prueba de humo: entra como superadministrador y como jugador y recorre la app
npx tsc --noEmit && npm run lint
```
En cada PR, GitHub Actions pasa las pruebas de lógica, los tipos, el lint y la prueba de humo contra un Supabase local.

### 5. Despliegue
Cada cambio que entra en `main` se despliega en Vercel. Si un cambio trae SQL nuevo, se ejecuta primero en el *SQL Editor* de Supabase y después se fusiona.

## Estructura
```
supabase/migrations/   Esquema, RLS, funciones y auditoría (una migración por versión con SQL)
src/app/(app)/         Pantallas con sesión: inicio, partidos, plantilla, loteria, finanzas, admin…
src/app/login, auth/   Entrar, salir, invitaciones y recuperar contraseña
src/app/rifa/          Página pública de las rifas
src/app/api/           Exportaciones, copia de seguridad, respuestas desde avisos y tareas automáticas
src/lib/               Sesión y permisos, lógica de cada módulo, liga, avisos, formatos
src/components/        Componentes de pantalla compartidos
e2e/                   Prueba de humo de la app entera (Playwright)
public/                Escudo, iconos de la PWA, logos y service worker
```

## Versiones
Cada cambio sube la versión en `package.json` y añade una entrada en `src/lib/changelog.ts` (MAYOR.MENOR.PARCHE: fase nueva · función nueva · arreglo). Lo que se ve en *Novedades* sale de ahí.

## Pendiente
- Material deportivo.
- Email (falta dominio propio + Resend) y WhatsApp Business oficial.
- Página pública de patrocinadores e importación del Excel antiguo de cuentas (aplazadas).
