
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
- Do NOT rewrite text that comes from the API. The `detail` of a `ProblemDetails` is worded
  on the server to be uniform (it must not reveal whether an account exists); paraphrasing it
  here would undo that. **Translate by CODE instead**: the server sends a stable `codigo` in
  `extensions` (see `Maquinaria.Api/Errores/CodigosProblema.cs`) and `mensaje-error.ts` maps
  it to the dictionary. A code cannot distinguish more than the server decided to — the five
  reasons a company login is rejected all share `credenciales_incorrectas`. **An unknown code
  MUST fall back to `detail`**, or a mismatched deploy between the two repos leaves screens
  mute; there is a regression test for that. Messages the server composes with data
  (a service's rejection `Motivo`) still arrive in Spanish: giving those a code means giving
  every validation rule its own code and parameters, which is a separate job.
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
`tarjeta-indicador`, `panel-lateral`, `globo-ayuda`, `dialogo-confirmacion`. Grep for it and
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
- **A primary action may open a SIDE PANEL** (`alPulsar` + `disposicion/panel-lateral.ts`) —
  that is the pattern for any "new X" form, everywhere. It used to be the bottom sheet in
  plataforma and the side panel in empresa; since 2026-09-01 there is ONE pattern and it is the
  panel. What does NOT go inside it is the confirmation: it carries the invitation link, which
  has to be readable and copyable, and the panel is dismissed by the same gesture that opened
  it. Close the panel and leave the notice on the SCREEN.
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

**And the mirror image bit twice more on 2026-09-03**: `validadorRequerido` on a numeric
`<select>` — the enum `tipo` of Movimientos and of Mantenimiento. It reads the control through
`texto()`, which returns `''` for anything that is not a string, so it answers
`{ required: true }` **always** and the submit button never enables. `validadores.ts` says so in
its own docblock and it still happened. The symptom is the cruellest of the family: a complete
looking form, no error message anywhere —warnings need `touched`, and a field prefilled with a
default is never touched— and a dead button.

An enum `<select>` with a default value and no empty option **needs no validator at all**: it
cannot be empty by construction. That is the fix, not a numeric validator.

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

## Edit `textos.ts` by CONTENT, never by line number

The dictionary is ~6000 lines with two symmetric halves (`es-MX`, `en-US`), so the temptation is
to collect line numbers first and delete them afterwards. **Do not.** Every earlier edit shifts
every later index, and a wrong index deletes a key that looks unrelated — the build then fails
somewhere else entirely, and there is **no git in this project** to undo it.

That happened on 2026-09-08: eight deletions computed against the original file, applied after
four whole blocks had already been removed. It destroyed six `en-US` strings and one section
header. Six of them had to be re-translated from the Spanish, because neither `dist/`,
`.angular/cache` nor the dev server held the previous bundle.

```py
# yes — cannot land in the wrong place
assert s.count(linea) == 1
s = s.replace(linea, "")
```

```py
# no — every prior deletion invalidates this index
del lineas[4217 - 1]
```

**And when it does go wrong, the repair tool is symmetry.** Walk both halves with a brace-depth
counter — which does not need the file to compile — and list, per section, the keys present in
one language and absent in the other. That names the damage exactly.

Adding is safer than deleting, but the same rule applies: anchor on a unique neighbouring
string, not on a number.

## A field that can CREATE its catalog entry is a `datalist`, not a combobox

When a catalog field must let you type a value that does not exist yet — and save it so it
becomes an option later — use a native `<input list="...">` plus `<datalist>`. The browser gives
you filtering, keyboard and screen-reader support for free.

**Do NOT hand-roll `role="combobox"`.** That role promises arrow keys, Home and End, and
announcing a role without its keyboard contract is worse than not announcing it — the same rule
as dropdowns above.

Three consequences to get right:

- **The control holds TEXT, not an id.** The id does not exist while someone is typing. Resolve
  it — or create the entry — in the submit handler.
- **Normalize before deciding it does not exist.** `===` treats `Excavadora`, `excavadora` and
  `Excavadora ` as three different catalog entries, and the catalog stops being useful for
  grouping within weeks. Trim, lowercase, and strip diacritics (`normalize('NFD')` +
  `/\p{Diacritic}/gu`) so `Camión` finds `Camion`.
- **Chain creations that depend on each other**, never `forkJoin`. A new model is created WITH
  its category, so it needs that id first; in parallel you get a half-built catalog when the
  first one fails.

And **drop any effect that cleared the field when a parent filter changed**. That belongs to a
closed `<select>`, where an out-of-list value renders blank. With free text it destroys what the
person typed — the value not being in the list is exactly the case that should create one.

The normalizing helpers live in `nucleo/formularios/texto.ts` — `mismoNombre` and
`codigoDesdeNombre` — because two screens need them: the equipment form and the price panel of
the record. A helper imported from one page component into another turns that page into a
library without anyone deciding so.

**A field that creates a catalog entry needing MORE than a name reveals those fields inline.**
A rate needs a code, a unit and a scope, so the price panel of the record shows them the moment
what you typed stops matching the catalog, and hides them again when it matches. Do not send
people to another screen and back: that round trip is what the `datalist` exists to remove.

Regression tests: `paginas/empresa/equipos/equipos.spec.ts`,
`nucleo/formularios/texto.spec.ts`.

## A comment's CLOSING SEQUENCE, written inside a comment, ends it there

Writing the two characters `-` `-` `>` inside an HTML comment — even as an example of what not
to do — closes that comment at those characters. **Everything after them renders as text on the
page.**

It happened on 2026-09-10: a comment in `renta.html` explaining this very rule contained the
sequence as an illustration, and half a sentence appeared under the rental's extensions, in
production-shaped output. **Neither `ng build` nor the 339 tests saw it** — a stray text node is
valid HTML. The client found it in the browser and sent a screenshot.

So: never write that sequence inside a comment. Say "the closing sequence" in words, or put the
example in a fenced block in a `.md` file where it is inert.

To sweep for it — a comment whose body contains another comment's opening is a comment that
closed early:

```bash
python -c "
import pathlib, re
for p in pathlib.Path('src/app').rglob('*.html'):
    s = p.read_text(encoding='utf-8')
    for m in re.finditer(r'<!--(.*?)-->', s, re.S):
        if '<!'+'--' in m.group(1):
            print(p, s[:m.start()].count(chr(10)) + 1)
"
```

**And the wider lesson, which is the reusable part:** this is the fourth defect this month that
compiled clean, passed every test, and was only visible on screen — the others were the prefill
that silently stopped, the `track $index` that showed stale values, and a panel that offered a
combination the server rejects. A green suite says the code does what the tests describe. It says
nothing about what the page shows.

## An HTML comment between a tag's ATTRIBUTES is not valid HTML

```html
<!-- NO: «Opening tag "app-panel-lateral" not terminated» — and the message never says
     comment, so you look at the bindings instead. -->
<app-panel-lateral
  [abierto]="panel()"
  <!-- what the title decides -->
  [titulo]="titulo()"
>
```

Put it **before** the opening tag. The error points at the element's line, several lines below
the comment, which is why this costs a minute more than it should.

## A trailing comma in a template call is an EXTRA ARGUMENT

Prettier formats a multi-line call in a `.ts` file with a trailing comma, and Angular's template
parser does not accept one:

```html
<!-- NO: «Parser Error: Unexpected token )» and «Expected 3 arguments, but got 4» -->
{{
  t().comun.equipoEnLista(
    equipo.codigoInterno,
    equipo.descripcion,
    equipo.marca + ' ' + equipo.modelo,
  )
}}
```

Drop the comma after the last argument. **Prettier does not add it back** — it leaves template
interpolations alone, so the formatted file and the compiling file are the same file.

It fails loudly at build time, which is why it belongs here and not in a review checklist: the
trap is that the habit comes from the `.ts` next door, where the comma is REQUIRED by the
formatter. `ng build` catches it; `tsc` does not look at templates.

## A cascading `<select>` must not clear its child while the catalog is EMPTY

Filtering one dropdown by another needs an effect that clears the child when the chosen value
leaves the list. That effect has a case that is not hypothetical: **catalogs arrive through
`httpResource`, so until they answer the list is empty — and an empty list contains nothing, not
even the correct value.**

```ts
effect(() => {
  const permitidos = this.modelos();
  const elegido = this.formulario.controls.modeloEquipoId.value;

  // `length > 0` FIRST. Without it, opening an edit form before the catalog loads wipes the
  // field, and whoever saves believes they changed nothing.
  if (permitidos.length > 0 && elegido !== '' && !permitidos.some((m) => m.id === elegido)) {
    this.formulario.controls.modeloEquipoId.setValue('');
  }
});
```

> Equipos no longer has this effect — its catalog fields became free-text `datalist` inputs on
> 2026-09-07, where clearing would destroy what someone typed (see the section above). The rule
> stands for any dropdown that stays a closed `<select>`.

**If you DO store the parent on the child entity, let the engine enforce it.** `equipo` keeps
`marca_id` even though brand hangs off the model — the client asked for it, and it buys filtering
without a join. What makes that safe is not discipline in the service: it is a COMPOSITE foreign
key, `(modelo_equipo_id, marca_id)` against a `UNIQUE (id, marca_id)` on `modelo_equipo`. A row
saying Caterpillar with a Komatsu model does not enter. Derive the value server-side on write and
never accept it from the request body — otherwise a wrong value comes back as a constraint error
instead of a message.

The rule that survives: **duplicated data needs a constraint, not a convention.** Without one,
do not duplicate.

Regression tests: `tests/Maquinaria.Api.Tests/Empresas/CamposDelDocumentoPruebas.cs` pins that
both foreign keys stay composite.

## A `<input type="file">` has NO value accessor — keep it out of the form

Fourth of the family, and the one where the control does not lie about the type: it holds
something completely different from what you want. Angular ships no `ControlValueAccessor` for
file inputs, so `formControlName` binds the element's `value` — the browser's fake path string,
`C:\fakepath\photo.jpg` — and the `File` is never reachable.

```ts
protected readonly evidencia = signal<File | null>(null);          // yes

protected elegirArchivo(entrada: EventTarget | null): void {
  const archivos = (entrada as HTMLInputElement | null)?.files;
  this.evidencia.set(archivos && archivos.length > 0 ? archivos[0] : null);
}
```

```ts
evidencia: [null as File | null],   // no — the control gets 'C:\fakepath\photo.jpg'
```

The upload itself is `FormData` + `HttpClient`, and **you must not set `Content-Type`**: the
browser has to write it so it can include the `boundary`. Fixing it by hand breaks the
multipart body with no error you can read.

Used in `paginas/empresa/movimientos` (evidence) and `paginas/empresa/orden-venta` (sale
documents). In Movimientos the upload is also a SEPARATE request that runs BEFORE the create —
the movements table is append-only and its trigger rejects every UPDATE, so the row is written
with its evidence inside or without it forever.

## A `<select>` OUTSIDE a reactive form preselects with `[selected]`, not `[value]`

Third of the same family, and the one with no accessor to blame. A plain `<select>` — no
`formControlName`, no `ngModel` — bound like this **does not work**:

```html
<select [value]="fila.estado">            <!-- no — lost -->
  @for (o of opciones; track o) { <option [value]="o">{{ o }}</option> }
</select>

<select>                                   <!-- yes — order-independent -->
  @for (o of opciones; track o) {
    <option [value]="o" [selected]="o === fila.estado">{{ o }}</option>
  }
</select>
```

**The parent's binding is applied BEFORE the `@for` has created a single `<option>`**, so
`select.value = 3` lands on an element with no options, is silently dropped, and the browser
falls back to the first one. Measured, not assumed: `"1"` instead of `"3"`.

The symptom is a table where **every row shows the first option** regardless of its data —
and it is worse than it looks, because the underlying value is correct: the view is the only
thing lying, so a change that did save reads as if it had not.

Two more things that cost a debugging round each while pinning this down:

- **The two forms cannot share a host component in a test.** The broken one's `[value]`
  changes between passes and dev-mode change detection throws `NG0100`, which masks what you
  are measuring. One host each.
- **Drive the test host from a SIGNAL**, the way the real screen gets its row. A plain field
  mutated between two `detectChanges()` throws `NG0100` too — an artifact of the harness, not
  something the app can hit.

Regression tests: `paginas/plataforma/empresas/selector-estado.spec.ts`, which pins BOTH
forms — the broken one included, so nobody "simplifies" the template back to `[value]`.


## A lazy selector called INSIDE a `computed` throws NG0602

`FabricaDeRecursos.selector()` and its siblings are **lazy on purpose**: they create their
`httpResource` the first time they are called, so a screen only fetches the dropdowns it uses.
That means the call has a side effect — and `httpResource` uses an `effect` internally.

Call it from inside a `computed` and Angular throws
**`NG0602: effect() cannot be called from within a reactive context`**.

```ts
private readonly ubicaciones = this.organizacion.selectorUbicacionesActivas();   // yes
readonly talleres = computed(() => this.ubicaciones().filter(u => u.tipo === 3));

readonly talleres = computed(() =>                                               // no — NG0602
  this.organizacion.selectorUbicacionesActivas()().filter(u => u.tipo === 3));
```

**The symptom does not look like an exception.** It shipped in Mantenimiento on 2026-09-03: the
list rendered neither its rows nor its empty message — the section collapsed to its 2px border —
and the only trace was the console. `ng build` was clean and all 314 tests passed, because
nothing mounts these components against the real services. It was found by opening the screen.

The shape of the mistake is `selectorX()()` — two call pairs in a row, one to build and one to
read. **Grep for `selector[A-Za-z]*()()` before shipping a screen**; a lazy factory belongs in a
field, and only the reading `()` goes in the `computed`.

## A field disabled through the CONTROL disappears from `formulario.value`

Fourth of the reactive-form family, and the one that changes what the request sends.
`control.disable()` does not just grey the field: Angular **removes it from the group's value**,
so `getRawValue()` still has it but `value` does not — and a DTO built from the form sends the
key as `undefined`, which serializes to `null`.

That is exactly wrong when the field is read-only because the SERVER owns it. The equipment
file shows its location and refuses to move it (the API answers 409); disabling the control
would have made every save send `ubicacionId: null`, which the server reads as *an attempt to
move it out of every location*.

```html
<select formControlName="ubicacionId" [attr.disabled]="editando ? '' : null">  <!-- yes -->
```

```ts
this.formulario.controls.ubicacionId.disable();   // no — drops it from the payload
```

`[attr.disabled]` greys the field in the DOM, the control keeps its value, and the PUT still
carries the current location — which is what makes the server's "did you try to change it?"
check meaningful. Disable through the control only when the value genuinely should not be sent.

And prefer disabled over hidden for a field the server owns: whoever opens the record still
needs to see where the machine is.

## Pushing to a `FormArray` does NOT re-render — the array is mutated in place

Fifth of the reactive-form family, and it is a zoneless problem, not a forms one.
`FormArray.controls` returns **the same array instance every time**; `push()` and `removeAt()`
mutate it. With no zones and `OnPush`, iterating it directly means the new row is never drawn:

```html
@for (fila of formulario.controls.conceptos.controls; track $index) { … }   <!-- no -->
```

A `computed` around it is no better, and this is the part that costs an hour: `computed`
memoizes **by reference**, and the reference never changes — so the memo never invalidates.

```ts
// no — returns the identical array, so the computed never reports a change
protected readonly filas = computed(() => this.formulario.controls.conceptos.controls);
```

Keep a version signal, bump it on every add and remove, and return a **copy**:

```ts
private readonly version = signal(0);

protected readonly filas = computed(() => {
  this.version();                                        // explicit dependency
  return [...this.formulario.controls.conceptos.controls];  // a NEW reference
});

protected agregarFila(): void {
  this.formulario.controls.conceptos.push(this.filaEnBlanco());
  this.version.update((v) => v + 1);
}
```

In the template, `formArrayName` on the wrapper and `[formGroupName]="$index"` on each row —
bind by index, not by control instance.

An event handler on the same component does happen to schedule change detection, so a button
inside the template can look like it works by accident. It stops working the moment a row is
added from anywhere else — an effect, a resource arriving, a parent. The version signal is what
makes it correct rather than lucky.

Live in `paginas/empresa/cotizacion`: a quote line captures its N chargeable concepts as an
array, and the last row cannot be removed because the server rejects a line with none.

### And an effect must not read a computed that depends on what it writes

The sibling trap, found the day after. An effect that prefills those rows looked like this:

```ts
effect(() => {
  if (this.precios().length > 0 && this.conceptosIntactos()) {  // no — infinite loop
    this.ponerPrecios();          // bumps `version`, which `conceptosIntactos` reads
  }
});
```

`conceptosIntactos` is a `computed` over the version signal, and the prefill bumps that signal —
so the effect schedules itself, forever.

The fix is not `untracked()`: it is to read the **form** instead of the computed, because a
`FormControl` is not a signal and reading it creates no dependency.

```ts
if (this.precios().length > 0 && this.formulario.controls.conceptos.pristine) { … }  // yes
```

Keep the computed for the TEMPLATE, which does need to re-render. The rule generalizes: inside
an effect, read the plain object; expose the signal-backed view for the view.

And `pristine` is the right question for any prefill: it goes false when the **user** types and
stays true when code calls `setValue`, so a prefill can never clobber captured input — call
`markAsPristine()` after filling so the next prefill still works.

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

**Every alta/edición form is `disposicion/panel-lateral.ts`** — reuse it, do not write another.
It is a `<dialog>` + `showModal()` (focus trap, `aria-modal`, page inert, top layer, Escape —
all free) plus a `[pie]` slot for a footer that stays put while the body scrolls.

- **The `[pie]` is not optional.** Its container carries a `border-t`, so an empty slot paints a
  stray rule at the bottom of the panel. Every panel in the app has one, even if all it holds is
  a Close button.
- **Responsive lives in the utility, not in the screen.** `panel-lateral` in `src/styles.css` is
  full-width on a phone and 32rem from `sm`. A screen that wants a different width is asking for
  a different component, not one more `input()`.

**There WAS a draggable bottom sheet (`disposicion/hoja.ts`) and it was deleted on 2026-09-01.**
It was the plataforma pattern while the panel was the empresa one, on the argument that
plataforma's forms are short and have no table underneath competing for attention. Both halves
were false — the alta of a company has seven fields, and the companies list is exactly what the
sheet covered as it rose. The component, its CSS (`hoja-inferior`, `hoja-en-gesto`, its
`::backdrop`) and its six gesture tests went with it; they are in git history if a sheet is ever
needed again. Do not resurrect it for a form: use the panel.

**Undo the browser's `<dialog>` defaults one by one.** Three of them bit, none of them errors —
you only see something wrong, so always check the CLOSED state too:

- `display: none` on the closed dialog, which OUR `display: flex` overrides (same specificity,
  ours wins by order) → **the panel renders in the page while closed**. Write
  `&:not([open]) { display: none }`.
- `max-height: calc(100% - 6px - 2em)` → the panel is short and detached from the bottom.
- `max-width: calc(100% - 6px - 2em)` leaves a 38px gap on the right → `max-width: 100%`.

**The backdrop click is NOT free.** A modal `<dialog>` closes on Escape but IGNORES clicks on
its backdrop — you have to write it. Detect it by `target`, **never by coordinates**: a click
born from the KEYBOARD (Enter/Space on a button) arrives with `clientX`/`clientY` at **zero**,
so a geometric check reads it as "outside the panel" and **pressing any inner button by keyboard
closes the whole panel**. Compare `evento.target` against the dialog element.

**Never omit `(close)` on the dialog.** Escape is closed by the BROWSER without going through
your method; without listening the signal stays "open", the effect does not re-run, and the
button stops opening the panel forever.

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

See `docs/convenciones.md#capas-panel-lateral-y-globo-de-ayuda`.
