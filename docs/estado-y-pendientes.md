# Estado y pendientes

Última verificación: 2026-08-20.

## Estado actual

Este repo es **scaffolding de `ng new` con un solo commit** (`095311b initial commit`). No hay código de negocio. `npm test` pasa 2/2 y `npm run build` genera ~218 kB crudos, todavía con la plantilla de bienvenida.

Lo que hay, tal como está:

- `src/app/app.routes.ts` — vacío: `export const routes: Routes = [];`
- `src/app/app.html` — sigue siendo la **página de bienvenida de Angular**, con sus comentarios `<!-- ... is only a placeholder ... -->`, un `<style>` inline, el logo en SVG y los enlaces a angular.dev
- `src/app/app.css` — vacío
- `src/app/app.config.ts` — solo `provideBrowserGlobalErrorListeners()` y `provideRouter(routes)`
- `src/app/app.spec.ts` — 2 pruebas, ambas pasan hoy
- `src/styles.css` — el comentario del CLI y `@import 'tailwindcss'`

Todavía no existen `src/app/core/`, `src/app/features/`, `src/app/shared/` ni `src/environments/`. La convención de organización por feature se define al construir el shell.

---

## Pendientes

Ordenados de "rompe algo" a "hay que decidirlo".

### Se van a romper al avanzar

1. **`app.spec.ts` se rompe al borrar la plantilla de bienvenida.** La segunda prueba, `should render title`, afirma `expect(compiled.querySelector('h1')?.textContent).toContain('Hello, maquinaria-frontend')`, y ese texto vive en `app.html` (`<h1>Hello, {{ title() }}</h1>`). Al reemplazar la plantilla hay que **reescribir** la prueba, no borrarla.
2. **`.vscode/launch.json` tiene un target de test obsoleto.** La configuración `ng test` apunta a `http://localhost:9876/debug.html`, que es de Karma. Este proyecto usa Vitest y ese puerto no existe. Hay que arreglarla o quitarla.

### Incumplimientos de AGENTS.md en el código actual

3. El componente `App` (`src/app/app.ts`) viola dos reglas del propio repo: no declara `changeDetection: ChangeDetectionStrategy.OnPush`, y usa `templateUrl` / `styleUrl` externos siendo un componente trivial (además con `app.css` vacío). Es como lo genera el CLI; hay que corregirlo al escribir el shell real.

### Internacionalización y metadatos

4. `src/index.html` declara `lang="en"`. El sistema es para México: debe ser `lang="es-MX"`.
5. El `<title>` de `src/index.html` sigue siendo `MaquinariaFrontend`.
6. No hay locale de Angular configurado (`es-MX`) para fechas, números y moneda. El backend guarda todo en UTC con zona horaria de presentación **por tenant**, así que el formateo del front tiene que respetar esa zona, no la del navegador.

### Falta de tooling

7. **Sin linter.** No hay ESLint ni `angular-eslint` instalados, ni script `lint`.
8. **Prettier instalado pero sin script.** Hay `.prettierrc` y el binario en `node_modules`, pero ni `format` ni `format:check`, así que el formato no se verifica en ningún punto.
9. **Sin CI.** No hay workflows de GitHub Actions ni gate de build/test en los PR.
10. **Sin pruebas end-to-end.** Angular CLI no trae framework de e2e; la elección es una decisión abierta.

### Integración con la API

11. Falta todo lo de [integración con el backend](integracion-backend.md): `provideHttpClient()`, `src/environments/`, los cuatro interceptores, el script `api:sync` y el cliente generado.
12. **Falta decidir CORS o proxy.** La API hoy no configura CORS, así que `:4200 → :5123` sería cross-origin. Ver [integración con el backend](integracion-backend.md#cors-o-proxy-decisión-abierta).
13. **La herramienta generadora del cliente OpenAPI no está elegida** en ningún documento. No solo falta el script: falta decidir con qué se genera.

### Producto

14. Falta el shell de la Fase 0 completo: layout, login de tres campos, guards, interceptores y navegación (`03-plan-desarrollo.md` §2 y §4, paso 13).
15. Falta el sistema de diseño sobre Tailwind v4: tokens con `@theme`, tipografía, paleta con contraste WCAG AA.
16. El dominio de producción no está registrado, así que la configuración de Cloudflare Pages está pendiente.

---

## Plan de desarrollo

Se trabaja en **rebanadas verticales**: cada módulo se termina de punta a punta antes de pasar al siguiente (`03-plan-desarrollo.md` §1).

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

Al cerrar la Fase 1 el sistema **ya es vendible**. Dashboard, notificaciones y reportes no son fases: cada fase agrega los suyos al cerrar.

La PWA offline de la Fase 5 se diseña desde ahora: los IDs se generan en el cliente (de ahí uuid v7) y hay resolución de conflictos.

---

## Divergencias con los documentos de diseño

Los documentos de `maquinaria-backend/docs/` son especificación, no inventario. Diferencias detectadas al 2026-08-20:

| Documento dice | Realidad en disco |
|---|---|
| Angular 22 / Angular CLI 22.1.4 | **Angular 21.2.21** |
| Node v24.19.0, npm 11.17.0 | Node v24.11.1, npm 11.6.2 |
| Repos `maquinaria_back` / `maquinaria_front` | `maquinaria-backend` / `maquinaria-frontend` |
| Salida del build `dist/maquinaria-front/browser` (§10, línea 127) | **`dist/maquinaria-frontend/browser`** |
| Checklist marca el frontend como "Angular 22 listo" | Es Angular 21 y solo scaffolding |

Cuando el disco y el documento no coinciden, **gana el disco** y se corrige el documento.
