# Recuperación de copias de seguridad

> Procedimiento definido en la versión 4.31.6 y **probado de verdad** en un Supabase local: copia de los datos de ejemplo → base de datos vacía → restaurar → las 60 tablas y los archivos quedan idénticos, y la app sigue numerando por donde iba. Repite esa prueba (abajo, «Ensayo») cada vez que cambie mucho el esquema, y por lo menos una vez por temporada.

## Qué copias hay

| Copia | Qué lleva | Dónde | Cuántas |
|---|---|---|---|
| **Automática** (cada lunes, 03:00 UTC) | Todas las tablas **y todos los archivos** (fotos, escudos, logos, justificantes, documentos, audios) en un `.json.gz` | Vercel Blob (si está `BLOB_READ_WRITE_TOKEN`) o el cajón privado `backups` de Supabase | Las 8 últimas |
| **Archivo completo** (*Gestión → Copia*, a mano) | Todas las tablas en `.json`, **sin archivos** | Lo que descargue el superadministrador | Las que guarde |
| **Excel** (*Gestión → Copia*) | Una hoja por tabla, para leer | Lo que descargue el superadministrador | — |

Lo que **no** viaja en ninguna copia, a propósito:
- Contraseñas (las guarda Supabase Auth). Al restaurar, cada uno recibe una provisional.
- `app_secrets` (claves de los avisos y de los tokens de los botones) y `push_subscriptions` (los móviles con avisos activados). Se regeneran solas; cada persona vuelve a activar los avisos.
- `session_activity` (sesiones abiertas): eran de los dispositivos de antes.
- Lo que está bajo llave en una cápsula del tiempo aún cerrada.

El plan gratis de Supabase **no hace copias propias** (las diarias son del plan Pro en adelante), así que estas son las únicas. Si un día se pasa a Pro, sus copias diarias de *Database → Backups* son la primera opción ante un desastre (no incluyen los archivos de Storage).

**Consejo:** cada mes, el superadministrador descarga la última copia automática (*Gestión → Copia → Copias automáticas*) y la guarda fuera (Drive, disco). Si se pierde el proyecto de Supabase entero y la copia estaba en su cajón `backups`, se pierde con él.

## ¿Qué ha pasado?

### A. Se ha borrado o estropeado algo concreto

Un partido mal editado, un patrocinador borrado, una cuota cambiada por error. **No hace falta restaurar nada.**

1. *Gestión → Control → Auditoría → Cambios*: busca el registro (filtro por apartado y fechas). Cada cambio guarda el **valor anterior y el nuevo** de cada campo, también de lo borrado.
2. Si es poca cosa, vuelve a escribirlo desde la app con los valores anteriores.
3. Si es mucho (por ejemplo, un partido con su acta entera), ábrelo en la última copia en Excel para tener todos los datos a mano, y vuelve a meterlos desde la app. Hacerlo desde la app (y no con SQL) mantiene la auditoría y las comprobaciones.

Ventas, cobros y movimientos de Finanzas no se pueden borrar: como mucho están **anulados**, y se ve quién y por qué.

### B. Se ha perdido la base de datos (o hay que montarla de cero)

El proyecto de Supabase se ha borrado, está corrupto o hay que mudarse a otro. Se monta un proyecto **nuevo** y se carga la última copia automática.

Tiempo estimado: una hora. Necesitas un ordenador con Node 22 y este repositorio (`npm install`).

#### 1. Avisa y para la app
- Si la app sigue en pie, *Gestión → Control → Mandos → Modo mantenimiento*. Si no, no hace falta.
- Descarga la última copia automática (`rayo-vallecanas-copia-AAAAMMDD-HHMM.json.gz`): desde *Gestión → Copia* si aún funciona, o desde Vercel → *Storage → Blob* (carpeta `copias/`).

