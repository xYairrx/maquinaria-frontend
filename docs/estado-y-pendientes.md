# Estado y pendientes

Última verificación: 2026-08-25.

## Estado actual

El repo ya **no** es scaffolding. Son **tres aplicaciones separadas por subdominio**, con
su árbol de rutas, su armazón y su menú, sobre 19 commits (`HEAD` en `69890c4`) más el
trabajo del 2026-08-25, que todavía está en el árbol de trabajo sin commitear.

Verificado en disco hoy:

| Medida                        | Valor                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Pruebas                       | **116 en 9 archivos**, todas pasan (`npx ng test --watch=false`)               |
| Componentes                   | **26**, todos con `OnPush`, y **26** `.html` hermanos                          |
| Plantillas dentro de un `.ts` | **cero** (`grep -rn "template:" src/` no devuelve nada)                        |
| Build de producción           | **373.59 kB** crudos / **103.85 kB** transferidos, más **22** chunks diferidos |
| Salida                        | `dist/maquinaria-frontend/browser`                                             |

Las cifras del documento anterior —39 pruebas en 2 archivos, 17 componentes, 290.25 kB—
eran de tres tandas de trabajo atrás y hoy son falsas en los tres casos. El reparto por
archivo de prueba, que es lo que dice de verdad dónde hay red y dónde no:

| Archivo                                             | Pruebas                   |
| --------------------------------------------------- | ------------------------- |
| `nucleo/ambiente/tenant.spec.ts`                    | 31 (casi todas `it.each`) |
| `paginas/plataforma/dashboard/resumen.spec.ts`      | 21                        |
| `nucleo/i18n/i18n.spec.ts`                          | 11                        |
| `nucleo/sesion/interceptor-refresco.spec.ts`        | 11                        |
| `nucleo/api/api-plataforma.spec.ts`                 | 10                        |
| `nucleo/api/api.spec.ts`                            | 9                         |
| `paginas/plataforma/salud-esquemas/esquema.spec.ts` | 9                         |
| `nucleo/sesion/acceso.spec.ts`                      | 8                         |
| `disposicion/hoja.spec.ts`                          | 6                         |

Los chunks diferidos que importan por tamaño son los de las pantallas del panel:
`dashboard` 20.01 / 5.37 kB, `planes` 15.61 / 4.31 kB, `empresas` 13.23 / 3.65 kB y
`salud-esquemas` 12.65 / 3.19 kB (crudo / transferido).

La plantilla de bienvenida de Angular ya no existe: `src/app/app.html` es
`<router-outlet />` y `app.css` se borró.

### Las tres aplicaciones

`src/app/app.routes.ts` no registra rutas: exporta `rutasDelAnfitrion()`, que **elige**
un árbol según el anfitrión. No hay un guard tapando rutas ajenas — esas rutas
sencillamente no se registran, igual que el backend aísla por base de datos.

| Anfitrión                      | Aplicación          | Árbol                 |
| ------------------------------ | ------------------- | --------------------- |
| `admin.<dominio>`              | Superadministración | `rutas-plataforma.ts` |
| `<slug>.<dominio>`             | La empresa `<slug>` | `rutas-empresa.ts`    |
| `<dominio>`, `login.<dominio>` | Portal de entrada   | `rutas-portal.ts`     |

Se resuelve una vez al arrancar: el anfitrión no cambia sin recargar, y cambiar de
empresa es cambiar de origen.

### Cómo está organizado `src/app/`

