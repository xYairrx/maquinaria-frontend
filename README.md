# maquinaria-frontend

Frontend Angular del **Sistema Integral de Operación y Rentabilidad de Activos**, un SaaS multi-tenant
para empresas mexicanas de renta de maquinaria y equipo pesado. Consume la API del repo hermano
[`xYairrx/maquinaria-backend`](https://github.com/xYairrx/maquinaria-backend) (.NET 10).

Rama de trabajo: `develop`.

---

## Stack

Versiones **realmente instaladas** en `node_modules` al 2026-08-20 (verificadas contra disco, no contra `package.json`):

| Pieza | Rango en `package.json` | Instalado | Nota |
|---|---|---|---|
| Angular (`@angular/core`) | `^21.2.0` | **21.2.21** | Standalone + signals |
| Angular CLI / `@angular/build` | `^21.2.21` | **21.2.21** | Builder `@angular/build:application` (esbuild/Vite) |
| TypeScript | `~5.9.2` | 5.9.3 | `strict` + `strictTemplates` |
| RxJS | `~7.8.0` | 7.8.2 | |
| Tailwind CSS | `^4.1.12` | 4.3.3 | v4 vía `@tailwindcss/postcss`; **no** hay `tailwind.config.js` |
| Vitest | `^4.0.8` | 4.1.11 | Runner de pruebas unitarias |
| jsdom | `^28.0.0` | 28.1.0 | Entorno DOM de las pruebas |
| Prettier | `^3.8.1` | 3.9.6 | Configurado en `.prettierrc`, sin script propio |
| zone.js | — | **no instalado** | La aplicación es **zoneless** |

**La app es zoneless.** No hay dependencia de `zone.js`, `angular.json` no declara entrada `polyfills`,
y `src/app/app.config.ts` no necesita provider explícito: en Angular 21 es el comportamiento por omisión.
No agregar `zone.js` ni `provideZoneChangeDetection()`.

**Tailwind v4 sin archivo de configuración.** Todo el enganche son dos piezas:

```json
// .postcssrc.json
{ "plugins": { "@tailwindcss/postcss": {} } }
```

```css
/* src/styles.css */
@import 'tailwindcss';
```

La personalización de tema en v4 se hace con `@theme` en CSS, no con un `tailwind.config.js`.

### Discrepancia con la documentación de diseño

`maquinaria-backend/docs/01-arquitectura.md` §1 y `00-puesta-en-marcha.md` §1 dicen **Angular 22 / Angular CLI 22.1.4**.
En disco es **Angular 21.2.21**. Lo mismo con las versiones de la máquina: los docs registran Node v24.19.0 y npm 11.17.0;
la máquina tiene Node v24.11.1 y npm 11.6.2 (este último fijado en `packageManager`). Los docs también nombran los repos
como `maquinaria_back` / `maquinaria_front`, cuando los remotos reales son `maquinaria-backend` / `maquinaria-frontend`.
Ante duda, **gana el disco**; los docs están pendientes de corregir.

---

## Requisitos previos

| Herramienta | Versión | Verificar |
|---|---|---|
| Node.js | v24.11.1 (probado) | `node -v` |
| npm | 11.6.2 — fijado en `packageManager` de `package.json` | `npm -v` |
| Git | — | `git --version` |

El campo `"packageManager": "npm@11.6.2"` es normativo: usar npm, no pnpm ni yarn.

El Angular CLI global es opcional. Si no lo tienes instalado, usa `npx ng ...` o los scripts de npm.

Para trabajar contra la API se necesita además el SDK de .NET 10 y el repo del backend clonado como hermano
(ver [Integración con el backend](#integración-con-el-backend)). Para trabajo puramente de UI no hace falta.

---

## Instalación y arranque

```bash
git clone https://github.com/xYairrx/maquinaria-frontend.git
cd maquinaria-frontend
npm install
npm start
```

El dev server queda en `http://localhost:4200` con recarga en caliente.

Compilación de producción:

```bash
npm run build
```

Salida verificada: **`dist/maquinaria-frontend/browser`** (es la ruta que hay que configurar en Cloudflare Pages).
`angular.json` no declara `outputPath`, así que sale del nombre del proyecto. Nota que
`docs/01-arquitectura.md` línea 127 dice `dist/maquinaria-front/browser` — está desactualizado.

---

## Scripts disponibles

Solo estos cinco existen hoy en `package.json`:

| Script | Comando | Para qué |
|---|---|---|
| `npm start` | `ng serve` | Dev server en `:4200`, configuración `development` |
| `npm run build` | `ng build` | Build de producción (configuración por omisión) |
| `npm run watch` | `ng build --watch --configuration development` | Build incremental sin dev server |
| `npm test` | `ng test` | Pruebas unitarias con Vitest + jsdom |
| `npm run ng` | `ng` | Paso directo al CLI, p. ej. `npm run ng -- generate component x` |

No hay script de lint ni de formato, ni `e2e`, ni `api:sync`. Ver [Pendientes](#pendientes).

Budgets del build de producción (`angular.json`): `initial` avisa a 500 kB y falla a 1 MB;
`anyComponentStyle` avisa a 4 kB y falla a 8 kB. El bundle actual, todavía con la plantilla de bienvenida,
está en ~218 kB crudos.

---

## Estructura de carpetas

Árbol real del repo (sin `node_modules`, `dist` ni `.angular/cache`):

```
maquinaria-frontend/
├── .claude/
│   └── CLAUDE.md            # idéntico a AGENTS.md
├── .vscode/
│   ├── extensions.json      # recomienda angular.ng-template
│   ├── launch.json          # depuración en Chrome
│   ├── mcp.json             # servidor MCP del Angular CLI
│   └── tasks.json           # tareas npm: start / test
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── app.config.ts    # provideRouter + provideBrowserGlobalErrorListeners
│   │   ├── app.css          # vacío
│   │   ├── app.html         # plantilla de bienvenida de Angular (placeholder)
│   │   ├── app.routes.ts    # routes: Routes = []
│   │   ├── app.spec.ts
│   │   └── app.ts           # componente App
│   ├── index.html
│   ├── main.ts              # bootstrapApplication(App, appConfig)
│   └── styles.css           # @import 'tailwindcss'
├── .editorconfig
├── .gitignore
├── .postcssrc.json
├── .prettierrc
├── AGENTS.md
├── angular.json
├── package.json
├── tsconfig.json            # base, con strict y strictTemplates
├── tsconfig.app.json
└── tsconfig.spec.json       # types: ["vitest/globals"]
```

Todavía no existen `src/app/core/`, `src/app/features/`, `src/app/shared/` ni `src/environments/`.
La convención de organización por feature se define al construir el shell (ver [Estado actual](#estado-actual)).

---

## Integración con el backend

### Estado real: no existe todavía

Hay que decirlo claro para que nadie busque lo que no está. **Hoy no hay ni una línea de integración con la API.**
Verificado en disco, no existe:

- `src/environments/` ni ningún archivo de configuración por ambiente
- `proxy.conf.json` ni configuración `proxyConfig` en `angular.json`
- `provideHttpClient()` en `src/app/app.config.ts`
- interceptores (JWT, refresh, errores, tenant)
- `src/app/core/api/` ni cliente HTTP generado
- script `api:sync` en `package.json`

Todo lo que sigue es el diseño acordado, no código existente.

### Puertos y documento OpenAPI

| Pieza | URL |
|---|---|
| Dev server de Angular | `http://localhost:4200` |
| API, perfil `http` | `http://localhost:5123` |
| API, perfil `https` | `https://localhost:7020` (además expone `:5123`) |
| Documento OpenAPI | `/openapi/v1.json` — **solo en Development** |

Los dos perfiles están en `maquinaria-backend/src/Maquinaria.Api/Properties/launchSettings.json`.
`Program.cs` llama `AddOpenApi()` siempre y `MapOpenApi()` únicamente cuando el entorno es Development,
así que en producción el documento no se sirve.

Para levantar la API en local, desde el repo del backend:

```bash
dotnet run --project src/Maquinaria.Api --launch-profile https
```

### Contrato: cliente generado y commiteado

Regla de `docs/01-arquitectura.md` §10.6a. .NET 10 expone OpenAPI de forma nativa
(`Microsoft.AspNetCore.OpenApi`, sin Swashbuckle) y el front consume ese documento:

```
npm run api:sync    →  genera src/app/core/api/ desde /openapi/v1.json
```

Los archivos generados **se versionan en este repo**. Dos razones, y ambas importan:

1. El front compila sin necesitar el backend corriendo.
2. Cualquier cambio de contrato aparece como un *diff* revisable en el historial del front.
   Es el sustituto práctico del commit atómico que dos repos independientes no permiten.

El script `api:sync` **aún no existe** y la herramienta generadora es una **decisión abierta**.

### Evolución del contrato: expandir → migrar → contraer

Regla de `docs/01-arquitectura.md` §10.6b. Con despliegues independientes, un cambio incompatible rompe
producción durante la ventana entre un deploy y el otro. Nunca se cambia un contrato de golpe:

| Paso | Repo | Acción |
|---|---|---|
| 1. Expandir | backend | Agrega el campo o endpoint nuevo. **Conserva el viejo** |
| 2. Migrar | frontend | Regenera el cliente y adopta lo nuevo |
| 3. Contraer | backend | Recién ahora elimina lo viejo |

La regla en una línea: **cada despliegue debe ser compatible con la versión actualmente desplegada del otro repo.**
Renombrar un campo y actualizar el front "al mismo tiempo" no existe; uno de los dos despliegues llega primero.

Convención de trazabilidad (§10.6c): referenciar desde el commit del front el issue del back que le corresponde.

### Dominios en producción y la cookie del refresh token

| Subdominio | Servicio |
|---|---|
| `app.tudominio.com` | Cloudflare Pages (este repo) |
| `api.tudominio.com` | Railway (la API, proxied) |

No es cosmética: son subdominios del **mismo dominio registrable a propósito**. El refresh token viaja en cookie
`HttpOnly` — **nunca** en `localStorage`, donde cualquier XSS lo roba — y al compartir dominio registrable la cookie
se emite para `.tudominio.com` y funciona con `SameSite=Lax`.

**No usar los dominios por omisión** de Pages y Railway (`*.pages.dev`, `*.up.railway.app`): son dominios
registrables distintos, la cookie sería de terceros y obligaría a `SameSite=None`, que los navegadores
restringen cada vez más. El dominio concreto todavía no se ha registrado.

### Login: tres campos

La pantalla de ingreso pide **Empresa** (el `slug` del tenant), correo y contraseña (§10.5).

El tercer campo es obligatorio por arquitectura, no por preferencia de interfaz: cada empresa tiene **su propia base
de datos**, así que hay que saber en cuál buscar antes de validar nada.

Consecuencias que el front debe respetar:

- **Un solo mensaje de error.** Nunca distinguir entre empresa inexistente, correo inexistente y contraseña
  incorrecta: distinguir regala la lista de clientes.
- **No hay registro público.** Los tenants los da de alta un superadministrador y los usuarios se crean por
  invitación con token de un solo uso. No debe existir pantalla de alta propia.

### Permisos

Los permisos son cadenas `modulo.accion` (`equipos.editar`, `rentas.autorizar`, `reportes.exportar`), se resuelven
al iniciar sesión y viajan en el JWT (§6). Son una matriz `Usuario → Rol → Permiso`, no un enum de roles, y cada
tenant tiene sus propios roles a partir de una semilla de 9. El front debe autorizar contra la cadena de permiso,
nunca contra el nombre del rol.

### Interceptores previstos

JWT, refresh automático, manejo de errores y `tenant` (§9). Ninguno existe todavía.

---

## Convenciones de código

Las reglas del repo están en **`AGENTS.md`**, y `.claude/CLAUDE.md` es **byte a byte el mismo archivo**
(ambos vienen del preset de instrucciones para IA del Angular CLI). Si se cambia uno, hay que cambiar el otro.

Lo más operativo:

**Componentes**
- Standalone siempre; **no** poner `standalone: true` en el decorador — es el valor por omisión desde v20.
- `changeDetection: ChangeDetectionStrategy.OnPush` en todo `@Component`.
- `input()` / `output()` como funciones, no `@Input()` / `@Output()`.
- Plantilla inline para componentes pequeños. Con archivos externos, rutas relativas al `.ts`.
- Componentes chicos y con una sola responsabilidad.

**Estado**
- Signals para estado local; `computed()` para estado derivado.
- Sobre signals se usa `set` o `update`, nunca `mutate`.
- Sin NgRx hasta que exista evidencia de que se necesita (`docs/01-arquitectura.md` §9).

**Plantillas**
- Control flow nativo `@if` / `@for` / `@switch`, no `*ngIf` / `*ngFor` / `*ngSwitch`.
- Bindings `class` y `style`; **no** `ngClass` ni `ngStyle`.
- Sin lógica compleja en la plantilla. No asumir globales como `new Date()`.
- Pipe `async` para observables.

**Directivas y host**
- **Prohibidos** `@HostBinding` y `@HostListener`; las bindings de host van en el objeto `host` del decorador.

**Servicios**
- Una responsabilidad por servicio, `providedIn: 'root'` para singletons.
- `inject()` en lugar de inyección por constructor.

**Formularios y ruteo**
- Formularios **reactivos**, no template-driven.
- **Lazy loading por ruta de feature.** Con 30 módulos previstos, un bundle único es inviable.

**Imágenes**
- `NgOptimizedImage` para toda imagen estática (no aplica a base64 inline).

**Accesibilidad** (requisito, no aspiración)
- Debe pasar todos los checks de AXE.
- WCAG AA como mínimo: manejo de foco, contraste de color y atributos ARIA.

**TypeScript**
- Tipado estricto; inferencia cuando el tipo es obvio.
- Evitar `any`; usar `unknown` cuando el tipo es incierto.
- Flags activos en `tsconfig.json`: `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
  `noImplicitReturns`, `noFallthroughCasesInSwitch`, `isolatedModules`.
  Compilador de Angular: `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`.

**Nomenclatura**
- Dominio en español, igual que el backend: `Equipo`, `Renta`, `Cotizacion`, `Horometro`.

**Formato**
- `.editorconfig`: UTF-8, 2 espacios, salto de línea final, sin espacios al final.
- `.prettierrc`: `printWidth` 100, comillas simples, parser `angular` para HTML.

**Herramientas del editor**
- `.vscode/mcp.json` registra el **servidor MCP del Angular CLI** (`npx -y @angular/cli mcp`), útil para
  que asistentes de código consulten la API real de la versión instalada en lugar de adivinar.
- `.vscode/extensions.json` recomienda `angular.ng-template` (Angular Language Service).

---

## Estado actual

Este repo es **scaffolding de `ng new` con un solo commit** (`095311b initial commit`). No hay código de negocio.
Lo que hay, tal como está:

- `src/app/app.routes.ts` — vacío: `export const routes: Routes = [];`
- `src/app/app.html` — sigue siendo la **página de bienvenida de Angular**, con sus comentarios
  `<!-- ... is only a placeholder ... -->`, un `<style>` inline, el logo en SVG y los enlaces a angular.dev.
- `src/app/app.css` — vacío.
- `src/app/app.config.ts` — solo `provideBrowserGlobalErrorListeners()` y `provideRouter(routes)`.
- `src/app/app.spec.ts` — 2 pruebas, **ambas pasan hoy** (`npm test` en verde, Vitest 4.1.11).
- `src/styles.css` — el comentario del CLI y `@import 'tailwindcss'`.

### Pendientes

Ordenados de "rompe algo" a "hay que decidirlo".

**Se van a romper al avanzar**

1. **`app.spec.ts` se rompe al borrar la plantilla de bienvenida.** La segunda prueba, `should render title`,
   afirma `expect(compiled.querySelector('h1')?.textContent).toContain('Hello, maquinaria-frontend')`, y ese
   texto vive en `app.html` (`<h1>Hello, {{ title() }}</h1>`). Al reemplazar la plantilla hay que reescribir
   la prueba, no borrarla.
2. **`.vscode/launch.json` tiene un target de test obsoleto.** La configuración `ng test` apunta a
   `http://localhost:9876/debug.html`, que es de Karma. Este proyecto usa Vitest y ese puerto no existe.
   Hay que arreglarla o quitarla.

**Incumplimientos de `AGENTS.md` en el código actual**

3. El componente `App` (`src/app/app.ts`) viola dos reglas del propio repo: no declara
   `changeDetection: ChangeDetectionStrategy.OnPush`, y usa `templateUrl` / `styleUrl` externos siendo un
   componente trivial (además con `app.css` vacío). Es como lo genera el CLI; hay que corregirlo al escribir
   el shell real.

**Internacionalización y metadatos**

4. `src/index.html` declara `lang="en"`. El sistema es para México: debe ser `lang="es-MX"`.
5. El `<title>` de `src/index.html` sigue siendo `MaquinariaFrontend`.
6. No hay locale de Angular configurado (`es-MX`) para fechas, números y moneda. El backend guarda todo en UTC
   con zona horaria de presentación **por tenant**, así que el formateo del front tiene que respetar esa zona,
   no la del navegador.

**Falta de tooling**

7. **Sin linter.** No hay ESLint ni `angular-eslint` instalados, ni script `lint`.
8. **Prettier instalado pero sin script.** Hay `.prettierrc` y el binario en `node_modules`, pero ni `format`
   ni `format:check`, así que el formato no se verifica en ningún punto.
9. **Sin CI.** No hay workflows de GitHub Actions ni gate de build/test en los PR.
10. **Sin pruebas end-to-end.** Angular CLI no trae framework de e2e; la elección es una decisión abierta.

**Integración con la API**

11. Falta todo lo de [Integración con el backend](#integración-con-el-backend): `provideHttpClient()`,
    `src/environments/`, los cuatro interceptores, el script `api:sync` y el cliente generado.
12. **Falta decidir CORS o proxy.** `maquinaria-backend/src/Maquinaria.Api/Program.cs` hoy no configura CORS
    (solo `AddOpenApi()` y `UseHttpsRedirection()`), así que `:4200` → `:5123` sería cross-origin. Las dos
    salidas son un `proxy.conf.json` en el dev server de Angular o CORS explícito en la API; **decisión abierta**.

**Producto**

13. Falta el shell de la Fase 0 completo: layout, login de tres campos, guards, interceptores y navegación
    (`docs/03-plan-desarrollo.md` §2 y §4, paso 13).
14. Falta el sistema de diseño sobre Tailwind v4: tokens con `@theme`, tipografía, paleta con contraste WCAG AA.
15. El dominio de producción no está registrado, así que la configuración de Cloudflare Pages está pendiente.

---

## Plan de desarrollo

Se trabaja en **rebanadas verticales**: cada módulo se termina de punta a punta antes de pasar al siguiente
(`docs/03-plan-desarrollo.md` §1).

```
Entidad → Migración → Caso de uso → Endpoint → Pruebas → Pantalla Angular → Funciona
```

No "todo el backend y luego todo el frontend": con 30 módulos, esa separación son seis meses sin nada demostrable.

| Fase | Alcance | Lo que aporta el front |
|---|---|---|
| **0 — Fundación** | Multi-tenancy, aprovisionamiento, auth | Shell: layout, login, guards, interceptores, navegación |
| **1 — Núcleo** | Equipos, clientes, obras, tarifas, disponibilidad, cotizaciones, rentas | Pantallas del ciclo cotizar → aprobar → rentar → cerrar |
| **2 — Operación** | Contratos, logística, inspecciones, evidencias, horómetros, daños | Captura con fotografías |
| **3 — Taller** | Mantenimiento, órdenes de trabajo, refacciones, compras | |
| **4 — Finanzas** | Pagos, cobranza, CFDI, rentabilidad | Reportes |
| **5 — Campo** | PWA con offline, sincronización, GPS, firmas, QR | La fase más difícil del front |
| **6 — Inteligencia** | Predicción, pricing dinámico, analítica | Requiere histórico real |

Al cerrar la Fase 1 el sistema **ya es vendible**. Dashboard, notificaciones y reportes no son fases:
cada fase agrega los suyos al cerrar.

La PWA offline de la Fase 5 se diseña desde ahora: los IDs se generan en el cliente (de ahí uuid v7)
y hay resolución de conflictos.

---

## Documentación de diseño

La documentación vive en el repo del backend, en `maquinaria-backend/docs/`. **No está en la raíz del contenedor.**

| Documento | Qué contiene |
|---|---|
| `docs/README.md` | Índice y "lo mínimo que hay que saber" |
| `docs/00-puesta-en-marcha.md` | Herramientas, versiones, Neon, bitácora del entorno |
| `docs/01-arquitectura.md` | Stack, multi-tenancy, capas, permisos (§6), frontend (§9), despliegue y contrato de API (§10) |
| `docs/02-modelo-datos.md` | 75 entidades de los 30 módulos |
| `docs/03-plan-desarrollo.md` | Rebanadas verticales, fases 0 a 6 |
| `docs/04-pendientes.md` | Huecos de especificación, decisiones de producto, riesgos |
| `docs/05-esquema-fase0.md` | DDL de la Fase 0, aprovisionamiento, login |

Para trabajar en este repo, los que importan son **§9, §10.5 y §10.6 de `01-arquitectura.md`** (frontend, login
y contrato de API), **§6** (permisos) y **`03-plan-desarrollo.md`**.

Son documentos vivos: se actualizan en el mismo commit que el código, no después. Y tampoco son infalibles —
ver la [discrepancia de versiones](#discrepancia-con-la-documentación-de-diseño) de arriba. Cuando el disco y el
documento no coinciden, gana el disco y se corrige el documento.
