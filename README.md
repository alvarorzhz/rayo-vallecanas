# ⚡ Rayo Vallecañas · Plataforma de gestión

PWA para la gestión integral del Rayo Vallecañas. **Fase 1: infraestructura y lotería.**

Stack: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS) · Resend · WhatsApp Business Platform · Vercel.

## Qué incluye la fase 1

| Área | Estado |
|---|---|
| Inicio/cierre de sesión, recuperación de contraseña, alta por invitación | ✅ |
| Roles (superadmin, directiva, responsable deportivo, jugador) y permisos por módulo (consultar/crear/modificar/eliminar) personalizables por usuario | ✅ |
| Seguridad en base de datos (RLS): cada vendedor solo ve sus ventas y sus compradores; la directiva ve todo | ✅ |
| Campañas de lotería configurables (número, sorteo, fecha, precio, importe jugado, donativo, total, prefijo de referencia) | ✅ |
| Participaciones individuales con estados disponible / reservada / vendida / anulada | ✅ |
| Tres modos de numeración por campaña: automática, talonarios por vendedor, elección manual | ✅ |
| Vendedores asignados por campaña y talonarios | ✅ |
| Venta desde el móvil, transaccional y sin duplicados (probado con 200 ventas simultáneas) | ✅ |
| Cobros (total, parcial, pendiente, devoluciones) separados de lo vendido | ✅ |
| Anulación controlada (libera o anula las participaciones) | ✅ |
| Justificante (pantalla imprimible/PDF, email con Resend, WhatsApp Business por plantilla) con registro y reenvío | ✅ |
| Alternativa sin cuenta de WhatsApp Business: “Abrir en WhatsApp” con el mensaje ya escrito | ✅ |
| Dashboard por perfil, panel de campaña, ranking de vendedores, registro del resultado del sorteo | ✅ |
| Exportación Excel (ventas, cobros, vendedores) | ✅ |
| Auditoría de operaciones (valores antes/después) y registros económicos inmutables | ✅ |
| PWA instalable con el escudo, consulta sin conexión de pantallas ya vistas (las ventas exigen conexión) | ✅ |

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com) (región UE, p. ej. Frankfurt).
2. Aplica las migraciones de `supabase/migrations/` en orden (SQL Editor, o `npx supabase link` + `npx supabase db push`).
3. **Authentication → Providers → Email**: desactiva *Allow new users to sign up* (las altas se hacen por invitación desde la app).
4. **Authentication → URL Configuration**: Site URL = la URL de la app; añade `https://TU-DOMINIO/auth/callback` a Redirect URLs.
5. **El primer usuario que se registre será superadministrador.** Créalo en *Authentication → Users → Add user* con tu email; después invita al resto desde *Usuarios* en la app.

### 2. Variables de entorno
Copia `.env.example` a `.env.local` (y en Vercel, en *Settings → Environment Variables*). `SUPABASE_SERVICE_ROLE_KEY` y las claves de Resend/WhatsApp solo se usan en el servidor.

### 3. Email (Resend)
Crea una cuenta en [resend.com](https://resend.com), verifica el dominio del club y rellena `RESEND_API_KEY` y `RESEND_FROM`.

### 4. WhatsApp Business (opcional)
Hace falta una cuenta de WhatsApp Business Platform (Meta) con un número dedicado y una plantilla aprobada, de categoría *Utility*, idioma `es`, llamada `justificante_loteria`:

```
RAYO VALLECAÑAS ⚡
¡Gracias por colaborar con nuestro equipo, {{1}}!
Tu compra de lotería ha quedado registrada.
Número: {{2}}
Participaciones: {{3}}
Referencia: {{4}}
Importe: {{5}}
¡Mucha suerte y gracias por apoyar al Rayo Vallecañas!
```

Rellena `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_TEMPLATE`. Mientras no estén, la app ofrece el envío manual por wa.me.

### 5. Desarrollo local
```bash
npm install
npx supabase start          # Postgres + Auth locales (requiere Docker)
cp .env.example .env.local  # con las claves que imprime supabase start
npm run dev
```

### 6. Despliegue
Importa el repositorio en Vercel, añade las variables de entorno y despliega.

## Estructura
```
supabase/migrations/   Esquema, RLS, funciones transaccionales y auditoría
src/app/(app)/         Pantallas autenticadas (inicio, lotería, mis ventas, admin)
src/app/login, auth/   Acceso, invitaciones y recuperación
src/app/api/           Exportación Excel
src/lib/               Supabase, sesión/permisos, formatos, justificantes, envíos
src/components/        UI compartida
public/                Escudo, iconos PWA y service worker
```

## Decisiones pendientes (configurables, no bloquean)
Numeración y talonarios (se elige por campaña), precio/importe jugado/donativo (por campaña), personas de la directiva (roles desde *Usuarios*), cuenta de WhatsApp Business (variables de entorno), política de conservación de datos de compradores (pendiente de definir; la base de datos guarda solo nombre, teléfono, email y consentimiento comercial explícito).

## Próximas fases
2 Finanzas · 3 Plantilla y temporadas · 4 Partidos y convocatorias · 5 Material, patrocinadores, push. Los módulos `finances`, `squad` y `matches` ya existen en el sistema de permisos.
