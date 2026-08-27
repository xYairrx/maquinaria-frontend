# Plan de la Fase 1 — frontend de empresa

> **Este documento manda sobre qué pantallas se construyen y en qué orden.** El alcance del
> producto está en `maquinaria-backend/docs/06-alcance-fase1.md` y el plan del backend en
> `07-plan-fase1.md`; aquí está la mitad que falta: las pantallas de la aplicación de
> empresa.
>
> Escrito el **2026-08-27**, después de verificar el backend endpoint por endpoint contra el
> repo y contra la API corriendo. Donde un documento de diseño y el disco no coinciden,
> **gana el disco** y se anota la divergencia.

---

## 0. Dónde vamos — al 2026-08-27

**Pasos 1, 2 y 3a del orden de construcción (§7) cerrados: los siete catálogos y Ubicaciones.**
Ocho pantallas de empresa, todas con el mismo molde de §8.

| Pantalla | Ruta | Módulo del permiso | Filtros propios, además de texto y activo |
|---|---|---|---|
| Marcas | `/marcas` | `equipos` | — |
| Categorías | `/categorias` | `equipos` | — |
| Tipos | `/tipos` | `equipos` | `CategoriaEquipoId` |
| Modelos | `/modelos` | `equipos` | `MarcaId` |
| Tarifas | `/tarifas` | `rentas` | `AplicaRenta`, `AplicaVenta`, `Unidad` |
| Cláusulas | `/clausulas` | `contratos` | `Obligatoria` |
| Puestos | `/puestos` | `usuarios` | — |
| Ubicaciones | `/ubicaciones` | `sucursales` | `Tipo` |

Todos los filtros van al SERVIDOR; ninguna pantalla trae el catálogo entero para recortarlo
en memoria.

### Lo verificado en el navegador, no supuesto

Alta, edición, retiro con confirmación, búsqueda con retardo, paginación, los mensajes de
vacío según el filtro que lo causó, el 409 con el texto del servidor, **0 violaciones de axe**
y la columna fijada aguantando un desplazamiento real de 500 px.

### Lo que sigue, en orden

1. **Trabajadores** (`/trabajadores`, módulo `usuarios`). Cuelga de puesto y de ubicación, que
   ya existen. Cierra el paso 3.
2. **Clientes y Proveedores** (paso 4). Ojo: sus dos servicios del backend hacen N+1, ver la
   tabla de abajo.
3. **Equipos y su expediente** (paso 5).

### Estado del backend, por pantalla que falta

De 33 servicios, 13 escribían su proyección como método y EF la evaluaba en el CLIENTE. Cinco
ya están arreglados. **Los ocho que quedan van a estorbar en este orden:**

| Paso | Pantalla | Servicio | Qué pasa |
|---|---|---|---|
| 4 | Clientes | `ServicioClientesEf` | N+1, no truena |
| 4 | Proveedores | `ServicioProveedoresEf` | N+1, no truena |
| 5 | Expediente de equipo | `ServicioDocumentosEquipoEf` | **truena** |
| 7 | Cotizaciones | `ServicioCotizacionesEf` | **truena** |
| 8 | Rentas | `ServicioRentasEf` | **truena** |
| 9 | Contratos | `ServicioContratosEf` | **truena** |
| 10 | Órdenes de compra | `ServicioOrdenesCompraEf` | **truena** |
| 10 | Órdenes de venta | `ServicioOrdenesVentaEf` | **truena** |

«Truena» es `NullReferenceException` **en cuanto la tabla tenga una fila**, no antes: con cero
filas el `Select` no corre sobre nada y todo parece bien. El arreglo y su razonamiento están en
`maquinaria-backend/docs/guias/estado-y-pendientes.md`, sección «Las proyecciones se evaluaban
en el cliente».

**El criterio acordado: se corrige cada uno cuando se llega a su pantalla**, no en una barrida.
El backend se armó sin frontend delante, así que cada pantalla nueva destapa lo suyo, y
arreglarlo con la pantalla a la vista es lo que permite comprobar que quedó bien.

### Cuatro trampas que ya costaron una depuración cada una

Están escritas completas en `AGENTS.md`; aquí solo para no repetirlas:

