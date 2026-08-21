# Integración con el backend

## Estado real: no existe todavía

Hay que decirlo claro para que nadie busque lo que no está. **Hoy no hay ni una línea de integración con la API.** Verificado en disco, no existe:

- `src/environments/` ni ningún archivo de configuración por ambiente
- `proxy.conf.json` ni configuración `proxyConfig` en `angular.json`
- `provideHttpClient()` en `src/app/app.config.ts`
- interceptores (JWT, refresh, errores, tenant)
- `src/app/core/api/` ni cliente HTTP generado
- script `api:sync` en `package.json`

Todo lo que sigue es el diseño acordado, no código existente.

## Puertos y documento OpenAPI

| Pieza | URL |
|---|---|
| Dev server de Angular | `http://localhost:4200` |
| API, perfil `http` | `http://localhost:5123` |
| API, perfil `https` | `https://localhost:7020` (además expone `:5123`) |
| Documento OpenAPI | `/openapi/v1.json` — **solo en Development** |

Los dos perfiles están en `maquinaria-backend/src/Maquinaria.Api/Properties/launchSettings.json`. `Program.cs` llama `AddOpenApi()` siempre y `MapOpenApi()` únicamente cuando el entorno es Development, así que en producción el documento no se sirve.

Para levantar la API en local, desde el repo del backend:

```bash
dotnet run --project src/Maquinaria.Api --launch-profile https
```

## CORS o proxy: decisión abierta

`maquinaria-backend/src/Maquinaria.Api/Program.cs` hoy **no configura CORS** — solo tiene `AddOpenApi()`, `MapOpenApi()` y `UseHttpsRedirection()`. Así que `:4200 → :5123` sería cross-origin y falla.

Las dos salidas son un `proxy.conf.json` en el dev server de Angular, o CORS explícito en la API. Hay que decidirlo antes de la primera llamada real.

## Contrato: cliente generado y commiteado

Regla de `01-arquitectura.md` §10.6a. .NET 10 expone OpenAPI de forma nativa (`Microsoft.AspNetCore.OpenApi`, sin Swashbuckle) y el front consume ese documento:

```
npm run api:sync    →  genera src/app/core/api/ desde /openapi/v1.json
```

Los archivos generados **se versionan en este repo**. Dos razones, y ambas importan:

1. El front compila sin necesitar el backend corriendo.
2. Cualquier cambio de contrato aparece como un *diff* revisable en el historial del front. Es el sustituto práctico del commit atómico que dos repos independientes no permiten.

El script `api:sync` **aún no existe** y la herramienta generadora es una **decisión abierta**.

## Evolución del contrato: expandir → migrar → contraer

Regla de `01-arquitectura.md` §10.6b. Con despliegues independientes, un cambio incompatible rompe producción durante la ventana entre un deploy y el otro. Nunca se cambia un contrato de golpe:

| Paso | Repo | Acción |
|---|---|---|
| 1. Expandir | backend | Agrega el campo o endpoint nuevo. **Conserva el viejo** |
| 2. Migrar | frontend | Regenera el cliente y adopta lo nuevo |
| 3. Contraer | backend | Recién ahora elimina lo viejo |

La regla en una línea: **cada despliegue debe ser compatible con la versión actualmente desplegada del otro repo.** Renombrar un campo y actualizar el front "al mismo tiempo" no existe; uno de los dos despliegues llega primero.

Convención de trazabilidad (§10.6c): referenciar desde el commit del front el issue del back que le corresponde.

## Dominios en producción y la cookie del refresh token

| Subdominio | Servicio |
|---|---|
| `app.tudominio.com` | Cloudflare Pages (este repo) |
| `api.tudominio.com` | Railway (la API, proxied) |

No es cosmética: son subdominios del **mismo dominio registrable a propósito**. El refresh token viaja en cookie `HttpOnly` — **nunca** en `localStorage`, donde cualquier XSS lo roba — y al compartir dominio registrable la cookie se emite para `.tudominio.com` y funciona con `SameSite=Lax`.

**No usar los dominios por omisión** de Pages y Railway (`*.pages.dev`, `*.up.railway.app`): son dominios registrables distintos, la cookie sería de terceros y obligaría a `SameSite=None`, que los navegadores restringen cada vez más.

El dominio concreto todavía no se ha registrado, así que la configuración de Cloudflare Pages está pendiente. La ruta de salida del build que hay que darle es `dist/maquinaria-frontend/browser`.

## Login: tres campos

La pantalla de ingreso pide **Empresa** (el `slug` del tenant), correo y contraseña (§10.5).

El tercer campo es obligatorio por arquitectura, no por preferencia de interfaz: cada empresa tiene **su propia base de datos**, así que hay que saber en cuál buscar antes de validar nada.

Consecuencias que el front debe respetar:

- **Un solo mensaje de error.** Nunca distinguir entre empresa inexistente, correo inexistente y contraseña incorrecta: distinguir regala la lista de clientes.
- **No hay registro público.** Los tenants los da de alta un superadministrador y los usuarios se crean por invitación con token de un solo uso. No debe existir pantalla de alta propia.

## Permisos

Los permisos son cadenas `modulo.accion` (`equipos.editar`, `rentas.autorizar`, `reportes.exportar`), se resuelven al iniciar sesión y viajan en el JWT (§6). Son una matriz `Usuario → Rol → Permiso`, no un enum de roles, y cada tenant tiene sus propios roles a partir de una semilla de 9.

El front debe autorizar contra **la cadena de permiso, nunca contra el nombre del rol**.

## Interceptores previstos

JWT, refresh automático, manejo de errores y `tenant` (§9). Ninguno existe todavía.

## Zona horaria

El backend guarda todo en UTC con **zona horaria de presentación por tenant**. El formateo del front tiene que respetar esa zona, no la del navegador.
