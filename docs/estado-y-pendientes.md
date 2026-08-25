# Estado y pendientes

Última verificación: 2026-08-24.

## Estado actual

El repo ya **no** es scaffolding. Son **tres aplicaciones separadas por subdominio**, con
su árbol de rutas, su armazón y su menú, sobre 11 commits (`HEAD` en `0144c89`).

Verificado en disco hoy:

| Medida | Valor |
|---|---|
| Pruebas | **39 en 2 archivos**, todas pasan (`npx ng test --watch=false`) |
| Componentes | **17**, todos con `OnPush`, y **17** `.html` hermanos |
| Plantillas dentro de un `.ts` | **cero** (`grep -rn "template:" src/` no devuelve nada) |
| Build de producción | **290.25 kB** crudos / **80.18 kB** transferidos, más 17 chunks diferidos |
| Salida | `dist/maquinaria-frontend/browser` |

La plantilla de bienvenida de Angular ya no existe: `src/app/app.html` es
`<router-outlet />` y `app.css` se borró.

### Las tres aplicaciones

`src/app/app.routes.ts` no registra rutas: exporta `rutasDelAnfitrion()`, que **elige**
un árbol según el anfitrión. No hay un guard tapando rutas ajenas — esas rutas
sencillamente no se registran, igual que el backend aísla por base de datos.

| Anfitrión | Aplicación | Árbol |
|---|---|---|
| `admin.<dominio>` | Superadministración | `rutas-plataforma.ts` |
| `<slug>.<dominio>` | La empresa `<slug>` | `rutas-empresa.ts` |
| `<dominio>`, `login.<dominio>` | Portal de entrada | `rutas-portal.ts` |

Se resuelve una vez al arrancar: el anfitrión no cambia sin recargar, y cambiar de
empresa es cambiar de origen.

### Cómo está organizado `src/app/`

| Carpeta | Qué hay |
|---|---|
| `nucleo/ambiente/` | `configuracion.ts`, `tenant.ts` (+ `tenant.spec.ts`), `sitio.ts`, `titulo-pagina.ts` |
| `nucleo/api/` | `api.ts`, `api-plataforma.ts`, `contratos.ts`, `contratos-plataforma.ts`, `mensaje-error.ts` |
| `nucleo/sesion/` | `sesion.ts`, `sesion-plataforma.ts`, `acceso.ts` (+ `acceso.spec.ts`), `guard-sesion.ts`, `guard-plataforma.ts`, `interceptor-token.ts` |
| `disposicion/` | `disposicion-empresa`, `disposicion-plataforma`, `menu-lateral`, `opciones-menu.ts` |
| `paginas/acceso/` | Piezas compartidas del acceso: `marco-acceso`, `campo-contrasena`, `selector-idioma`, `bandera`, `ilustracion-acceso` |
| `paginas/empresa/` | `iniciar-sesion`, `aceptar-invitacion`, `solicitar-restablecimiento`, `restablecer-contrasena`, `inicio` |
| `paginas/plataforma/` | `iniciar-sesion`, `empresas` |
| `paginas/portal/` | `seleccionar-empresa` |

Cada pantalla se renombró por **lo que se hace en ella**. **Las URL no cambiaron**:
`/entrar`, `/invitacion`, `/recuperar`, `/restablecer`, `/inicio`, `/empresas`.

No existen `src/app/core/`, `features/`, `shared/` ni `src/environments/`: la
configuración de ambiente es un solo archivo, `nucleo/ambiente/configuracion.ts`.

### Regla de código que rige desde ahora

**Ningún componente lleva HTML dentro del `.ts`.** Ni una plantilla en línea, ni un
`template:` de una sola línea: todo el marcado va en un `.html` hermano referenciado con
`templateUrl`. Está escrita en [`AGENTS.md`](../AGENTS.md) (idéntico a
`.claude/CLAUDE.md`) y desarrollada en [convenciones](convenciones.md). Hoy se cumple en
los 17 componentes.

### Qué funciona de punta a punta

- **Acceso de empresa sin tercer campo.** La empresa sale del subdominio
  (`tenantActual()`), no del formulario: son **dos campos**, correo y contraseña.
