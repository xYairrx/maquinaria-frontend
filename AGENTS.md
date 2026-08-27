
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

## A new screen is FOUR edits, not two

**A menu entry and its route ship TOGETHER, or neither ships.** `menuEmpresa()` used to return
an `Operación` group with `/equipos`, `/clientes` and `/rentas` while `rutas-empresa.ts`
registered none of them: the option rendered, and pressing it fell through to `path: '**'` and
bounced back to `/inicio`. All three were removed.

1. The route in `rutas-empresa.ts` / `rutas-plataforma.ts`, with its own `loadComponent`.
2. The line in `menuEmpresa()` / `menuPlataforma()` (`disposicion/opciones-menu.ts`), with the
   module `clave` if it belongs to one.
3. `titulos.<clave>` in BOTH language blocks of `nucleo/i18n/textos.ts` — the route `title`
   reads it.
4. `menu.<clave>`, both languages too.

Missing 3 or 4 does not COMPILE, which is the safety net. And there is no `MENU_EMPRESA`
constant, whatever a stale docblock says: it is the function `menuEmpresa()`, a function on
purpose so it re-evaluates when the language changes.


**Verify with `ng build`, never with `tsc --noEmit`.** Bare `tsc` does not compile Angular
TEMPLATES — a missing dictionary key, a method the component does not have, a wrong binding
type all pass it clean. Only the Angular compiler checks them.

That is not a theoretical gap. A missing `t().tipos.filtrarCategoria` passed `tsc` and then
**wedged `ng serve`**: the dev server could no longer rebuild, kept serving the last good
bundle, and every later edit looked like it had no effect — including the fix for a real bug,
which was verified as "still broken" twice against stale code. If a change stops showing up
in the browser, the dev server is failing to build; read its output before doubting the edit.

See `docs/convenciones.md#el-andamiaje-de-una-pantalla-nueva`.

## Look for the existing utility BEFORE writing markup

**`src/styles.css` already defines the piece you are about to hand-roll.** `chip`,
`chip-activo`, `campo-formulario`, `boton-principal`, `aviso`, `esqueleto`,
`tarjeta-indicador`, `hoja-inferior`, `globo-ayuda`, `dialogo-confirmacion`. Grep for it and
read `docs/sistema-de-diseno.md` before typing a class list.

Writing it by hand does not just duplicate the definition — **it silently drops the states
the utility carries.** A filter chip written as `class="chip aria-pressed:bg-negro-tarjeta"`
looks right until you hover it and the text colour changes, because `chip-activo` also pins
`:hover` and the hand-written version does not. That shipped in four screens before it was
caught.

The same check applies to colour. Two rules from `docs/sistema-de-diseno.md#lo-que-no-se-hace`
that a "reasonable" instinct violates:

- **No green, no red.** The palette is monochrome plus yellow. Destructive is BLACK — taking
  the yellow away is what says "not the happy path".
- **No `opacity` to dim content.** It drags text below the contrast minimum. Use the
  `estado-neutro-fondo` / `estado-neutro-texto` pair, or nothing.

Colours are never written as hex in a template. Every one is a `--color-*` token in
`@theme`, named by ROLE — `superficie-sutil` survives a palette change, `gris-98` does not.

## Responsive

**Every screen is responsive from its first commit.** This is not a later pass — retrofitting
costs more than writing it adaptive, because fixed widths leak into three places first.

- **Mobile first, always in that order.** Unprefixed classes are the phone; `sm: md: lg: xl:`
  only ADD as the viewport widens. Never `grid-cols-4 sm:grid-cols-1` — that leaves the
  tightest case defined by subtraction.
- **The `<body>` never scrolls horizontally.** Anything too wide scrolls inside its own box
  with `overflow-x-auto`. A wide table scrolls; it does NOT get rebuilt as cards (that
  duplicates the markup and the copies drift apart).
- **A wide table pins its first column** (`sticky left-0`) and carries a `min-w-*`: scrolled
  sideways there is otherwise nothing telling you which row you are reading. The sticky cell
  needs its OWN opaque background — the header's in the `<th>`, the surface's in the `<td>` —
  plus a `border-r`, or content shows through and the seam reads as a layout bug. Prefer
  dropping a column (fold its badge into the pinned cell) over pinning a second one. A table
  with no `min-w-*` wraps its cells on a phone, and then its skeleton cannot mirror it.
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
- **A primary action may open a SHEET** (`alPulsar` + `disposicion/hoja.ts`) — that is the
  pattern for any "new X" form, not something specific to Planes. What does NOT go inside the
  sheet is the confirmation: it carries the invitation link, which has to be readable and
  copyable, and a sheet is dismissed by the same gesture that opened it. Close the sheet and
  leave the notice on the SCREEN.
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

