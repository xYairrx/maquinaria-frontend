
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

## Responsive

**Every screen is responsive from its first commit.** This is not a later pass — retrofitting
costs more than writing it adaptive, because fixed widths leak into three places first.

- **Mobile first, always in that order.** Unprefixed classes are the phone; `sm: md: lg: xl:`
  only ADD as the viewport widens. Never `grid-cols-4 sm:grid-cols-1` — that leaves the
  tightest case defined by subtraction.
- **The `<body>` never scrolls horizontally.** Anything too wide scrolls inside its own box
  with `overflow-x-auto`. A wide table scrolls; it does NOT get rebuilt as cards (that
  duplicates the markup and the copies drift apart).
- **No fixed widths on content.** `max-w-*` and `min-w-0` yes, `w-[720px]` no. `min-w-0` on
  a flex child is what makes `truncate` work.
- **Button and chip groups wrap** (`flex-wrap`); they do not overflow or squash.
- **What you hide on mobile can never be the only way to do something.** Hide redundancy,
  never an action.
- **Off-screen is not hidden.** An element moved out with `translate` is STILL in the tab
  order. Use `visibility: hidden` (Tailwind `invisible`), reverted with `lg:visible`.
- Breakpoints are Tailwind's defaults, uncustomized. `lg` (1024) is the important one: it is
  where the side menu goes from drawer to fixed column.
- Verify at **375, 768 and 1280** before calling a screen done.

See `docs/convenciones.md#responsivo` for the reasoning and the drawer's a11y requirements.

## The top bar

**One bar per screen, drawn by the shell.** It deliberately mixes two scopes: the menu
button, Sign out and the initials avatar belong to the shell; the title, context, search
and primary action belong to the screen.

- A screen does NOT draw any of that. It **publishes data** into the `Barra` service
  (`disposicion/barra.ts`) from an `effect` in its constructor — an `effect` and not a
  plain call, because the context depends on data that arrives later and on the language.
- **The `<h1>` is the bar's.** Never add another one in the screen; there would be two.
- **Pass the search signal, do not copy it.** `valor` is the screen's writable signal: the
  bar writes to it and the screen filters by reading it. No intermediate state to sync.
- **The primary action always navigates.** If the form lives on the screen itself, declare
  no action — a button pointing at where you already are goes nowhere.
- Why a service and not `<ng-content>`: projected content does not cross a
  `<router-outlet>`. Same reasoning as `opciones-menu.ts`, where the menu is data too.

See `docs/convenciones.md#la-barra-superior`.

## Dropdowns: disclosure ARIA, not menu ARIA

For a popup of actions (the user menu, a filter popover), declare `aria-haspopup` +
`aria-expanded` on the trigger and make the panel a plain list of buttons. Do NOT add
`role="menu"` / `role="menuitem"` / `role="listbox"` unless you also implement arrow-key
navigation, Home and End — announcing a role without its keyboard contract is worse than
not announcing it, because the screen reader promises behavior that is not there.

Whichever you pick, these are required:

- **Escape closes AND returns focus to the trigger.** Without the second half, closing with
  focus inside drops focus to `<body>` (WCAG 2.4.3).
- **An outside click closes**, and that one does not move focus.
- Guard the outside-click check by containment, or the trigger's own click — which bubbles
  to the document too — closes the panel in the same gesture that opened it.
- The trigger renders even with no data to show; hiding it would remove the only way to
  reach what is inside.

See `docs/convenciones.md#el-avatar-es-un-desplegable`.