1. **`tsc --noEmit` no revisa plantillas de Angular.** Verificar con `ng build`. Una clave de
   diccionario faltante pasó el typecheck, dejó `ng serve` sin poder reconstruir, y durante un
   rato el navegador sirvió código viejo mientras parecía que las correcciones no hacían nada.
2. **`[ngValue]` y no `[value]`** en un `<option>` cuyo valor no sea texto.
3. **`<input type="number">` mete un `number` en el control, y `null` al vaciarse** — nunca
   cadena vacía, se declare como se declare.
4. **Un `computed` / `effect` / `httpResource` solo rastrea SEÑALES.** Leer
   `form.getRawValue()` o una propiedad normal lo deja congelado sin avisar. Ya pasó dos veces.

### Cómo levantar el entorno

```bash
cd maquinaria-frontend && npm ci && npx ng serve
```

La API va aparte, en el 5123. El front la busca ahí y el tenant sale del subdominio, así que
se entra por `http://<slug>.localhost:4200` —hoy `prueba`—, no por `localhost:4200`.

Comprobación antes de dar por buena una pantalla: `npx ng build` (revisa plantillas),
`npx ng test --watch=false` y abrirla en el navegador.

---

## 1. Qué se entrega

El criterio de salida no lo fija este documento, lo fija el alcance de la fase:

> El ciclo completo **cotizar → aprobar → rentar → cerrar** funciona, y es **imposible
> rentar dos veces el mismo equipo en fechas traslapadas**.

La segunda mitad ya está garantizada por el motor —el constraint `EXCLUDE` sobre
`ocupacion_equipo`— y el frontend no la implementa: la **muestra**. Cuando la API conteste
`409`, la pantalla tiene que decir por qué de forma que se entienda, no repetir la
validación.

**El panel de superadministración queda fuera de este plan.** Está construido y no es
responsabilidad de esta fase.

---

## 2. Punto de partida, verificado el 2026-08-27

### Backend

| Medida | Valor |
|---|---|
| Endpoints | **136** en 30 controladores MVC |
| Compilación | 0 errores, 0 advertencias |
| Pruebas | **339** en verde |
| Migraciones | 5 en la central, 8 en las de empresa |

Las once rebanadas de la Fase 1 están escritas. El backend **no bloquea** al frontend en
nada, salvo los dos huecos de §3.

### Frontend

| Medida | Valor |
|---|---|
| Pruebas | **148** en 10 archivos |
| Componentes | 26, todos `OnPush`, ninguno con HTML en el `.ts` |
| Aplicaciones | 3, por subdominio |

La Fase 0 está cerrada: accesos, guards, interceptores de token y refresco, i18n en dos
idiomas, armazones y navegación. El panel de plataforma está en pie.

**La aplicación de empresa tiene UNA pantalla**: `/inicio`. Nada más.

### El hueco, en números

| | |
|---|---|
| Endpoints que el front consume hoy | **19** — 11 de plataforma, 8 de autenticación |
| Endpoints **sin una sola pantalla** | **117** |

Esos 117 son este plan.

---

## 3. Dos huecos del backend que este plan no puede rodear

Ninguno de los dos es un error del backend: son documentos de alcance que quedaron
desactualizados. Se anotan aquí porque **cambian lo que se puede construir**.

### 3.1 Usuarios y permisos no tiene API de empresa

`06-alcance-fase1.md` §2 lo marca **Construido** e `inicio.ts` lo declara en
`IMPLEMENTADOS`. Verificado contra el repo:

```
¿endpoints /api/usuarios, /api/roles, /api/permisos?  →  NINGUNO
```

Las tablas existen —`usuario`, `rol`, `rol_permiso`, `usuario_rol`, sembradas por
`EmpresaSemillaSeguridad`— pero **ningún controlador las expone**. Lo único que hay es
`GET /api/mi/sesion` y aceptar una invitación.

Consecuencia concreta: **hoy solo el superadministrador puede meter usuarios a una
empresa**, desde `/api/plataforma/empresas/{slug}/invitacion`. Un administrador de empresa
no puede invitar a nadie, ni listar a su gente, ni asignar roles.