## An empty state must say WHY it is empty

**One empty text is a lie the moment the screen has filters.** With the "Retired" chip on
and nothing retired, "No brands yet. Create the first one with the button above" is FALSE —
there may be ten active ones — and worse than false it is useless: it invites creating a
record when what you have to do is clear the filter.

Pick the message from the state that produced the emptiness, in this order:

1. **A search is active** → name the term: `Ninguna marca coincide con «cat».` Without the
   term, someone who mistyped cannot see what they actually searched for.
2. **A filter is active** → say which one is empty AND how to get out:
   `Ninguna marca está retirada. Quita el filtro para ver el catálogo completo.`
3. **Nothing is active** → the real empty state, and the ONLY one that carries the call to
   action: `Todavía no hay marcas. La primera se crea con el botón de arriba.`

Two rules on top of that:

- **Never infer about what you did not query.** "All of them are active" would need an
  unfiltered count this screen does not request, and it is a lie on an empty catalog. Each
  text asserts only what this request proves.
- **The bar context counts the same thing the list shows.** "0 marcas" with the retired
  filter on reads as "the catalog is empty". Name what is being counted: `0 retiradas`.

The call to action belongs ONLY to case 3. With a filter on, "create the first one" is noise.

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

## Token refresh must be SINGLE-FLIGHT

The backend's refresh token **ROTATES and has no grace window**: two concurrent exchanges of
the same token are read as a stolen-token replay and **revoke the user's whole session chain**.
Unserialized refresh does not degrade the experience, it signs out someone who was working.
`nucleo/sesion/refresco-sesion.ts` exists for nothing else.

- **`enVuelo` + `shareReplay({ bufferSize: 1, refCount: false })`, both halves.** `HttpClient`
  observables are COLD, so without sharing the subscription two subscribers of the "same"
  observable fire two POSTs — that is the bug itself, not a nicety.
- **`finalize` goes BEFORE `shareReplay`**, so it runs once when the source completes instead
  of once per subscriber. It is what releases `enVuelo`.
- **`refCount: false` is not decoration.** With `true`, a request cancelled because its screen
  was destroyed tears the exchange down half-done — token already rotated on the server,
  nothing saved on the client — and the next refresh sends a token the backend considers spent.
- **No loop, by construction:** the refresh POST goes out through `HttpBackend` (outside the
  interceptor chain, so no `Bearer` and it cannot trigger itself), and the retry is launched
  INSIDE `catchError`, which does not catch what its own handler returns — a second 401 reaches
  the screen.
- **Session teardown lives on the SHARED source**, so it runs once even with ten requests
  waiting; the error still propagates to every subscriber, or their screens stay "sending"
  forever.
- **Interceptor order is load-bearing:** `[interceptorRefresco, interceptorToken]`. The refresh
  one is outermost, so the request it retries passes through the token one again and goes out
  with the NEW `Bearer` without touching headers here.
- **Platform is out:** there is no `sesion_refresh` for `/api/plataforma/**`, so that 401
  propagates untouched. Only the header is shared, in `interceptor-token`.
- **No proactive refresh from `expiraEn`** — a timer adds clock skew, timers to clean up and a
  second path that can race the reactive one. The 401 is the signal.

Regression tests: `nucleo/sesion/interceptor-refresco.spec.ts` (11), the load-bearing one being
"two concurrent 401s produce ONE refresh".
See `docs/convenciones.md#sesión-el-refresco-del-token-va-serializado`.

## A reactive primitive only tracks SIGNALS — anything else freezes it

`computed`, `effect` and `httpResource` re-run when a **signal** they read changes. Reading
anything else — a plain property, `form.getRawValue()`, a service field — registers **no
dependency at all**. The primitive evaluates once and keeps that value forever.

It does not throw, does not warn, and the compiler cannot see it. The types are correct; the
value is just stale. **This has now shipped twice:**