- **Restablecimiento de contraseña completo**, en dos pantallas (`/recuperar` y
  `/restablecer`), contra los endpoints nuevos de la API.
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
  Cuatro indicadores, una lista de avisos y las últimas altas, **todo derivado de
  `GET /empresas`**: sin endpoint de estadísticas y sin una sola cifra estimada, que es lo
  que prohíbe el sistema de diseño. La lógica de agregación vive aparte en `resumen.ts`,
  como función pura, con 13 casos de prueba.

  Los tres avisos que sabe detectar son los tres problemas que la lista permite deducir:
  un alta **fallida**, una empresa **lista sin plan** —su base existe y su gente no ve
  ningún módulo— y una base con el **esquema desfasado**, comparando su `versionEsquema`
  contra la más avanzada. Ese último cubre en la interfaz el desfase que hoy hay que
  descubrir a mano; el comando `migrar-empresas` del backend sigue pendiente.
  El diseño sigue el boceto de referencia —barra de la pantalla con búsqueda y acción
  principal, cuatro indicadores con el último destacado en negro y amarillo, banda de
  gráfica y avisos, tabla con chips de filtro— pero **cada hueco se llenó con el dato real
  que le corresponde**, no con el del boceto: donde el boceto pedía «utilización semanal»
  van **altas por mes**, que es la única serie temporal que la lista de empresas permite
  calcular.
- **Tarjetas de indicador, listas de aviso y chips de filtro** como `@utility` en
  `src/styles.css`, siguiendo la especificación del sistema de diseño. Eran tres de los
  cinco componentes que el documento describía sin que existieran; siguen faltando las
  tablas y los campos de formulario de aplicación.