Es el pendiente que `04-pendientes.md` dejó abierto —"falta definir si el permiso
`usuarios.crear` viene activo desde el inicio"—. El permiso existe en la matriz; el
endpoint no.

**Qué hacer:** no construir la pantalla de usuarios en esta fase, y **corregir
`IMPLEMENTADOS` en `inicio.ts`**, que hoy dice `new Set(['usuarios'])` mientras
`rutas-empresa.ts` no registra ninguna ruta `/usuarios`. Ese conjunto miente en la única
pantalla que existe.

### 3.2 Las obras de los clientes no existen

`06-alcance-fase1.md` §2 dice que M4 Clientes incluye "contactos, domicilios y **obras**".
No hay entidad `Obra`, no hay tabla `obra`, y `ClientesController` son cinco endpoints de
CRUD plano.

**Qué hacer:** la pantalla de clientes es un CRUD simple. Si el negocio necesita obras, es
una rebanada nueva del backend, no un ajuste del front.

---

## 4. El mapa: 9 módulos, 18 pantallas, 117 endpoints

Lo que gobierna la visibilidad del menú no es la pantalla sino la **clave de módulo**, y esa
relación **no es uno a uno**: una clave desbloquea varias pantallas. Es la intersección que
aplica `nucleo/sesion/acceso.ts`:

```
permisos del rol  ∩  módulos del plan del tenant
```

| Clave de módulo | Pantallas que desbloquea | Endpoints |
|---|---|---|
| `equipos` | Marcas · Modelos · Tipos · Categorías · Equipos · Transferencias | 48 |
| `rentas` | Tarifas · Rentas | 20 |
| `contratos` | Cláusulas · Contratos | 12 |
| `compras` | Órdenes de compra · Órdenes de venta | 14 |
| `usuarios` | Puestos · Trabajadores | 10 |
| `clientes` | Clientes | 5 |
| `proveedores` | Proveedores | 5 |
| `cotizaciones` | Cotizaciones | 7 |
| `disponibilidad` | Disponibilidad | 4 |
| `sucursales` | Ubicaciones | 5 |

Nótese que **no existen las claves `catalogos`, `tarifas`, `trabajadores` ni
`ubicaciones`**. Los siete catálogos se reparten entre `equipos`, `contratos`, `usuarios` y
`rentas`; ubicaciones vive bajo `sucursales`. Poner una clave inventada en `menuEmpresa()`
oculta la opción para siempre, porque no coincide con ningún `modulo.clave` de la base
central.

### 4.1 Las pantallas, por forma

**Siete catálogos, un solo molde.** Mismo verbo, misma forma, mismo `PATCH {id}/activo`:

```
GET    /api/catalogos/<recurso>              lista paginada
GET    /api/catalogos/<recurso>/{id}         una fila
POST   /api/catalogos/<recurso>              alta
PUT    /api/catalogos/<recurso>/{id}         edición
PATCH  /api/catalogos/<recurso>/{id}/activo  retirar / reactivar
```

Los recursos: `marcas`, `modelos-equipo`, `tipos-equipo`, `categorias-equipo`, `tarifas`,
`clausulas`, `puestos`.

**Se parecen en la FORMA de sus operaciones, no en sus campos.** `AltaMarca` tiene un solo
campo —su identidad *es* el nombre, con `UNIQUE` encima—, `categoria_equipo` tiene código,
nombre y descripción, y `modelo_equipo` cuelga de dos llaves foráneas. **No abstraer un
componente genérico de catálogo con un solo ejemplo escrito**; ver §10.5 del plan del
backend.

**Cuatro CRUD con estado:** Ubicaciones, Trabajadores, Clientes y Proveedores. Igual que un
catálogo pero con más campos, y con `PATCH {id}/estado` en lugar de `/activo` en Clientes y
Trabajadores.

**Equipos: lista más expediente.** Seis endpoints propios y dos recursos anidados —cuatro de
documentos y tres de tarifas—. El expediente es una pantalla de detalle, no una hoja.

**Comercial: maestro-detalle con máquina de estados.**