- **`httpResource` reading a non-signal property** (Marcas). The search box and the
  active/retired filters did nothing: the resource's first run read zero signals, so it never
  refetched. Fixed by creating the resource inside a factory that closes over the filter
  signal. Locked by `api-catalogos.spec.ts`.
- **`computed` reading `form.getRawValue()`** (Ubicaciones). The "half a coordinate locates
  nothing" guard never fired: no warning, and the submit button stayed enabled. Locked by
  `paginas/empresa/ubicaciones/ubicaciones.spec.ts`, which keeps the broken version next to
  the fixed one to show the difference.

**A `FormGroup` is not reactive.** The bridge is `valueChanges`:

```ts
private readonly valores = toSignal(this.formulario.valueChanges, {
  initialValue: this.formulario.getRawValue(),
});

readonly incompleta = computed(() => {           // yes — reads a signal
  const { latitud, longitud } = this.valores();
  return (latitud == null) !== (longitud == null);
});

readonly rota = computed(() => {                 // no — reads nothing reactive
  const { latitud, longitud } = this.formulario.getRawValue();
  return (latitud === null) !== (longitud === null);
});
```

Pass `initialValue`, or the signal is `undefined` until the first keystroke and the guard is
wrong on a freshly opened form.

**A method called FROM the template is a different case and is fine.** `puedeEnviar()` reads
`formulario.valid`, which is not a signal, but the template re-evaluates it on every change
detection pass and Angular's event listeners mark the component dirty on every keystroke. The
trap is only inside `computed` / `effect` / `httpResource`, which decide for themselves when
to re-run.

**The check to run before writing one:** name the signals this primitive reads. If the list is
empty, it will never re-run — that is the whole bug, in both cases it caused.

## A `<select>` whose value is not a string needs `[ngValue]`

**`[value]` on an `<option>` is ALWAYS a string** — that is the HTML spec, attributes are
text. So `[value]="2"` stores `"2"`, and Angular's `SelectControlValueAccessor` reads
`select.value` and writes that **string** into the form control.

Use `[ngValue]` for enums, numbers and objects. Angular then keeps a lookup table — the DOM
holds a made-up key (`"1: 2"`) and the control receives the real value.

```html
<option [ngValue]="unidad">   <!-- enum, number, object -->
<option [value]="cliente.id"> <!-- a GUID IS a string; fine -->
```

This shipped and produced two symptoms that did not look related:

- **A 400 from model binding.** The body went out as `{"unidad": "2"}` and `System.Text.Json`
  will not read a string into a `short`-backed enum, so the request failed before reaching
  any handler — with ASP.NET's generic "One or more validation errors occurred".
- **The form silently changed its own default.** It declared `unidad: 2` and the screen
  showed the FIRST option instead. On init Angular looks for the option matching `2`; the
  options were `"1"`…`"6"`, `2 !== "2"`, nothing matched, so the browser fell back.

**Typed forms cannot catch this.** They are typed at DECLARATION and never verified at
runtime: `getRawValue().unidad` returns what the declaration promises, while the value
accessor has written a string underneath. The type lies, the compiler is happy, and the
service tests — which check that what you pass is what gets sent — pass too.

It was only visible by using the screen. See `nucleo/api/mensaje-error.spec.ts`, whose whole
reason for existing is that the 400 said nothing until `errors` was surfaced.

## An `<input type="number">` control is a `number | null`, never a string

Same lie as `[ngValue]`, from the other side. `NumberValueAccessor` — which Angular attaches
to **every** `<input type="number">` with a `formControlName` — writes into the control:

- a **number** when the field parses (`250`, and `250.5` too, whatever `step` says),
- **`null`** when the field is empty. Not `''`. Never `''`.

So a control declared `horasEntreServicios: ['']` holds a string only until someone types in
it. That is what makes this one nasty: it does not fail on the happy path you test first.

```ts
horasEntreServicios: [null as number | null],          // yes
horasEntreServicios: [''],                             // no — lies the moment it is used
```

The bug this caused: `v.horasEntreServicios.trim()` threw
`TypeError: trim is not a function` in the SUBMIT handler. Because the throw happened after
`enviando.set(true)` and outside any `subscribe`, nothing caught it — **the request never went
out and the button stayed stuck on "Guardando…" forever**, with no error notice, since the
error path that clears the flag lives in the `subscribe`. The screen looked frozen.

