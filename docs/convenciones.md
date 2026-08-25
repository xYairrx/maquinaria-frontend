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

### Tres reglas

1. **El `<h1>` lo pinta la barra.** Una pantalla no añade el suyo: habría dos.
2. **La señal de búsqueda se pasa, no se copia.** `valor` es la señal escribible de la
   pantalla; la barra escribe ahí y la pantalla filtra leyéndola. Sin copia intermedia no
   hay dos estados que sincronizar.
3. **La acción principal navega, siempre.** Si el formulario está en la propia pantalla,
   no se declara acción: un botón que apunta a donde ya estás no lleva a ninguna parte.

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
   `min-w-*` para que las columnas no se aplasten.
3. **Nada de anchos fijos en el contenido.** `max-w-*` y `min-w-0` sí; `w-[720px]` no. El
   `min-w-0` en un hijo de flex es lo que permite que `truncate` funcione: sin él, el hijo
   se niega a encogerse y desborda al padre.
4. **Los grupos de botones y chips se envuelven** (`flex-wrap`), no se desbordan ni se
   comprimen.
5. **Lo que se oculta en móvil no puede ser la única forma de hacer algo.** Ocultar es
   para lo redundante —un avatar cuando el nombre ya está al lado—, nunca para una acción.

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
│                    guard-plataforma.ts, interceptor-token.ts, acceso.ts (+ .spec)
├── disposicion/     los armazones y el menú lateral
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
    │   │                dashboard.{ts,html}, resumen.ts (+ .spec)
    │   └── empresas/
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
| `sesion/` | almacenes de sesión, guards, interceptor, `acceso.ts` | Depende de quién entró |

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
