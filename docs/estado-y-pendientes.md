# Estado y pendientes

Última verificación: 2026-08-24.

## Estado actual

El repo ya **no** es scaffolding. Son **tres aplicaciones separadas por subdominio**, con
su árbol de rutas, su armazón y su menú, sobre 11 commits (`HEAD` en `0144c89`).

Verificado en disco hoy:

| Medida | Valor |
|---|---|
| Pruebas | **39 en 2 archivos**, todas pasan (`npx ng test --watch=false`) |
| Componentes | **17**, todos con `OnPush`, y **17** `.html` hermanos |
| Plantillas dentro de un `.ts` | **cero** (`grep -rn "template:" src/` no devuelve nada) |
| Build de producción | **290.25 kB** crudos / **80.18 kB** transferidos, más 17 chunks diferidos |
| Salida | `dist/maquinaria-frontend/browser` |

La plantilla de bienvenida de Angular ya no existe: `src/app/app.html` es
`<router-outlet />` y `app.css` se borró.

### Las tres aplicaciones

`src/app/app.routes.ts` no registra rutas: exporta `rutasDelAnfitrion()`, que **elige**
un árbol según el anfitrión. No hay un guard tapando rutas ajenas — esas rutas
sencillamente no se registran, igual que el backend aísla por base de datos.

| Anfitrión | Aplicación | Árbol |
|---|---|---|
| `admin.<dominio>` | Superadministración | `rutas-plataforma.ts` |
| `<slug>.<dominio>` | La empresa `<slug>` | `rutas-empresa.ts` |
| `<dominio>`, `login.<dominio>` | Portal de entrada | `rutas-portal.ts` |

Se resuelve una vez al arrancar: el anfitrión no cambia sin recargar, y cambiar de
empresa es cambiar de origen.

### Cómo está organizado `src/app/`

| Carpeta | Qué hay |
|---|---|
| `nucleo/ambiente/` | `configuracion.ts`, `tenant.ts` (+ `tenant.spec.ts`), `sitio.ts`, `titulo-pagina.ts` |
| `nucleo/api/` | `api.ts`, `api-plataforma.ts`, `contratos.ts`, `contratos-plataforma.ts`, `mensaje-error.ts` |
| `nucleo/sesion/` | `sesion.ts`, `sesion-plataforma.ts`, `acceso.ts` (+ `acceso.spec.ts`), `guard-sesion.ts`, `guard-plataforma.ts`, `interceptor-token.ts` |
| `disposicion/` | `disposicion-empresa`, `disposicion-plataforma`, `menu-lateral`, `opciones-menu.ts` |
| `paginas/acceso/` | Piezas compartidas del acceso: `marco-acceso`, `campo-contrasena`, `selector-idioma`, `bandera`, `ilustracion-acceso` |
| `paginas/empresa/` | `iniciar-sesion`, `aceptar-invitacion`, `solicitar-restablecimiento`, `restablecer-contrasena`, `inicio` |
| `paginas/plataforma/` | `iniciar-sesion`, `empresas` |
| `paginas/portal/` | `seleccionar-empresa` |

Cada pantalla se renombró por **lo que se hace en ella**. **Las URL no cambiaron**:
`/entrar`, `/invitacion`, `/recuperar`, `/restablecer`, `/inicio`, `/empresas`.

No existen `src/app/core/`, `features/`, `shared/` ni `src/environments/`: la
configuración de ambiente es un solo archivo, `nucleo/ambiente/configuracion.ts`.

### Regla de código que rige desde ahora

**Ningún componente lleva HTML dentro del `.ts`.** Ni una plantilla en línea, ni un
`template:` de una sola línea: todo el marcado va en un `.html` hermano referenciado con
`templateUrl`. Está escrita en [`AGENTS.md`](../AGENTS.md) (idéntico a
`.claude/CLAUDE.md`) y desarrollada en [convenciones](convenciones.md). Hoy se cumple en
los 17 componentes.

### Qué funciona de punta a punta

- **Acceso de empresa sin tercer campo.** La empresa sale del subdominio
  (`tenantActual()`), no del formulario: son **dos campos**, correo y contraseña.
- **Restablecimiento de contraseña completo**, en dos pantallas (`/recuperar` y
  `/restablecer`), contra los endpoints nuevos de la API.
- **Armazones con menú lateral**, uno por aplicación. El menú es **datos**
  (`opciones-menu.ts`) y se filtra por la intersección **permisos del rol ∩ módulos del
  plan**; los grupos que quedan vacíos desaparecen. La superadministración no filtra por
  módulos: el superadministrador no contrata plan.
- **Marco de acceso a dos columnas** compartido por las pantallas sin sesión, campo de
  contraseña con botón de mostrar y selector de idioma.
