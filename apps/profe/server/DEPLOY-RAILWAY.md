# Desplegar en Railway (paso a paso)

## Qué sube a Railway con esta carpeta `server/`

- Un **API Node/Express** pequeño: `GET /health` y `POST /api/send-reset-email` (Resend).
- Es lo que la app de escritorio puede usar para **“¿Olvidaste tu contraseña?”** si configuras la URL y el secreto en **Usuarios → Servicio de correo**.

## Qué **no** es este despliegue

- **No** es la aplicación Gestor Académico completa en el navegador.
- La app principal es **Electron + SQLite + IPC** en tu PC; llevarla “toda” a Railway implicaría un **backend web** (API + base de datos compartida, p. ej. PostgreSQL), **autenticación por sesión/JWT** y adaptar el front a **HTTP en lugar de `electronAPI`**. Eso es otro proyecto grande.

Si solo quieres **ver el aspecto del front** sin Electron, puedes usar `npm run dev` en local o un hosting de estáticos; la vista previa en navegador sigue siendo limitada (mock).

---

## Requisitos previos

1. Cuenta en [Railway](https://railway.app).
2. Cuenta en [Resend](https://resend.com) (API key y dominio/remitente verificado, o el remitente de prueba que permitan).
3. Repo en GitHub/GitLab/Bitbucket (o subir el código con la CLI de Railway).

---

## Pasos en Railway

### 1. Nuevo proyecto

1. Entra a [railway.app](https://railway.app) → **New project**.
2. Elige **Deploy from GitHub repo** (o la opción que uses) y selecciona el repositorio de **Gestor Académico**.

### 2. Servicio con raíz `server` (importante en monorepo)

1. Tras crear el servicio, abre **Settings** del servicio.
2. En **Root directory** pon exactamente: `server`  
   Así el build usa el `Dockerfile` y el `package.json` de esta carpeta, no los de la raíz del monorepo.

### 3. Generar dominio público

1. Pestaña **Settings** → **Networking** → **Generate domain** (o **Public networking**).
2. Copia la URL, por ejemplo: `https://gestor-academico-mail-production-xxxx.up.railway.app`  
   **Sin** barra final al pegarla en la app de escritorio.

### 4. Variables de entorno

En el servicio → **Variables**, añade:

| Variable            | Descripción |
|---------------------|-------------|
| `MAIL_API_SECRET`   | Una clave larga y secreta (la misma que pondrás en la app en Usuarios → correo). |
| `RESEND_API_KEY`    | API key de Resend. |
| `MAIL_FROM`         | Correo remitente permitido en Resend (ej. `Gestor <onboarding@resend.dev>` o tu dominio verificado). |

Railway suele inyectar `PORT` solo; el contenedor ya usa `PORT` o **8080** por defecto en el `Dockerfile`.

### 5. Despliegue

1. Guarda variables → Railway redeploy automático (o **Deploy** manual).
2. Espera a que el build termine (Dockerfile: build en dos etapas).

### 6. Comprobar que funciona

En el navegador o con `curl`:

```bash
curl https://TU-DOMINIO.up.railway.app/health
```

Debe responder JSON con `"ok": true`.

---

## Enlazar la app de escritorio

1. Abre **Usuarios** (como administrador) → configuración del **servicio de correo**.
2. **URL del servicio:** la URL pública de Railway (sin `/` al final).
3. **Secreto / API:** el mismo valor que `MAIL_API_SECRET` en Railway.

La app llamará al endpoint de reset protegido con ese secreto.

---

## Archivos relevantes

- `Dockerfile` — imagen de producción Node 20.
- `railway.toml` — builder Dockerfile y healthcheck `GET /health`.
- `src/index.ts` — rutas Express.

Si Railway prioriza `railway.json` y falla el build, en el panel del servicio fuerza **Dockerfile** como builder o elimina/ajusta `railway.json` para que no entre en conflicto con `railway.toml`.

---

## Problemas frecuentes

- **502 / Application failed to respond:** revisa logs del servicio en Railway; a veces falta `RESEND_API_KEY` o el proceso no escucha en `0.0.0.0:$PORT` (este código ya usa `0.0.0.0`).
- **401 al enviar correo:** `MAIL_API_SECRET` distinto entre Railway y la app, o falta header `Authorization: Bearer …`.
- **Resend rechaza el remitente:** verifica `MAIL_FROM` en el panel de Resend.
