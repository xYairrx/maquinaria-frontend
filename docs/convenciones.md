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
