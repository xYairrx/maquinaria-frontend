# Maquinaria — Frontend

Frontend Angular del **Sistema Integral de Operación y Rentabilidad de Activos**, un SaaS multi-tenant para empresas mexicanas de renta de maquinaria y equipo pesado.

Consume la API del repo hermano [`maquinaria-backend`](https://github.com/xYairrx/maquinaria-backend) (.NET 10). Rama de trabajo: `develop`.

> **Estado: tres aplicaciones en pie, separadas por subdominio.** `admin.<dominio>` es la superadministración, `<slug>.<dominio>` la aplicación de una empresa y el dominio pelado el portal de entrada. Cada una con su armazón y su menú lateral. Ver [estado y pendientes](docs/estado-y-pendientes.md).

## Stack

Versiones realmente instaladas en `node_modules` al 2026-08-25, verificadas contra disco:

| Pieza | Rango | Instalado |
|---|---|---|
| Angular (`@angular/core`) | `^21.2.0` | **21.2.21** |
| Angular CLI / `@angular/build` | `^21.2.21` | **21.2.21** |
| TypeScript | `~5.9.2` | 5.9.3 |
| RxJS | `~7.8.0` | 7.8.2 |
| Tailwind CSS | `^4.1.12` | 4.3.3 |
| Vitest | `^4.0.8` | 4.1.11 |
| jsdom | `^28.0.0` | 28.1.0 |
| Prettier | `^3.8.1` | 3.9.6 |
| zone.js | — | **no instalado** |

Cuatro cosas que conviene saber antes de tocar código: la app es **zoneless**, Tailwind es **v4 sin `tailwind.config.js`**, el builder es `@angular/build:application` (esbuild/Vite) y **ningún componente lleva HTML dentro del `.ts`** — todo el marcado va en un `.html` hermano con `templateUrl`. El detalle está en [convenciones](docs/convenciones.md).

> Los documentos de diseño dicen **Angular 22**; en disco es **21.2.21**. Esa y otras divergencias están listadas en [estado y pendientes](docs/estado-y-pendientes.md#divergencias-con-los-documentos-de-diseño). Ante duda, gana el disco.

## Requisitos

| Herramienta | Versión | Verificar |
|---|---|---|
| Node.js | v24.11.1 (probado) | `node -v` |
| npm | 11.6.2 — fijado en `packageManager` | `npm -v` |
| Git | — | `git --version` |

El campo `"packageManager": "npm@11.6.2"` es normativo: usar npm, no pnpm ni yarn. El Angular CLI global es opcional; si no lo tienes, usa `npx ng ...` o los scripts de npm.

Para trabajo puramente de UI no hace falta el backend. Para trabajar contra la API, ver [integración con el backend](docs/integracion-backend.md).

## Arrancar

```bash
git clone https://github.com/xYairrx/maquinaria-frontend.git
cd maquinaria-frontend
npm install
npm start
```

El dev server queda en `http://localhost:4200` con recarga en caliente. **Qué aplicación
ves depende del anfitrión**: `localhost:4200` es el portal, `admin.localhost:4200` la
superadministración y `bajio.localhost:4200` la empresa `bajio`. Chrome y Edge resuelven
`*.localhost` solos, sin tocar el archivo `hosts`.

## Scripts

Solo estos cinco existen hoy:

| Script | Comando | Para qué |
|---|---|---|
| `npm start` | `ng serve` | Dev server en `:4200`, configuración `development` |
| `npm run build` | `ng build` | Build de producción |
| `npm run watch` | `ng build --watch --configuration development` | Build incremental sin dev server |
| `npm test` | `ng test` | Pruebas unitarias con Vitest + jsdom — hoy **116 en 9 archivos, todas pasan** |
| `npm run ng` | `ng` | Paso directo al CLI, p. ej. `npm run ng -- generate component x` |

No hay script de lint, formato, `e2e` ni `api:sync`.

La salida del build es **`dist/maquinaria-frontend/browser`** — la ruta que hay que configurar en Cloudflare Pages. `angular.json` no declara `outputPath`, así que sale del nombre del proyecto. Budgets: `initial` avisa a 500 kB y falla a 1 MB.

El paquete inicial de hoy es **373.59 kB crudos / 103.85 kB transferidos**, cómodamente por debajo del aviso. Cada pantalla va en su propio chunk perezoso, así que lo que crece con una pantalla nueva no es esta cifra.

## Estructura

```
maquinaria-frontend/
├── docs/                       # guías de este repo
├── public/                     # favicon, fotografía del panel de marca, banderas
├── src/
│   ├── app/
│   │   ├── app.config.ts        # providers: router, http, título de pestaña
│   │   ├── app.routes.ts        # elige el árbol de rutas según el subdominio
│   │   ├── rutas-empresa.ts     # <slug>.<dominio>
│   │   ├── rutas-plataforma.ts  # admin.<dominio>
│   │   ├── rutas-portal.ts      # el dominio pelado y login.<dominio>
│   │   ├── nucleo/              # ambiente/ · api/ · sesion/
│   │   ├── disposicion/         # armazones y menú lateral
│   │   └── paginas/             # acceso/ · empresa/ · plataforma/ · portal/
│   ├── index.html
│   ├── main.ts                  # bootstrapApplication(App, appConfig)
│   └── styles.css               # fuentes, Tailwind v4 y los tokens de @theme
├── AGENTS.md                    # reglas del repo (idéntico a .claude/CLAUDE.md)
├── angular.json
├── .postcssrc.json
└── tsconfig.json                # strict y strictTemplates
```

No hay `src/app/core/`, `features/`, `shared/` ni `src/environments/`: la configuración de
ambiente es un solo archivo, `nucleo/ambiente/configuracion.ts`. El desglose carpeta por
carpeta está en [estado y pendientes](docs/estado-y-pendientes.md#cómo-está-organizado-srcapp).

## Guías

| Guía | Para qué |
|---|---|
| [Integración con el backend](docs/integracion-backend.md) | Puertos, OpenAPI, cliente generado, dominios, acceso por subdominio, permisos |
| [Sistema de diseño](docs/sistema-de-diseno.md) | Menú lateral, barra superior, tarjetas, tablas y accesos. La referencia visual del producto |
| [Convenciones de código](docs/convenciones.md) | Las reglas de `AGENTS.md` en forma operativa, zoneless y Tailwind v4 |
| [Estado y pendientes](docs/estado-y-pendientes.md) | Qué hay en disco, los 17 pendientes, las fases y las divergencias con los docs |
| [Plan de la Fase 1](docs/plan-fase1-front.md) | **Qué pantallas se construyen y en qué orden.** El mapa de los 117 endpoints sin interfaz, los contratos de listado y el patrón de pantalla de módulo |

## Cómo se trabaja

Por **rebanadas verticales**: cada módulo se termina de punta a punta antes de pasar al siguiente.

```
Entidad → Migración → Caso de uso → Endpoint → Pruebas → Pantalla Angular → Funciona
```

No "todo el backend y luego todo el frontend". Las fases están en [estado y pendientes](docs/estado-y-pendientes.md#plan-de-desarrollo).

## Documentación de diseño

Vive en el repo del backend, en `maquinaria-backend/docs/`. **No está en la raíz del contenedor.**

Para trabajar en este repo los que importan son **§9, §10.5 y §10.6 de `01-arquitectura.md`** (frontend, login y contrato de API), **§6** (permisos) y **`03-plan-desarrollo.md`**. El índice completo está en el [README del backend](https://github.com/xYairrx/maquinaria-backend#documentación-de-diseño).
