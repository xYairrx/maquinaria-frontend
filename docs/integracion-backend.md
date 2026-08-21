# Integración con el backend

## Estado real: el primer flujo ya corre

**Actualizado el 2026-08-21.** La integración existe y el ciclo completo —invitación,
definir contraseña, iniciar sesión, pantalla protegida— funciona de punta a punta contra
la API real.

Lo que ya está en disco:

| pieza | dónde |
|---|---|
| Configuración de ambiente | `src/app/nucleo/configuracion.ts` — un archivo, no `src/environments/` |
| Cliente HTTP | `src/app/nucleo/api.ts`, con los tipos en `contratos.ts` |
| `provideHttpClient()` | `src/app/app.config.ts`, con `withInterceptors` |
| Interceptor de token | `src/app/nucleo/interceptor-token.ts` |
| Guard de sesión | `src/app/nucleo/guard-sesion.ts` |
| Estado de sesión | `src/app/nucleo/sesion.ts` — signals + `localStorage` |
| Pantallas de empresa | `src/app/paginas/{invitacion,entrar,inicio}`, con carga diferida |
| Pantallas de plataforma | `src/app/paginas/plataforma/{entrar-plataforma,panel}` |
| Sesión de plataforma | `src/app/nucleo/sesion-plataforma.ts` — **llave de almacenamiento separada** |

### Dos sesiones, separadas a propósito

El token de plataforma y el de empresa se guardan bajo **llaves distintas**, y el
interceptor elige cuál mandar según la ruta: `/api/plataforma/**` lleva el de plataforma,
el resto el de empresa.

No es duplicación. Son dos poblaciones con dos audiencias de JWT distintas, y el backend
las separa a propósito con la policy del claim `ambito`. Guardarlas en la misma llave
permitiría mandar un token al ámbito equivocado —un 403 desconcertante— y deshacer en el
cliente la separación que el servidor mantiene. Además, así se pueden tener las dos
abiertas a la vez: dar de alta una empresa y entrar a ella para revisarla.

Lo que **sigue faltando**:

- **`api:sync`.** Los tipos de `contratos.ts` están escritos a mano. El plan sigue siendo
  generarlos desde `/openapi/v1.json` y commitear el resultado, para que un cambio de
  contrato salga como diff en la revisión y no como error en tiempo de ejecución.
- **Interceptor de refresco.** El login ya devuelve un token de refresco y la API lo
  guarda en `sesion_refresh`, pero el front todavía no lo usa: cuando el token de 15
  minutos caduca, hay que volver a entrar.
- **Pruebas.** No hay ni una del front. `vitest` está instalado y sin usar.

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

## CORS: decidido

**CORS explícito en la API**, no proxy en el dev server. `Program.cs` llama `AddCors()` con
una política por omisión cuyos orígenes salen de configuración:

```json
// appsettings.Development.json
"Cors": { "Origenes": ["http://localhost:4200"] }
```

En `appsettings.json` la lista va **vacía**: en producción el origen es el dominio real y
se configura por ambiente. Una lista vacía no permite nada, que es el valor por omisión
correcto.

Se eligió sobre el proxy porque el frontend en producción vive en otro dominio
—Cloudflare Pages contra Railway— así que CORS hay que resolverlo de todas formas. Un
proxy solo lo habría escondido en desarrollo y lo habría dejado aparecer al desplegar.

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
