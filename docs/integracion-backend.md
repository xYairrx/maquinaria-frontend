# Integración con el backend

## `api:check` y los finales de línea

`openapi-typescript` escribe `generado.ts` **siempre en LF**, y `--check` compara **bytes**
contra lo que regenera. Con `core.autocrlf=true` —el valor por omisión en Windows— git deja el
archivo en CRLF al clonar, así que **`npm run api:check` falla en un clon recién hecho aunque el
contrato esté perfectamente al día**, y el mensaje que da —«Generated types are not
up-to-date!»— apunta justo al sitio equivocado.

Cerrado con un `.gitattributes` que fija ese archivo a LF en el árbol de trabajo.

**Y `generado.ts` está en `.prettierignore`.** Un `prettier --write` con comodines lo reformatea
—comillas simples, indentación de dos— y la siguiente regeneración lo revierte: un diff de nueve
mil líneas en el que no cambió ni un tipo. Ya había pasado. El archivo no se lee a mano; para eso
está `contratos.ts`, que es la superficie curada.

## Estado real: el primer flujo ya corre

**Actualizado el 2026-08-25.** La integración existe y el ciclo completo —invitación,
definir contraseña, iniciar sesión, pantalla protegida, **y el token renovándose solo
cuando caduca**— funciona de punta a punta contra la API real. El restablecimiento de
contraseña también está implementado en los dos lados.

Lo que ya está en disco:

| pieza                     | dónde                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Configuración de ambiente | `src/app/nucleo/ambiente/configuracion.ts` — un archivo, no `src/environments/`                                                            |
| Qué empresa es esta       | `src/app/nucleo/ambiente/tenant.ts` — sale del subdominio, con `tenant.spec.ts` al lado                                                    |
| Identidad del producto    | `src/app/nucleo/ambiente/sitio.ts` — el nombre y la marca, escritos una sola vez                                                           |
| Cliente HTTP              | `src/app/nucleo/api/api.ts` y `api-plataforma.ts`, con los tipos en `api/contratos.ts` y `api/contratos-plataforma.ts`                     |
| Traducción de errores     | `src/app/nucleo/api/mensaje-error.ts` — saca el `detail` del `ProblemDetails`                                                              |
| `provideHttpClient()`     | `src/app/app.config.ts`, con `withInterceptors([interceptorRefresco, interceptorToken])` — **ese orden importa**, ver §Refresco            |
| Interceptor de token      | `src/app/nucleo/sesion/interceptor-token.ts`                                                                                               |
| Interceptor de refresco   | `src/app/nucleo/sesion/interceptor-refresco.ts` (+ `.spec.ts`, 11 pruebas) y el canje serializado en `refresco-sesion.ts`                  |
| Guards de sesión          | `src/app/nucleo/sesion/guard-sesion.ts` y `guard-plataforma.ts`                                                                            |
| Estado de sesión          | `src/app/nucleo/sesion/sesion.ts` — signals + `localStorage`, con `datosDeRefresco()`                                                      |
| Qué puede ver quien entró | `src/app/nucleo/sesion/acceso.ts` — permisos del rol ∩ módulos del plan                                                                    |
| Pantallas de empresa      | `src/app/paginas/empresa/{aceptar-invitacion,iniciar-sesion,inicio,solicitar-restablecimiento,restablecer-contrasena}`, con carga diferida |
| Pantallas de plataforma   | `src/app/paginas/plataforma/{iniciar-sesion,dashboard,empresas,planes,salud-esquemas}`                                                     |
| Pantalla del portal       | `src/app/paginas/portal/seleccionar-empresa`                                                                                               |
| Sesión de plataforma      | `src/app/nucleo/sesion/sesion-plataforma.ts` — **llave de almacenamiento separada**                                                        |

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

#### Eso se reporta como fallo de seguridad, y no lo es — 2026-09-01

El síntoma: estando dentro del panel, ir de `admin.localhost:4200/dashboard` a
`bajio.localhost:4200/inicio` **deja entrar, y con otro usuario**. Y al revés también.

