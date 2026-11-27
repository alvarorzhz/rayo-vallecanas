# Variables de entorno

> Actualizado en la versión 4.32.1. En local van en `.env.local` (copia `.env.example`); en producción, en Vercel → *Settings → Environment Variables*. Tras cambiar una en Vercel hay que pulsar **Redeploy**. Una prueba (`src/lib/__tests__/docs.test.ts`) falla si el código usa una variable que no está en esta página.

Las claves de los avisos push (VAPID) y la de firmar los botones de los avisos **no son variables**: se generan solas la primera vez y se guardan en la tabla `app_secrets`.

## Obligatorias

Sin ellas la app no arranca o no funciona lo básico.

**Cómo comprobar `CRON_SECRET` en producción:** Vercel → proyecto *rayo-vallecanas* → *Settings* → *Environment Variables* → buscar `CRON_SECRET` y que tenga marcado *Production*. Si no está: *Add New*, nombre `CRON_SECRET`, valor una clave larga al azar (por ejemplo, 40 letras y números), entorno *Production*, *Save*, y luego *Deployments* → último → *Redeploy*. Para confirmar que funciona: *Settings* → *Cron Jobs* → *Run* en una tarea (por ejemplo `/api/cron/liga`, que no guarda nada) y en *Logs* debe salir 200, no 503.

| Variable | Dónde se ve | Para qué | Si falta |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador y servidor | Dirección del proyecto de Supabase | La app no arranca |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Navegador y servidor | Clave pública de Supabase: todo lo que se hace con la sesión de cada persona, bajo RLS | La app no arranca |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo servidor** | Clave que se salta RLS: altas de usuarios, avisos push, tareas automáticas, copias, respuestas desde los avisos, registro de accesos. **Nunca** con prefijo `NEXT_PUBLIC_` | Fallan altas, avisos, tareas y copias |
| `NEXT_PUBLIC_SITE_URL` | Navegador y servidor | URL pública (`https://rayo-vallecanas.vercel.app`): enlaces de invitación, justificantes, rifa pública | Enlaces que apuntan a `localhost` |
| `CRON_SECRET` | Solo servidor | Vercel la manda en cada tarea automática (`Authorization: Bearer …`) y la app la comprueba (`src/lib/cron.ts`) | **Ninguna tarea automática funciona** (convocatorias, liga, resultado, fichajes, MVP, cápsula, copia): responden 503 y lo apuntan en los registros de Vercel como `[cron] … falta CRON_SECRET`. Desde 4.32.1 la app falla cerrada; antes, sin ella, cualquiera podía lanzarlas desde Internet. En local, para probar una tarea, pon una cualquiera en `.env.local` y llama con `curl -H "Authorization: Bearer <la clave>" http://localhost:3000/api/cron/…` |

## Opcionales

Si faltan, la función correspondiente se apaga o usa un plan B.

| Variable | Para qué | Si falta |
|---|---|---|
| `GEMINI_API_KEY` | Borradores con IA en La Voz del Rayo y la voz de Don Rayo (Google AI Studio, plan gratis). Puede llevar signos: no la «limpies» | El editor solo ofrece copiar las instrucciones para la IA; Don Rayo sin voz |
| `GEMINI_MODEL` | Otro modelo de texto si Google cambia los nombres (se prueba después de los de serie) | Se usan los de serie. Mejor vacía |
| `GEMINI_TTS_MODEL` | Otro modelo de voz para Don Rayo | Se usan los de serie |
| `GEMINI_BASE_URL` | Otra dirección para la API de Gemini (pruebas o un proxy) | `https://generativelanguage.googleapis.com` |
| `BLOB_READ_WRITE_TOKEN` | Guardar la copia semanal en Vercel Blob (fuera de Supabase). Lo crea Vercel al conectar un *Blob store* al proyecto | La copia va al cajón privado `backups` de Supabase |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` | Mandar justificantes por email (Resend). **Apagado** mientras no haya dominio propio | No hay email; el justificante se manda por WhatsApp o PDF |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_API_VERSION` | WhatsApp Business oficial (Cloud API) para los justificantes. Sin cuenta Business todavía | Se abre WhatsApp con el mensaje ya escrito |

## Solo para pruebas

No van en Vercel.

| Variable | Para qué |
|---|---|
| `E2E_URL` | Dirección de la app para la prueba de humo (`npm run test:e2e`). Por defecto `http://localhost:3000` |
| `LEAGUE_LIVE`, `LEAGUE_COMPETITION`, `LEAGUE_TEAM` | `npm run test:live`: lee la web de la liga de verdad (competición y equipo de futormes; por defecto la Apertura 2026/27) |
| `RESTORE_SUPABASE_URL`, `RESTORE_SERVICE_ROLE_KEY` | `scripts/restaurar-copia.mjs`: proyecto de destino de una restauración, ver [recuperacion.md](recuperacion.md) |
| `NODE_ENV` | La pone Next.js sola; no se toca |