- **Sistema de color y tipografía** en `src/styles.css` con `@theme` de Tailwind v4:
  tokens nombrados por papel, Lato y Merriweather, y el contraste WCAG anotado al lado
  de cada token.
- **`sitio.ts`** centraliza el nombre del producto, el corte de la marca en dos colores,
  la descripción y el idioma.
- **`TituloPagina`** compone el título de la pestaña como «pantalla · producto».

---

## Pendientes

Ordenados de "rompe algo" a "hay que decidirlo".

### Incoherencias en disco

1. **El `<title>` de `src/index.html` no coincide con `sitio.nombre`.** El archivo dice
   `Maquinaria` y `nucleo/ambiente/sitio.ts` dice `RETROMAQ`. `index.html` es HTML
   estático y no puede leer `sitio.ts` — el propio archivo lo advierte en un
   comentario —, así que la sincronización es manual y hoy está rota. Solo se ve el
   primer instante, hasta que el router navega, pero es el nombre que sale al compartir
   la pestaña.
2. **`.vscode/launch.json` tiene un target de test obsoleto.** La configuración `ng test`
   apunta a `http://localhost:9876/debug.html`, que es de Karma. Este proyecto usa Vitest
   y ese puerto no existe. Hay que arreglarla o quitarla.
3. **Dos `.svg.original` sin commitear en `public/`**
   (`flag-mx-svgrepo-com.svg.original` y
   `flag-for-flag-us-outlying-islands-svgrepo-com.svg.original`): son los originales de
   las banderas antes de limpiarlas. Hay que decidir si se versionan o se borran, no
   dejarlos indefinidamente como *untracked*.
4. **Dos SVG de excavadora que ya nadie usa**: `excavator-svgrepo-com.svg` y
   `excavator-bulldozer-svgrepo-com.svg`. La ilustración del acceso es
   `excavadora.webp`, referenciada desde `src/styles.css`. Los dos SVG no aparecen en
   ningún archivo de `src/` y aun así se copian al build.

### Internacionalización y metadatos

5. **El selector de idioma no traduce nada.** La lista, el estado y las banderas están;
   el inglés aparece porque se pidió dejar la interfaz montada antes de conectarla.
   Falta lo de fondo: **elegir librería de i18n**, traducir los textos y recordar la
   preferencia entre visitas. Hoy `elegir()` solo cambia lo que muestra el propio
   selector.
6. **No hay locale de Angular configurado** (`es-MX`) para fechas, números y moneda: no
   hay `LOCALE_ID` ni `registerLocaleData` en `src/`. El backend guarda todo en UTC con
   zona horaria de presentación **por tenant**, así que el formateo del front tiene que
   respetar esa zona, no la del navegador.

### Falta de tooling

7. **Sin linter.** No hay ESLint ni `angular-eslint` instalados, ni script `lint`.
8. **Prettier instalado pero sin script.** Hay `.prettierrc` y el binario en
   `node_modules` (3.9.6), pero ni `format` ni `format:check`, así que el formato no se
   verifica en ningún punto.
9. **Sin CI.** No hay workflows de GitHub Actions ni gate de build/test en los PR. Ahora
   que hay 39 pruebas, es justo lo que falta para que sirvan de red.
10. **Sin pruebas end-to-end.** Angular CLI no trae framework de e2e; la elección sigue
    siendo una decisión abierta.
11. **Cobertura desigual.** Las 39 pruebas están en `nucleo/ambiente/tenant.spec.ts` y
    `nucleo/sesion/acceso.spec.ts` — lógica pura —. Ningún componente, ningún guard y
    ningún interceptor tienen prueba.

### Integración con la API

> El grueso ya corre: `provideHttpClient()`, el interceptor de token, los dos guards y
> las dos sesiones separadas por llave. El inventario está en
> [integración con el backend](integracion-backend.md). Lo que sigue en esta lista es lo
> que falta.

12. **Falta el interceptor de refresco de token.** El login ya devuelve token de
    refresco y se guarda, pero nadie lo usa: cuando el token de 15 minutos caduca hay
    que volver a entrar.
13. **Falta `api:sync`.** Los tipos de `nucleo/api/contratos.ts` y
    `contratos-plataforma.ts` están **escritos a mano**. El plan sigue siendo generarlos
    desde `/openapi/v1.json` y commitear el resultado, para que un cambio de contrato
    salga como diff en la revisión y no como error en tiempo de ejecución.
14. **La herramienta generadora del cliente OpenAPI no está elegida** en ningún
    documento. No solo falta el script: falta decidir con qué se genera.