Lo que pasa es lo de arriba: son **dos sesiones distintas, en dos orígenes distintos**, las
dos abiertas de antes. Entrar a la empresa no reusa la sesión de admin — reanuda la de la
empresa, que llevaba ahí desde la última vez, porque el token de refresco dura 30 días.
«Cambió de usuario» es literal: es otra sesión, de otra persona.

Comprobado en un navegador, no razonado. Escribiendo una marca en el `localStorage` de cada
subdominio y yendo a leerla desde el otro:

| Desde                  | Lee la marca del otro | Sin sesión, `/inicio` y `/dashboard` acaban en |
| ---------------------- | --------------------- | ---------------------------------------------- |
| `admin.localhost:4200` | `null`                | `/entrar`                                      |
| `bajio.localhost:4200` | `null`                | `/entrar`                                      |

**`localStorage` está partido por ORIGEN**, y el origen incluye el host completo:
`admin.localhost` y `bajio.localhost` son dos orígenes, así que dos almacenes. El token de uno
es ilegible desde el otro.

Para convencerse en diez segundos: abre el subdominio de la empresa en una ventana de
incógnito. Te manda a `/entrar`.

Y la separación de verdad no la hacen los guards —son comodidad de interfaz y sus propios
comentarios lo dicen—, sino la API: dos audiencias de JWT y una policy de ámbito por endpoint.
Eso quedó fijado el mismo día con `AmbitoCruzadoPruebas` en el backend, porque hasta entonces
**nada fallaba si alguien le quitaba el `[Authorize]` a un controlador**.

Lo que **sigue faltando**:

- **`api:sync`.** Los tipos de `contratos.ts` están escritos a mano. El plan sigue siendo
  generarlos desde `/openapi/v1.json` y commitear el resultado, para que un cambio de
  contrato salga como diff en la revisión y no como error en tiempo de ejecución. Ya hay
  una prueba de que hace falta: `SaludEsquemas.versionDisponible` está tipado `string` y el
  servidor puede mandar `null` — ver §Salud de esquemas.
- **Refresco de la sesión de PLATAFORMA.** No existe en ningún lado: el backend no tiene
  `sesion_refresh` para plataforma y ningún endpoint bajo `/api/plataforma` canjea nada.
  Es una decisión de esquema pendiente del backend, no un pendiente de este repo, y el
  front la respeta explícitamente: un 401 de ese ámbito se propaga tal cual.
- **Interceptor de manejo de errores.** Cada pantalla llama a `mensajeDeError` a mano.
- **El token de refresco en `localStorage`** en vez de cookie `HttpOnly`. Ver
  §Divergencia consciente, que es el único pendiente de seguridad abierto de esta parte.
- **Pruebas de lo que toca la red, a medias.** `npm test` (builder
  `@angular/build:unit-test`, con `vitest` y `jsdom`) corre **9 archivos y 116 pruebas** en
  verde. De esta integración ya tienen red `api.spec.ts` (9), `api-plataforma.spec.ts` (10,
  con `HttpTestingController` y `http.verify()` para fijar que un recurso compartido se pide
  UNA vez) y `interceptor-refresco.spec.ts` (11). Siguen sin una sola prueba los dos guards,
  `interceptor-token`, los dos almacenes de sesión y `mensaje-error`.

## Puertos y documento OpenAPI

| Pieza                 | URL                                                                                 |
| --------------------- | ----------------------------------------------------------------------------------- |
| Dev server de Angular | `http://localhost:4200`, y `http://<slug>.localhost:4200` para entrar a una empresa |
| API, perfil `http`    | `http://localhost:5123` — **es a la que apunta `configuracion.urlApi`**             |
| API, perfil `https`   | `https://localhost:7020` (además expone `:5123`)                                    |
| Documento OpenAPI     | `/openapi/v1.json` — **solo en Development**                                        |

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