| Pantalla | Endpoints | Lo que la hace distinta |
|---|---|---|
| Cotizaciones | 7 | Líneas que se agregan y quitan una por una, más `PATCH {id}/estado` |
| **Rentas** | **15** | **Cinco procesos**: confirmar, extender, cerrar, cancelar y crear desde cotización. Líneas *y* conceptos, que son dos colecciones distintas |
| Contratos | 7 | Cláusulas que se enganchan del catálogo, más `GET por-renta/{rentaId}` |

**Rentas es el entregable de la fase.** Es la pantalla más grande del plan y la que cierra el
criterio de salida.

**Disponibilidad:** un calendario. `GET /api/disponibilidad` y
`GET /api/disponibilidad/equipos/{id}`, más alta y baja de bloqueos. Es donde el `409` del
`EXCLUDE` se vuelve visible.

**Compra y venta:** dos pantallas simétricas. Orden → detalles → `PATCH estado` →
`POST finalizacion`.

---

## 5. Los tres contratos que habla toda pantalla

Están en `Maquinaria.Aplicacion/ObjetosDTO/Comun/`. Escribirlos una vez en el front y
reusarlos evita que la tercera pantalla tenga su propia forma de decir "página 2".

### 5.1 Filtro — la cadena de consulta de todo listado

```
?texto=cat&activo=true&incluirEliminados=false&numero=1&tamano=50&orden=nombre&descendente=false
```

| Campo | Regla |
|---|---|
| `texto` | Búsqueda libre. Cada módulo decide sobre qué columnas aplica |
| `activo` | **Nulo trae activos e inactivos**, que no es lo mismo que `false` |
| `incluirEliminados` | Exige el permiso `.eliminar` del módulo |
| `numero` | **Base 1**, como lo cuenta la gente |
| `tamano` | Por defecto 50, **techo 200** |
| `orden` | Se valida contra lista blanca en el servidor; un valor no reconocido cae al orden por defecto |

El techo de 200 no es preferencia de interfaz, es la defensa del servidor. La pantalla no
debe ofrecer "mostrar todos".

### 5.2 Pagina — lo que devuelve

```ts
{ filas: T[]; numero: number; tamano: number; total: number; paginas: number }
```

`total` es el conteo **completo** de filas que cumplen el filtro, no las de esta página.
Cuesta un `COUNT` extra y se paga a propósito: sin él no se puede pintar "51-100 de 3,842"
ni el último botón del paginador.

Una página vacía es **200 con `filas: []`**, nunca un 404.

### 5.3 RazonRechazo — los tres códigos que hay que distinguir

| Razón | HTTP | Cuándo | Qué hace la pantalla |
|---|---|---|---|
| `Invalido` | **400** | Dato mal capturado | Marcar el campo |
| `NoEncontrado` | **404** | La fila no existe o está borrada | Aviso y volver a la lista |
| `Conflicto` | **409** | Choca con el estado o con una garantía del motor | **Explicar el choque.** Es el caso del no-traslape |

Los tres llegan como `ProblemDetails`; el texto sale de `detail` y **no se traduce en el
front** —está redactado en el servidor para ser uniforme—. Ver la regla en `AGENTS.md`.

**El 409 merece trato propio en las pantallas de renta y disponibilidad.** Un "Error al
guardar" convierte la mejor garantía del producto en un fallo genérico.

---

## 6. api:sync — HECHO el 2026-08-27

Se hizo **antes de la primera pantalla**, no después. Cierra los pendientes 13, 14 y 18.

### Qué herramienta, y por qué

| Herramienta | Genera | Veredicto |
|---|---|---|
| **`openapi-typescript` 7.13.0** | **Solo tipos** | **Elegida** |
| `orval` | Tipos más hooks y servicios | Descartada |
| `@openapitools/openapi-generator-cli` | Servicios Angular con `HttpClient` | Descartada |
| `ng-openapi-gen` | Servicios Angular | Descartada |

Las tres descartadas generan **servicios con `HttpClient` y Observables**, y eso pelea de
frente con las convenciones de este repo: el `httpResource` vive en el servicio, se exponen
`Signal<T>`, hay recursos compartidos que se piden una sola vez, `undefined` significa "no
pidas todavía" y el refresco va serializado. Código generado no sabe nada de eso, y mantener
las dos capas cuesta más que escribir la delgada a mano.

**Lo que hacía falta no era un cliente generado: era que los contratos de datos dejaran de
escribirse a mano.** `api.ts` se queda como está.