- **La lista de empresas es un recurso COMPARTIDO** (`ApiPlataforma.empresas`, con
  `httpResource`): el dashboard y la pantalla de Empresas la leen los dos y hacen una sola
  petición entre las dos, en lugar de una cada uno en cada navegación. El alta recarga la
  lista sola. Las reglas —y las tres trampas de `httpResource`, incluida la de que `value()`
  lanza en estado de error— están en
  [convenciones](convenciones.md#datos-httpresource-y-el-recurso-compartido).

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

  El formulario vive en una **hoja inferior arrastrable** (`disposicion/hoja.ts`), abierta
  desde el botón amarillo de la barra: se agarra del asa, tiene dos anclajes y se cierra
  tirándola hacia abajo o con un gesto rápido, como las de móvil. El componente es
  reutilizable; y el «por qué no se puede editar» está detrás de un botón `?`
  con un `popover` nativo. Las dos capas y sus trampas están en
  [convenciones](convenciones.md#capas-hoja-inferior-y-globo-de-ayuda).

  De paso, el alta de empresa dejó de mandar `codigoPlan: 'base'` fijo en el código: ahora es
  un selector alimentado por los planes **activos** del recurso compartido.
- **Campos de formulario de aplicación** como `@utility campo-formulario`, con lo que ya solo
  faltan las tablas de los cinco componentes que el sistema de diseño especificaba sin código.
  `empresas.html` perdió sus 6 copias de la misma cadena de Tailwind.
- **Todo responsivo**, comprobado en 375, 768 y 1280. El menú lateral es un **cajón** por
  debajo de `lg` —con hamburguesa, velo y cierre con Escape— y una columna fija desde ahí;
  antes ocupaba 264 px fijos a cualquier ancho, lo que dejaba un teléfono con 111 px de
  contenido. La regla, los cortes y las trampas están en
  [convenciones](convenciones.md#responsivo) y en [`AGENTS.md`](../AGENTS.md).

---

## Pendientes

Ordenados de "rompe algo" a "hay que decidirlo".

### Incoherencias en disco

1. **El `<title>` de `src/index.html` no coincide con `sitio.nombre`.** El archivo dice
   `Maquinaria` y `nucleo/ambiente/sitio.ts` dice `RETROMAQ`. `index.html` es HTML
   estático y no puede leer `sitio.ts` — el propio archivo lo advierte en un
   comentario —, así que la sincronización es manual y hoy está rota. Solo se ve el
   primer instante, hasta que el router navega, pero es el nombre que sale al compartir
   la pestaña.
2. **`.vscode/launch.json` tiene un target de test obsoleto.** La configuración `ng test`
   apunta a `http://localhost:9876/debug.html`, que es de Karma. Este proyecto usa Vitest
   y ese puerto no existe. Hay que arreglarla o quitarla.
3. **Dos `.svg.original` sin commitear en `public/`**
   (`flag-mx-svgrepo-com.svg.original` y
   `flag-for-flag-us-outlying-islands-svgrepo-com.svg.original`): son los originales de
   las banderas antes de limpiarlas. Hay que decidir si se versionan o se borran, no
   dejarlos indefinidamente como *untracked*.
4. **Dos SVG de excavadora que ya nadie usa**: `excavator-svgrepo-com.svg` y
   `excavator-bulldozer-svgrepo-com.svg`. La ilustración del acceso es
   `excavadora.webp`, referenciada desde `src/styles.css`. Los dos SVG no aparecen en
   ningún archivo de `src/` y aun así se copian al build.

### Accesibilidad

0. **`selector-idioma` declara `role="listbox"` y `role="option"` sin navegación con
   flechas.** Un `listbox` obliga a mover la selección con las flechas, y anunciarlo sin
   implementarlo promete a un lector de pantalla un comportamiento que no está. Se nota
   ahora por contraste con `menu-usuario`, que resolvió el mismo problema con ARIA de
   divulgación —`aria-haspopup` + `aria-expanded` y botones normales—. Las dos salidas son
   igual de válidas: bajarlo a divulgación como el otro, o implementar las flechas. Ver
   [convenciones](convenciones.md#aria-de-divulgación-no-de-menú).

### Esqueletos de carga

0. **Dos pantallas siguen con «Cargando…» en texto**: `paginas/plataforma/empresas` y
   `paginas/empresa/inicio`. La convención y las piezas ya están —ver
   [convenciones](convenciones.md#esqueletos-de-carga)—; falta escribir el espejo de cada
   una. El de `empresas` es una tabla, así que sale casi igual al del dashboard.

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
9. **Sin CI.** No hay workflows de GitHub Actions ni gate de build/test en los PR. Ahora
   que hay 39 pruebas, es justo lo que falta para que sirvan de red.
10. **Sin pruebas end-to-end.** Angular CLI no trae framework de e2e; la elección sigue
    siendo una decisión abierta.
11. **Cobertura desigual.** Las 39 pruebas están en `nucleo/ambiente/tenant.spec.ts` y
    `nucleo/sesion/acceso.spec.ts` — lógica pura —. Ningún componente, ningún guard y
    ningún interceptor tienen prueba.

### Integración con la API

> El grueso ya corre: `provideHttpClient()`, el interceptor de token, los dos guards y
> las dos sesiones separadas por llave. El inventario está en
> [integración con el backend](integracion-backend.md). Lo que sigue en esta lista es lo
> que falta.

12. **Falta el interceptor de refresco de token.** El login ya devuelve token de
    refresco y se guarda, pero nadie lo usa: cuando el token de 15 minutos caduca hay
    que volver a entrar.
13. **Falta `api:sync`.** Los tipos de `nucleo/api/contratos.ts` y
    `contratos-plataforma.ts` están **escritos a mano**. El plan sigue siendo generarlos
    desde `/openapi/v1.json` y commitear el resultado, para que un cambio de contrato
    salga como diff en la revisión y no como error en tiempo de ejecución.
14. **La herramienta generadora del cliente OpenAPI no está elegida** en ningún
    documento. No solo falta el script: falta decidir con qué se genera.
15. **El token de refresco vive en `localStorage`**, no en cookie `HttpOnly`. Es una
    divergencia consciente con el diseño y hay que resolverla antes de producción; está
    explicada en
    [integración con el backend](integracion-backend.md#dominios-en-producción-y-la-cookie-del-refresh-token)
    y no se repite aquí.

### Producto

16. **Las pantallas de los módulos son la Fase 1 en adelante.** El menú de empresa hoy
    solo tiene el inicio; el andamiaje para agregar una pantalla ya está: una entrada en
    `rutas-empresa.ts` y una línea en `MENU_EMPRESA` con su clave de módulo.
17. **El dominio de producción no está registrado**, así que la configuración de
    Cloudflare Pages sigue pendiente. La ruta de salida que hay que darle es
    `dist/maquinaria-frontend/browser`.

### Cerrados desde la revisión anterior

Se listan para que nadie los reabra: `lang="es-MX"` en `index.html`, la prueba
`app.spec.ts` que se rompía al quitar la plantilla de bienvenida — desapareció con
ella —, el componente `App` sin `OnPush`, la integración HTTP, la **decisión de CORS**
(CORS explícito en la API, no proxy en el dev server), el **shell completo de la Fase 0**
y el **sistema de diseño sobre Tailwind v4**. El `<title>` de `index.html` se corrigió en
su momento y se ha vuelto a desincronizar: es el pendiente 1.

---

## Plan de desarrollo

Se trabaja en **rebanadas verticales**: cada módulo se termina de punta a punta antes de
pasar al siguiente (`03-plan-desarrollo.md` §1).

```
Entidad → Migración → Caso de uso → Endpoint → Pruebas → Pantalla Angular → Funciona
```

No "todo el backend y luego todo el frontend": con 26 módulos, esa separación son seis
meses sin nada demostrable.

| Fase | Alcance | Lo que aporta el front |
|---|---|---|
| **0 — Fundación** | Multi-tenancy, aprovisionamiento, auth | Shell: layout, login, guards, interceptores, navegación |
| **1 — Núcleo** | Equipos, clientes, obras, tarifas, disponibilidad, cotizaciones, rentas | Pantallas del ciclo cotizar → aprobar → rentar → cerrar |
| **2 — Operación** | Contratos, logística, inspecciones, evidencias, horómetros, daños | Captura con fotografías |
| **3 — Taller** | Mantenimiento, órdenes de trabajo, refacciones, compras | |
| **4 — Finanzas** | Pagos, cobranza, CFDI, rentabilidad | Reportes |
| **5 — Campo** | PWA con offline, sincronización, GPS, firmas, QR | La fase más difícil del front |
| **6 — Inteligencia** | Predicción, pricing dinámico, analítica | Requiere histórico real |

La Fase 0 del front **está en pie**: armazones, accesos, guards, interceptor de token y
navegación. Para cerrarla del todo falta el interceptor de refresco (pendiente 12).

Al cerrar la Fase 1 el sistema **ya es vendible**. Dashboard, notificaciones y reportes
no son fases: cada fase agrega los suyos al cerrar.

La PWA offline de la Fase 5 se diseña desde ahora: los IDs se generan en el cliente (de
ahí uuid v7) y hay resolución de conflictos.

---

## Divergencias con los documentos de diseño

Los documentos de `maquinaria-backend/docs/` son especificación, no inventario.
Diferencias detectadas al 2026-08-24:

| Documento dice | Realidad en disco |
|---|---|
| Angular 22 / Angular CLI 22.1.4 | **Angular 21.2.21** (CLI y `@angular/build`, también 21.2.21) |
| Node v24.19.0, npm 11.17.0 | Node v24.11.1, npm 11.6.2 |
| Repos `maquinaria_back` / `maquinaria_front` | `maquinaria-backend` / `maquinaria-frontend` |
| Salida del build `dist/maquinaria-front/browser` (§10, línea 127) | **`dist/maquinaria-frontend/browser`** |
| Checklist marca el frontend como "Angular 22 listo" | Es Angular 21, pero ya no es scaffolding: tres aplicaciones en pie |
| Login con tres campos, incluido el identificador de empresa | **Dos campos**: la empresa sale del subdominio |
| Organización por feature en `core/` / `features/` / `shared/` | `nucleo/` + `disposicion/` + `paginas/` agrupadas por aplicación |
| `src/environments/` con reemplazo de archivos por configuración | Un solo archivo, `nucleo/ambiente/configuracion.ts` |
| Cliente de API generado desde OpenAPI | `contratos.ts` escrito **a mano**; `api:sync` no existe (pendiente 13) |
| Refresh token en cookie `HttpOnly` | En `localStorage` (pendiente 15) |

Cuando el disco y el documento no coinciden, **gana el disco** y se corrige el documento.
