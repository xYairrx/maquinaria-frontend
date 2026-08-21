# Convenciones de código

Las reglas del repo están en [`AGENTS.md`](../AGENTS.md), y `.claude/CLAUDE.md` es **byte a byte el mismo archivo** (ambos vienen del preset de instrucciones para IA del Angular CLI). Si se cambia uno, hay que cambiar el otro.

## Componentes

- Standalone siempre; **no** poner `standalone: true` en el decorador — es el valor por omisión desde v20.
- `changeDetection: ChangeDetectionStrategy.OnPush` en todo `@Component`.
- `input()` / `output()` como funciones, no `@Input()` / `@Output()`.
- Plantilla inline para componentes pequeños. Con archivos externos, rutas relativas al `.ts`.
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
- **Lazy loading por ruta de feature.** Con 30 módulos previstos, un bundle único es inviable.

## Imágenes

`NgOptimizedImage` para toda imagen estática. No aplica a base64 inline.

## Accesibilidad

Requisito, no aspiración:

- Debe pasar todos los checks de AXE.
- WCAG AA como mínimo: manejo de foco, contraste de color y atributos ARIA.

## TypeScript

- Tipado estricto; inferencia cuando el tipo es obvio.
- Evitar `any`; usar `unknown` cuando el tipo es incierto.

Flags activos en `tsconfig.json`: `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `isolatedModules`. Del compilador de Angular: `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`.

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