| Clave         | Qué hace                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Origenes`    | Lista exacta, para los orígenes que **no** son subdominios de cliente. Gana sin pasar por ninguna validación de forma: es configuración nuestra |
| `DominioBase` | El dominio pelado y **cualquier subdominio bajo él** se aceptan. Vacío desactiva la regla por completo                                          |
| `ExigirHttps` | Se apaga solo en desarrollo, donde el dev server es `http`                                                                                      |

Dos detalles que conviene no perder:

- **`DominioBase` de la API tiene que coincidir con `dominioBase` de
  `nucleo/ambiente/configuracion.ts`.** Si no coinciden, el navegador bloquea _todas_ las
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
2. Cualquier cambio de contrato aparece como un _diff_ revisable en el historial del front. Es el sustituto práctico del commit atómico que dos repos independientes no permiten.

El script `api:sync` **aún no existe** y la herramienta generadora es una **decisión abierta**.

## Evolución del contrato: expandir → migrar → contraer

Regla de `01-arquitectura.md` §10.6b. Con despliegues independientes, un cambio incompatible rompe producción durante la ventana entre un deploy y el otro. Nunca se cambia un contrato de golpe:

| Paso        | Repo     | Acción                                                  |
| ----------- | -------- | ------------------------------------------------------- |
| 1. Expandir | backend  | Agrega el campo o endpoint nuevo. **Conserva el viejo** |
| 2. Migrar   | frontend | Regenera el cliente y adopta lo nuevo                   |
| 3. Contraer | backend  | Recién ahora elimina lo viejo                           |

La regla en una línea: **cada despliegue debe ser compatible con la versión actualmente desplegada del otro repo.** Renombrar un campo y actualizar el front "al mismo tiempo" no existe; uno de los dos despliegues llega primero.

Convención de trazabilidad (§10.6c): referenciar desde el commit del front el issue del back que le corresponde.

## Dominios en producción y la cookie del refresh token

| Subdominio                            | Servicio                                                               |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `*.tudominio.com` y el dominio pelado | Cloudflare Pages (este repo)                                           |
| `admin.tudominio.com`                 | Cloudflare Pages, mismo build: el árbol de rutas lo elige el anfitrión |
| `api.tudominio.com`                   | Railway (la API, proxied)                                              |

**Es un solo build servido en muchos anfitriones, no un despliegue por empresa.** Desde
que la empresa sale del subdominio, el frontend necesita un **comodín** en Pages: cada
cliente nuevo es un subdominio más y no puede implicar un despliegue. `api` y `admin` son
slugs reservados en `tenant.ts`, así que ninguna empresa puede reclamarlos. Esa parte de
la configuración de Pages sigue pendiente junto con el registro del dominio.

El reparto de subdominios no es cosmética: son subdominios del **mismo dominio registrable a propósito**. El refresh token viaja en cookie `HttpOnly` — **nunca** en `localStorage`, donde cualquier XSS lo roba — y al compartir dominio registrable la cookie se emite para `.tudominio.com` y funciona con `SameSite=Lax`.

**No usar los dominios por omisión** de Pages y Railway (`*.pages.dev`, `*.up.railway.app`): son dominios registrables distintos, la cookie sería de terceros y obligaría a `SameSite=None`, que los navegadores restringen cada vez más.

El dominio concreto todavía no se ha registrado, así que la configuración de Cloudflare Pages está pendiente. La ruta de salida del build que hay que darle es `dist/maquinaria-frontend/browser`.

### Divergencia consciente: hoy el refresh token está en `localStorage`

**Decidido el 2026-08-24, y SIGUE ABIERTO al 2026-08-25.** El párrafo de arriba, `guias/convenciones.md` §Seguridad del login y `01-arquitectura.md` §6.1 dicen `HttpOnly` **nunca `localStorage`**. `src/app/nucleo/sesion/sesion.ts` hace lo contrario: guarda el token de refresco bajo la llave `maquinaria.refresco` en `localStorage`.

No es un descuido —el propio archivo lo declara en un comentario— pero hasta hoy la divergencia no estaba registrada en ningún documento, así que quien leyera solo los docs asumiría lo contrario de lo que hace el código.

**Y es de los dos lados, no solo del front.** El backend tampoco lo manda por cookie: la
respuesta del login y la del refresco devuelven el token **en el cuerpo**, en el
`SesionEmpresa`. Así que el día que se cambie, se cambia a la vez en los dos repos —el
backend emitiendo `Set-Cookie` y dejando de devolverlo, el front dejando de leerlo y
mandando `withCredentials`— y por la regla de expandir → migrar → contraer eso son tres
despliegues, no uno.

**Se mantiene `localStorage` mientras dure el desarrollo.** La regla de `HttpOnly` sigue siendo la meta y no se relaja: es el estado objetivo, no una recomendación descartada.

|               | Hoy                                         | Antes de producción                         |
| ------------- | ------------------------------------------- | ------------------------------------------- |
| Refresh token | `localStorage`, llave `maquinaria.refresco` | Cookie `HttpOnly` + `SameSite=Lax`          |
| CSRF          | No aplica                                   | Hay que resolverlo (es el costo del cambio) |
| Riesgo        | Un XSS se lleva un token de 30 días         | Un XSS no alcanza la cookie                 |

**Condición de cierre, no fecha:** esto se resuelve **antes del primer despliegue con datos de un cliente real**.

**Lo que se planeó y no se cumplió, escrito para que no se repita la promesa:** este documento
decía que se resolvería «en la misma tanda de trabajo que el interceptor de refresco, porque
ambos tocan el mismo código de sesión». El interceptor se implementó el 2026-08-25 y el token
se quedó en `localStorage`, así que sí, el manejo del refresco habrá que tocarlo dos veces.
Lo que costó de más es acotado —`Sesion.datosDeRefresco()` y el cuerpo de
`Api.refrescarSesion` desaparecen cuando la cookie viaje sola, y el resto del single-flight
sigue igual porque la rotación no cambia—, pero el patrón sí: **una condición de cierre
amarrada a otra tarea se rompe cuando esa tarea entra sola.** La condición de cierre real es
la de arriba, el despliegue con datos reales.

La nota de coherencia sobre las vigencias **queda resuelta**: no había contradicción, eran
piezas distintas —15 minutos el acceso de empresa, 60 el de plataforma, 30 días el refresco—.
Los tres números están en la tabla de §Refresco de la sesión de empresa, leídos de
`OpcionesJwt.cs`.

## Acceso: dos campos, porque la empresa sale del subdominio

**El acceso pasó de tres campos a dos.** Ya no se escribe la empresa: quien abre `bajio.<dominio>` está entrando a `bajio`.

La arquitectura no cambió —cada empresa tiene **su propia base de datos**, así que hay que saber en cuál buscar antes de validar nada—, cambió de dónde sale el dato. Lo resuelve `nucleo/ambiente/tenant.ts`, con `tenantActual()` leyendo `window.location.hostname` contra `configuracion.dominioBase`.

**Por qué no se deduce del correo**, que era la otra forma de quitar el campo: no hay un lugar donde estén todos los correos. Un índice `correo → empresa` en la base central duplicaría correos fuera de su base, rompería la instalación on-premise y permitiría enumerar clientes escribiendo correos. El subdominio dice la empresa **antes** de validar nada, exactamente igual que hacía el tercer campo.

**Esto no es un control de seguridad.** El subdominio solo decide qué pantalla se muestra y qué slug se manda a la API. Que la empresa exista, esté activa y el usuario pertenezca a ella lo resuelve el backend en cada petición; un valor inventado en la URL solo consigue un mensaje de error.

### Tres aplicaciones, tres árboles de rutas

| Anfitrión                       | Aplicación                               | Rutas                 |
| ------------------------------- | ---------------------------------------- | --------------------- |
| `admin.<dominio>`               | Superadministración                      | `rutas-plataforma.ts` |
| `<slug>.<dominio>`              | La aplicación de esa empresa             | `rutas-empresa.ts`    |
| `<dominio>` y `login.<dominio>` | Portal: preguntar a qué empresa se entra | `rutas-portal.ts`     |

`app.routes.ts` elige **uno** al arrancar y registra solo ese, y esa es la parte que importa: en `bajio.<dominio>` las rutas de plataforma no devuelven 403 ni las tapa un guard, sencillamente **no existen**. Es la misma idea que el aislamiento por base de datos del backend: lo que no existe no se puede alcanzar por descuido. Se resuelve una sola vez porque el anfitrión no cambia sin recargar; cambiar de empresa es cambiar de origen.

`RESERVADOS` en `tenant.ts` duplica a propósito la lista de `SlugsReservados` del backend —que es la autoritativa— para no tratar `login.<dominio>` como una empresa llamada «login». Si el backend agrega uno, este también.

### Consecuencias que el front debe respetar

- **Un solo mensaje de error.** Nunca distinguir entre empresa inexistente, correo inexistente y contraseña incorrecta: distinguir regala la lista de clientes. Por eso `mensaje-error.ts` muestra el `detail` del `ProblemDetails` y no inventa texto propio.
- **No hay registro público.** Los tenants los da de alta un superadministrador y los usuarios se crean por invitación con token de un solo uso. No debe existir pantalla de alta propia.
- **Decir a qué empresa se está entrando.** Ahora que el slug no se escribe, el nombre de la empresa en la línea de apoyo del acceso (`apoyoDestacado` de `MarcoAcceso`) es lo único que le avisa a quien llegó desde una liga vieja que está en el subdominio equivocado.

## Restablecimiento de contraseña

**Implementado en los dos lados.** Tres endpoints, todos anónimos y bajo `/api/empresas/{slug}`:

| Método y ruta                     | Respuesta                                                  | Qué hace                                               |
| --------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `POST /restablecimientos`         | **202 siempre**, con el mismo cuerpo exista o no la cuenta | Pide la liga                                           |
| `GET /restablecimientos/{token}`  | **204** o **404**, sin datos de la cuenta                  | Dice si la liga todavía sirve                          |
| `POST /restablecimientos/{token}` | 200 o 400                                                  | Define la contraseña nueva y cierra las demás sesiones |

En el front son `solicitarRestablecimiento`, `consultarRestablecimiento` y `restablecerContrasena` de `nucleo/api/api.ts`, y las pantallas `empresa/solicitar-restablecimiento` (`/recuperar`) y `empresa/restablecer-contrasena` (`/restablecer`).

### La regla que gobierna estas pantallas

**La interfaz nunca puede delatar si un correo existe.** El backend responde 202 con un texto único —construido una sola vez para que las dos respuestas sean idénticas byte a byte— tanto si la cuenta existe como si no. Toda esa mecánica se tira a la basura si la interfaz añade un caso propio.

En la práctica:

1. **Del 202 solo se toma `mensaje` y se muestra tal cual.** El texto del servidor es condicional a propósito («si el correo corresponde a una cuenta…»). Reescribirlo como «te mandamos el correo» convertiría el formulario en un enumerador de los clientes de la empresa. Por eso el estado de la pantalla guarda **el mensaje del servidor y no un booleano**: obliga a pintar lo que respondió la API.
2. **Ninguna rama depende del correo escrito.** El estado final es el mismo para cualquier entrada, y no hay nada más en el bloque de confirmación: ni la carpeta de correo no deseado, ni un contador, ni un reintento. Cualquier añadido que suene a «ya salió» dice más de lo que el servidor quiso decir.
3. **Los errores que sí se muestran son de transporte.** El 429 del limitador —3 peticiones cada 15 minutos por empresa e IP— y el servidor caído. Ninguno depende de si la cuenta existe. El 429 llega sin cuerpo, así que la pantalla pone su propio texto: sin él, `mensajeDeError` diría «Error 429.» y alguien reintentaría creyendo que se perdió el correo.

El `GET` del token responde 204 o 404 y **nada más**: ni el correo ni el nombre del titular. La pantalla de invitación sí muestra a quién va dirigida la liga; la de restablecimiento no puede, porque cualquiera con una liga vieja averiguaría el correo de la cuenta.

Tras restablecer **no se inicia sesión automáticamente**: el backend acaba de revocar todas las sesiones de esa cuenta, así que entrar a mano con la contraseña nueva es lo que toca. Se vuelve a `/entrar?restablecida=1`, con un aviso distinto del de `?activada=1`: el restablecimiento acaba de cerrar las demás sesiones y un texto que sirviera para los dos casos no diría ninguno de los dos.

## Refresco de la sesión de empresa

**Implementado en los dos lados el 2026-08-25.** Con esto el token de acceso de 15 minutos
deja de obligar a volver a entrar, y se cierra la Fase 0 del frontend.

| Método y ruta                               | Auth        | Cuerpo              | Respuesta                                      |
| ------------------------------------------- | ----------- | ------------------- | ---------------------------------------------- |
| `POST /api/empresas/{slug}/sesion/refresco` | **anónimo** | `{ tokenRefresco }` | **200** con `SesionEmpresa`, **401** o **429** |

Las vigencias están en `Maquinaria.Infraestructura/Seguridad/OpcionesJwt.cs`, y verlas
juntas zanja la nota de coherencia que este documento arrastraba —`sesion.ts` hablaba de 30
días y el documento de 15 minutos—: **no se contradecían, son piezas distintas**.

| Pieza                         | Vigencia                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Token de acceso de empresa    | **15 minutos** (`MinutosEmpresa`) — corto a propósito: los permisos viajan dentro |
| Token de acceso de plataforma | **60 minutos** (`MinutosPlataforma`)                                              |
| Token de refresco             | **30 días** (`DiasRefresco`)                                                      |

### Es el contrato del login, reusado a propósito

La respuesta es **idéntica en forma** a la del login: el mismo `SesionEmpresa`. Por eso no
se escribió un contrato nuevo — el backend lo declara en el comentario del endpoint— y por
eso el cliente puede sustituir lo que tenía guardado sin traducir nada. **Guardar el token
de refresco NUEVO no es opcional**: el canje rota el viejo y lo revoca.

Es **anónimo**, y también a propósito: se refresca precisamente porque el token de acceso ya
caducó, así que exigir uno válido dejaría el endpoint inservible. Lo que autentica aquí es el
token de refresco. El **slug va en la ruta** igual que en el login, y eso es lo que hace que
el middleware de tenant resuelva la empresa sin claim: la sesión se busca en la base de ESA
empresa. Sin slug no hay tenant y el caso de uso rechaza.

Del lado del front eso obliga a **salir por el `HttpBackend`**: `Api.refrescarSesion` usa un
`httpSinInterceptores = new HttpClient(inject(HttpBackend))`. No puede llevar `Authorization`
—el token ya caducó— y, sobre todo, no puede pasar por el interceptor de refresco, porque su
propio 401 pediría otro refresco sin fin. Estar fuera de la cadena lo hace imposible por
construcción y no por una bandera que alguien pueda olvidar.

### Un solo 401, para seis motivos, y sin reintento posible

El 401 tapa **token inexistente, caducado, revocado, reusado, usuario que ya no está activo
y empresa que no puede operar**, todos con el mismo `detail`
(`MotivoRefrescoUniforme`: «La sesion no es valida o expiro.»). Distinguirlos le diría a
quien prueba tokens y slugs cuáles existen — es la misma regla anti-enumeración del acceso.

**Y sin sesión abierta un 401 no es un token caducado**, así que el interceptor no refresca:
es el login contestando que las credenciales no sirven, o una liga que ya no vale. Refrescar
ahí sería pedir un canje sin nada que canjear.

La consecuencia para el cliente es directa: **ninguno de los seis se arregla volviendo a
pedirlo**, así que ante un fallo del canje no hay reintento. Se limpia la sesión y se navega
a `/entrar?expirada=1`, y eso corre **una vez** aunque hubiera diez peticiones esperando,
porque está en la cadena de la fuente y no en la de cada suscriptor. El error sí se propaga a
quien esperaba: cada petición tiene que fallar de verdad para que su pantalla salga de
«enviando».

### El 429 no es un 401

El endpoint hereda la política de acceso de empresa: **10 peticiones por minuto, ventana
fija, partición por `slug|IP` y sin cola** (`Program.cs`, `PoliticaAcceso`). Un token de
refresco es un secreto de 256 bits que no se adivina, pero el endpoint es anónimo y escribe
en la base.

**Un 429 NO se trata como un token caducado.** El interceptor solo reacciona a `401` con
sesión abierta; cualquier otro código se propaga. Confundirlos quemaría un refresco por cada
rechazo del limitador y, con la rotación de por medio, el cliente se echaría a sí mismo
fuera.

### La rotación no tiene ventana de gracia: el cliente ESTÁ OBLIGADO a serializar

Esta es la parte del contrato que hay que respetar aunque el compilador no lo pida. El token
de refresco **rota en cada canje y el anterior queda revocado al instante**, sin periodo de
tolerancia. Dos refrescos concurrentes con el mismo token se leen en el servidor como **reuso
de token robado**, y la respuesta a eso no es un 401 y ya: **se revoca toda la cadena de
sesiones del usuario**.

O sea que un refresco sin serializar no degrada la experiencia: **echa a la calle a quien
estaba trabajando**, y justo cuando más peticiones hay en vuelo, que es cuando el token
caduca en medio de una pantalla que pide tres cosas a la vez.

Por eso el canje vive en `RefrescoSesion` y no en el interceptor: un `enVuelo` +
`shareReplay` que garantiza **un solo canje en vuelo**, con todas las peticiones esperando el
mismo. El detalle de por qué hacen falta las dos mitades —y por qué `refCount: false`— está
en [convenciones](convenciones.md#sesión-el-refresco-del-token-va-serializado); aquí lo que
importa es que **es una exigencia del servidor, no una optimización del cliente**.

### El refresco de plataforma NO existe

No hay `sesion_refresh` para plataforma en el backend ni endpoint que lo canjee bajo
`/api/plataforma`. Es una decisión de esquema pendiente, y mientras siga así el front la
respeta en voz alta: `interceptorRefresco` descarta `/api/plataforma/**` en su primera línea
—`peticion.url.includes(RUTAS_DE_PLATAFORMA)`, la constante que exporta `interceptor-token.ts`
para no escribir la ruta dos veces— y hay una prueba de que un 401 de ese ámbito **se propaga
tal cual**. Con 60 minutos de vigencia, el superadministrador vuelve a entrar.

### El orden de los interceptores es parte del diseño

`withInterceptors([interceptorRefresco, interceptorToken])`, y el refresco va **primero**.
Su `siguiente` es el resto de la cadena, así que la petición que se reintenta tras refrescar
vuelve a pasar por el interceptor del token y sale con el `Bearer` **nuevo** sin que el
refresco toque ninguna cabecera. Al revés, el reintento saldría con el token ya caducado y
daría otro 401.

Y no puede haber bucle: el reintento se lanza DENTRO del `catchError`, y un `catchError` no
atrapa lo que devuelve su propio manejador. Si el reintento vuelve a dar 401, ese 401 sale a
la pantalla.

## Salud de esquemas: `GET /api/plataforma/salud/esquemas`

**Implementado en los dos lados.** Solo plataforma, con la misma policy que el resto del
panel: el estado de las bases de todos los clientes no es asunto de ningún cliente.

Existe porque las migraciones de empresa se aplican **N veces, una por base**, y un fallo
parcial deja versiones desalineadas sin que nada lo diga. Ya pasó: `demo` y `bajio`
quedaron una migración atrás de la plantilla y nadie se enteró.

```
SaludEsquemas {
  versionDisponible: string      // la migración más avanzada DEL BINARIO que respondió
  totalEmpresas: number
  desfasadas: number
  empresas: EmpresaEnSalud[]     // id, slug, razonSocial, estado, aprovisionamiento,
}                                // versionAplicada, migracionesPendientes,
                                 // desfasada, versionReconocida
```

**`versionDisponible` es del binario, no de la empresa más adelantada**, y esa distinción es
la razón de ser del endpoint. Deducir la referencia de la lista de empresas —que es lo que
hacía el dashboard hasta hoy— da **cero desfase cuando TODAS van una migración atrás**, que
es exactamente el estado en el que suele estar el sistema.

**Cuidado con el tipo**: el backend lo calcula como `disponibles.Count > 0 ? disponibles[^1]
: null`, así que el contrato admite `null` y `contratos-plataforma.ts` lo declara `string`.
En producción no puede pasar —un ensamblado sin ninguna migración—, pero es una divergencia
real del contrato escrito a mano y está anotada como pendiente 18 en
[estado y pendientes](estado-y-pendientes.md#integración-con-la-api).

### Tres estados, y el tercero es el que importa

`desfasada` **la calcula el servidor**: la regla de qué es estar atrasado vive en un solo
lado. Lo único que decide el front es cuál de los tres estados aplica, en la función pura
`estadoDeEsquema()`, que leen **el dashboard y la pantalla de esquemas**:

| Estado           | Cuándo                                                     |
| ---------------- | ---------------------------------------------------------- |
| al día           | `versionReconocida` y no `desfasada`                       |
| desfasada        | `versionReconocida` y `desfasada` — se arregla migrando    |
| **sin comparar** | `versionReconocida: false`, y **gana sobre todo lo demás** |

`versionReconocida: false` significa que **no se pudo comparar**: la versión aplicada es
nula, o es una migración que este binario no conoce —el caso típico es una base **por delante
del código desplegado**—. En ese estado `desfasada` y `migracionesPendientes` no dicen nada
útil y **no se leen**: pintarlos sería afirmar un dato que nadie calculó. Colapsarlo a dos
estados esconde el caso peligroso detrás del mismo color que «al día», y su arreglo no es
migrar: puede ser desplegar.

### Lo que el endpoint NO hace, y la pantalla lo dice

**Lee `version_esquema` de la base central y no se conecta a las bases de las empresas.** Es
una simplificación deliberada —consultar `__EFMigrationsHistory` de N bases en una petición
HTTP son N conexiones y N puntos de falla— y el dato lo mantienen los dos únicos caminos que
aplican migraciones: el aprovisionamiento y `migrar-empresas`.

Consecuencia aceptada: **si alguien migra a mano sin actualizar la central, el reporte miente
hasta la siguiente corrida de `migrar-empresas`**, que la corrige. La pantalla lo escribe en
su nota de limitación en lugar de dejar que se lea como infalible.

El comando existe y es la salida del aviso:
`dotnet run --project src/Maquinaria.Api -- migrar-empresas`.

### En el front es un recurso compartido, y sin `defaultValue`

Lo leen el dashboard —para el aviso de desfase— y la pantalla `/esquemas`, así que va en
`ApiPlataforma.saludEsquemas` y entre las dos hacen **una** petición, fijado con
`http.verify()` en `api-plataforma.spec.ts`.

**Sin `defaultValue`, al contrario que las listas**: aquí el vacío no es `[]` sino «todavía
no hay reporte», y eso se dice con `null`. Un reporte de relleno con cero desfasadas se
pintaría como un reporte de verdad diciendo que no hay nada que atender. Por lo mismo,
`resumir()` del dashboard recibe el reporte como parámetro **opcional**: sin reporte no
afirma nada del esquema de nadie.

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

| Interceptor            | Estado                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JWT**                | Existe: `nucleo/sesion/interceptor-token.ts`                                                                                                                   |
| **`tenant`**           | **Ya no hace falta.** El slug va en la URL de cada endpoint (`/api/empresas/{slug}/…`), no en una cabecera, y sale del subdominio. No hay nada que interceptar |
| **Refresh automático** | **Existe (2026-08-25)**: `interceptor-refresco.ts` + `refresco-sesion.ts`, **solo para la sesión de empresa**. Ver §Refresco de la sesión de empresa           |
| **Manejo de errores**  | Pendiente. Hoy cada pantalla llama a `mensajeDeError` a mano                                                                                                   |

Y son **dos** interceptores y no un `if` más dentro del de token, por dos razones: poner el
`Authorization` correcto es cosa de las dos sesiones y ahí está bien compartido, mientras
refrescar es cosa de una sola; y son dos momentos distintos del ciclo —uno toca la petición
al salir, el otro la respuesta al volver—, así que mezclarlos obligaría a leer un archivo con
dos vidas.

El de JWT hace **dos** comprobaciones, y las dos importan:

1. **Solo se manda el token a nuestra API** (`peticion.url.startsWith(configuracion.urlApi)`). Sin eso, cualquier petición a un tercero —un mapa, un CDN— saldría con el token del usuario en la cabecera.
2. **Elige entre el token de plataforma y el de empresa por la ruta.** El backend firma los dos con la misma llave y los distingue por audiencia y por el claim `ambito`; mandar el equivocado da un 403 desconcertante. Elegirlo aquí evita reproducir ese error en cada llamada.

## Zona horaria

El backend guarda todo en UTC con **zona horaria de presentación por tenant**. El formateo del front tiene que respetar esa zona, no la del navegador.