| Carpeta               | Qué hay                                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nucleo/ambiente/`    | `configuracion.ts`, `tenant.ts` (+ `tenant.spec.ts`), `sitio.ts`, `titulo-pagina.ts`                                                                                                                                        |
| `nucleo/api/`         | `api.ts` (+ `api.spec.ts`), `api-plataforma.ts` (+ `api-plataforma.spec.ts`), `contratos.ts`, `contratos-plataforma.ts`, `mensaje-error.ts`                                                                                 |
| `nucleo/i18n/`        | `i18n.ts` (+ `i18n.spec.ts`) y `textos.ts` con los dos idiomas                                                                                                                                                              |
| `nucleo/sesion/`      | `sesion.ts`, `sesion-plataforma.ts`, `acceso.ts` (+ `acceso.spec.ts`), `guard-sesion.ts`, `guard-plataforma.ts`, `interceptor-token.ts`, `refresco-sesion.ts`, `interceptor-refresco.ts` (+ `interceptor-refresco.spec.ts`) |
| `disposicion/`        | `disposicion-empresa`, `disposicion-plataforma`, `menu-lateral`, `menu-usuario`, `opciones-menu.ts`, `barra.ts`, `hoja` (+ `hoja.spec.ts`)                                                                                  |
| `paginas/acceso/`     | Piezas compartidas del acceso: `marco-acceso`, `campo-contrasena`, `selector-idioma`, `bandera`                                                                                                                             |
| `paginas/empresa/`    | `iniciar-sesion`, `aceptar-invitacion`, `solicitar-restablecimiento`, `restablecer-contrasena`, `inicio` (con `esqueleto`)                                                                                                  |
| `paginas/plataforma/` | `iniciar-sesion`, `dashboard` (+ `resumen.ts`, `esqueleto`), `empresas` (+ `esqueleto`), `planes` (+ `esqueleto`), `salud-esquemas` (+ `esquema.ts`, `esqueleto`)                                                           |
| `paginas/portal/`     | `seleccionar-empresa`                                                                                                                                                                                                       |

Cada pantalla se renombró por **lo que se hace en ella**. **Las URL no cambiaron**:
`/entrar`, `/invitacion`, `/recuperar`, `/restablecer`, `/inicio`, `/empresas`. Las que
se agregaron después llevan el mismo criterio: `/dashboard`, `/planes`, `/esquemas`.

No existen `src/app/core/`, `features/`, `shared/` ni `src/environments/`: la
configuración de ambiente es un solo archivo, `nucleo/ambiente/configuracion.ts`.

### Regla de código que rige desde ahora

**Ningún componente lleva HTML dentro del `.ts`.** Ni una plantilla en línea, ni un
`template:` de una sola línea: todo el marcado va en un `.html` hermano referenciado con
`templateUrl`. Está escrita en [`AGENTS.md`](../AGENTS.md) (idéntico a
`.claude/CLAUDE.md`) y desarrollada en [convenciones](convenciones.md). Hoy se cumple en
los 26 componentes.

### Qué funciona de punta a punta

- **Acceso de empresa sin tercer campo.** La empresa sale del subdominio
  (`tenantActual()`), no del formulario: son **dos campos**, correo y contraseña.
- **Restablecimiento de contraseña completo**, en dos pantallas (`/recuperar` y
  `/restablecer`), contra los endpoints nuevos de la API.
- **Refresco de token de empresa, y con él la Fase 0 del frontend cerrada.** Un 401 de la
  API de empresa canjea el token de refresco y **reintenta la petición**, así que el token
  de acceso de 15 minutos ya no obliga a volver a entrar. Son
  `nucleo/sesion/refresco-sesion.ts` —el canje, serializado— y `interceptor-refresco.ts`
  —el 401 y el reintento—, registrado ANTES del interceptor de token en `app.config.ts`
  para que el reintento salga con el `Bearer` nuevo sin tocar ninguna cabecera.

  Lo que gobierna esta pieza es que **la rotación no tiene ventana de gracia**: dos
  refrescos concurrentes canjean el mismo token, el servidor lee el segundo como robo y
  revoca toda la cadena de sesiones del usuario. De ahí el single-flight; el razonamiento
  del `shareReplay` y del `refCount: false` está en
  [convenciones](convenciones.md#sesión-el-refresco-del-token-va-serializado), y el
  contrato del endpoint —401 único, 429, obligación de serializar— en
  [integración con el backend](integracion-backend.md#refresco-de-la-sesión-de-empresa).

  **El refresco de plataforma no existe**, y no por olvido: el backend no tiene
  `sesion_refresh` para plataforma. `interceptor-refresco` descarta `/api/plataforma/**`
  en su primera línea y hay prueba de que un 401 de ese ámbito se propaga tal cual.

  Cuando el canje falla no hay reintento posible: se limpia la sesión y se navega a
  `/entrar?expirada=1`, con `entrarEmpresa.expirada` en los dos idiomas y su bloque ya
  pintado en la pantalla de acceso — el mismo patrón de `?activada=1` y `?restablecida=1`.

- **Armazones con menú lateral**, uno por aplicación. El menú es **datos**
  (`opciones-menu.ts`) y se filtra por la intersección **permisos del rol ∩ módulos del
  plan**; los grupos que quedan vacíos desaparecen. La superadministración no filtra por
  módulos: el superadministrador no contrata plan.
- **Marco de acceso a dos columnas** compartido por las pantallas sin sesión, campo de
  contraseña con botón de mostrar y selector de idioma.
- **Sistema de color y tipografía** en `src/styles.css` con `@theme` de Tailwind v4:
  tokens nombrados por papel, Lato y Merriweather, y el contraste WCAG anotado al lado
  de cada token.
- **`sitio.ts`** centraliza el nombre del producto, el corte de la marca en dos colores,
  la descripción y el idioma.
- **`TituloPagina`** compone el título de la pestaña como «pantalla · producto», y lo
  recompone al cambiar de idioma sin esperar a la siguiente navegación.
- **Resumen de la superadministración** (`/dashboard`), la pantalla de entrada del panel.
  Cuatro indicadores, una lista de avisos y las últimas altas, derivado de `GET /empresas`
  —sin endpoint de estadísticas y sin una sola cifra estimada, que es lo que prohíbe el
  sistema de diseño— más el reporte de esquemas para el aviso de desfase. La lógica de
  agregación vive aparte en `resumen.ts`, como función pura, con 21 casos de prueba.

  Los cuatro motivos de atención que sabe detectar son un alta **fallida**, una empresa
  **lista sin plan** —su base existe y su gente no ve ningún módulo—, una base con el
  **esquema desfasado** y una base **sin comparar**. Ese último es más grave que el
  desfase: desfasada se arregla migrando, sin comparar puede pedir desplegar.

  El diseño sigue el boceto de referencia —barra de la pantalla con búsqueda y acción
  principal, cuatro indicadores con el último destacado en negro y amarillo, banda de
  gráfica y avisos, tabla con chips de filtro— pero **cada hueco se llenó con el dato real
  que le corresponde**, no con el del boceto: donde el boceto pedía «utilización semanal»
  van **altas por mes**, que es la única serie temporal que la lista de empresas permite
  calcular.

  **El aviso de esquema desfasado MENTÍA hasta hoy, y así se arregló.** `resumen.ts`
  deducía el desfase comparando el `versionEsquema` de cada empresa contra **la más
  avanzada de la lista**, y esa referencia es circular: si TODAS las empresas están una
  migración atrás, la más avanzada es una de ellas y el dashboard reportaba **cero
  desfase** — que es exactamente el estado en el que estaba el sistema. Ahora `resumir()`
  recibe un tercer parámetro `salud: SaludEsquemas | null = null` y decide con
  `estadoDeEsquema()`, la misma función pura que usa la pantalla de esquemas.
  `esquemaReferencia()` se borró y el campo pasó a `versionDisponible`, que es la
  migración más avanzada **del binario que respondió**. El parámetro es opcional a
  propósito: **sin reporte no se afirma nada del esquema de nadie.** `resumen.spec.ts`
  pasó de 19 a 21 `it`, y en el camino se borraron los tres de `describe('esquemaReferencia')`:
  describían el comportamiento roto y por eso no podían verlo.

- **Salud de esquemas** (`/esquemas`), contra `GET /api/plataforma/salud/esquemas`. Una
  tabla por empresa con la versión aplicada, las migraciones pendientes y su estado, más
  la leyenda de los tres estados debajo. Las dos funciones puras que la sostienen viven en
  `salud-esquemas/esquema.ts` con 9 pruebas: `estadoDeEsquema()` y `migracionLegible()`,
  que parte `20260824232637_EmpresaCatalogosOrganizacion` en fecha y nombre **sin perder un
  carácter** y sin pasar por `DatePipe` —esas cifras no son un instante en una zona
  horaria, son parte de un identificador, y el locale las movería de día en México—.

  **Tres estados y no dos**: al día, desfasada y **sin comparar**. `versionReconocida: false`
  gana sobre todo lo demás, y en ese caso `desfasada` y `migracionesPendientes` no se leen:
  colapsarlo a dos estados esconde el caso peligroso, una base POR DELANTE del código
  desplegado, pintándola igual que una al día.

  El endpoint lee la `version_esquema` que la base central tiene registrada y **no se
  conecta a las bases de las empresas**, así que una migración aplicada a mano no se ve
  hasta la siguiente corrida de `migrar-empresas`. La pantalla lo dice en su nota de
  limitación en lugar de dejar que se lea como un reporte infalible.

- **Tarjetas de indicador, listas de aviso, chips de filtro y campos de formulario** como
  `@utility` en `src/styles.css`, siguiendo la especificación del sistema de diseño. De los
  cinco componentes que ese documento describía sin que existieran, el único que sigue sin
  `@utility` es la **tabla**: hoy son cuatro tablas (empresas, planes, salud de esquemas y
  las últimas altas del dashboard) con las clases escritas en cada `.html`.
- **La lista de empresas, el catálogo de planes y el reporte de esquemas son recursos
  COMPARTIDOS** (`ApiPlataforma`, con `httpResource`): dos pantallas que los lean hacen
  **una** petición entre las dos, en lugar de una cada una en cada navegación. Las
  mutaciones recargan su propia lista dentro del servicio. Las reglas —y las tres trampas
  de `httpResource`, incluida la de que `value()` lanza en estado de error— están en
  [convenciones](convenciones.md#datos-httpresource-y-el-recurso-compartido).

  El reporte de esquemas se expone **sin `defaultValue`**, al contrario que las listas:
  aquí el vacío no es `[]` sino «todavía no hay reporte», y un reporte de relleno con cero
  desfasadas se pintaría como un reporte de verdad que dice que no hay nada que atender.
  Que se pide una sola vez para las dos pantallas está fijado con `http.verify()` en
  `api-plataforma.spec.ts`.

  **Las dos consultas de liga también son recursos** (`Api.consultaDeInvitacion` y
  `Api.consultaDeRestablecimiento`), por fábrica en vez de campo del servicio: llevan
  parámetros de la pantalla y no las comparte nadie. Las pantallas de invitación y de
  restablecimiento perdieron su `effect` con `subscribe` dentro, y la consulta se rehace sola
  si cambia el token. El resto de `api.ts` son mutaciones y se quedan con `subscribe`, que es
  lo correcto.

  De paso salió un fallo ANTERIOR a los recursos: `withComponentInputBinding` pone
  `undefined` en un `input()` cuando el parámetro no está en la URL, pisando su valor por
  defecto, así que `token() === ''` era falso, se pedía la liga `undefined` y el 404 hacía
  que **una liga que faltaba se viera como una liga caducada**. Arreglado con
  comprobaciones falsy y fijado con pruebas.

- **Una sola barra superior por pantalla**, dibujada por el armazón y alimentada por la
  pantalla como DATOS a través de `disposicion/barra.ts` — título, contexto, búsqueda y
  acción principal—, junto al botón del menú, Salir y el avatar de iniciales, que son del
  armazón. El porqué de que sea un servicio y no proyección de contenido está en
  [convenciones](convenciones.md#la-barra-superior).
- **Catálogo comercial** (`/planes`): la lista de planes con sus módulos y el formulario
  para crear uno, más retirar y reactivar. Contra los cuatro endpoints reales del backend.

  **La regla que gobierna la pantalla**: un plan ES su conjunto de módulos, así que **no hay
  ni un campo de cupos** —los cupos cuelgan de la empresa, en `tenant_limite`—. Meterlos ahí
  contradiría el modelo, que dice literalmente «LOS MODULOS SON LA DEFINICION DEL PLAN».

  **No hay editar, y la pantalla lo explica en voz alta** en lugar de dejar a quien llega
  buscando el botón: la suscripción no guarda importe —solo apunta al plan— así que cambiar
  el precio reescribiría lo que pagaron los suscriptores anteriores, y quitar un módulo se lo
  quita a todos retroactivamente. Se retira el plan y se crea su sucesor.

- **El alta de empresa vive en la hoja inferior**, con la misma fórmula que planes. La barra
  de `/empresas` por fin tiene acción principal —«Nueva empresa», con `alPulsar` y no `ruta`,
  así que el armazón pinta un `<button>`— y el formulario de siete campos está en
  `<app-hoja [anclajes]="[50, 70, 95]">`. Antes no había acción porque un botón amarillo que
  apuntara al formulario de más abajo no llevaba a ninguna parte.

  **La confirmación del alta se queda en la PANTALLA, no en la hoja**, y es deliberado:
  lleva la liga de invitación, que es justo lo que hay que poder leer con calma y copiar;
  dentro de una hoja que se descarta con un gesto desaparecería con el mismo movimiento que
  la abrió. Y `puedeEnviar()` exige que haya al menos un plan activo, porque
  `AprovisionarEmpresa` lo rechaza en el servidor.

- **Hoja inferior arrastrable reutilizable** (`disposicion/hoja.ts`), sobre un `<dialog>`
  nativo con `showModal()`: se agarra del asa, tiene anclajes configurables y se cierra
  tirándola hacia abajo o con un gesto rápido. La usan el alta de plan y el alta de empresa.
  Las dos capas —la hoja y el globo de ayuda `popover`— y sus trampas están en
  [convenciones](convenciones.md#capas-hoja-inferior-y-globo-de-ayuda).

  **Tenía un fallo visible y se arregló el 2026-08-25.** El `<dialog>` está clavado al fondo
  con `inset: auto 0 0` y el arrastre se aplicaba entero como `translate`; hacia arriba eso
  es NEGATIVO, así que la hoja **se despegaba del borde inferior** y dejaba ver el velo
  debajo, con el pie y su acción principal subiendo con ella, para volver de golpe al soltar.
  Medido en navegador real a 720 px de alto: 200 px de arrastre daban **200 px de hueco**.

  El gesto ahora es **asimétrico**: **subir es CRECER** —`min(98dvh, calc(<anclaje>dvh +
<subida>px))`— y **bajar es DESPLAZARSE**, que sigue en el `translate` porque al descartarla
  la hoja sí tiene que irse por debajo del borde. Medido después: 360 px en reposo, **560 px
  con 200 de arrastre y 0 de hueco**, y 706 px con un arrastre enorme, que es el freno de
  98dvh sobre 720. El `min()` va en CSS y no en JS porque mezcla `dvh` con `px`. Se quitó la
  goma elástica del anclaje más alto: amortiguaba a un cuarto, pero lo conseguía levantando
  la hoja del fondo — el mismo fallo en pequeño. `hoja.spec.ts` fija la regla con 6 pruebas:
  **el `translate` nunca es negativo.**

- **Tablas con la primera columna fija.** `planes` pasó de **seis columnas a cinco**: la
  píldora de estado se mudó DENTRO de la celda del plan, pegada al nombre, donde se lee
  mejor, en vez de ocupar columna propia (`planes.colEstado` quedó sin uso y se retiró de los
  dos idiomas). La columna del plan se **fija a la izquierda** con `sticky left-0`, fondo
  opaco y filete a la derecha, y `min-w-180` bajó a `min-w-160`. `empresas` recibió el mismo
  tratamiento.

  **Verificado en navegador real a 375 px**: contenido de 640 px en una caja de 375, que se
  desplaza dentro de su caja, `position: sticky` calculado, fondo opaco, y tras desplazar
  265 px la primera columna seguía en `left: 0`. El documento **no** se desplaza en
  horizontal, que es la regla dura de la convención.

- **Esqueletos de carga en todas las pantallas con datos en vuelo**: `dashboard`, `empresas`,
  `planes`, `salud-esquemas` y `empresa/inicio`, cada uno en un componente hermano. El texto
  de «Cargando…» no se perdió, se movió: `comun.cargando` ya solo aparece como el
  `role="status"` `sr-only` de esos esqueletos.
- **Todo responsivo**, comprobado en 375, 768 y 1280. El menú lateral es un **cajón** por
  debajo de `lg` —con hamburguesa, velo y cierre con Escape— y una columna fija desde ahí;
  antes ocupaba 264 px fijos a cualquier ancho, lo que dejaba un teléfono con 111 px de
  contenido. La regla, los cortes y las trampas están en
  [convenciones](convenciones.md#responsivo) y en [`AGENTS.md`](../AGENTS.md).

---

## Pendientes

Ordenados de "rompe algo" a "hay que decidirlo". **Los números no se reciclan**: un
pendiente cerrado deja su hueco, porque los commits y los otros documentos lo citan por
número.

### Internacionalización y metadatos

5. ~~El selector de idioma no traduce nada.~~ **HECHO (2026-08-25).** Español y
   México-inglés completos, cambio en vivo y preferencia recordada en
   `maquinaria.idioma`. Ver [internacionalización](convenciones.md#internacionalización)
   en las convenciones.
6. ~~No hay locale de Angular configurado.~~ **HECHO (2026-08-25).** `LOCALE_ID` sale del
   idioma guardado y se registran los datos de `es-MX` y `en` en `app.config.ts`.

   **Lo que queda de esta parte**, y no es poco:

   - **`LOCALE_ID` se fija al arrancar**, así que cambiar de idioma en vivo NO mueve
     fechas, números ni moneda. Hoy no se nota porque no hay un solo `| date` ni
     `| number` en la aplicación; el primero que se escriba tiene que decidir entre
     pasarle el locale al pipe o recargar al cambiar de idioma. Anotado con un comentario
     `ponytail:` en `nucleo/i18n/i18n.ts`.
   - **La zona horaria por tenant sigue sin resolverse.** El backend guarda en UTC con
     zona de presentación **por empresa**, y el locale no la lleva: `es-MX` no dice
     si la empresa opera en Tijuana o en Cancún. Eso es un dato de `IdentidadEmpresa`
     que la API todavía no manda.
   - **Los textos que vienen de la API siguen en español**, siempre. `mensaje-error.ts`
     traduce lo que genera el front, pero el `detail` del `ProblemDetails` se muestra
     tal cual y la API no lee `Accept-Language`. Es la costura visible del inglés y se
     arregla en el backend, no aquí.

### Falta de tooling

7. **Sin linter.** No hay ESLint ni `angular-eslint` instalados, ni script `lint`.
8. **Prettier instalado pero sin script.** Hay `.prettierrc` y el binario en
   `node_modules` (3.9.6), pero ni `format` ni `format:check`, así que el formato no se
   verifica en ningún punto.
9. **Sin CI.** No hay workflows de GitHub Actions ni gate de build/test en los PR. Con 116
   pruebas en verde, es justo lo que falta para que sirvan de red: hoy nadie las corre si
   quien escribe el commit no se acuerda.
10. **Sin pruebas end-to-end.** Angular CLI no trae framework de e2e; la elección sigue
    siendo una decisión abierta.
11. **Cobertura desigual — mejoró mucho, y sigue desigual.** De 39 pruebas en 2 archivos a
    **179 en 15**. Lo que ya tiene red: las dos funciones puras del arranque (`tenant`,
    `acceso`), el diccionario y el cambio de idioma (`i18n`), los tres servicios de API con
    `HttpTestingController` —incluida la regresión de que `value()` no debe lanzar en error y
    las cuatro de que el listado de catálogos reacciona al filtro—, la agregación del
    dashboard (`resumen`), la lectura del esquema (`esquema`), el interceptor de refresco
    (11 casos, con el single-flight y el 401 de plataforma que se propaga), la hoja inferior
    (6 casos de gesto sobre el `<dialog>` real), el diálogo de confirmación, `mensaje-error`
    (8 casos, nacidos del 400 que no decía nada), el `NumberValueAccessor` (5 casos) y la
    guarda de coordenadas de Ubicaciones (6). Las tres últimas, abajo.

    Lo que **sigue sin una sola prueba**: los dos guards (`guard-sesion`, `guard-plataforma`),
    `interceptor-token`, los dos almacenes de sesión, `titulo-pagina` y `opciones-menu`.

    De las pantallas hay **cuatro** con archivo de prueba —Modelos, Ubicaciones, Trabajadores
    y el detalle de Cotización—, y ninguna de ellas prueba la pantalla: cada una fija **una
    regla que el compilador no ve** y que ya costó una depuración. Están listadas abajo.

    Las pruebas nuevas de esta tanda no son de pantalla sino **de lo que Angular hace por
    debajo**, que es donde el compilador no ayuda:

    - `nucleo/api/mensaje-error.spec.ts`: los `errors` por campo ganan al `title` genérico.
    - `paginas/empresa/modelos/modelos.spec.ts`: un `<input type="number">` mete un number en
      el control —y `null` al vaciarse, nunca cadena vacía—.
    - `paginas/empresa/cotizacion/cotizacion.spec.ts` (7 casos): la forma de la tabla de
      transiciones copiada del servidor. Lo que fija no es que la copia esté al día —eso no
      se puede comprobar desde aquí— sino que un estado TERMINAL esté ausente y no con lista
      vacía: con `[]` el botón de cambiar estado se seguiría dibujando y abriría un
      desplegable sin opciones.
    - `paginas/empresa/ubicaciones/ubicaciones.spec.ts`: un `computed` que lee
      `getRawValue()` **no reacciona**. Guarda la versión rota junto a la buena para que la
      diferencia se vea.

12. ~~Falta el interceptor de refresco de token.~~ **HECHO (2026-08-25), y con él se cierra
    la Fase 0 del frontend.** `refresco-sesion.ts` + `interceptor-refresco.ts`, con
    single-flight obligatorio porque la rotación no tiene ventana de gracia. **Solo para la
    sesión de empresa**: el backend no tiene `sesion_refresh` para plataforma, así que un
    401 de `/api/plataforma/**` se propaga tal cual y eso sigue siendo una decisión de
    esquema abierta del backend, no un pendiente de este repo. Contrato en
    [integración con el backend](integracion-backend.md#refresco-de-la-sesión-de-empresa).
13. ~~Falta `api:sync`.~~ **HECHO (2026-08-27).** `npm run api:sync` genera
    `nucleo/api/generado.ts` desde `/openapi/v1.json`, y `npm run api:check` verifica que
    esté al día sin escribir —es lo que le falta al gate de CI del pendiente 9—. El archivo
    generado **no se edita**: el nombre es la advertencia. `contratos.ts` se queda a mano
    como superficie curada y re-exporta con nombres del dominio.
14. ~~La herramienta generadora no está elegida.~~ **HECHO (2026-08-27):
    `openapi-typescript` 7.13.0**, con `--immutable` y `--alphabetize`. Se descartaron
    `orval`, `openapi-generator-cli` y `ng-openapi-gen` porque las tres generan **servicios
    con `HttpClient` y Observables**, que pelean con `httpResource` + señales, los recursos
    compartidos y el refresco serializado. Lo que hacía falta no era un cliente generado
    sino que los contratos de datos dejaran de escribirse a mano. El razonamiento completo
    está en [plan de la Fase 1](plan-fase1-front.md#6-apisync--hecho-el-2026-08-27).

    **Al generar por primera vez salieron tipos débiles, y se arregló en el backend.**
    `AddOpenApi()` se llamaba pelado: 279 campos salían como `number | string` y 15 enums
    como `number` sin sus valores. Con el transformador `Arranque/EsquemaOpenApi.cs` quedan
    en **0** y `EstadoRenta` pasó de `number` a `1 | 2 | … | 10`.

15. **El token de refresco vive en `localStorage`**, no en cookie `HttpOnly`. Es una
    divergencia consciente con el diseño y hay que resolverla antes de producción; está
    explicada en
    [integración con el backend](integracion-backend.md#dominios-en-producción-y-la-cookie-del-refresh-token)
    y no se repite aquí. **El cambio es de los dos lados a la vez**: el backend tampoco
    manda hoy el token de refresco por cookie, lo devuelve en el cuerpo de la respuesta de
    login y de refresco.
16. **`SaludEsquemas.versionDisponible` está tipado como `string` y el servidor puede
    mandar `null`.** El backend lo calcula como `disponibles.Count > 0 ? disponibles[^1] :
null` (`SaludEsquemas.cs`), o sea nulo si el ensamblado no trajera ninguna migración —no
    puede pasar en producción, pero el contrato lo permite—. `resumen.ts` ya lo trata como
    `string | null`; el tipo de `contratos-plataforma.ts` es más optimista que la API.

    **La herramienta que lo habría cazado ya existe** (pendiente 13), pero el desajuste
    sigue en pie: `contratos-plataforma.ts` no se ha reescrito contra `generado.ts`. Se
    cierra cuando esos tipos pasen a re-exportar del generado en lugar de declararse a mano.

### Producto

16. **Las pantallas de los módulos son la Fase 1 en adelante**, y el menú de empresa hoy
    solo tiene el inicio. El pendiente estaba mal escrito en tres cosas y así queda
    corregido:

    - **No existe ninguna `MENU_EMPRESA`.** Es la **función** `menuEmpresa()` de
      `disposicion/opciones-menu.ts`, y es función a propósito: una constante de módulo se
      evalúa al cargar y se queda congelada en el idioma de ese momento.
    - **El andamiaje es un paso más largo de lo que decía.** Una pantalla nueva necesita su
      entrada en `rutas-empresa.ts`, su línea en `menuEmpresa()` con la clave de módulo,
      **y** sus textos: `titulos.<clave>` y `menu.<clave>` en los DOS bloques de idioma de
      `textos.ts`. Sin eso no compila — que es justo la gracia del diccionario tipado. Los
      cuatro pasos están escritos en
      [convenciones](convenciones.md#el-andamiaje-de-una-pantalla-nueva).
    - **La entrada de menú y su ruta se agregan JUNTAS.** El 2026-08-25 se retiró de
      `menuEmpresa()` un grupo `Operación` con `/equipos`, `/clientes` y `/rentas`:
      `rutas-empresa.ts` no registra ninguna de las tres, así que para un plan que las
      contratara la opción se dibujaba, y al pulsarla caía en el `path: '**'` y volvía a
      `/inicio`. Un menú que no lleva a ningún lado es peor que un menú corto. Los textos
      `menu.operacion`, `menu.equipos`, `menu.clientes` y `menu.rentas` **se quedaron en
      `textos.ts` a propósito**, para que vuelvan con su pantalla; hoy están sin uso y eso
      es intencional, no basura por limpiar.

17. **El dominio de producción no está registrado**, así que la configuración de
    Cloudflare Pages sigue pendiente. La ruta de salida que hay que darle es
    `dist/maquinaria-frontend/browser`.

### Cerrados desde la revisión anterior

Se listan para que nadie los reabra, con su número retirado:

- **1. El `<title>` de `index.html` desincronizado de `sitio.nombre`.** Ya dice
  `RETROMAQ`, y `<html lang="es-MX">`. Sigue siendo sincronización manual: `index.html` es
  HTML estático y no puede leer `sitio.ts`, y el propio archivo lo advierte en un comentario.
- **2. El target de `ng test` obsoleto en `.vscode/launch.json`.** Se quitó: apuntaba a
  `http://localhost:9876/debug.html`, que es de **Karma**, y este proyecto corre con Vitest
  sobre jsdom. **No hay configuración que lo reemplace, y no es un olvido**:
  `@angular/build:unit-test` no levanta ningún servidor ni sirve ninguna URL que un Chrome
  pueda abrir. El archivo lo deja escrito para que nadie la «arregle» reintroduciéndola.
- **3. Los dos `.svg.original` sin commitear en `public/`.** No existen: `public/` tiene
  hoy `excavadora.webp`, `favicon.ico` y las dos banderas ya limpias.
- **4. Los dos SVG de excavadora sin usar.** Borrados (`excavator-svgrepo-com.svg` y
  `excavator-bulldozer-svgrepo-com.svg`), que se copiaban al build sin que nadie los
  referenciara.
- **El «0» de accesibilidad: `selector-idioma` con `role="listbox"` sin flechas.** Bajado a
  ARIA de divulgación, igual que `menu-usuario`: `aria-haspopup="true"` +
  `aria-expanded`, botones normales y `aria-current` en lugar del `aria-selected` que pedía
  el `role="option"`. **Estaba peor de lo que decía el documento**: no solo mentían los
  roles, **faltaba toda la conducta** —sin Escape, sin cierre al clicar fuera— y al elegir
  idioma el foco caía a `<body>` (WCAG 2.4.3). Ahora Escape cierra y devuelve el foco al
  disparador, y el clic fuera cierra sin moverlo.
- **El «0» de esqueletos: `plataforma/empresas` y `empresa/inicio` con «Cargando…» en
  texto.** Los dos tienen su `esqueleto.ts` hermano.
- **12. El interceptor de refresco**, arriba, con el detalle de qué quedó fuera.

Y de revisiones anteriores: `lang="es-MX"` en `index.html`, la prueba `app.spec.ts` que se
rompía al quitar la plantilla de bienvenida — desapareció con ella —, el componente `App`
sin `OnPush`, la integración HTTP, la **decisión de CORS** (CORS explícito en la API, no
proxy en el dev server), el **shell completo de la Fase 0** y el **sistema de diseño sobre
Tailwind v4**.

---

## Plan de desarrollo

Se trabaja en **rebanadas verticales**: cada módulo se termina de punta a punta antes de
pasar al siguiente (`03-plan-desarrollo.md` §1).

```
Entidad → Migración → Caso de uso → Endpoint → Pruebas → Pantalla Angular → Funciona
```

No "todo el backend y luego todo el frontend": con 26 módulos, esa separación son seis
meses sin nada demostrable.

| Fase                 | Alcance                                                                 | Lo que aporta el front                                  |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| **0 — Fundación**    | Multi-tenancy, aprovisionamiento, auth                                  | Shell: layout, login, guards, interceptores, navegación |
| **1 — Núcleo**       | Equipos, clientes, obras, tarifas, disponibilidad, cotizaciones, rentas | Pantallas del ciclo cotizar → aprobar → rentar → cerrar |
| **2 — Operación**    | Contratos, logística, inspecciones, evidencias, horómetros, daños       | Captura con fotografías                                 |
| **3 — Taller**       | Mantenimiento, órdenes de trabajo, refacciones, compras                 |                                                         |
| **4 — Finanzas**     | Pagos, cobranza, CFDI, rentabilidad                                     | Reportes                                                |
| **5 — Campo**        | PWA con offline, sincronización, GPS, firmas, QR                        | La fase más difícil del front                           |
| **6 — Inteligencia** | Predicción, pricing dinámico, analítica                                 | Requiere histórico real                                 |

**La Fase 0 del front está CERRADA (2026-08-25)**: armazones, accesos, guards, interceptor
de token, interceptor de refresco y navegación. Lo que queda pegado a la Fase 0 no es
shell: es tooling (7 a 11) y decisiones de despliegue (15, 17). El panel de
superadministración —empresas, planes, resumen, salud de esquemas— también está en pie, y
eso ya es más que la fundación.

Al cerrar la Fase 1 el sistema **ya es vendible**. Dashboard, notificaciones y reportes
no son fases: cada fase agrega los suyos al cerrar.

La PWA offline de la Fase 5 se diseña desde ahora: los IDs se generan en el cliente (de
ahí uuid v7) y hay resolución de conflictos.

---

## Divergencias con los documentos de diseño

Los documentos de `maquinaria-backend/docs/` son especificación, no inventario.
Diferencias detectadas al 2026-08-25:

| Documento dice                                                    | Realidad en disco                                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular 22 / Angular CLI 22.1.4                                   | **Angular 21.2.21** (`@angular/core`, CLI y `@angular/build`, los tres 21.2.21)                                                                                                                                         |
| Node v24.19.0, npm 11.17.0                                        | **Node v22.14.0, npm 10.9.2**, medido hoy en esta máquina — y `package.json` declara `packageManager: npm@11.6.2`, que no es el que corre. La revisión anterior anotaba v24.11.1 / 11.6.2: ese dato también quedó viejo |
| Repos `maquinaria_back` / `maquinaria_front`                      | `maquinaria-backend` / `maquinaria-frontend`                                                                                                                                                                            |
| Salida del build `dist/maquinaria-front/browser` (§10, línea 127) | **`dist/maquinaria-frontend/browser`**                                                                                                                                                                                  |
| Checklist marca el frontend como "Angular 22 listo"               | Es Angular 21, y ya no es scaffolding: tres aplicaciones en pie y la Fase 0 cerrada                                                                                                                                     |
| Login con tres campos, incluido el identificador de empresa       | **Dos campos**: la empresa sale del subdominio                                                                                                                                                                          |
| Organización por feature en `core/` / `features/` / `shared/`     | `nucleo/` + `disposicion/` + `paginas/` agrupadas por aplicación                                                                                                                                                        |
| `src/environments/` con reemplazo de archivos por configuración   | Un solo archivo, `nucleo/ambiente/configuracion.ts`                                                                                                                                                                     |
| Cliente de API generado desde OpenAPI                             | `contratos.ts` escrito **a mano**; `api:sync` no existe (pendiente 13), y ya se le escapó un tipo (pendiente 18)                                                                                                        |
| Refresh token en cookie `HttpOnly`                                | En `localStorage`, y el backend lo devuelve en el cuerpo (pendiente 15)                                                                                                                                                 |
| §9 prevé cuatro interceptores: JWT, refresh, errores y `tenant`   | Tres decididos: JWT y refresh **existen**, `tenant` **no hace falta** —el slug va en la ruta—, y el de errores sigue pendiente: cada pantalla llama a `mensajeDeError` a mano                                           |

Lo que **dejó de ser divergencia** en esta revisión: el comando `migrar-empresas` del
backend, que el documento anterior daba por pendiente y hoy existe
(`dotnet run --project src/Maquinaria.Api -- migrar-empresas`, con
`Aplicacion/Empresas/MigrarEmpresas.cs`). Es lo que aplica lo que la pantalla de salud de
esquemas señala, así que el aviso ya tiene salida.

Cuando el disco y el documento no coinciden, **gana el disco** y se corrige el documento.
