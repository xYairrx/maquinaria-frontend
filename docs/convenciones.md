# Convenciones de código

Las reglas del repo están en [`AGENTS.md`](../AGENTS.md), y `.claude/CLAUDE.md` es **byte a byte el mismo archivo** (ambos vienen del preset de instrucciones para IA del Angular CLI). Si se cambia uno, hay que cambiar el otro.

## Componentes

- Standalone siempre; **no** poner `standalone: true` en el decorador — es el valor por omisión desde v20.
- `changeDetection: ChangeDetectionStrategy.OnPush` en todo `@Component`.
- `input()` / `output()` como funciones, no `@Input()` / `@Output()`.
- **NUNCA HTML dentro del `.ts`.** Nada de `template:` con backticks, ni siquiera de una
  línea: el marcado de cada componente va en un `.html` hermano, referenciado con
  `templateUrl` y con **ruta relativa al `.ts`**. Meter la plantilla dentro del TypeScript
  convierte el archivo en un muro de marcado donde la lógica no se encuentra; para eso
  existen tipos de archivo distintos. Esta regla **anula** el consejo habitual de Angular
  de incrustar las plantillas pequeñas.
- Componentes chicos y con una sola responsabilidad.

## Estado

- Signals para estado local; `computed()` para estado derivado.
- Sobre signals se usa `set` o `update`, nunca `mutate`.
- Transformaciones de estado puras y predecibles.
- Sin NgRx hasta que exista evidencia de que se necesita (`01-arquitectura.md` §9).

## Plantillas

- Control flow nativo `@if` / `@for` / `@switch`, no `*ngIf` / `*ngFor` / `*ngSwitch`.
- Bindings `class` y `style`; **no** `ngClass` ni `ngStyle`.
- Sin lógica compleja en la plantilla. No asumir globales como `new Date()`.
- Pipe `async` para observables.

## Directivas y host

**Prohibidos** `@HostBinding` y `@HostListener`. Las bindings de host van en el objeto `host` del decorador.

## Servicios

- Una responsabilidad por servicio, `providedIn: 'root'` para singletons.
- `inject()` en lugar de inyección por constructor.

## Formularios y ruteo

- Formularios **reactivos**, no template-driven.
- **Lazy loading por ruta de feature.** Con 26 módulos previstos, un bundle único es inviable.
- **Los parámetros de ruta y de query llegan como `input()`**, no leyendo `ActivatedRoute`.
  El router va con `withComponentInputBinding()` en `app.config.ts`, así que
  `/entrar?restablecida=1` se recibe con `readonly restablecida = input('')`. Es la misma
  razón que el resto: sin decoradores y sin suscripciones que limpiar.
- **El árbol de rutas lo elige el anfitrión.** `app.routes.ts` registra `rutas-empresa`,
  `rutas-plataforma` o `rutas-portal` según el subdominio, una sola vez al arrancar.
  Detalle en [`integracion-backend.md`](integracion-backend.md).

## Imágenes

`NgOptimizedImage` para toda imagen estática. No aplica a base64 inline.

**Hoy no se usa en ningún sitio, y las dos imágenes del repo explican por qué.** Se anota
para que nadie lo tome por descuido:

- **La fotografía del panel de marca** (`excavadora.webp`) es un **fondo de CSS**, no un
  `<img>`. `NgOptimizedImage` la detectaba como elemento LCP y exigía `priority`
  (NG02955), que la precargaría también en móvil, donde ese panel está oculto y la imagen
  no se ve nunca. Y el navegador **no descarga el fondo de un elemento con
  `display: none`**, así que como fondo ni siquiera se pide. El detalle está en la
  utilidad `foto-marca` de `styles.css`.
- **Las banderas del selector de idioma** son SVG de 2 KB servidos desde `public/`, con
  `alt` vacío porque son decorativas. Optimizar un SVG que ya pesa menos que su propia
  petición no aporta nada.

La regla sigue en pie para lo que venga —fotos de equipos, adjuntos—; lo que no procede es
forzarla sobre estos dos casos.

## Internacionalización

Dos idiomas: `es-MX` (el del producto) y `en-US`. El cambio es **en vivo**, sin recargar,
y la elección se guarda en `localStorage` bajo `maquinaria.idioma`.

**No hay librería de i18n, y es a propósito.** El repo no tiene una sola dependencia de
terceros, y lo que hacía falta lo da TypeScript: en `nucleo/i18n/textos.ts`, el
diccionario español define la FORMA y el inglés se declara con ese tipo, así que una
traducción que falte —o una clave inventada— **no compila**, y el error nombra la clave.
Con claves de texto (`'entrar.titulo'`) eso solo se descubre viendo la clave cruda en
pantalla. `@angular/localize` se descartó por ser de tiempo de compilación: un bundle por
idioma obligaría al selector a recargar en `/en-US/` en vez de cambiar en vivo.

### Cómo se usa

En el componente, un miembro; en la plantilla, `t()`. El miembro es obligatorio porque
Angular no puede llamar a una función importada desde el marcado:

```ts
import { t } from '../../nucleo/i18n/i18n';

export class MiPantalla {
  protected readonly t = t;
}
```

```html
<h1>{{ t().inicio.tuAcceso }}</h1>
```

### Las cinco reglas

1. **Ningún texto de interfaz se escribe en una plantilla ni en un `.ts`.** Todo pasa por
   `t()`. Lo que no es texto —el nombre del producto, que es marca— sigue en `sitio.ts`.
2. **Lo que lleva un dato dentro va como función**, no como plantilla con marcadores:
   `permisos: (n) => ...`. Así el dato se comprueba de tipo y no hay que interpretar
   cadenas en tiempo de ejecución.
3. **Un texto que viene de la API no se traduce.** Los mensajes de `/restablecimientos` y
   los de error de login están redactados en el servidor para ser uniformes —no delatar si
   una cuenta existe— y reescribirlos aquí desharía esa uniformidad sin que se note.
4. **El valor por defecto de un `input()` de texto no puede ser el texto.** Se evaluaría
   al construir el componente y se quedaría congelado en el idioma de ese momento. El
   patrón es `input('')` más un `computed` que resuelve el defecto:
   `this.etiqueta() || t().campoContrasena.etiqueta`. Ver `campo-contrasena.ts` y
   `menu-lateral.ts`.
5. **Un menú o una lista de datos va en una función, no en una constante de módulo.** Una
   constante se evalúa al cargar el módulo y se queda en el idioma de ese instante. Ver
   `menuEmpresa()` en `disposicion/opciones-menu.ts`.

### Las dos trampas que ya costaron un rato

**El título de la pestaña.** Los `title` de las rutas son funciones
(`title: () => t().titulos.entrar`), pero el router las invoca **una sola vez, al
navegar**, y guarda la cadena resultante en el snapshot. `TitleStrategy.buildTitle` lee
esa cadena, así que al cambiar de idioma devolvía el título viejo ya resuelto. Por eso
`titulo-pagina.ts` no usa `buildTitle`: recorre el snapshot leyendo `routeConfig.title`,
que sí conserva la función original, y la vuelve a llamar. En una pantalla de acceso,
donde no se navega a ninguna parte, sin esto la pestaña se quedaba en el idioma anterior
para siempre.

**`LOCALE_ID` no cambia en vivo.** Se resuelve al construirse el inyector, así que fechas,
números y moneda se quedan con el idioma con el que se cargó la página. Hoy no se nota
porque no hay un solo `| date` en la aplicación. Está anotado con un comentario
`ponytail:` en `i18n.ts`, con las dos salidas.

## El andamiaje de una pantalla nueva

