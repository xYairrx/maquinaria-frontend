
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
- **The primary action either navigates or acts, never both.** `ruta` makes the shell render
  an `<a>` (openable in a new tab); `alPulsar` makes it a `<button>`. Not cosmetic: announcing
  "link" for something that opens a sheet on the same screen lies to a screen reader. Declare
  no action if there is neither.
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

## Loading skeletons

**Never a "Loading…" text.** While data is in flight, render the SILHOUETTE of what is
coming: grey blocks with the shape, size and position of the real content. A text says
nothing about the shape, so when the data lands the screen jumps from one line to a grid of
cards, and that jump reads as a bug.

- Use `@utility esqueleto` from `src/styles.css`, and `esqueleto-inverso` on dark surfaces
  (light grey on a black card is a white patch, and the layout must not flash colour).
- **Keep the announcement.** The old text was also the `role="status"`. The split is:
  `aria-busy` on the container, `role="status"` + `sr-only` for the announcement, and
  `aria-hidden` on the blocks themselves — they are decoration.
- Put it in a **sibling component**, not in the `@if` branch: it is dozens of lines of
  structure with no data. The duplicated structure is the price — **if the real layout
  changes, the skeleton changes.** A skeleton that no longer matches is worse than none.
- **Blocks match the text's LINE BOX, not its font size.** 12 px text occupies 16, so its
  block is `h-4`, not `h-3`.
- **Bar heights in a chart are fixed literals**, never `Math.random()` — the silhouette
  would shake on every change-detection pass.
- Lists of unknown length cannot match exactly. Pick a plausible count and accept it.
- **Not for user-triggered actions.** Submitting a form still uses the disabled button with
  its "Sending…": a silhouette there would hide the form they just filled in.

See `docs/convenciones.md#esqueletos-de-carga`.

## Data fetching: check for an existing resource FIRST

**Before writing any fetch in a new screen, look for one that already exists.** The empresas
list lives in `ApiPlataforma.empresas` and is SHARED — the dashboard and the Empresas screen
both read it and make ONE request between them. Do not add a second fetch for data a service
already exposes.

- **The `httpResource` lives in the SERVICE, never in the component.** That is the whole
  point: a resource in a component is one request per component instance; in a
  `providedIn: 'root'` service there is one instance, so one request, shared and cached.
- **Expose plain `Signal<T>`, never the resource itself.** `httpResource` is `@experimental`
  in Angular (since 19.2, still so in 21.2). Keeping it inside one file means an API change
  touches one file, not every screen.
- **`value()` THROWS when the resource is in an error state.** Always wrap:
  `computed(() => res.hasValue() ? res.value() : [])`. Screens read data inside effects with
  no guard, so exposing `.value` directly makes a failed request blow up the effect instead
  of rendering the error notice. There is a regression test for this in
  `api-plataforma.spec.ts` — do not "simplify" that `computed` away.
- **A `undefined` URL means "do not fetch yet"** — that is how a conditional request is
  expressed. Without it, the login screen (which injects the same service to sign in) fires
  an unauthenticated GET.
- **Unwrap the error**: `error.cause ?? error` before handing it to `mensajeDeError`, or the
  server's `ProblemDetails` text is lost.
- **A mutation reloads its own list, in the service**, chained with `tap(() => this.reload…)`
  — never in the screen. Callers must not have to remember.
- **Resources are for READING.** Mutations (sign in, provision, reset password) stay
  `HttpClient` + `subscribe`: a person triggers them, they have their own `enviando` flag and
  their own error, and they are not cached.

TanStack Query was evaluated and deferred. Revisit when a mutation must invalidate several
lists across screens, when you find yourself writing a cache with a TTL, or when you need
server-side pagination. See `docs/convenciones.md#datos-httpresource-y-el-recurso-compartido`.

## Route inputs can be `undefined` despite their type

`withComponentInputBinding` assigns `undefined` when a query param is absent from the URL,
**overriding the `input()` default**. So `readonly token = input('')` can hand you
`undefined` at runtime while TypeScript insists it is a `string`.

Always test route-derived params with falsy checks, never `=== ''`:

```ts
!empresa || !token() ? undefined : buildUrl()   // yes
empresa === '' || token() === ''                // no — lets `undefined` through
```