### Los dos archivos, y por qué son dos

| Archivo | Qué es |
|---|---|
| `nucleo/api/**generado.ts**` | Salida cruda de la máquina, ~9,100 líneas. **El nombre es la advertencia**: no se edita nunca |
| `nucleo/api/contratos.ts` | La superficie curada, a mano. Re-exporta con nombres del dominio: `export type Marca = components['schemas']['MarcaDto']` |

Las pantallas importan de `contratos.ts`, nunca de `generado.ts`. Así los nombres son los del
producto y **un renombre del backend rompe en un solo archivo**.

Se descartó el flag `--root-types`: produce 134 alias con prefijo `Schema` —`SchemaMarcaDto`,
`SchemaAltaMarca`— que nadie quiere escribir. Los alias curados se agregan a `contratos.ts`
conforme los pide cada pantalla.

Los flags que sí van: `--immutable`, porque `contratos.ts` usa `readonly` en todo, y
`--alphabetize`, para que un cambio de contrato salga como diff limpio, que es el propósito.

### Los comandos

```
npm run api:sync    genera nucleo/api/generado.ts desde la API corriendo
npm run api:check   verifica que esté al día SIN escribir. Para el gate de CI (pendiente 9)
```

`/openapi/v1.json` **solo se sirve en Development**, así que los dos exigen la API levantada.

### El documento venía mal, y se arregló en el backend

Al generar por primera vez, los tipos salieron débiles. Medido contra el documento real:

| Defecto | Alcance | Qué producía |
|---|---|---|
| Numéricos como unión | **279 campos** | `readonly modelos: number \| string` |
| Enums sin sus valores | **15 tipos** | `EstadoRenta = number`. Nada impedía mandar `99` |

Ninguno era un error del modelo ni de los controladores: `AddOpenApi()` se llamaba **pelado**,
sin transformadores, y esos son sus valores por defecto. Con 18 pantallas por delante, dejarlo
significaba un `Number(...)` o un `as` repartido por todas ellas — y perder la seguridad de
tipos justo en las máquinas de estados, que son el corazón de la fase.

Se corrigió con un transformador de esquema en el backend,
`Maquinaria.Api/Arranque/EsquemaOpenApi.cs`, que colapsa `type: ["integer","string"]` a
`integer` y escribe los valores de cada enum con su descripción. Resultado:

```
campos `number | string` :  279  →  0
EstadoRenta              :  number  →  1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
```

Y con la descripción de cada valor en el propio tipo:
`1 = Borrador · 2 = Confirmada · 3 = PorEntregar · …`

**Lo que sigue sin arreglar:** los DTO de escritura salen con todos sus campos opcionales
—`AltaMarca = { nombre?: string }`— porque son `readonly record struct` y .NET no los marca
requeridos. Se anota y no se arregla: a diferencia de los otros dos, no contamina las lecturas
y el formulario valida antes de enviar.

---

## 7. Orden de construcción

Sigue las dependencias reales, no el orden alfabético del menú. Es el mismo orden de las
rebanadas R2 a R11 del backend, y por la misma razón: cada pantalla necesita que existan los
catálogos que su formulario consulta.

| # | Pantalla | Estado | Depende de | Por qué en este lugar |
|---|---|---|---|---|
| **1** | **Marcas** | **hecha** | — | **Define el patrón de pantalla de módulo.** Cinco endpoints, un campo |
| 2 | Los otros seis catálogos | **hechas** | 1 | Mismo molde |
| 3 | Ubicaciones · Trabajadores | Ubicaciones **hecha** | 2 (puestos) | Trabajador cuelga de puesto |
| 4 | Clientes · Proveedores | — | — | CRUD independiente |
| 5 | Equipos y su expediente | — | 2, 3 | Su formulario consulta marca, modelo, tipo, categoría y ubicación |
| 6 | Disponibilidad · Transferencias | — | 5 | Sin equipos no hay calendario |
| 7 | Cotizaciones | — | 4, 5, 2 (tarifas) | Cliente, equipos y conceptos cobrables |
| 8 | **Rentas** | — | 7 | **Cierra el criterio de salida** |
| 9 | Contratos | — | 8, 2 (cláusulas) | Cuelgan de una renta |
| 10 | Órdenes de compra y de venta | — | 4, 5 | Proveedor y equipo |

