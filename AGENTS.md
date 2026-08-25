
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- NEVER put HTML inside the `.ts` file. No `template:` with backticks, not even a
  one-liner: every component's markup goes in a sibling `.html` file referenced with
  `templateUrl`. Inline templates turn component files into walls of markup where the
  logic is impossible to find; that is what separate file types are for. This rule
  overrides the usual Angular advice to inline small templates.
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## Internationalization

- NEVER hardcode UI text in a template or a `.ts` file. Every user-facing string goes
  through `t()` from `src/app/nucleo/i18n/i18n.ts`, and both `es-MX` and `en-US` must be
  filled in `nucleo/i18n/textos.ts` — a missing translation is a compile error, so this
  is not optional.
- In a component: `protected readonly t = t;`, then `{{ t().seccion.clave }}` in the
  template. Angular cannot call an imported function from markup.
- Text with a value inside goes in the dictionary as a FUNCTION —
  `permisos: (n: number) => ...` — never as a template with placeholders.
- Do NOT translate text that comes from the API. The `detail` of a `ProblemDetails` is
  worded on the server to be uniform (it must not reveal whether an account exists);
  rewriting it here would undo that.
- A text `input()` default cannot BE the text: it would freeze in whatever language was
  active at construction. Use `input('')` plus a `computed` that resolves the fallback.
- A menu or data list goes in a function, not a module constant: a constant is evaluated
  at module load and stays in that language.

See `docs/convenciones.md#internacionalización` for the reasoning and the two traps.