**La entrada del menú y su ruta se agregan JUNTAS, o no se agregan.** La regla sale de un
fallo que estuvo en disco: `menuEmpresa()` devolvía un grupo `Operación` con `/equipos`,
`/clientes` y `/rentas`, y **`rutas-empresa.ts` no registraba ninguna de las tres**. Para una
empresa cuyo plan las contratara, la opción se dibujaba, se pulsaba, caía en el `path: '**'` y
volvía a `/inicio`. Un menú que no lleva a ningún lado es peor que un menú corto: quien lo
pulsa cree que la pantalla existe y que algo se rompió. Las tres se retiraron el 2026-08-25, y
sus textos —`menu.equipos`, `menu.clientes`, `menu.rentas` y `menu.operacion`, el título del
grupo— se quedan en `textos.ts` a propósito, para volver el día que exista la pantalla.

Y el andamiaje es **un paso más largo** de lo que parecía. Son cuatro cosas, no dos:

1. La ruta en `rutas-empresa.ts` o `rutas-plataforma.ts`, con su `loadComponent` —un chunk
   por pantalla.
2. La línea en `menuEmpresa()` o `menuPlataforma()` (`disposicion/opciones-menu.ts`), con la
   `clave` del módulo si pertenece a alguno; el filtrado por plan y permisos ya funciona.
3. `titulos.<clave>` en los DOS bloques de idioma de `nucleo/i18n/textos.ts`: es lo que lee
   el `title` de la ruta.
4. `menu.<clave>`, también en los dos idiomas.

