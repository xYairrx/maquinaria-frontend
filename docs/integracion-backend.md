# Integración con el backend

## Estado real: el primer flujo ya corre

**Actualizado el 2026-08-24.** La integración existe y el ciclo completo —invitación,
definir contraseña, iniciar sesión, pantalla protegida— funciona de punta a punta contra
la API real. El restablecimiento de contraseña también está implementado en los dos lados.

Lo que ya está en disco:

| pieza | dónde |
|---|---|
| Configuración de ambiente | `src/app/nucleo/ambiente/configuracion.ts` — un archivo, no `src/environments/` |
| Qué empresa es esta | `src/app/nucleo/ambiente/tenant.ts` — sale del subdominio, con `tenant.spec.ts` al lado |
| Identidad del producto | `src/app/nucleo/ambiente/sitio.ts` — el nombre y la marca, escritos una sola vez |
| Cliente HTTP | `src/app/nucleo/api/api.ts` y `api-plataforma.ts`, con los tipos en `api/contratos.ts` y `api/contratos-plataforma.ts` |
| Traducción de errores | `src/app/nucleo/api/mensaje-error.ts` — saca el `detail` del `ProblemDetails` |
| `provideHttpClient()` | `src/app/app.config.ts`, con `withInterceptors` |
| Interceptor de token | `src/app/nucleo/sesion/interceptor-token.ts` |
| Guards de sesión | `src/app/nucleo/sesion/guard-sesion.ts` y `guard-plataforma.ts` |
| Estado de sesión | `src/app/nucleo/sesion/sesion.ts` — signals + `localStorage` |
| Qué puede ver quien entró | `src/app/nucleo/sesion/acceso.ts` — permisos del rol ∩ módulos del plan |
| Pantallas de empresa | `src/app/paginas/empresa/{aceptar-invitacion,iniciar-sesion,inicio,solicitar-restablecimiento,restablecer-contrasena}`, con carga diferida |
| Pantallas de plataforma | `src/app/paginas/plataforma/{iniciar-sesion,empresas}` |
| Pantalla del portal | `src/app/paginas/portal/seleccionar-empresa` |
| Sesión de plataforma | `src/app/nucleo/sesion/sesion-plataforma.ts` — **llave de almacenamiento separada** |

`nucleo/` ya no es plano: va en `ambiente/`, `api/` y `sesion/`. El criterio de qué va en
cada una está en [`convenciones.md`](convenciones.md) §Estructura de carpetas.

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
- **Pruebas, casi todas.** Ya no es cero: `npm test` (builder `@angular/build:unit-test`,
  con `vitest` y `jsdom`) corre **2 archivos y 39 pruebas** en verde — `tenant.spec.ts` y
  `acceso.spec.ts`, las dos funciones puras que deciden a qué empresa se llama y qué
  módulos se dibujan. Ninguna pantalla ni ningún servicio con HTTP tiene prueba todavía.

## Puertos y documento OpenAPI

| Pieza | URL |
|---|---|
| Dev server de Angular | `http://localhost:4200`, y `http://<slug>.localhost:4200` para entrar a una empresa |
| API, perfil `http` | `http://localhost:5123` — **es a la que apunta `configuracion.urlApi`** |
| API, perfil `https` | `https://localhost:7020` (además expone `:5123`) |
| Documento OpenAPI | `/openapi/v1.json` — **solo en Development** |

Los dos perfiles están en `maquinaria-backend/src/Maquinaria.Api/Properties/launchSettings.json`. `Program.cs` llama `AddOpenApi()` siempre y `MapOpenApi()` únicamente cuando el entorno es Development, así que en producción el documento no se sirve.

Para levantar la API en local, desde el repo del backend:

```bash
dotnet run --project src/Maquinaria.Api --launch-profile https
```