**El paso 1 es el que importa.** Define cómo se ve una pantalla de módulo en este producto
—tabla responsiva, hoja de alta, filtros, paginación y manejo de los tres códigos— y las
diecisiete siguientes lo copian. Vale la pena hacerlo despacio.

**Al terminar el 8 el producto es vendible.** Los pasos 9 y 10 aumentan su valor.

---

## 8. El patrón canónico de una pantalla de módulo

### 8.1 Los cuatro archivos que se tocan siempre

Está en `AGENTS.md` y en `convenciones.md#el-andamiaje-de-una-pantalla-nueva`. **Los cuatro
o ninguno**, porque faltar el 3 o el 4 no compila —que es la red— y faltar el 2 dibuja una
opción que rebota al `path: '**'`:

1. La ruta en `rutas-empresa.ts`, dentro de `children`, con su `loadComponent`
2. La línea en `menuEmpresa()` con la **clave de módulo de §4**, no una inventada
3. `titulos.<clave>` en los **dos** bloques de idioma de `textos.ts`
4. `menu.<clave>`, también en los dos

Los textos `menu.operacion`, `menu.equipos`, `menu.clientes` y `menu.rentas` **ya están en el
diccionario**, sin uso, esperando su pantalla. Se retiraron del menú el 2026-08-25 junto con
sus rutas inexistentes; vuelven con ellas.

### 8.2 Lo que la pantalla NO hace

- **No dibuja su `<h1>` ni su cabecera.** Publica datos en el servicio `Barra` desde un
  `effect`. Una pantalla, un solo `<h1>`, y lo pinta el armazón
- **No pone el `httpResource` en el componente.** Va en el servicio, `providedIn: 'root'`, y
  se exponen señales. Un recurso en el componente es una petición por instancia
- **No traduce el `detail` de un `ProblemDetails`**
- **No repite una validación que el servidor ya hace.** La comprobación previa no sirve bajo
  concurrencia; el constraint sí

### 8.3 Lo que sí lleva, sin excepción

- **`OnPush` y plantilla en un `.html` hermano.** Ni un `template:` de una línea
- **Responsiva desde el primer commit**, verificada a 375, 768 y 1280. La tabla ancha **fija
  su primera columna** y scrollea dentro de su caja; el `<body>` nunca scrollea de lado
- **Esqueleto de carga**, nunca un "Cargando…". Y si cambia la tabla, cambia el esqueleto
- **El vacío dice POR QUÉ está vacío.** Un solo texto miente en cuanto hay filtros: con el
  chip de «retiradas» puesto y ninguna, «todavía no hay marcas» es falso e invita a crear
  algo cuando lo que toca es quitar el filtro. Tres mensajes: búsqueda —con el término
  dentro—, filtro —diciendo cómo salir— y el vacío de verdad, que es el único que lleva la
  llamada a la acción. El contexto de la barra cuenta lo mismo que la lista: «0 retiradas»,
  no «0 marcas»
- **Cada texto por `t()`**, con los dos idiomas llenos
- **La hoja inferior de `disposicion/hoja.ts` para el alta.** Ya existe y está probada: no
  escribir otra

### 8.3.bis Verificado en el navegador — 2026-08-27

Las cuatro primeras pantallas se auditaron **contra la aplicación corriendo**, no por lectura
del código. Método: navegador integrado con la sesión de una empresa real, medición del DOM
con JavaScript y `axe-core` 4.10.2 inyectado en la página.

**Responsivo**, a los tres anchos que exige la regla:

| Ancho | Resultado |
|---|---|
| 375 | El `<body>` NO se desplaza en horizontal; la caja de la tabla sí (560 > 342). Cero elementos desbordando fuera de ella. Cero enfocables fuera de pantalla — el cajón se oculta de verdad, no solo se traslada |
| 768 | Sin desbordes; la tabla de 4 columnas cabe sin desplazamiento |
| 1280 | Sin desbordes; menú en columna fija |

**La columna fijada**, con desplazamiento real de 200 px: se queda en `left: 17`, fondo
`rgb(255,255,255)` opaco, su filete derecho, y `elementFromPoint` confirma que nada se
transparenta por debajo.