15. **El token de refresco vive en `localStorage`**, no en cookie `HttpOnly`. Es una
    divergencia consciente con el diseño y hay que resolverla antes de producción; está
    explicada en
    [integración con el backend](integracion-backend.md#dominios-en-producción-y-la-cookie-del-refresh-token)
    y no se repite aquí.

### Producto

16. **Las pantallas de los módulos son la Fase 1 en adelante.** El menú de empresa hoy
    solo tiene el inicio; el andamiaje para agregar una pantalla ya está: una entrada en
    `rutas-empresa.ts` y una línea en `MENU_EMPRESA` con su clave de módulo.
17. **El dominio de producción no está registrado**, así que la configuración de
    Cloudflare Pages sigue pendiente. La ruta de salida que hay que darle es
    `dist/maquinaria-frontend/browser`.

### Cerrados desde la revisión anterior

Se listan para que nadie los reabra: `lang="es-MX"` en `index.html`, la prueba
`app.spec.ts` que se rompía al quitar la plantilla de bienvenida — desapareció con
ella —, el componente `App` sin `OnPush`, la integración HTTP, la **decisión de CORS**
(CORS explícito en la API, no proxy en el dev server), el **shell completo de la Fase 0**
y el **sistema de diseño sobre Tailwind v4**. El `<title>` de `index.html` se corrigió en
su momento y se ha vuelto a desincronizar: es el pendiente 1.

---

## Plan de desarrollo

Se trabaja en **rebanadas verticales**: cada módulo se termina de punta a punta antes de
pasar al siguiente (`03-plan-desarrollo.md` §1).

```
Entidad → Migración → Caso de uso → Endpoint → Pruebas → Pantalla Angular → Funciona
```

No "todo el backend y luego todo el frontend": con 26 módulos, esa separación son seis
meses sin nada demostrable.

| Fase | Alcance | Lo que aporta el front |
|---|---|---|
| **0 — Fundación** | Multi-tenancy, aprovisionamiento, auth | Shell: layout, login, guards, interceptores, navegación |
| **1 — Núcleo** | Equipos, clientes, obras, tarifas, disponibilidad, cotizaciones, rentas | Pantallas del ciclo cotizar → aprobar → rentar → cerrar |
| **2 — Operación** | Contratos, logística, inspecciones, evidencias, horómetros, daños | Captura con fotografías |
| **3 — Taller** | Mantenimiento, órdenes de trabajo, refacciones, compras | |
| **4 — Finanzas** | Pagos, cobranza, CFDI, rentabilidad | Reportes |
| **5 — Campo** | PWA con offline, sincronización, GPS, firmas, QR | La fase más difícil del front |
| **6 — Inteligencia** | Predicción, pricing dinámico, analítica | Requiere histórico real |

La Fase 0 del front **está en pie**: armazones, accesos, guards, interceptor de token y
navegación. Para cerrarla del todo falta el interceptor de refresco (pendiente 12).

Al cerrar la Fase 1 el sistema **ya es vendible**. Dashboard, notificaciones y reportes
no son fases: cada fase agrega los suyos al cerrar.

La PWA offline de la Fase 5 se diseña desde ahora: los IDs se generan en el cliente (de
ahí uuid v7) y hay resolución de conflictos.

---

## Divergencias con los documentos de diseño

Los documentos de `maquinaria-backend/docs/` son especificación, no inventario.
Diferencias detectadas al 2026-08-24:

| Documento dice | Realidad en disco |
|---|---|
| Angular 22 / Angular CLI 22.1.4 | **Angular 21.2.21** (CLI y `@angular/build`, también 21.2.21) |
| Node v24.19.0, npm 11.17.0 | Node v24.11.1, npm 11.6.2 |
| Repos `maquinaria_back` / `maquinaria_front` | `maquinaria-backend` / `maquinaria-frontend` |
| Salida del build `dist/maquinaria-front/browser` (§10, línea 127) | **`dist/maquinaria-frontend/browser`** |
| Checklist marca el frontend como "Angular 22 listo" | Es Angular 21, pero ya no es scaffolding: tres aplicaciones en pie |
| Login con tres campos, incluido el identificador de empresa | **Dos campos**: la empresa sale del subdominio |
| Organización por feature en `core/` / `features/` / `shared/` | `nucleo/` + `disposicion/` + `paginas/` agrupadas por aplicación |
| `src/environments/` con reemplazo de archivos por configuración | Un solo archivo, `nucleo/ambiente/configuracion.ts` |
| Cliente de API generado desde OpenAPI | `contratos.ts` escrito **a mano**; `api:sync` no existe (pendiente 13) |
| Refresh token en cookie `HttpOnly` | En `localStorage` (pendiente 15) |

Cuando el disco y el documento no coinciden, **gana el disco** y se corrige el documento.