`Validators.required` hides it by accident: `null` is empty, so the form is invalid and never
submits. Three screens survived on that alone. An OPTIONAL numeric field has no such cover,
and Modelos was the first one.

Two more consequences worth writing down:

- **Truncate before sending.** The accessor uses `parseFloat`, so `250.5` reaches you even
  with `step="1"`. An `int` column rejects it with a model-binding 400 — the same generic
  "One or more validation errors occurred" as the `[ngValue]` bug.
- **Reset with the right type too.** `reset({ orden: '0' })` puts a string back into a number
  control and the mismatch returns.

**Anything a value accessor touches is typed by the ACCESSOR, not by your declaration.** The
compiler checks the declaration and nothing checks the accessor, so these two rules — this
one and `[ngValue]` — are the whole list of places where a typed reactive form will lie to
you. Regression tests: `paginas/empresa/modelos/modelos.spec.ts`.

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

## Never `confirm()` or `alert()`

**Asking before a destructive action goes through `Confirmacion.pedir()`**
(`disposicion/confirmacion.ts`), which resolves to a boolean — a one-for-one replacement
for `confirm()`:

```ts
const sigue = await this.confirmacion.pedir({
  titulo: t().marcas.retirar,
  mensaje: t().marcas.confirmarRetiro(marca.nombre),
  confirmar: t().marcas.retirar,   // a VERB, never "OK"
  peligro: true,
});

if (!sigue) return;
```

Why not the browser's: it **ignores the app's language** — its buttons come from the
browser's, so someone reading Spanish gets "OK / Cancel" and the dictionary cannot reach
them; it **cannot be styled**, breaking the design system at the exact moment someone is
about to break something; it **blocks the thread**; and it cannot tell a destructive action
from a neutral one.

- The dialog is mounted ONCE per shell (`<app-dialogo-confirmacion />`). A screen never
  draws it — same split as `Barra`: state in a service, markup in the shell.
- **`mensaje` says what CHANGES**, not "are you sure?". A question with no consequence in it
  forces a blind decision.
- **Cancel comes first in the DOM and carries `autofocus`.** A `<dialog>` focuses its first
  focusable child, and on a destructive question that has to be the safe option — otherwise
  a reflex Enter executes what was being asked.
- **Closing without choosing is NO.** Escape closes via the browser without passing through
  the component, so `(close)` must resolve the promise `false`; without it the caller hangs
  forever with its button stuck.
- **Destructive is BLACK, not red.** The palette is monochrome plus yellow and the design
  system forbids red; yellow is the wanted action, so taking it away already says this is
  not the happy path. The label carries the verb, so colour is never the only cue.

See `docs/convenciones.md#confirmar-antes-de-una-accion-destructiva`.

## Overlays: use the native element

**A bottom sheet is `disposicion/hoja.ts`** — reuse it, do not write another. It is a
`<dialog>` + `showModal()` (focus trap, `aria-modal`, page inert, top layer for free) plus the
drag gesture and CONFIGURABLE snap points (`[anclajes]="[50, 70, 95]"`, percentages of the
viewport height, as many as you need).

**What makes it a sheet and not a modal is that it MOVES.** Grab the handle, snap up, snap
down, drag down far enough (or flick) to dismiss. A panel that only appears and disappears is
a modal with rounded corners. And **a sheet is never centred** — it is pinned to the bottom and
to both sides with no gaps (`inset: auto 0 0`), with only the TOP corners rounded and the shadow
cast upwards.

**The gesture is ASYMMETRIC: dragging up GROWS, dragging down TRANSLATES.** Because the sheet is
pinned to the bottom, a NEGATIVE `translate` **detaches it from the bottom edge** and shows the
backdrop underneath, with the footer and its primary action riding up — a real bug, 200 px of
drag for 200 px of gap. Up goes into the max-height, `min(98dvh, calc(<snap>dvh + <drag>px))`;
down stays in the `translate`, which is exactly what dismissal should look like. Keep the `min()`
in CSS, never in JS: it mixes `dvh` with `px` and only the browser knows what a `dvh` measures
right now. No rubber band past the top snap either — damping it meant lifting the sheet off the
bottom again, and there is nothing left to grow into. And since it is a max-height, if the
content already fits, dragging up moves nothing. `disposicion/hoja.spec.ts` (6) locks the rule:
**the `translate` is never negative, on any path.**

Five more gesture decisions, each one a bug that already happened or was avoided:

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