El perfil `https` también expone el `:5123`, que es el puerto al que llama el front. No hace falta confiar en el certificado de desarrollo: ver [§La trampa que costó una tarde](#la-trampa-que-costó-una-tarde-usehttpsredirection-en-desarrollo).

**En desarrollo no se entra por `localhost:4200` a secas.** Ahí vive el portal, que solo tiene `/entrar` y pregunta a qué empresa se va. Para probar el acceso de una empresa hay que abrir `http://bajio.localhost:4200/entrar`, y para el panel de superadministración `http://admin.localhost:4200`. Chrome y Edge resuelven `*.localhost` a 127.0.0.1 sin tocar el archivo `hosts`.

## CORS: un predicado sobre el dominio base, no una lista

**CORS explícito en la API**, no proxy en el dev server. Eso no cambió, y la razón sigue
siendo la misma: el frontend en producción vive en otro dominio —Cloudflare Pages contra
Railway— así que CORS hay que resolverlo de todas formas. Un proxy solo lo habría
escondido en desarrollo y lo habría dejado aparecer al desplegar.

**Lo que sí cambió es la forma.** Con un subdominio por empresa el conjunto de orígenes
válidos es abierto y crece con cada cliente: mantenerlo como lista en configuración
significaría redesplegar la API cada vez que se da de alta una empresa. Así que
`Program.cs` ya no llama `WithOrigins()` con una lista, sino `SetIsOriginAllowed()` con un
predicado (`Arranque/OrigenesPermitidos.cs`):

```json
// appsettings.Development.json
"Cors": {
  "Origenes": ["http://localhost:4200"],
  "DominioBase": "localhost",
  "ExigirHttps": false
}
```

| Clave | Qué hace |
|---|---|
| `Origenes` | Lista exacta, para los orígenes que **no** son subdominios de cliente. Gana sin pasar por ninguna validación de forma: es configuración nuestra |
| `DominioBase` | El dominio pelado y **cualquier subdominio bajo él** se aceptan. Vacío desactiva la regla por completo |
| `ExigirHttps` | Se apaga solo en desarrollo, donde el dev server es `http` |

Dos detalles que conviene no perder:

- **`DominioBase` de la API tiene que coincidir con `dominioBase` de
  `nucleo/ambiente/configuracion.ts`.** Si no coinciden, el navegador bloquea *todas* las
  llamadas de los subdominios de empresa. En desarrollo los dos valen `localhost`, y
  `bajio.localhost:4200` funciona sin tocar el archivo `hosts` porque Chrome y Edge
  resuelven `*.localhost` a 127.0.0.1 de forma nativa.
- **No se usó `AllowAnyOrigin()`**, que sería la salida fácil para un conjunto abierto:
  deshabilita las credenciales y deja que cualquier sitio llame a la API desde el
  navegador de un usuario con sesión abierta. `SetIsOriginAllowed` sí es compatible con
  `AllowCredentials`, que hará falta cuando el token de refresco pase a cookie `HttpOnly`.

**Lo que el predicado NO hace es comprobar que el subdominio sea una empresa real.** Sería
una consulta a la base en cada preflight y además delataría qué slugs son clientes, justo
lo que evitan las reglas anti-enumeración del acceso. Que el tenant exista lo resuelve la
petición, no el CORS.

## La trampa que costó una tarde: `UseHttpsRedirection` en desarrollo

**Si la pantalla dice «no se pudo contactar al servidor» pero `curl` responde bien, es
esto.** Ya está arreglado en el backend; queda escrito porque el síntoma engaña y volverá
a aparecer en cualquier proyecto que copie la plantilla de .NET.

La API tenía `app.UseHttpsRedirection()` activo también en desarrollo, y eso **rompía
todas las llamadas del navegador**. La secuencia era:

1. El preflight `OPTIONS` salía por `http://localhost:5123` y respondía **204**. CORS bien.
2. La petición real se redirigía a `https://localhost:7020`.
3. Ahí el navegador cortaba con `ERR_CERT_AUTHORITY_INVALID`, porque el certificado de
   desarrollo no está en el almacén de confianza.

Angular no ve nada de eso: recibe un `HttpErrorResponse` con `status === 0`, que
`mensaje-error.ts` traduce a «No se pudo contactar al servidor». Mientras tanto `curl` y
`Invoke-WebRequest` respondían perfectamente, porque no validan el certificado igual, así
que todo apuntaba al frontend.

**Se resolvió desactivando la redirección solo en desarrollo**; en producción sigue activa,
que es donde importa. La alternativa era `dotnet dev-certs https --trust` en cada máquina y
apuntar el front al 7020 —igual de válida y más parecida a producción—, pero exige un paso
manual por máquina que nada verifica: quien lo olvide pierde la tarde con un error que no
habla de certificados.

## Contrato: cliente generado y commiteado

Regla de `01-arquitectura.md` §10.6a. .NET 10 expone OpenAPI de forma nativa (`Microsoft.AspNetCore.OpenApi`, sin Swashbuckle) y el front consume ese documento:

```
npm run api:sync    →  genera src/app/nucleo/api/ desde /openapi/v1.json
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
| `*.tudominio.com` y el dominio pelado | Cloudflare Pages (este repo) |
| `admin.tudominio.com` | Cloudflare Pages, mismo build: el árbol de rutas lo elige el anfitrión |
| `api.tudominio.com` | Railway (la API, proxied) |

**Es un solo build servido en muchos anfitriones, no un despliegue por empresa.** Desde
que la empresa sale del subdominio, el frontend necesita un **comodín** en Pages: cada
cliente nuevo es un subdominio más y no puede implicar un despliegue. `api` y `admin` son
slugs reservados en `tenant.ts`, así que ninguna empresa puede reclamarlos. Esa parte de
la configuración de Pages sigue pendiente junto con el registro del dominio.

El reparto de subdominios no es cosmética: son subdominios del **mismo dominio registrable a propósito**. El refresh token viaja en cookie `HttpOnly` — **nunca** en `localStorage`, donde cualquier XSS lo roba — y al compartir dominio registrable la cookie se emite para `.tudominio.com` y funciona con `SameSite=Lax`.

**No usar los dominios por omisión** de Pages y Railway (`*.pages.dev`, `*.up.railway.app`): son dominios registrables distintos, la cookie sería de terceros y obligaría a `SameSite=None`, que los navegadores restringen cada vez más.

El dominio concreto todavía no se ha registrado, así que la configuración de Cloudflare Pages está pendiente. La ruta de salida del build que hay que darle es `dist/maquinaria-frontend/browser`.

### Divergencia consciente: hoy el refresh token está en `localStorage`

**Decidido el 2026-08-24.** El párrafo de arriba, `guias/convenciones.md` §Seguridad del login y `01-arquitectura.md` §6.1 dicen `HttpOnly` **nunca `localStorage`**. `src/app/nucleo/sesion/sesion.ts` hace lo contrario: guarda el token de refresco bajo la llave `maquinaria.refresco` en `localStorage`.

No es un descuido —el propio archivo lo declara en un comentario— pero hasta hoy la divergencia no estaba registrada en ningún documento, así que quien leyera solo los docs asumiría lo contrario de lo que hace el código.

**Se mantiene `localStorage` mientras dure el desarrollo.** La regla de `HttpOnly` sigue siendo la meta y no se relaja: es el estado objetivo, no una recomendación descartada.

| | Hoy | Antes de producción |
|---|---|---|
| Refresh token | `localStorage`, llave `maquinaria.refresco` | Cookie `HttpOnly` + `SameSite=Lax` |
| CSRF | No aplica | Hay que resolverlo (es el costo del cambio) |
| Riesgo | Un XSS se lleva un token de 30 días | Un XSS no alcanza la cookie |

**Condición de cierre, no fecha:** esto se resuelve **antes del primer despliegue con datos de un cliente real**, y en la misma tanda de trabajo que el interceptor de refresco (pendiente de §Lo que falta), porque ambos tocan el mismo código de sesión. Hacerlos por separado significa escribir dos veces el manejo del refresco.

Nota de coherencia pendiente: el comentario de `sesion.ts` habla de un refresco de **30 días** y este documento fija el token de acceso en **15 minutos**. Al implementar el refresco hay que confirmar cuál es la vigencia real que emite el backend y dejar un solo número escrito.

## Acceso: dos campos, porque la empresa sale del subdominio

**El acceso pasó de tres campos a dos.** Ya no se escribe la empresa: quien abre `bajio.<dominio>` está entrando a `bajio`.

La arquitectura no cambió —cada empresa tiene **su propia base de datos**, así que hay que saber en cuál buscar antes de validar nada—, cambió de dónde sale el dato. Lo resuelve `nucleo/ambiente/tenant.ts`, con `tenantActual()` leyendo `window.location.hostname` contra `configuracion.dominioBase`.

**Por qué no se deduce del correo**, que era la otra forma de quitar el campo: no hay un lugar donde estén todos los correos. Un índice `correo → empresa` en la base central duplicaría correos fuera de su base, rompería la instalación on-premise y permitiría enumerar clientes escribiendo correos. El subdominio dice la empresa **antes** de validar nada, exactamente igual que hacía el tercer campo.

**Esto no es un control de seguridad.** El subdominio solo decide qué pantalla se muestra y qué slug se manda a la API. Que la empresa exista, esté activa y el usuario pertenezca a ella lo resuelve el backend en cada petición; un valor inventado en la URL solo consigue un mensaje de error.

### Tres aplicaciones, tres árboles de rutas

| Anfitrión | Aplicación | Rutas |
|---|---|---|
| `admin.<dominio>` | Superadministración | `rutas-plataforma.ts` |
| `<slug>.<dominio>` | La aplicación de esa empresa | `rutas-empresa.ts` |
| `<dominio>` y `login.<dominio>` | Portal: preguntar a qué empresa se entra | `rutas-portal.ts` |

`app.routes.ts` elige **uno** al arrancar y registra solo ese, y esa es la parte que importa: en `bajio.<dominio>` las rutas de plataforma no devuelven 403 ni las tapa un guard, sencillamente **no existen**. Es la misma idea que el aislamiento por base de datos del backend: lo que no existe no se puede alcanzar por descuido. Se resuelve una sola vez porque el anfitrión no cambia sin recargar; cambiar de empresa es cambiar de origen.

`RESERVADOS` en `tenant.ts` duplica a propósito la lista de `SlugsReservados` del backend —que es la autoritativa— para no tratar `login.<dominio>` como una empresa llamada «login». Si el backend agrega uno, este también.

### Consecuencias que el front debe respetar

- **Un solo mensaje de error.** Nunca distinguir entre empresa inexistente, correo inexistente y contraseña incorrecta: distinguir regala la lista de clientes. Por eso `mensaje-error.ts` muestra el `detail` del `ProblemDetails` y no inventa texto propio.
- **No hay registro público.** Los tenants los da de alta un superadministrador y los usuarios se crean por invitación con token de un solo uso. No debe existir pantalla de alta propia.
- **Decir a qué empresa se está entrando.** Ahora que el slug no se escribe, el nombre de la empresa en la línea de apoyo del acceso (`apoyoDestacado` de `MarcoAcceso`) es lo único que le avisa a quien llegó desde una liga vieja que está en el subdominio equivocado.

## Restablecimiento de contraseña

**Implementado en los dos lados.** Tres endpoints, todos anónimos y bajo `/api/empresas/{slug}`:

| Método y ruta | Respuesta | Qué hace |
|---|---|---|
| `POST /restablecimientos` | **202 siempre**, con el mismo cuerpo exista o no la cuenta | Pide la liga |
| `GET /restablecimientos/{token}` | **204** o **404**, sin datos de la cuenta | Dice si la liga todavía sirve |
| `POST /restablecimientos/{token}` | 200 o 400 | Define la contraseña nueva y cierra las demás sesiones |

En el front son `solicitarRestablecimiento`, `consultarRestablecimiento` y `restablecerContrasena` de `nucleo/api/api.ts`, y las pantallas `empresa/solicitar-restablecimiento` (`/recuperar`) y `empresa/restablecer-contrasena` (`/restablecer`).

### La regla que gobierna estas pantallas

**La interfaz nunca puede delatar si un correo existe.** El backend responde 202 con un texto único —construido una sola vez para que las dos respuestas sean idénticas byte a byte— tanto si la cuenta existe como si no. Toda esa mecánica se tira a la basura si la interfaz añade un caso propio.

En la práctica:

1. **Del 202 solo se toma `mensaje` y se muestra tal cual.** El texto del servidor es condicional a propósito («si el correo corresponde a una cuenta…»). Reescribirlo como «te mandamos el correo» convertiría el formulario en un enumerador de los clientes de la empresa. Por eso el estado de la pantalla guarda **el mensaje del servidor y no un booleano**: obliga a pintar lo que respondió la API.
2. **Ninguna rama depende del correo escrito.** El estado final es el mismo para cualquier entrada, y no hay nada más en el bloque de confirmación: ni la carpeta de correo no deseado, ni un contador, ni un reintento. Cualquier añadido que suene a «ya salió» dice más de lo que el servidor quiso decir.
3. **Los errores que sí se muestran son de transporte.** El 429 del limitador —3 peticiones cada 15 minutos por empresa e IP— y el servidor caído. Ninguno depende de si la cuenta existe. El 429 llega sin cuerpo, así que la pantalla pone su propio texto: sin él, `mensajeDeError` diría «Error 429.» y alguien reintentaría creyendo que se perdió el correo.

El `GET` del token responde 204 o 404 y **nada más**: ni el correo ni el nombre del titular. La pantalla de invitación sí muestra a quién va dirigida la liga; la de restablecimiento no puede, porque cualquiera con una liga vieja averiguaría el correo de la cuenta.

Tras restablecer **no se inicia sesión automáticamente**: el backend acaba de revocar todas las sesiones de esa cuenta, así que entrar a mano con la contraseña nueva es lo que toca. Se vuelve a `/entrar?restablecida=1`, con un aviso distinto del de `?activada=1`: el restablecimiento acaba de cerrar las demás sesiones y un texto que sirviera para los dos casos no diría ninguno de los dos.

## Las ligas de correo van al subdominio de la empresa

**Cambió, y rompe las ligas viejas.** `PlantillasCorreoWeb` del backend ya no manda `?empresa=`: el slug va en el **subdominio**.

```
antes:  http://localhost:4200/invitacion?token=…&empresa=bajio
ahora:  http://bajio.localhost:4200/invitacion?token=…
```

Lo mismo para el restablecimiento, en `/restablecer`. La razón es directa: el front saca la empresa del anfitrión, y una liga al dominio pelado llegaría al **portal**, donde esas pantallas no existen —`rutas-portal.ts` solo tiene `/entrar`—.

Se construye con `UriBuilder` sobre `Correo:UrlBaseAplicacion`, así que el esquema y el puerto salen de la configuración sin casos especiales: en desarrollo `http://localhost:4200` da `http://bajio.localhost:4200`.

## Correo: Resend activado

`Correo:Proveedor` vale `"resend"` en `appsettings.json` (antes `"log"`), con un `HttpClient` tipado contra `POST /emails` y **sin paquete de NuGet**: es un solo endpoint, y un SDK de terceros para eso es una dependencia más que pinear, auditar y actualizar a cambio de ahorrar veinte líneas.

**Aviso práctico, que parece un error de configuración y no lo es:** mientras el dominio no esté verificado en Resend, solo se acepta `onboarding@resend.dev` como remitente y **solo se entrega al correo del titular de la cuenta**. Invitar a cualquier otra dirección no falla: Resend acepta la petición y el correo no llega. Es el sandbox.

El envío es **best-effort y no se propaga**: que Resend esté caído no convierte un aprovisionamiento correcto en un fracaso. El error se registra en el log, no en la respuesta. Para desarrollo, `Correo:DevolverLigaEnRespuesta` está en `true` solo en `appsettings.Development.json` y devuelve la liga en la respuesta del alta; en producción arranca en `false`, porque si no cualquiera con acceso al panel podría tomar la sesión del administrador de un cliente antes de que ese abra su correo.

## Permisos

Los permisos son cadenas `modulo.accion` (`equipos.editar`, `rentas.autorizar`, `reportes.exportar`), se resuelven al iniciar sesión y viajan en el JWT (§6). Son una matriz `Usuario → Rol → Permiso`, no un enum de roles, y cada tenant tiene sus propios roles a partir de una semilla de 9.

El front debe autorizar contra **la cadena de permiso, nunca contra el nombre del rol**.

## Interceptores

§9 preveía cuatro: JWT, refresh automático, manejo de errores y `tenant`. Hoy el mapa es otro:

| Interceptor | Estado |
|---|---|
| **JWT** | Existe: `nucleo/sesion/interceptor-token.ts` |
| **`tenant`** | **Ya no hace falta.** El slug va en la URL de cada endpoint (`/api/empresas/{slug}/…`), no en una cabecera, y sale del subdominio. No hay nada que interceptar |
| **Refresh automático** | Pendiente. Es lo que falta para que el token de 15 minutos deje de obligar a volver a entrar |
| **Manejo de errores** | Pendiente. Hoy cada pantalla llama a `mensajeDeError` a mano |

El de JWT hace **dos** comprobaciones, y las dos importan:

1. **Solo se manda el token a nuestra API** (`peticion.url.startsWith(configuracion.urlApi)`). Sin eso, cualquier petición a un tercero —un mapa, un CDN— saldría con el token del usuario en la cabecera.
2. **Elige entre el token de plataforma y el de empresa por la ruta.** El backend firma los dos con la misma llave y los distingue por audiencia y por el claim `ambito`; mandar el equivocado da un 403 desconcertante. Elegirlo aquí evita reproducir ese error en cada llamada.

## Zona horaria

El backend guarda todo en UTC con **zona horaria de presentación por tenant**. El formateo del front tiene que respetar esa zona, no la del navegador.