**Accesibilidad — `axe-core`, reglas `wcag2a` + `wcag2aa` + `wcag21a` + `wcag21aa` +
`best-practice`:**

```
Marcas 375                  0 violaciones · 38 aprobadas
Marcas 375 + hoja abierta   0 violaciones · 21 aprobadas
Tipos + hoja abierta        0 violaciones · 41 aprobadas
Categorías 768              0 violaciones · 37 aprobadas
```

**La hoja inferior**, midiendo tras `getAnimations().forEach(a => a.finish())` —sin eso se
mide la animación a medias, que es la trampa anotada en `convenciones.md`—: 375 de 375 de
ancho **sin hueco a la derecha**, pegada al fondo (0 px), solo las esquinas de arriba
redondeadas, `translate: 0px` —nunca negativo, que es lo que fija `hoja.spec.ts`— y
`max-height` 324.8 px, el 40 % del anclaje pedido.

**El diálogo de confirmación:** foco inicial en **Cancelar** (con su `autofocus`), foco de
vuelta al disparador al cerrar (WCAG 2.4.3), y cerrar sin elegir **no ejecuta la acción**.

> **Una nota de método.** La primera medición del foco dio un falso positivo: parecía que el
> foco caía en el `<dialog>` en lugar de en Cancelar. Era contaminación de la propia prueba
> —en la misma llamada se cerró la hoja inferior justo antes, y su restauración de foco pisó
> al diálogo—. Al aislar el caso, el comportamiento es correcto. **Una medición que toca dos
> capas a la vez no prueba nada de ninguna.**

### 8.4 Definición de terminado

Una pantalla está lista cuando:

1. Sus endpoints se consumen por un servicio con tipos **generados**, no escritos a mano
2. Lista con búsqueda, filtro de activos y paginación contra `Filtro` y `Pagina`
3. Distingue 400, 404 y 409, y el 409 dice qué chocó
4. Tiene esqueleto que refleja su forma real
5. Se ve bien a 375, 768 y 1280
6. Sus dos idiomas están completos
7. Pasa AXE sin incidencias
8. Los cuatro archivos de §8.1 están tocados

---

## 9. Fuera de alcance, dicho para que nadie lo busque

- **Usuarios, roles y permisos** — no hay API (§3.1)
- **Obras de cliente** — no hay modelo (§3.2)
- **Dashboard** — es transversal: cada fase agrega sus indicadores al cerrar
- Logística, inspecciones, evidencias, horómetros, taller, pagos, facturación,
  notificaciones, reportes, QR y subrentas — Fase 2 en adelante
- **PWA y offline** — Fase 5. Pero los identificadores se generan en el cliente desde ahora
  (uuid v7), que es lo que la hace posible después
- **Interceptor de errores** — pendiente 11 del front. Hoy cada pantalla llama a
  `mensajeDeError` a mano; con 18 pantallas conviene cerrarlo, pero no bloquea

---

## 10. Divergencias detectadas al escribir este plan

| Documento dice | Realidad en el repo |
|---|---|
| `06-alcance-fase1.md` §2: M25 Usuarios y permisos "Construido" | Sin endpoints de empresa (§3.1) |
| `06-alcance-fase1.md` §2: M4 Clientes incluye "obras" | No existe la entidad ni la tabla (§3.2) |
| `inicio.ts`: `IMPLEMENTADOS = new Set(['usuarios'])` | No hay ruta `/usuarios` |
| `01-arquitectura.md` §10.6a: se genera el **cliente HTTP** y se commitea | Se generan **solo los tipos**; `api.ts` sigue a mano. Desviación consciente, razonada en §6 |
| `01-arquitectura.md` §10.6a: el cliente va en `src/app/core/api/` | Va en `src/app/nucleo/api/`. No existe `core/` en este repo |

**Cerrada en esta revisión:** `api:sync` no existía y los tipos estaban escritos a mano. Hoy
existe, junto con `api:check`, y el documento OpenAPI del backend se corrigió para que valga
la pena generarlos (§6).

Cuando el disco y el documento no coinciden, **gana el disco** y se corrige el documento.