Faltando 3 o 4 **no compila**, y eso es la red: el diccionario español define la forma y el
inglés se declara con ese tipo. Ver [internacionalización](#internacionalización).

**No existe ninguna constante `MENU_EMPRESA`**, por si algún comentario la nombra —el docblock
de `rutas-empresa.ts` todavía lo hace—: es la función `menuEmpresa()`. Y es función a
propósito, porque una constante se evaluaría al cargar el módulo y el menú se quedaría en el
idioma de ese instante.

## La barra superior

**Hay UNA sola barra por pantalla, y la dibuja el armazón.** Mezcla dos ámbitos a
propósito, porque así es como se ve en el diseño:

| Del armazón | De la pantalla |
|---|---|
| Botón del menú (`lg:hidden`), Salir, avatar de iniciales | Título, contexto, búsqueda, acción principal |

La pantalla no dibuja nada de eso: **lo publica como datos** en el servicio
`disposicion/barra.ts`, desde un `effect` en su constructor.

```ts
effect(() =>
  this.barra.configurar({
    titulo: t().panel.titulo,
    contexto: `${p.contexto(this.resumen().total)} · ${p.actualizado(this.horaDeCarga())}`,
    busqueda: { marcador: p.buscar, valor: this.busqueda },
    accion: { etiqueta: p.nuevaEmpresa, ruta: '/empresas' },
  }),
);
```

Va en un `effect` y no en una llamada suelta porque el contexto depende de cosas que
cambian después: los datos que llegan con la petición, y el idioma.

### Por qué un servicio y no `<ng-content>`

Entre el armazón y la pantalla hay un `<router-outlet>`, y **el contenido proyectado no
cruza un outlet**. Publicar un `<ng-template>` en un servicio sí funcionaría, pero es
maquinaria para mover marcado; describir la barra como datos deja al armazón dibujándola
entera y a la pantalla diciendo solo qué pone. Es el mismo criterio que
`opciones-menu.ts`, donde el menú también es datos.

### Cuatro reglas

1. **El `<h1>` lo pinta la barra.** Una pantalla no añade el suyo: habría dos.
2. **La señal de búsqueda se pasa, no se copia.** `valor` es la señal escribible de la
   pantalla; la barra escribe ahí y la pantalla filtra leyéndola. Sin copia intermedia no
   hay dos estados que sincronizar.
3. **La acción principal o navega o hace algo, nunca las dos.** Con `ruta` el armazón pinta
   un `<a>` —se puede abrir en otra pestaña— y con `alPulsar` un `<button>`. No es cosmético:
   anunciar «enlace» algo que abre una hoja en la misma pantalla es mentirle a un lector de
   pantalla. Y si no hay ni una cosa ni la otra, no se declara acción.

4. **Una acción principal puede ABRIR UNA HOJA, y entonces la confirmación se queda en la
   PANTALLA.** El alta de empresa se mudó al patrón de planes: la barra declara
   `accion: { etiqueta, alPulsar }`, el armazón pinta un `<button>` y el formulario vive en la
   hoja inferior. Antes esa pantalla no tenía acción principal, porque un botón amarillo que
   apuntara al formulario de más abajo no lleva a ninguna parte. Lo que **no** se mete en la
   hoja es la confirmación: lleva la liga de invitación —justo lo que hay que poder leer con
   calma y copiar— y dentro de una hoja que se descarta con un gesto desaparecería con el mismo
   movimiento que la abrió. La hoja se cierra al terminar y el aviso queda en la pantalla.

### El avatar es un desplegable

De él cuelgan la identidad —nombre y correo— y **Salir**. Vive en
`disposicion/menu-usuario.ts` y lo usan las dos aplicaciones; recibe la identidad por
`input()` y emite `salir`, así que no conoce ninguno de los dos almacenes de sesión.

Está ahí por dos razones que se juntaron: al entrar el título de la pantalla en la barra,
el nombre y el correo se quedaron sin sitio; y en un teléfono un botón de «Salir» suelto
competía por el ancho con la búsqueda y la acción principal.

**El disparador se dibuja SIEMPRE**, incluso sin identidad cargada — entonces enseña una
silueta en lugar de las iniciales. Si se ocultara, «Salir» dejaría de estar en la página, y
esconder la única forma de hacer algo es justo lo que prohíbe la regla de arriba.

#### ARIA de divulgación, no de menú

Se declara `aria-haspopup` + `aria-expanded` y el panel es una lista de botones normales.
**No lleva `role="menu"` ni `role="menuitem"`**, y es deliberado: un `role="menu"` obliga a
navegación con flechas, Home y End, y anunciarlo sin implementarlo es peor que no
anunciarlo — el lector de pantalla promete un comportamiento que no está. Con dos
elementos, Tab basta.

Lo que sí es obligatorio, y está implementado:

- **Escape cierra y devuelve el foco al disparador.** Sin lo segundo, cerrar con el foco en
  «Salir» lo deja en la nada: el elemento enfocado desaparece y el foco cae al `<body>`,
  así que hay que recorrer la página entera otra vez (WCAG 2.4.3).
- **Un clic fuera cierra**, y ese sí no mueve el foco: quien usa el ratón ya está mirando a
  otra parte.
- La comprobación de «fuera» es lo que evita que el propio clic del disparador —que también
  burbujea hasta el documento— lo cierre en el mismo gesto que lo abre.

### Responsivo

Por debajo de `sm` la barra se envuelve en dos filas: título arriba, búsqueda y acción a
todo lo ancho abajo (`order-last w-full sm:order-none sm:w-auto`). Comprimirlas en la
misma línea deja la búsqueda inservible, y esconderlas no es opción — la búsqueda es la
única forma de filtrar.

## Datos: `httpResource` y el recurso compartido

**ANTES DE PEDIR NADA EN UNA PANTALLA NUEVA, MIRA SI YA EXISTE.** La lista de empresas, por
ejemplo, ya está en `ApiPlataforma.empresas` y es compartida: el dashboard y la pantalla de
Empresas la leen los dos y entre las dos hacen **una** petición. Antes cada una hacía la
suya en cada navegación.

### El recurso vive en el SERVICIO, no en el componente

Ahí está toda la gracia. Un `httpResource` dentro de un componente se crea una vez por
instancia de componente: dos pantallas, dos peticiones. En un servicio `providedIn: 'root'`
hay una sola instancia, así que hay un solo recurso y una sola petición, compartida y
cacheada mientras la aplicación viva.

```ts
// nucleo/api/api-plataforma.ts
private readonly recursoEmpresas = httpResource<readonly ResumenEmpresa[]>(
  () => (this.sesion.activa() ? `${this.base}/empresas` : undefined),
  { defaultValue: [] },
);
```

```ts
// en la pantalla: se leen señales, y ya
protected readonly empresas = this.api.empresas;
protected readonly cargando = this.api.empresasCargando;
protected readonly error = this.api.empresasError;
```

Eso sustituye a las tres señales más el `subscribe` que había en cada pantalla.

### Cuando no lo comparte nadie: una fábrica

Si la lectura lleva parámetros de la pantalla y no la comparte nadie —las dos consultas de
liga, `Api.consultaDeInvitacion` y `Api.consultaDeRestablecimiento`— el dedup no aplica, pero
la otra razón sí. Entonces el servicio expone una **fábrica** que devuelve señales:

```ts
// en el componente, en un inicializador de campo (que es contexto de inyeccion)
private readonly liga = this.api.consultaDeInvitacion(this.empresa, this.token);

protected readonly invitacion = this.liga.valor;
```

La fábrica devuelve un `ConsultaDeLiga<T>`: `valor`, `cargando`, `resuelta`, `error` y
`noSirve`. Con la URL dependiendo de la señal del token, **la consulta se rehace sola si el
token cambia** — antes eso era un `effect` con un `subscribe` dentro.

`noSirve` es el 404, y existe porque en una liga significa algo distinto de «falló la red»:
un 404 dice que la liga no sirve —no existe, ya se usó o caducó, y el backend no los
distingue a propósito—, mientras que cualquier otro código no dice NADA de la liga. Con lo
segundo se reintenta; con lo primero se manda a pedir otra.

### Lo que se expone son SEÑALES, nunca el recurso

`httpResource` está marcado **`@experimental`** en Angular —desde la 19.2, y sigue así en la
21.2—, así que se queda encerrado en el archivo del servicio. Las pantallas ven
`Signal<T>` normales. Si su API cambia en una versión menor, cambia un archivo y no
veintiséis pantallas.

### Tres trampas, las tres pagadas ya

**1. `value()` LANZA si el recurso está en error.** Está en su documentación, en una frase de
paso: *«the current value, or throws an error if the resource is in an error state»*. Como
las pantallas leen los datos dentro de un `effect` sin condición, exponer `.value` directo
hacía que un fallo de la petición reventara el efecto en lugar de pintar el aviso. La
envoltura obligatoria:

```ts
readonly empresas = computed(() =>
  this.recursoEmpresas.hasValue() ? this.recursoEmpresas.value() : [],
);
```

**2. Una URL `undefined` significa «todavía no pidas».** Es como se expresa una petición
condicional. Sin eso, la pantalla de acceso —que inyecta el mismo servicio para iniciar
sesión— dispara un GET sin token y se come un 401 antes de que nadie haya entrado.

**3. Un `input()` de ruta puede ser `undefined` aunque su tipo diga `string`.**
`withComponentInputBinding` asigna `undefined` cuando el parámetro no está en la URL, y eso
**pisa el valor por defecto** del `input`. Así que las comprobaciones van con falsy y no con
`=== ''`:

```ts
readonly token = input('');          // el tipo dice string; en ejecucion puede ser undefined
!empresa || !token() ? undefined : `.../invitaciones/${...}`
```

Con la comparación estricta se pedía la liga `undefined`, el servidor contestaba 404, y **una
liga que faltaba se veía como una liga caducada**. Era un fallo anterior a los recursos; la
migración solo lo hizo visible. Hay pruebas de regresión en `api.spec.ts`.

**4. El error hay que desenvolverlo.** `Resource.error` está tipado como `Error`, y Angular
envuelve lo que no sea «parecido a un error». Un `HttpErrorResponse` pasa tal cual porque
tiene `name` y `message`, pero se desenvuelve igual (`error.cause ?? error`) para no depender
de ese detalle interno. Sin ello se perdería el `detail` del `ProblemDetails` y todos los
fallos se verían como «Ocurrió un error inesperado».

### Una mutación recarga su propia lista

El `reload()` va en el servicio, encadenado a la mutación, **no en la pantalla**:

```ts
darDeAltaEmpresa(alta: AltaDeEmpresa) {
  return this.http.post<EmpresaAprovisionada>(`${this.base}/empresas`, alta)
    .pipe(tap(() => this.recargarEmpresas()));
}
```

Así quien dé de alta una empresa no tiene que acordarse de recargar, y el día que haya un
segundo sitio que lo haga no hay una segunda copia de esa llamada que se pueda olvidar. La
pantalla de Empresas ya no tiene función `recargar()`.

### Qué NO es un recurso

Un `httpResource` es para **leer**. Las mutaciones —iniciar sesión, dar de alta, restablecer
una contraseña— siguen siendo `HttpClient` con `subscribe`: las dispara una persona, tienen
su propio `enviando` y su propio error, y no se cachean. Las pantallas de acceso se quedan
como están.

### Por qué no TanStack Query

Se evaluó y se descartó por ahora: `httpResource` cubre lo que dolía —el estado de carga
repetido en cada pantalla— sin añadir la primera dependencia de terceros del repo, y el
adaptador de Angular de TanStack también está marcado como experimental. **El disparador para
volver a mirarlo**: cuando una mutación tenga que invalidar varias listas de pantallas
distintas, cuando haya que escribir una caché propia con TTL, o cuando haga falta paginación
de servidor con `keepPreviousData`. Hasta entonces, no.

## Sesión: el refresco del token va SERIALIZADO

El token de refresco del backend **ROTA en cada canje y no tiene ventana de gracia**, y de ese
único hecho sale todo lo demás. Dos peticiones que caducan a la vez canjearían el MISMO token;
el backend lee el segundo canje como **reuso de token robado y revoca toda la cadena de
sesiones del usuario**. Un refresco sin serializar no degrada la experiencia: **echa a la calle
a quien estaba trabajando.** Por eso hay una clase entera para esto
—`nucleo/sesion/refresco-sesion.ts`— y su única obligación es que nunca haya dos refrescos en
vuelo.

Las piezas son cuatro archivos: `refresco-sesion.ts` (el canje serializado),
`interceptor-refresco.ts` (el 401 que lo dispara y el reintento), `interceptor-token.ts` (la
cabecera, compartida por las dos sesiones) y el orden en `app.config.ts`.

### Las tres piezas del single-flight, y por qué las tres hacen falta

```ts
this.enVuelo = this.api.refrescarSesion(datos.empresa, datos.tokenRefresco).pipe(
  map((sesion) => { this.sesion.abrir(sesion); return sesion.token; }),
  catchError((error: unknown) => { this.terminarSesion(); return throwError(() => error); }),
  finalize(() => (this.enVuelo = null)),
  shareReplay({ bufferSize: 1, refCount: false }),
);
```

1. **El campo `enVuelo`** hace que el segundo que llega reciba el MISMO observable en vez de
   crear otro. Es la mitad evidente, y por sí sola no sirve de nada.
2. **`shareReplay({ bufferSize: 1, refCount: false })` es la mitad que de verdad serializa.**
   Los observables de `HttpClient` son **fríos**: sin compartir la suscripción, dos
   suscriptores del «mismo» observable disparan **dos POST** — exactamente el fallo que se
   está evitando. Quien quite esta línea creyendo que `enVuelo` ya lo resuelve, lo reintroduce.
3. **`finalize` va ANTES del `shareReplay`.** Así corre una vez, al terminar la fuente, y no
   una vez por suscriptor. Es lo que libera `enVuelo` para que el siguiente 401 —que ya tendrá
   el token rotado— pueda pedir un canje nuevo.

**Y `refCount: false` no es un adorno.** Con `true`, una petición cancelada porque su pantalla
se destruyó desmontaría el canje **a medias**: el token ya rotado en el servidor y sin guardar
en el cliente. El siguiente refresco iría con un token que el backend ya considera canjeado —
revocación de toda la cadena. Con `false` el canje se termina siempre y lo que se guarda es lo
que se emitió.

### Sin bucle por CONSTRUCCIÓN, no por bandera

Las dos mitades están cerradas sin que nadie tenga que acordarse de nada:

- **La petición de refresco sale por `HttpBackend`** (`Api.refrescarSesion`), fuera de la
  cadena de interceptores. No lleva `Bearer` —el token de acceso ya caducó y el endpoint es
  anónimo— y no puede dispararse a sí misma.
- **El reintento se lanza DENTRO del `catchError`**, y un `catchError` no atrapa lo que
  devuelve su propio manejador. Si el reintento vuelve a dar 401, ese 401 **sale a la
  pantalla** en lugar de pedir otro canje.

### Fallo limpio: una vez para todos, error para cada uno

`terminarSesion()` —limpiar la sesión y navegar a `/entrar?expirada=1`— vive en el
`catchError` de la **fuente compartida**, así que corre **una sola vez** aunque estén
esperando diez peticiones. Ante un fallo del canje no hay reintento posible: el 401 del
endpoint de refresco tapa seis motivos —inexistente, caducado, revocado, reusado, usuario
inactivo, empresa que no puede operar— y ninguno se arregla volviéndolo a pedir.

El error **sí** se propaga a cada suscriptor, y eso es deliberado: una petición que no falla
deja su pantalla en «enviando» para siempre.

### El orden de los interceptores es carga funcional

```ts
provideHttpClient(withInterceptors([interceptorRefresco, interceptorToken]))
```

`interceptorRefresco` va **por fuera**, así que su `siguiente(peticion)` vuelve a pasar por
`interceptorToken` y el reintento sale con el `Bearer` **nuevo** sin que aquí haya que tocar
ninguna cabecera. Al revés, el reintento saldría con el token ya caducado y daría otro 401.

Son además dos momentos distintos del ciclo —uno toca la petición al salir, el otro la
respuesta al volver—, y por eso son dos archivos y no un `if` más.

### Plataforma queda FUERA

El backend **no tiene `sesion_refresh` para plataforma**, así que `interceptor-refresco`
descarta `/api/plataforma/**` en su primera línea y un 401 de ese ámbito se propaga tal cual.
Lo que sí sigue compartido es la cabecera: `interceptor-token` elige entre el token de
plataforma y el de empresa **por la ruta**, y sirve a las dos sesiones.

### Lo que se dejó FUERA a propósito

- **No hay refresco proactivo por `expiraEn`.** Un temporizador agrega desfase de reloj,
  timers que limpiar y un segundo camino que puede colarse en paralelo con el reactivo. El 401
  ya es la señal, y llega del único sitio que sabe la verdad.
- **Una petición lenta que da 401 después de que otra ya refrescó dispara un canje de más**,
  con el token NUEVO. Eso es un refresco desperdiciado, **no** reuso: la cadena no se revoca.
  Está probado, no supuesto.

### Las pruebas

`nucleo/sesion/interceptor-refresco.spec.ts`, **11 pruebas**. La que más importa es
«dos peticiones concurrentes que dan 401 producen UN SOLO refresco»; el resto es la red
alrededor: que se guarde el token rotado, que la navegación al acceso ocurra una vez, que el
429 del limitador no se confunda con un 401, que un reintento con 401 no se reintente otra
vez, que plataforma no dispare nada, y que dos 401 separados en el tiempo sí canjeen dos veces
con el token rotado.

## Capas: hoja inferior y globo de ayuda

Las dos usan **elementos nativos**, y esa es la razon de que ocupen tan poco codigo.

### La hoja inferior es un `<dialog>` ARRASTRABLE

Vive en `disposicion/hoja.ts` y se usa proyectando contenido:

```html
<app-hoja
  [abierta]="hojaAbierta()"
  [anclajes]="[50, 70, 95]"
  [titulo]="..."
  [apoyo]="..."
  (cerrar)="cerrarHoja()"
>
  <form ...>…</form>
  <div pie>…</div>
</app-hoja>
```

**Los anclajes son configurables**, en porcentaje del alto de la pantalla y tantos como haga
falta. Se abre en el más bajo, sube de uno en uno al arrastrar hacia arriba, baja al arrastrar
hacia abajo, y desde el más bajo un arrastre hacia abajo la cierra; un lanzamiento fuerte
cierra desde cualquiera. Se normalizan al leerlos —ordenados, sin repetidos, acotados entre 20
y 98— y una lista vacía cae a los de por defecto: una hoja de cero píxeles no se ve como un
error, se ve como una hoja que «no abre».

**Lo que la hace una hoja y no un modal es que se mueve.** Se agarra del asa, sube al anclaje
completo, baja al medio, y si se tira hacia abajo lo suficiente —o se lanza con un gesto
rápido— se cierra. Un panel que solo aparece y desaparece es un modal con las esquinas
redondeadas, y ese fue el primer intento: **una hoja no se centra nunca**, se queda abajo en
todos los anchos.

El elemento es un `<dialog>` con `showModal()`, y de ahí salen gratis el atrapado de foco, el
`aria-modal`, el resto de la página inerte y la capa superior. Lo que el componente agrega es
el gesto y los anclajes.

#### Cinco decisiones del gesto, y por qué

1. **El arrastre solo vive en el asa y la cabecera.** Arrastrar desde el cuerpo obliga a
   distinguir «quiero mover la hoja» de «quiero desplazar el contenido», que se resuelve
   mirando si el contenedor está en su tope y encadenando los dos gestos. Con el asa como
   única zona, el cuerpo se desplaza como cualquier lista y no hay conflicto.
2. **`touch-action: none` en la zona de arrastre.** Sin él el navegador se queda el gesto
   vertical para desplazar la página y los `pointermove` nunca llegan.
3. **`setPointerCapture` va primero y entre `try`.** Sin captura, sacar el dedo del asa corta
   el gesto a medias. Pero **lanza** si el puntero ya no existe —un toque muy rápido—, y si
   eso pasara después de marcar `arrastrando`, la hoja se quedaría en modo gesto para siempre:
   sin transición y esperando un `pointerup` que nunca llega.
4. **La velocidad necesita un piso de muestreo (8 ms).** Sin él, dos `pointermove` en el mismo
   milisegundo —normal con un puntero de alta frecuencia o con eventos coalescidos— dan una
   división por casi cero y una velocidad enorme. El síntoma es **una hoja que se cierra sola
   en un arrastre lento de 45 px**, que es lo contrario de lo que el gesto quiere decir. Es un
   fallo que ya ocurrió.
5. **La transición se apaga mientras el dedo está encima** (`hoja-en-gesto`). Con la
   transición puesta la hoja persigue al dedo con retraso, que es el síntoma clásico de una
   hoja que no se programó con el gesto en mente.

#### Tres cosas que el NAVEGADOR le hace a un `<dialog>` y hay que deshacer

Las tres dieron fallos reales, y ninguna avisa: no hay error, solo algo que se ve mal.

| Lo que pone el navegador | Síntoma | Qué se escribe |
|---|---|---|
| `display: none` al cerrado | **La hoja se ve en la página estando cerrada** — con su formulario y todo. Lo pisaba nuestro `display: flex`, que tiene la misma especificidad y gana por orden | `&:not([open]) { display: none }` |
| `max-height: calc(100% - 6px - 2em)` | Alto constante que ignora el anclaje | El tope va **en línea** desde el componente |
| `max-width: calc(100% - 6px - 2em)` | 38 px de hueco a la derecha | `max-width: 100%` |

La regla general: al usar `<dialog>` para algo que no es un cuadro centrado, **hay que anular
sus valores por defecto uno por uno**, y comprobar el estado CERRADO además del abierto.

#### El gesto es ASIMÉTRICO: subir es CRECER, bajar es DESPLAZARSE

**Esta guía lo documentaba al revés, y lo que documentaba era el fallo.** El arrastre se
aplicaba entero al `translate`, y la hoja está clavada al fondo con `inset: auto 0 0`: un
`translate` **negativo** la **despega del borde inferior** y deja ver el velo debajo, con el
pie y su acción principal subiendo con ella; al soltar volvía de golpe. Medido en navegador
real sobre una ventana de **720 px** de alto: **200 px de arrastre daban 200 px de hueco.**

Una hoja inferior no se mueve hacia arriba, **crece** hacia arriba. El reparto que hay escrito:

| Dirección | Dónde va | Por qué |
|---|---|---|
| **Arriba** | el tope de alto: `min(98dvh, calc(<anclaje>dvh + <subida>px))` | Su borde de abajo no se separa nunca del de la pantalla |
| **Abajo** | el `translate`, y solo positivo | Ahí sí es un desplazamiento de verdad: la hoja se va **por debajo** del borde, que es lo que tiene que parecer al descartarla |

Medido después del arreglo, misma ventana de 720: **360 px en reposo, 560 px con 200 px de
arrastre y 0 de hueco**, y 706 px con un arrastre enorme — que es el freno de `98dvh`
haciendo su trabajo.

**El `min()` va en CSS y no en JavaScript**, y no por gusto: mezcla unidades —`dvh` del
anclaje con `px` del dedo— y solo el navegador sabe cuánto mide un `dvh` en este instante.
Calcularlo en JS obligaría a leer `innerHeight` en cada `pointermove`.

**Se quitó la goma elástica** del anclaje más alto. Amortiguaba el tirón a un cuarto para dar
el efecto de las hojas de móvil, pero lo conseguía **levantando la hoja del fondo**: el mismo
fallo en pequeño. Ahora subir es crecer, y por encima del anclaje más alto no hay nada que
crecer, así que el tirón se ignora en lugar de fingir movimiento.

Lo fija `disposicion/hoja.spec.ts`, **6 pruebas**, y la regla que fijan es una sola: **el
`translate` nunca es negativo, en ningún recorrido.** Si alguien vuelve a mandar el arrastre
completo al `translate`, esas pruebas fallan.

#### El anclaje es un TOPE de alto, no un alto fijo

Aparte de lo del `max-height` de arriba, un alto fijo deja hueco vacío cuando el contenido es
más corto que el anclaje. Con el tope, la hoja mide lo que mide su contenido hasta donde el
anclaje la deje.

**La consecuencia honesta, que hay que escribir:** si el contenido **ya cabe entero**,
arrastrar hacia arriba no mueve nada, porque no hay nada más que descubrir. Es tope, no alto.

#### Accesibilidad: el arrastre nunca es el único camino

El asa es un `<button>`, así que con teclado alterna entre los dos anclajes y su `aria-label`
dice a cuál lleva. Escape cierra —lo da el `<dialog>`— y hay un botón de cerrar explícito. Un
gesto de puntero como única forma de expandir dejaría fuera a quien navega con teclado
(WCAG 2.1.1).

#### Lo demás de la forma

Pegada al fondo y a lo ancho, **sin huecos**, con solo las esquinas de arriba redondeadas y
la sombra hacia arriba, que es por donde se separa del contenido. El velo es **negro puro al
55 %** —no el negro de la marca: el velo no es parte de la paleta, es ausencia de pantalla— y
entra a la vez que la hoja, o aparece de golpe y la hoja llega después. La entrada es `translateY(100%)` —desde fuera de la pantalla, no unos píxeles— y
solo hay animación de entrada: la de salida necesita `transition-behavior: allow-discrete`,
que aún no está en todos los motores.

La transición cubre **las dos mitades del gesto** —`translate` y `max-height`— justamente
porque subir y bajar se expresan en propiedades distintas; declarar solo `translate` dejaría
el crecimiento a saltos.

#### El clic en el velo NO lo da el navegador

Aquí había un error en esta guía: un `<dialog>` modal cierra con **Escape**, pero **ignora los
clics en su velo**. Hay que escribirlo.

Y se detecta por `target`, **no por coordenadas**, que fue un fallo de accesibilidad real: un
`click` nacido del TECLADO —Enter o Espacio sobre un botón— llega con `clientX` y `clientY` en
**cero**. Con la comprobación geométrica ese cero quedaba «por encima» de la hoja y se leía
como un clic en el velo, así que **pulsar con teclado cualquier botón de dentro cerraba la hoja
entera**. Con `target` no hay ambigüedad: el velo es área del propio `<dialog>`, y todo lo de
dentro está cubierto por sus hijos.

```ts
if (dialogo === undefined || evento.target !== dialogo) return;
```

Falta un detalle más: al soltar un arrastre que acabó fuera de la hoja, el navegador emite
también un `click`. Sin una bandera que recuerde que hubo gesto, ese clic se lee como «pulsé el
velo» y cierra la hoja justo después de haberla arrastrado.

**Y el `(close)` del `<dialog>` no es opcional.** Escape lo cierra el NAVEGADOR sin pasar por
tu método; sin escucharlo la señal se queda diciendo que está abierta, y como el `effect` no se
reejecuta si nada cambió, **el botón deja de abrir la hoja para siempre**.

### El globo de ayuda es un `popover`

El atributo `popover` nativo con `popovertarget` da el descarte al pulsar fuera, el cierre con
Escape y la capa superior. A mano es una senal, dos escuchas de documento y una comprobacion
de contencion — que es exactamente lo que hay escrito en `menu-usuario`, **anterior a esto**.
Si se toca ese componente, migrarlo a `popover` borra casi todo su codigo.

Su posicion va **explicita** (`top` y `right`, no `inset: auto`): un popover vive en la capa
superior, donde «auto» no tiene una posicion estatica de la que partir y el resultado depende
del motor.

Se usa `aria-details` y no `aria-describedby` cuando el contenido tiene estructura —un titulo
y varios puntos—: `describedby` lo aplana a una sola cadena leida de corrido.

### Verificar capas con el panel del navegador oculto

Ojo con esto, que hace perder el tiempo: **con el panel oculto la pagina no compone
fotogramas**, asi que las animaciones se congelan en su primer fotograma y las tareas en cola
se retrasan. Sintomas que parecen fallos y no lo son:

- `getBoundingClientRect()` devuelve la posicion **con la transformacion de entrada aplicada**
  — una hoja que parece desbordar 24 px es la animacion a medias. Se resuelve con
  `elemento.getAnimations().forEach(a => a.finish())` antes de medir.
- Los `Escape` sinteticos no llegan al `<dialog>`, y el evento `close` puede tardar. Para
  comprobar el enganche, despacha el evento a mano: `d.dispatchEvent(new Event('close'))`.

## Confirmar antes de una acción destructiva

**Nunca `confirm()` ni `alert()`.** La pregunta va por `Confirmacion.pedir()`
(`disposicion/confirmacion.ts`), que devuelve una promesa de booleano y sustituye a
`confirm()` línea por línea:

```ts
const sigue = await this.confirmacion.pedir({
  titulo: t().marcas.retirar,
  mensaje: t().marcas.confirmarRetiro(marca.nombre),
  confirmar: t().marcas.retirar,
  peligro: true,
});

if (!sigue) {
  return;
}
```

### Por qué no el del navegador

Cuatro razones, y ninguna es estética:

- **Ignora el idioma de la aplicación.** Sus botones salen en el del navegador, así que
  alguien con la interfaz en español lee «OK / Cancel». El diccionario no los alcanza, y el
  selector de idioma queda desmentido en el peor momento.
- **No se puede estilizar.** Rompe el sistema de diseño justo cuando la persona está a punto
  de romper algo.
- **Bloquea el hilo.** Detiene renderizado y animaciones mientras está abierto.
- **No distingue lo destructivo de lo neutro.** «Retirar una marca» y «Guardar cambios» se
  ven idénticos.

### El reparto

El estado vive en un servicio y el marcado en el armazón, que monta
`<app-dialogo-confirmacion />` **una sola vez**. Es el mismo reparto que `Barra`, y por la
misma razón: dieciocho pantallas con su propio diálogo serían dieciocho copias del mismo
marcado que se separan con el tiempo.

### Cinco reglas

- **`mensaje` dice qué CAMBIA**, no «¿estás seguro?». Una pregunta sin la consecuencia
  dentro obliga a decidir a ciegas. «Deja de ofrecerse al capturar un equipo» sí informa.
- **`confirmar` es un VERBO**, nunca «Aceptar». Leer «Retirar» dice qué va a pasar aunque no
  se haya leído el texto, que es como se usa un diálogo de verdad.
- **Cancelar va primero en el DOM y lleva `autofocus`.** Un `<dialog>` enfoca su primer
  elemento enfocable, y en una pregunta destructiva eso tiene que ser la opción segura: con
  el orden invertido, un Enter reflejo ejecuta lo que se estaba preguntando.
- **Cerrar sin elegir es NO.** Escape lo cierra el navegador sin pasar por el componente, así
  que el `(close)` del `<dialog>` resuelve la promesa en `false`. Sin eso, quien esperaba se
  queda colgado para siempre con su botón bloqueado — y no hay error en consola ni nada que
  ver en pantalla. Hay prueba de regresión en `confirmacion.spec.ts`.
- **Lo destructivo va en NEGRO, no en rojo.** La paleta es monocroma más amarillo y el
  sistema de diseño prohíbe el rojo; el amarillo es el color de la acción que se quiere, así
  que sacarlo ya dice que este no es el camino feliz. El color **no es el único indicio**: la
  etiqueta lleva el verbo.

### Una pregunta nueva cancela la anterior

Si se pide una confirmación con otra abierta, la primera se resuelve en `false` antes de
sustituirla. Dejarla colgada filtraría una promesa que nunca se resuelve. Pasa de verdad: dos
filas pulsadas rápido, o un atajo que abre otra.

## Esqueletos de carga

**Nada de textos que digan «Cargando…».** Mientras llegan los datos se pinta la SILUETA de
lo que viene: bloques grises con la forma, el tamaño y la posición del contenido real.

La razón no es estética. Un texto no dice nada de la forma de lo que falta, así que al
llegar los datos la pantalla salta de una línea a una rejilla de tarjetas, y ese salto se
lee como un error. Con la silueta, el hueco ya mide lo que va a medir.

Las piezas son `@utility esqueleto` y `@utility esqueleto-inverso` en `src/styles.css`. La
segunda es para fondos oscuros: sobre una tarjeta negra el gris claro es un parche blanco, y
el esqueleto de una tarjeta destacada tiene que seguir siendo negro o el layout parpadea de
color al cargar.

### Accesibilidad: el texto no se pierde, se mueve

El «Cargando…» no era solo visual — era el `role="status"` que anuncia la carga. Quitarlo
del todo dejaría a un lector de pantalla anunciando una región vacía. El reparto es:

```html
<div aria-busy="true">
  <p role="status" class="sr-only">{{ t().comun.cargando }}</p>

  <div aria-hidden="true">
    <!-- los bloques del esqueleto -->
  </div>
</div>
```

- **`aria-busy`** en el contenedor: lo de dentro está a medias.
- **`role="status"` + `sr-only`**: el anuncio, invisible pero presente.
- **`aria-hidden`** en los bloques: son decoración, y deletrear cuarenta divs vacíos es ruido.

El latido se apaga con `prefers-reduced-motion`, y eso va **dentro de la utilidad**, no en un
`motion-reduce:` en cada uso: de esos se olvida uno, y es el que marea a quien pidió menos
movimiento.

### En un componente hermano, no en la rama del `@if`

El esqueleto del dashboard vive en `paginas/plataforma/dashboard/esqueleto.{ts,html}`.
Dentro de `dashboard.html` esas sesenta líneas duplicarían su longitud y habría que leer dos
rejillas en paralelo para encontrar la de verdad.

**El precio es la estructura duplicada, y se paga a sabiendas.** La alternativa —pintar la
plantilla real con datos de relleno— obliga a que cada `@if`, cada `@for` y cada pipe de la
pantalla aguanten datos falsos, y eso ensucia el camino bueno para adornar el malo. Lo que
sí es obligatorio: **si cambia el layout real, cambia el esqueleto.** Un esqueleto que ya no
coincide es peor que ninguno, porque promete una forma y entrega otra.

### Qué puede coincidir y qué no

Medido en el dashboard, esqueleto contra cargado:

| | Diferencia |
|---|---|
| Ancho del contenedor | 0 px |
| Alto de la gráfica | 0 px |
| Tarjeta de indicador | 1 px |
| Un elemento de la lista de avisos | 7 px |
| La tarjeta de avisos completa | 141 px |

Lo de altura fija coincide exacto. **Lo que no puede coincidir es una lista cuyo largo se
desconoce hasta que llegan los datos**: el esqueleto pinta tres avisos y llegaron cuatro. Se
elige un número plausible y se acepta la diferencia; fingir precisión ahí no se puede.

**Y un desajuste que aquí se daba por inevitable ya no lo es.** El esqueleto de `empresas` no
podía coincidir en altura por debajo de `sm`: la tabla era de reparto automático y **sin
`min-w-*`**, así que en un teléfono envolvía el texto de sus celdas, sus filas crecían de alto
y el espejo se quedaba corto. Con `min-w-160` la tabla ya no envuelve —se desplaza dentro de su
caja— así que **las alturas coinciden a cualquier ancho**. El `min-w` tiene que estar también
en el esqueleto, o es él el que se encoge donde la tabla no lo hace. La regla general que sale
de esto: **una tabla de reparto automático no se puede espejar**; si hay esqueleto, hay
`min-w-*`.

Dos detalles que sí se afinan y valen la pena:

- **Los bloques miden la CAJA DE LÍNEA del texto, no su tamaño de fuente.** Un texto de 12 px
  ocupa 16, así que su bloque es `h-4` y no `h-3`. Con `h-3` cada tarjeta quedaba 5 px más
  baja.
- **Los altos de las barras de una gráfica van FIJOS.** Con `Math.random()` la silueta
  temblaría en cada pasada de detección de cambios, y además la convención prohíbe suponer
  globales así en las plantillas.

### Cuándo NO va un esqueleto

Solo para los datos con los que ARRANCA una pantalla. Para algo que la persona acaba de
disparar —enviar un formulario, guardar— lo correcto sigue siendo el botón deshabilitado con
su «Enviando…»: ahí sí se sabe qué está pasando y quién lo pidió, y una silueta escondería
el formulario que acaba de rellenar.

## Responsivo

**Toda pantalla se hace responsiva desde el primer commit.** No es una pasada posterior:
adaptar una pantalla ya escrita cuesta más que escribirla adaptada, porque obliga a
deshacer decisiones de ancho fijo que ya se colaron en tres sitios.

### Móvil primero, y siempre en ese orden

Las clases sin prefijo son las del **teléfono**; los prefijos `sm: md: lg: xl:` solo
**añaden** al ensanchar. Nunca al revés: una clase de escritorio revertida con `sm:` deja
el caso pequeño —que es el más apretado— definido por descarte.

```html
<!-- Sí: declara la forma estrecha y la ensancha -->
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

<!-- No: el caso del teléfono queda implícito -->
<div class="grid grid-cols-4 gap-4 sm:grid-cols-1">
```

Los cortes son los de Tailwind, sin personalizar: `sm` 640, `md` 768, `lg` 1024, `xl`
1280. El que más pesa aquí es **`lg`**, porque es donde el menú lateral pasa de cajón a
columna fija: por debajo de `lg` el contenido tiene todo el ancho.

### Las cinco reglas

1. **El `<body>` no se desplaza en horizontal, nunca.** Lo que no cabe se desplaza dentro
   de su propia caja con `overflow-x-auto` — tablas, gráficas y bloques de código. Es la
   comprobación más barata de todas y la que más se rompe.
2. **Una tabla ancha se desplaza, no se convierte en tarjetas.** Convertirla duplica el
   marcado y las dos copias se desincronizan. La tabla va en un `overflow-x-auto` con
   `min-w-*` para que las columnas no se aplasten, y **su primera columna se fija** — el
   porqué, más abajo.
3. **Nada de anchos fijos en el contenido.** `max-w-*` y `min-w-0` sí; `w-[720px]` no. El
   `min-w-0` en un hijo de flex es lo que permite que `truncate` funcione: sin él, el hijo
   se niega a encogerse y desborda al padre.
4. **Los grupos de botones y chips se envuelven** (`flex-wrap`), no se desbordan ni se
   comprimen.
5. **Lo que se oculta en móvil no puede ser la única forma de hacer algo.** Ocultar es
   para lo redundante —un avatar cuando el nombre ya está al lado—, nunca para una acción.

### La primera columna de una tabla ancha se FIJA

La regla 2 dice que una tabla ancha se desplaza. Lo que falta es lo que se descubrió al
usarla: **desplazándose en horizontal se pierde de vista de qué fila se está leyendo.** La
tabla de planes tenía **seis** columnas y era exactamente el síntoma que se reportó — tres
columnas a la derecha, ya no se sabe de qué plan se habla.

Dos cambios, y el segundo importa tanto como el primero:

1. **La columna del identificador se fija** con `sticky left-0` — el plan en `planes`, el slug
   en `empresas`.
2. **La columna del estado se mudó DENTRO de la celda del plan**, como píldora pegada al
   nombre, donde de hecho se lee mejor. De seis columnas a **cinco**: una columna menos que
   desplazar es mejor que una columna más que fijar. Esto es de `planes`; `empresas` ya tenía
   cinco y solo recibió la columna fija.

Tres detalles que **fallan en silencio** si se olvidan, porque no dan error, solo se ven mal:

- **Fondo propio y opaco** en la celda fija, o el contenido que pasa por debajo se
  transparenta.
- **Un filete a la derecha** (`border-r border-borde`), o el corte se lee como un error de
  maquetado en vez de como una columna fijada.
- **El fondo tiene que ser el de SU fila**: el del `<thead>` en el `<th>` —`bg-superficie-sutil`
  en `empresas`, y `bg-superficie` en `planes`, cuya cabecera hoy va sin relleno— y el de la
  superficie en el `<td>`. Un solo color para las dos deja la cabecera con el tono del cuerpo.

Verificado en navegador real a **375 px**: 640 px de contenido en una caja de 375, se desplaza
dentro de su caja, `position: sticky` en el estilo calculado, fondo opaco, y tras desplazar
265 px la primera columna seguía en `left: 0`. El documento no se desplaza en horizontal.

Sigue vigente la regla dura de siempre: `overflow-x-auto` **en la tabla y nunca en la
página**, y la tabla **no** se reconstruye como tarjetas.

Y el `min-w-*` que exige la regla 2 tiene un efecto de rebote que vale la pena conocer: con la
tabla fijada a `min-w-160` sus celdas ya no envuelven en un teléfono, así que **su esqueleto
vuelve a poder espejarla a cualquier ancho**. Ver [esqueletos](#qué-puede-coincidir-y-qué-no).

### Ocultar de verdad, no solo de la vista

Un elemento sacado de pantalla con `translate` **sigue en el orden de tabulación**: quien
navega con teclado se mete en un menú que no ve. Para eso está `visibility: hidden`, que sí
saca del foco, y se revierte con `lg:visible`. Es exactamente lo que hace `menu-lateral`:

```html
<nav class="fixed ... transition-transform lg:static lg:visible lg:translate-x-0"
     [class.-translate-x-full]="!abierto()"
     [class.invisible]="!abierto()">
```

`display: none` también sirve, pero mata la transición; con `visibility` el cajón entra
deslizándose.

### El armazón

El menú lateral es **un cajón por debajo de `lg` y una columna fija desde `lg`**. Lo que
eso exige, y que no es opcional:

- Un botón de hamburguesa en la cabecera, `lg:hidden`, con `aria-expanded` y
  `aria-controls="menu-lateral"`.
- Un velo que tape el contenido. Es un `<button>` y no un `<div>` con `click`: un `div`
  clicable no recibe foco ni responde a Enter.
- **Escape lo cierra** (WCAG 2.1.2), desde el `host` del armazón y no con `@HostListener`.
- Un clic en el menú lo cierra: cualquier opción navega, y dejar el cajón encima de la
  pantalla nueva obliga a cerrarlo a mano.

### Cómo se comprueba

En los tres anchos, y son tres números concretos: **375** (teléfono), **768** (tableta) y
**1280** (escritorio). Lo que se mira en cada uno:

| Qué | Cómo se ve que está mal |
|---|---|
| `document.documentElement.scrollWidth > innerWidth` | Hay desborde horizontal del documento |
| El menú cerrado | Algún enlace suyo sigue siendo alcanzable con Tab |
| Los grupos de tarjetas | Cifras o pies cortados |
| La tabla | Se desplaza la página en vez de la tabla |
| La columna fija | Se va con el desplazamiento, o el contenido se le transparenta por debajo |

## Accesibilidad

Requisito, no aspiración:

- Debe pasar todos los checks de AXE.
- WCAG AA como mínimo: manejo de foco, contraste de color y atributos ARIA.

## TypeScript

- Tipado estricto; inferencia cuando el tipo es obvio.
- Evitar `any`; usar `unknown` cuando el tipo es incierto.

Flags activos en `tsconfig.json`: `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `isolatedModules`. Del compilador de Angular: `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`.

## Estructura de carpetas

En español, como todo el dominio. Nada de `core/`, `features/` ni `shared/`.

```
src/app/
├── app.ts, app.html, app.config.ts
├── app.routes.ts    elige el árbol de rutas según el subdominio
├── rutas-empresa.ts, rutas-plataforma.ts, rutas-portal.ts
├── nucleo/          servicios y reglas transversales, SIN pantallas
│   ├── ambiente/    de dónde sale la configuración y qué empresa es esta
│   │                configuracion.ts, sitio.ts, tenant.ts (+ .spec), titulo-pagina.ts
│   ├── i18n/        los textos de la interfaz en los dos idiomas y el idioma activo
│   │                textos.ts, i18n.ts (+ .spec)
│   ├── api/         llamadas HTTP, tipos del contrato y traducción de errores
│   │                api.ts, api-plataforma.ts, contratos*.ts, mensaje-error.ts
│   └── sesion/      quién entró, qué puede ver y cómo viaja su token
│                    sesion.ts, sesion-plataforma.ts, guard-sesion.ts,
│                    guard-plataforma.ts, interceptor-token.ts, acceso.ts (+ .spec),
│                    refresco-sesion.ts, interceptor-refresco.ts (+ .spec)
├── disposicion/     los armazones, el menú lateral, la barra y la hoja inferior
│                    disposicion-empresa.ts, disposicion-plataforma.ts, menu-lateral.ts,
│                    menu-usuario.ts, opciones-menu.ts, barra.ts, hoja.ts (+ .spec)
└── paginas/         una carpeta por APLICACIÓN, y dentro una por pantalla
    ├── acceso/      lo COMPARTIDO por las pantallas sin sesión — no es una aplicación
    │                marco-acceso, campo-contrasena, selector-idioma, bandera
    ├── empresa/     lo que se ve en `<slug>.<dominio>`
    │   ├── iniciar-sesion/
    │   ├── inicio/
    │   ├── aceptar-invitacion/
    │   ├── solicitar-restablecimiento/
    │   └── restablecer-contrasena/
    ├── plataforma/  lo que se ve en `admin.<dominio>`
    │   ├── iniciar-sesion/
    │   ├── dashboard/   el resumen, y la pantalla de entrada del panel
    │   │                dashboard.{ts,html}, esqueleto.{ts,html}, resumen.ts (+ .spec)
    │   ├── planes/     el catalogo comercial: lista y creacion
    │   │                planes.{ts,html}, esqueleto.{ts,html}
    │   ├── empresas/   el alta en hoja inferior y la tabla de columna fija
    │   │                empresas.{ts,html}, esqueleto.{ts,html}
    │   └── salud-esquemas/  en qué versión de esquema va cada empresa
    │                     salud-esquemas.{ts,html}, esqueleto.{ts,html},
    │                     esquema.ts (+ .spec)
    └── portal/      lo que se ve en el dominio pelado y en `login.<dominio>`
        └── seleccionar-empresa/
```

**`paginas/` se agrupa por aplicación porque el subdominio decide qué árbol de rutas se
carga.** Cada subcarpeta corresponde a un archivo `rutas-*.ts`: `empresa/` a
`rutas-empresa.ts`, `plataforma/` a `rutas-plataforma.ts` y `portal/` a `rutas-portal.ts`.
Con las pantallas sueltas no se sabía a cuál de las tres aplicaciones pertenecía cada una.

**Cada pantalla se llama por lo que hace, no por su URL.** La ruta `/entrar` la sirve
`iniciar-sesion/`, y `/recuperar` la sirve `solicitar-restablecimiento/`: las URL son
visibles para quien usa el sistema y hay ligas ya emitidas que apuntan a ellas, así que
se quedan como están aunque el archivo se llame de otro modo.

**Cuando dos aplicaciones tienen la misma pantalla, la clase las distingue**: el acceso
de empresa es `IniciarSesion` y el de plataforma `IniciarSesionPlataforma`, aunque los
dos archivos se llamen `iniciar-sesion.ts`. Leer un import y no saber de qué aplicación
es, es justo lo que se evita.

**`nucleo/` va por subcarpetas y no plano.** Con quince archivos sueltos ya no se
encuentra nada, y van a ser muchos más: la regla es que si una carpeta pasa de unos ocho
archivos, se agrupa por responsabilidad.

Qué va en cada una:

| Carpeta | Qué contiene | Cómo saber si algo va aquí |
|---|---|---|
| `ambiente/` | `configuracion.ts`, `tenant.ts`, `sitio.ts`, `titulo-pagina.ts` | Responde «¿dónde estoy?»: la URL de la API, el dominio base, qué empresa dice el subdominio, cómo se llama el producto |
| `api/` | clientes HTTP, `contratos*.ts`, `mensaje-error.ts` | Habla con el backend o describe lo que este devuelve |
| `sesion/` | almacenes de sesión, guards, los dos interceptores, el refresco serializado, `acceso.ts` | Depende de quién entró |

**Los archivos de prueba viven junto a lo que prueban**, no en una carpeta aparte:
`tenant.spec.ts` al lado de `tenant.ts`.

**Nombres de archivo en kebab-case y sin sufijo de tipo**: `guard-sesion.ts`, no
`sesion.guard.ts`; `sesion-plataforma.ts`, no `platform-session.service.ts`.

### `paginas/acceso/`: lo compartido por las pantallas sin sesión

**Es la excepción a «una carpeta por aplicación»**: `acceso/` no es una aplicación, es la
carpeta de lo que las tres comparten cuando todavía no hay sesión. No tiene rutas ni un
`rutas-acceso.ts`, y ninguno de sus componentes es una pantalla: son piezas que las
pantallas de `empresa/`, `plataforma/` y `portal/` montan dentro de las suyas.

| Componente | Qué es |
|---|---|
| `marco-acceso` | El armazón de dos columnas. Cada pantalla proyecta su formulario con `<ng-content>`; el marco no sabe de campos, validaciones ni API |
| `campo-contrasena` | El campo con el botón de mostrar/ocultar, la etiqueta en `sr-only` y `aria-invalid` |
| `selector-idioma` | El desplegable de idioma de la barra superior |
| `bandera` | La banderita de un idioma, como `<img>` |

La razón de que existan es siempre la misma: **el detalle que se copia mal**. El
alternador de contraseña tiene más partes de las que parece —el `type="button"` del botón,
la etiqueta que describe la acción y no el estado, el `aria-pressed`, el `aria-controls`—
y repetirlo en las cuatro pantallas que piden contraseña garantiza que una copia se quede a
medias. Lo mismo el marco: las cinco pantallas sin sesión repiten estructura, proporciones
y la desaparición del panel por debajo de `lg`.

> `ilustracion-acceso` sigue en la carpeta pero **ya no lo importa nadie**: el panel de
> marca pasó a una fotografía de fondo.

### El `FormControl` se pasa como `input()`, no con `formControlName`

`campo-contrasena` recibe el control:

```html
<app-campo-contrasena [control]="formulario.controls.contrasena" />
```

```ts
readonly control = input.required<FormControl<string>>();
```

Y **no** `formControlName="contrasena"` dentro del componente. Tres razones:

1. **No depende de estar dentro de un `formGroup` concreto.** Un componente con
   `formControlName` solo funciona si su anfitrión resulta ser el contenedor correcto, y
   eso es una dependencia invisible que rompe al mover el componente de sitio.
2. **No hay que reexponer el contenedor con `viewProviders`.** Es el truco habitual para
   que `formControlName` funcione dentro de un hijo, y es exactamente el tipo de acople
   que conviene no adquirir.
3. **El tipo del control se comprueba en la plantilla que lo usa.** Con `formControlName`
   el vínculo es una cadena y nadie verifica que exista ni de qué tipo es; con `input()`
   lo comprueba `strictTemplates`.

El mismo criterio aplica a los `input()` que acompañan al control (`campoId`,
`autocompletado`, `descritoPor`, `invalido`): `invalido` existe porque al mover los campos
crudos al componente el `aria-invalid` se perdía, y con él la única señal que tiene un
lector de pantalla de que **ese** campo es el del problema — el `role="alert"` anuncia el
mensaje, pero no dice a qué campo se refiere.

## Nomenclatura

Dominio en español, igual que el backend: `Equipo`, `Renta`, `Cotizacion`, `Horometro`.

## Formato

- `.editorconfig`: UTF-8, 2 espacios, salto de línea final, sin espacios al final.
- `.prettierrc`: `printWidth` 100, comillas simples, parser `angular` para HTML.

Prettier está instalado pero **sin script**: no hay `format` ni `format:check`, así que hoy nada verifica el formato.

## Zoneless

La app no usa zone.js. No hay dependencia, `angular.json` no declara entrada `polyfills`, y `app.config.ts` no necesita provider explícito: en Angular 21 es el comportamiento por omisión.

**No agregar `zone.js` ni `provideZoneChangeDetection()`.**

## Tailwind v4 sin archivo de configuración

Todo el enganche son dos piezas:

```json
// .postcssrc.json
{ "plugins": { "@tailwindcss/postcss": {} } }
```

```css
/* src/styles.css */
@import 'tailwindcss';
```

La personalización de tema en v4 se hace con `@theme` en CSS, no con un `tailwind.config.js`.

## Herramientas del editor

- `.vscode/mcp.json` registra el **servidor MCP del Angular CLI** (`npx -y @angular/cli mcp`), útil para que asistentes de código consulten la API real de la versión instalada en lugar de adivinar.
- `.vscode/extensions.json` recomienda `angular.ng-template` (Angular Language Service).