The bug this caused: the URL was built with the string `"undefined"`, the server answered
404, and **a missing link rendered as an expired link**. Regression tests live in
`nucleo/api/api.spec.ts`.

Related: when a read takes screen params and nothing shares it, the service exposes a
FACTORY returning plain signals (`Api.consultaDeInvitacion`), not a resource field. The
dedup argument does not apply, but keeping `httpResource` out of components still does.

## Overlays: use the native element

**A bottom sheet is `disposicion/hoja.ts`** — reuse it, do not write another. It is a
`<dialog>` + `showModal()` (focus trap, `aria-modal`, page inert, top layer for free) plus the
drag gesture and CONFIGURABLE snap points (`[anclajes]="[50, 70, 95]"`, percentages of the
viewport height, as many as you need).

**What makes it a sheet and not a modal is that it MOVES.** Grab the handle, snap up, snap
down, drag down far enough (or flick) to dismiss. A panel that only appears and disappears is
a modal with rounded corners. And **a sheet is never centred** — it stays at the bottom at
every width, floating with all four corners rounded.

Five gesture decisions, each one a bug that already happened or was avoided:

- **Drag only from the handle and header.** Dragging from the body forces you to disambiguate
  "move the sheet" from "scroll the content". Restricting the zone removes the conflict.
- **`touch-action: none` on the drag zone**, or the browser keeps the vertical gesture for
  scrolling and `pointermove` never fires.
- **`setPointerCapture` first, inside `try`.** It THROWS when the pointer is already gone (a
  very fast tap); after setting the dragging flag, that would leave the sheet stuck in gesture
  mode forever, waiting for a `pointerup` that never comes.
- **Velocity needs a minimum sampling interval (8 ms).** Two `pointermove` events in the same
  millisecond divide by almost zero and give a huge velocity — the sheet then closes itself on
  a SLOW 45 px drag.
- **Kill the transition while dragging.** With it on, the sheet lags behind the finger.

**Undo the browser's `<dialog>` defaults one by one.** Three of them bit, and none of them
errors — you only see something wrong:

- `display: none` on the closed dialog, which OUR `display: flex` overrides (same specificity,
  ours wins by order) → **the sheet renders in the page while closed**. Write
  `&:not([open]) { display: none }`.
- `max-height: calc(100% - 6px - 2em)` caps the height you asked for → the snap point must be
  set INLINE from the component, and as a max-height, not a fixed height.
- `max-width: calc(100% - 6px - 2em)` leaves a 38px gap on the right → `max-width: 100%`.

Always check the CLOSED state, not just the open one.

**Dragging is never the only path**: the handle is a `<button>` that toggles snaps by keyboard,
Escape closes, and there is an explicit close button (WCAG 2.1.1).

**The backdrop click is NOT free.** A modal `<dialog>` closes on Escape but IGNORES clicks on
its backdrop — you have to write it. Detect it by `target`, **never by coordinates**: a click
born from the KEYBOARD (Enter/Space on a button) arrives with `clientX`/`clientY` at **zero**,
so a geometric check reads it as "above the sheet" and **pressing any inner button by keyboard
closes the whole sheet**. Use `evento.target !== dialogo → return`. Also guard with a flag for
the `click` the browser emits after a drag that ended outside the sheet.

**Never omit `(close)` on the dialog.** Escape is closed by the BROWSER without going through
your method; without listening the signal stays "open", the effect does not re-run, and the
button stops opening the sheet forever.

**A help/info popup is the native `popover` attribute** with `popovertarget`: light dismiss,
Escape and the top layer come free. Position it with explicit `top`/`right` — in the top layer
`inset: auto` has no static position to resolve against. Use `aria-details`, not
`aria-describedby`, when it has structure (heading plus points).

**Verifying overlays with the browser pane hidden**: the page does not composite, so animations
freeze on their first frame and queued tasks are delayed. `getBoundingClientRect()` then
includes the entry transform — a sheet that looks 24px too low is the animation mid-flight.
Call `el.getAnimations().forEach(a => a.finish())` before measuring, dispatch
`new Event('close')` by hand to test that binding, and space synthetic `pointermove` events
across separate calls so real time passes (otherwise the velocity guard is what you are
testing).

See `docs/convenciones.md#capas-hoja-inferior-y-globo-de-ayuda`.
