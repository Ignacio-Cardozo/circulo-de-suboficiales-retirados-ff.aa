# Respaldos de la base de datos

El sistema tiene tres niveles de protección:

| Qué | Para qué | Dónde |
|---|---|---|
| **Copia diaria `.dump`** (GitHub Actions + `pg_dump`) | Recuperarse de una pérdida de datos y **migrar** a otro servidor | Configuración → Respaldos y migración |
| **Exportación a Excel (CSV)** | Consultar o revisar los datos sin conocimientos técnicos | Configuración → Respaldos y migración |
| **Restauración de Neon** | Deshacer un error de hace unas pocas horas | Panel de Neon → Branches → Restore |

## Cómo funciona

1. El workflow [`.github/workflows/db-backup.yml`](../.github/workflows/db-backup.yml) ejecuta `pg_dump` contra Neon (solo el esquema `public`).
2. Verifica que el archivo se pueda leer, lo **cifra** con AES-256 (`openssl`) y lo guarda como artifact de GitHub.
   El cifrado es obligatorio: el repositorio es público y los artifacts de un repo público los puede descargar cualquier usuario de GitHub.
3. En la app, un administrador ve la lista, puede crear una copia en el momento y descargarla. La API ([`api/_backup.ts`](../api/_backup.ts)) baja el artifact, lo descifra y entrega un `.dump` común, listo para `pg_restore`.
4. Todos los endpoints `/api/backup/*` verifican el JWT de Neon Auth y que el usuario tenga rol `owner` o `admin`.

### Dos ambientes: principal y prueba

Cada ambiente tiene su propia base de datos y sus propias copias; nunca se mezclan.

| Ambiente | Base de datos (secret de GitHub) | Cuándo se respalda | Duración de las copias | Desde dónde se ve en la app |
|---|---|---|---|---|
| `produccion` | `DATABASE_URL` | Todos los días a las 03:00 + a mano | 30 días (la del día 1 de cada mes: 90) | El deploy de producción de Vercel |
| `prueba` | `DATABASE_URL_PRUEBA` | Solo a mano | 7 días | Local (`npm run dev`) y previews de Vercel |

- La app detecta sola en qué ambiente está: `produccion` si corre en el deploy de producción de Vercel (`VERCEL_ENV=production`), `prueba` en cualquier otro lado. Se puede forzar con la variable `BACKUP_AMBIENTE`.
- "Crear copia ahora" dispara el workflow con el ambiente de la app, y la lista muestra solo las copias de ese ambiente.
- Las copias se llaman `db-backup-produccion-…`, `db-backup-produccion-mensual-…` y `db-backup-prueba-…`.
- Si falta el secret del ambiente pedido, el workflow falla con un mensaje claro: nunca usa la base del otro ambiente en su lugar.
- Desde GitHub también se puede correr a mano: Actions → *Backup de base de datos* → *Run workflow* → elegir el ambiente.

## Configuración (una sola vez)

### 1. Generar la clave de cifrado

Cualquier texto largo y aleatorio (mínimo 16 caracteres). Por ejemplo:

```bash
openssl rand -base64 32
```

Guardala también en un lugar seguro fuera del sistema (gestor de contraseñas): **sin esta clave las copias de GitHub no se pueden abrir**.

### 2. Secrets en GitHub

Repositorio → Settings → Secrets and variables → Actions → *New repository secret*:

| Secret | Valor |
|---|---|
| `DATABASE_URL` | Connection string de la base **principal** (la misma que usa Vercel en producción) |
| `DATABASE_URL_PRUEBA` | Connection string de la base **de prueba** (la misma de tu `.env` local). Opcional: solo hace falta para respaldar la base de prueba |
| `BACKUP_PASSPHRASE` | La clave del paso 1 |

Las connection strings se copian desde Neon → tu proyecto → **Connect**, eligiendo la branch correspondiente (la principal o la de prueba).

### 3. Token de GitHub para la app

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → *Generate new token*:

- Repository access: *Only select repositories* → este repositorio.
- Permissions → Repository permissions → **Actions: Read and write** (nada más).
- Expiración: la más larga que permita tu cuenta, y anotá la fecha para renovarlo.

### 4. Variables de entorno en Vercel

Proyecto → Settings → Environment Variables (entorno *Production*):

| Variable | Valor |
|---|---|
| `BACKUP_GITHUB_TOKEN` | El token del paso 3 |
| `BACKUP_PASSPHRASE` | La misma clave del paso 1 |
| `BACKUP_GITHUB_REPO` | `owner/repositorio` (opcional si Vercel expone las variables de sistema `VERCEL_GIT_*`) |
| `NEON_AUTH_URL` | Opcional: por defecto se usa `VITE_NEON_AUTH_URL` |
| `BACKUP_AMBIENTE` | Opcional: `produccion` o `prueba`. No hace falta en Vercel (se detecta solo) |

Después de guardarlas, hacé un redeploy.

En local, las mismas variables van en el `.env` (`BACKUP_GITHUB_TOKEN`, `BACKUP_PASSPHRASE`, `BACKUP_GITHUB_REPO`). La app local trabaja con el ambiente `prueba`.

### Probar antes de subir a main

GitHub solo deja disparar un workflow a mano (botón *Run workflow* o "Crear copia ahora") cuando el archivo está en la rama por defecto. Para probar antes, el workflow tiene un disparo **temporal**: cada push a la rama `backup-test` respalda la base de **prueba** (`DATABASE_URL_PRUEBA`).

```bash
git checkout -b backup-test
git push -u origin backup-test
```

En unos minutos la copia aparece en Actions y en la app local (Configuración → Respaldos), donde se puede descargar. Antes de mergear a `main`, borrá el bloque `push:` del workflow.

### 5. Probar

En la app: Configuración → Respaldos y migración → **Crear copia ahora**. En un minuto aproximadamente aparece en la lista; descargala para confirmar que todo funciona.

## Restaurar o migrar

1. Descargá una copia `.dump` desde la app.
2. Creá una base vacía en el servidor de destino (PostgreSQL 17 o superior).
3. Restaurá:

   ```bash
   pg_restore --no-owner --no-privileges -d "postgresql://usuario:clave@servidor/base" backup.dump
   ```

4. Apuntá `DATABASE_URL` (Vercel y el secret de GitHub) a la nueva base.

> Las cuentas de inicio de sesión viven en el esquema `neon_auth`, que administra Neon Auth y no se incluye en la copia. Si se cambia de proveedor, los usuarios deben registrarse de nuevo y un administrador reasignar los roles en la tabla `app_users`.

### Abrir una copia directamente desde GitHub (sin la app)

Si la app no está disponible, se puede descargar el artifact desde la pestaña *Actions* del repositorio y descifrarlo a mano:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -in backup-AAAA-MM-DD.dump.enc -out backup.dump
```

## Límites a tener en cuenta

- GitHub conserva los artifacts como máximo 90 días. Para un archivo histórico, descargá una copia por mes y guardala fuera del sistema.
- La descarga desde la app pasa por una función de Vercel, que tiene un límite de ~4,5 MB por respuesta. Hoy la copia ocupa mucho menos; si la base crece por encima de eso, hay que descargar desde GitHub como se explica arriba.
- El workflow usa `pg_dump` 17. Si Neon pasa a una versión mayor de Postgres, actualizá `PG_MAJOR` en el workflow.
- Si el repositorio no tiene actividad durante 60 días, GitHub desactiva los workflows programados. Se reactivan desde la pestaña *Actions*.