#### 2. Proyecto nuevo en Supabase
1. [supabase.com](https://supabase.com) → *New project*, región **Frankfurt (eu-central-1)**.
2. Aplica todas las migraciones, en orden:
   ```bash
   npx supabase link --project-ref NUEVO_REF
   npx supabase db push
   ```
   (o pega cada archivo de `supabase/migrations/` en el *SQL Editor*, en orden de nombre).
3. **No crees ningún usuario todavía**: el script se niega a restaurar en un proyecto con usuarios, y el primero que se crea sería superadministrador.

#### 3. Usuarios y archivos (script)
Con la URL y la clave *service_role* del proyecto **nuevo** (*Project Settings → API*):
```bash
RESTORE_SUPABASE_URL=https://NUEVO_REF.supabase.co \
RESTORE_SERVICE_ROLE_KEY=eyJ... \
node scripts/restaurar-copia.mjs rayo-vallecanas-copia-AAAAMMDD-HHMM.json.gz --simular   # primero, comprobar

RESTORE_SUPABASE_URL=... RESTORE_SERVICE_ROLE_KEY=... \
node scripts/restaurar-copia.mjs rayo-vallecanas-copia-AAAAMMDD-HHMM.json.gz
```
El script:
- crea a cada usuario con **el mismo id y email** y una contraseña provisional (las imprime al final: **guárdalas**, no se vuelven a ver);
- sube los archivos a sus cajones;
- deja los datos preparados en `rayo-vallecanas-copia-AAAAMMDD-HHMM.restaurar.sql`.

Se niega a escribir en el proyecto de producción actual (`cakmcerhielecrfxgdlk`) salvo con `--es-produccion-y-esta-vacia`, y en cualquier proyecto que ya tenga usuarios.

#### 4. Los datos (SQL)
Ejecuta el `.restaurar.sql` en el proyecto nuevo, **una sola vez**:
- *SQL Editor* → pega el contenido → *Run*; o
- `npx supabase db query --remote="CADENA_DE_CONEXIÓN" -f rayo-vallecanas-copia-AAAAMMDD-HHMM.restaurar.sql` (la cadena está en *Connect → Direct connection*).

Es un único bloque: o entra todo o no entra nada. Carga cada tabla con los disparadores apagados (para que los guardas de la app no lo frenen y la auditoría no se llene de ruido), conserva los ids, deja que las columnas calculadas se calculen solas y pone los contadores donde iban. Las filas por defecto que crean las migraciones se sustituyen por las de la copia. Al final obliga a todos a cambiar la contraseña.

#### 5. Configura el proyecto nuevo
1. *Authentication → Providers → Email*: desactiva **Allow new users to sign up**.
2. *Authentication → URL Configuration*: Site URL = `https://rayo-vallecanas.vercel.app`, y añade `https://rayo-vallecanas.vercel.app/auth/callback` a Redirect URLs.

#### 6. Apunta la app al proyecto nuevo
En Vercel → *Settings → Environment Variables* (Production), cambia `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` por las del proyecto nuevo y pulsa **Redeploy**. Actualiza también el *ref* del proyecto en la memoria del proyecto y en `scripts/restaurar-copia.mjs` (`PRODUCTION_REF`).

#### 7. Después de restaurar
- [ ] Entra con tu email y la contraseña provisional: la app pide cambiarla.
- [ ] Mira por encima: Inicio, un partido con su acta, Plantilla con fotos, Finanzas (el saldo debe coincidir con el del Excel de la copia), un sorteo con sus ventas.
- [ ] *Gestión → Control → Mandos*: quita el modo mantenimiento si lo pusiste (se restaura tal y como estaba en la copia).
- [ ] Manda a cada uno su contraseña provisional por privado.
- [ ] Avisa al equipo de que vuelvan a activar los avisos al móvil (*Perfil*).
- [ ] Lanza una copia nueva (*Gestión → Copia*) para empezar la serie en el proyecto nuevo.
- [ ] Apunta en la memoria del proyecto qué pasó, qué copia se usó y cuántos días de datos se perdieron.

Lo que se haya hecho entre la copia y el desastre se pierde: como mucho, una semana. Se puede reconstruir a mano con lo que sepa cada uno (resultados de futormes con *Partidos → Liga → Sincronizar*, ventas con los talonarios en papel).

## Ensayo (en local, sin tocar producción)

```bash
npx supabase start                    # Supabase local con los datos de ejemplo
# 1. Hacer una copia: Gestión → Copia → «Hacer copia ahora» con la app en local (npm run dev),
#    o descargar una de producción.
npx supabase db reset --no-seed       # base vacía, solo migraciones
RESTORE_SUPABASE_URL=http://127.0.0.1:54321 \
RESTORE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY de «supabase status»> \
node scripts/restaurar-copia.mjs copia.json.gz
npx supabase db query -f copia.restaurar.sql
```
Compara el número de filas de cada tabla con la copia (*Gestión → Copia → Excel*, hoja «Resumen») y entra con una contraseña provisional.

Ensayado el 2026-11-27 con la versión 4.31.3 del esquema: 59 tablas, 486 filas y 1 archivo restaurados, recuento por tabla idéntico, contenido idéntico fila a fila y la auditoría siguió numerando desde donde iba.
