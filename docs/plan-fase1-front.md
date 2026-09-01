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

| Pantalla       | Ruta              | Módulo del permiso | Filtros propios, además de texto y activo      |
| -------------- | ----------------- | ------------------ | ---------------------------------------------- |
| Marcas         | `/marcas`         | `equipos`          | —                                              |
| Categorías     | `/categorias`     | `equipos`          | —                                              |
| Tipos          | `/tipos`          | `equipos`          | `CategoriaEquipoId`                            |
| Modelos        | `/modelos`        | `equipos`          | `MarcaId`                                      |
| Tarifas        | `/tarifas`        | `rentas`           | `AplicaRenta`, `AplicaVenta`, `Unidad`         |
| Cláusulas      | `/clausulas`      | `contratos`        | `Obligatoria`                                  |
| Puestos        | `/puestos`        | `usuarios`         | —                                              |
| Ubicaciones    | `/ubicaciones`    | `sucursales`       | `Tipo`                                         |
| Trabajadores   | `/trabajadores`   | `usuarios`         | `Estado`, `PuestoId`, `UbicacionId`            |
| Proveedores    | `/proveedores`    | `proveedores`      | —                                              |
| Clientes       | `/clientes`       | `clientes`         | `Estado`                                       |
| Equipos        | `/equipos`        | `equipos`          | `Estado`, `UbicacionId`, `Proposito`           |
| Expediente     | `/equipos/:id`    | `equipos`          | detalle: documentos y precios                  |
| Traspasos      | `/traspasos`      | `equipos`          | `EquipoId`, `UbicacionId`                      |
| Disponibilidad | `/disponibilidad` | `disponibilidad`   | periodo OBLIGATORIO + tipo, ubicación, cliente |

Todos los filtros van al SERVIDOR; ninguna pantalla trae el catálogo entero para recortarlo
en memoria.

### Lo verificado en el navegador, no supuesto

Alta, edición, retiro con confirmación, búsqueda con retardo, paginación, los mensajes de
vacío según el filtro que lo causó, el 409 con el texto del servidor, **0 violaciones de axe**
y la columna fijada aguantando un desplazamiento real de 500 px.

### El menú lateral pasó a acordeón — 2026-08-28

Las ocho pantallas colgaban de un encabezado fijo, «CATÁLOGOS». Ahora son dos grupos
plegables, cada uno con su icono y su galón:

| Grupo            | Pantallas                                                   |
| ---------------- | ----------------------------------------------------------- |
| _(sin nombre)_   | Inicio, suelto arriba                                       |
| **CATÁLOGOS**    | Marcas · Categorías · Tipos · Modelos · Tarifas · Cláusulas |
| **ORGANIZACIÓN** | Puestos · Ubicaciones                                       |

El corte entre los dos es el mismo que el repo ya había hecho en la capa de datos al separar
`ApiOrganizacion` de `ApiCatalogos`: un catálogo describe **cosas** que la empresa renta o
factura, y organización describe a la **empresa misma**. El menú era la única capa donde esa
división no se veía.

Se pliega, y no solo se agrupa, porque con las 18 pantallas de la Fase 1 una lista completa
—aunque lleve encabezados— obliga a recorrer con la vista todo lo que no interesa. La forma
—icono y galón arriba, hijas indentadas sin icono colgando de un filete— sale del boceto de
referencia.

`Operación`, `Comercial` y `Compras` **no se agregaron**: sus pantallas no existen, y la regla
es que la entrada del menú y la ruta van JUNTAS. Nacen con su primera pantalla.

**Lo verificado contra la aplicación corriendo**, no por lectura del código:

| Qué                          | Resultado                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Abrir y cerrar               | `aria-expanded` alterna, galón girado, panel `<ul>` con las 6 hijas y **0 iconos** dentro                                           |
| `aria-controls`              | `menu-grupo-catalogos` y `menu-grupo-organizacion`: los acentos se normalizan y el `id` existe cuando el panel está abierto         |
| Recargar en `/tarifas`       | CATÁLOGOS aparece **abierto solo**, ORGANIZACIÓN cerrado y fuera del DOM, y Tarifas con `aria-current="page"` y la píldora amarilla |
| Cerrar a mano estando dentro | Se queda cerrado, y sigue cerrado al navegar a `/inicio`. **0 enfocables** en el grupo plegado                                      |
| Cajón cerrado a 375          | Los 3 disparadores existen y **ninguno recibe foco** —comprobado llamando a `focus()`, no por `offsetParent`                        |
| Cajón abierto a 375          | 264 px pegado a la izquierda, los **9 enfocables** reciben foco, el `<body>` no se desplaza de lado, 0 elementos desbordando        |
| `axe-core` 4.10.2            | **0 violaciones** a 375, 768 y 1280, con el grupo abierto. Reglas `wcag2a + wcag2aa + wcag21a + wcag21aa + best-practice`           |

### Un fallo de accesibilidad del ARMAZÓN que solo `/inicio` destapaba

`axe` marcó `scrollable-region-focusable` —impacto **serio**— sobre
`<main id="contenido" tabindex="-1">`. No era del menú y **estaba desde antes**.

El `<main>` es una región desplazable (`overflow-y-auto`). Con `tabindex="-1"` es enfocable
por código —lo necesita el salto de contenido— pero no con Tab, así que **si la pantalla de
dentro no tiene ni un control, no hay forma de desplazarla sin ratón** (WCAG 2.1.1).

Medido: en `/inicio` el `<main>` se desplaza y tiene **0 enfocables**; en `/tarifas` tiene
**18** y por eso pasa. Ahí está por qué nunca salió: las cuatro pantallas auditadas el
2026-08-27 son todas de módulo, con filtros y botones, y `axe` da por buena la región en
cuanto encuentra algo enfocable dentro. `/inicio` es la única de puro contenido de lectura.

Corregido a `tabindex="0"` en los **dos** armazones. El precio es una parada de tabulación
más por pantalla; el de `-1` era contenido inalcanzable. `/inicio` pasó de 1 violación a
**0 violaciones y 34 aprobadas**.

### Rediseño visual de las ocho pantallas — 2026-08-28

Se hizo ANTES de seguir con la lógica y no después, por una razón de aritmética: el patrón se
repite en las 18 pantallas de la fase, así que corregirlo con ocho escritas cuesta ocho, y con
dieciocho cuesta dieciocho.

| Antes                                                  | Ahora                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| Menú con dos grupos abiertos a la vez                  | **Acordeón exclusivo**: como mucho uno                     |
| Chips «Todas · Activas · Retiradas» sueltos en su fila | **`<select>`** en la barra de herramientas                 |
| Búsqueda y «Nuevo X» en la barra superior              | **Bajados a la fila de filtros**, encima de la tabla       |
| «1-2 de 2» encima de la tabla                          | **Debajo**, compartiendo fila con el paginador             |
| Hoja inferior para el alta                             | **Panel lateral derecho** (la hoja se queda en plataforma) |
| Botones «Editar» / «Retirar» con texto                 | **Iconos**, en una columna «Acciones» con encabezado       |

Tres piezas compartidas nuevas, para que esto no se copie ocho veces:
`disposicion/barra-herramientas.ts`, `disposicion/panel-lateral.ts` y las utilidades
`panel-lateral` y `boton-icono` de `src/styles.css`. El razonamiento de cada decisión está en
[sistema de diseño](sistema-de-diseno.md).

**Verificado contra la aplicación corriendo**, en las ocho:

| Qué                      | Resultado                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| Barra de herramientas    | Las 8 con búsqueda, `<select>` de estado y su botón. **Cero chips sueltos**                           |
| Búsqueda y acción arriba | Ya no existen en la barra superior                                                                    |
| Acciones de fila         | Iconos con `aria-label` que incluye el nombre de la fila                                              |
| Rango                    | Debajo de la tabla en las 8                                                                           |
| Panel lateral            | Pegado a la derecha (hueco 0), alto completo, esquinas solo a la izquierda, 512 px a 1280 y 375 a 375 |
| Escape y reapertura      | Cierra y **vuelve a abrir**: el `(close)` está atado, que es la trampa de la hoja                     |
| Panel cerrado            | **0 de 4** enfocables reciben foco                                                                    |
| `axe-core` 4.10.2        | **0 violaciones** en Marcas, Categorías, Tipos, Modelos, Tarifas y Puestos, con el panel abierto      |
| Responsivo               | 375, 768 y 1280 sin desbordes fuera de la caja de la tabla                                            |

**Cuatro supuestos míos que el compilador tiró**, y que conviene saber al tocar estas
pantallas:

1. **`MenuLateral` ya tenía un `abierto`** —el `input()` del cajón en móvil—, así que el del
   acordeón se llama `grupoAbierto`.
2. **Tipos y Modelos nombran su señal y sus textos en MASCULINO** (`soloActivos`,
   `todos/activos/retirados`). No es cosmética: el diccionario define el tipo.
3. **Una cláusula no tiene `nombre`, tiene `titulo`.** El nombre accesible de sus acciones
   habría anunciado «Editar undefined».
4. **Un `<select>` entrega TEXTO.** Los filtros que eran chips —tipo de ubicación, aplicación
   de tarifa, obligatoriedad de cláusula— ganaron un método que traduce esa cadena a lo que su
   filtro ya esperaba, en lugar de meter la conversión en la plantilla.

**Lo que queda pendiente de este rediseño:** el panel abre con el foco en su botón de cerrar,
que es lo que hace un `<dialog>` con su primer enfocable. Para un formulario sería mejor el
primer campo; se deja anotado y no se cambia sin decidirlo.

### Tres correcciones más a las tablas — 2026-08-28

**1. Filete entre TODAS las columnas.** Solo lo tenía la primera, la fijada, así que el resto
de los datos flotaban sin separación y una fila de cinco celdas se leía como un párrafo suelto.
Es `@utility tabla-columnas`, una clase en el `<table>` y no cien clases repartidas por las
celdas. Excluye la última —un borde en el extremo derecho duplica al de la tarjeta— y respeta
la celda fijada, que lleva su filete más oscuro a propósito: por debajo de ella pasa el
contenido al desplazar de lado, así que esa costura tiene que leerse más fuerte.

**2. Lo apilado pasó a columna propia.** El código colgaba debajo del nombre en cinco
pantallas; la descripción, en Modelos y Tarifas; y la capacidad, debajo del tipo en Ubicaciones.
Dos líneas dentro de una celda se leen como una sola cosa, y son dos.

| Pantalla                     | Columnas nuevas      |
| ---------------------------- | -------------------- |
| Categorías · Tipos · Puestos | Código               |
| Modelos                      | Descripción          |
| Tarifas                      | Código · Descripción |
| Ubicaciones                  | Código · Capacidad   |

Los badges de estado —«Retirada», «Obligatoria»— **no** se sacaron: son estado de esa fila, no
un dato aparte, y una columna para ellos estaría vacía casi siempre.

**3. El encabezado «Acciones» se ve.** Existía en las ocho, pero con `sr-only` en siete: solo
lo anunciaba un lector de pantalla. Ahora se lee.

Dos consecuencias que había que atender o el cambio quedaba a medias: el **ancho mínimo** de
cada tabla creció con sus columnas —Ubicaciones a `min-w-260`, Modelos a 240, Tarifas a 220—, y
los **ocho esqueletos** se rehicieron para reflejar las columnas nuevas y los botones de icono.
Un esqueleto que ya no coincide es peor que no tener ninguno.

**Verificado en la aplicación corriendo:** encabezados y celdas cuadran en las ocho, «Acciones»
es el último encabezado y se lee, todas las celdas menos la última llevan filete, el `<body>` no
se desplaza de lado y la tabla sí dentro de su caja. `axe-core` en Ubicaciones —ocho columnas,
la más ancha— **0 violaciones, 40 aprobadas**.

**Un error que cometí y conviene no repetir:** al sacar la descripción a su columna busqué el
cierre del bloque `@if (...) {` con el primer `}`, y ese `}` era el de la interpolación
`{{ modelo.descripcion }}`. Partió el marcado de dos pantallas y lo cazó `ng build` con
`NG5002`. En una plantilla de Angular las llaves de un bloque y las de una interpolación se
parecen; para cortar un bloque hay que contar llaves, no buscar la primera.

### Cuatro ajustes finos de las tablas — 2026-08-28

**1. Todo centrado.** `text-center` en el `<table>` y fuera las alineaciones sueltas que
peleaban con él.

**2. El código es la PRIMERA columna, y con ello la fijada.** No es solo reordenar: la primera
columna es la que se queda quieta al desplazar la tabla de lado, así que tiene que ser la que
identifica la fila. Un código lo hace mejor que un nombre —es corto, único y es como se le
nombra en los documentos— y de paso la columna fijada deja de ser la más ancha de la tabla. El
badge de estado se queda con el NOMBRE: describe a la fila entera, y junto a un código de seis
caracteres se leería como si calificara al código.

**3. El rango va a la derecha**, con `order-last ms-auto`. El `ms-auto` importa cuando NO hay
paginador —una sola página—, que era justo cuando se quedaba solo a la izquierda.

**4. Los filtros medían distinto.** Unos con `py-2` y otros con `py-1.5`, que en la misma fila
se ve como dos controles de distinto tamaño. En vez de emparejar los dos archivos desviados se
creó `@utility filtro-barra`: con una sola definición no hay dos que emparejar. Es la misma
razón por la que ya existían `chip` y `campo-formulario`.

Y otra vez **los ocho esqueletos**, que con el código delante y las columnas separadas volvían
a no coincidir. El par apilado que quedaba en cuatro de ellos se partió en dos bloques
hermanos, con el corto primero.

**Verificado:** en Ubicaciones, Tipos y Tarifas el primer encabezado es «Código» y lleva la
clase `sticky`, todas las celdas de la primera fila con `text-align: center`, los dos filtros
midiendo **37 px los dos**, y el rango pegado al borde derecho de su fila. `axe-core` en
Ubicaciones: **0 violaciones, 40 aprobadas**. Encabezados y celdas cuadran en las ocho, con
exactamente una columna fijada en cada una.

### Trabajadores — paso 3 cerrado (2026-08-28)

Novena pantalla de empresa, y **la primera que no cabe en el molde de los catálogos**. Tres
diferencias, cada una con su consecuencia en el código:

**El estado no es un booleano.** `EstadoTrabajador` tiene tres valores —Activo, Inactivo y
Baja— así que `cambiarActivo(id, bool)` no sirve. Se resolvió con
`FabricaDeRecursos.parcheo()`, un PATCH genérico que comparte la doble recarga —listado y
selector— sin que el enum entre en `RecursoRest`. Generalizar la fábrica le habría cargado a
las ocho pantallas que solo apagan y encienden un caso que ninguna tiene.

Por lo mismo, **el filtro de estado de la barra de herramientas pasó a ser opcional**: es
booleano, y el servidor lee `Activo` como «no dado de baja», que colapsa Activo e Inactivo en
un grupo y esconde justo la distinción que a esta pantalla le importa. Sin señal no se dibuja,
y Trabajadores pone el suyo —de tres valores— en `[filtros]`.

**El estado tiene su propio panel.** `AltaTrabajador` excluye `estado` y `fechaBaja` porque el
CHECK `trabajador_baja_coherente` exige que la baja y su fecha viajen JUNTAS: obligatoria para
la baja, **prohibida** en cualquier otro estado. Moverlas por separado desde un PUT es la forma
de topar con ese CHECK como un 500.

**La baja no es reversible**, así que pasa por `Confirmacion`. Inactivo no la merece —una
incapacidad o un permiso se deshacen— y confirmar todo le quita el significado a confirmar.

Detalles menores pero deliberados: la columna fijada es el **número de empleado**, que es lo
que identifica la fila; el badge de estado va con el nombre y solo aparece cuando la persona
NO está activa; y `usuarioId` se conserva al editar en lugar de capturarse, porque **un
trabajador no es un usuario** y ligar una cuenta es parte de Usuarios, que sigue sin API de
empresa (§3.1).

`trabajadores.spec.ts` fija las dos mitades del CHECK con 7 casos. La que se olvida es la
segunda: «sobra la fecha» solo ocurre al elegir Baja, escribir la fecha y volver a Activo —el
campo se esconde pero su valor sigue en el formulario—, que es la ruta que nadie recorre a
propósito.

**Estado:** `ng build` limpio, **203 pruebas en verde** (eran 196), chunk diferido de 25.04 kB.
Los cuatro archivos del andamiaje tocados: ruta, entrada de menú con icono propio, `titulos.` y
`menu.` en los dos idiomas.

#### Lo verificado en el navegador, y el fallo que solo apareció ahí

Alta, edición, los tres filtros contra el servidor, el cambio de estado y los mensajes de vacío.
`axe-core` 4.10.2: **0 violaciones y 40 aprobadas**, con el panel abierto y cerrado.

Los filtros devuelven lo correcto y el contexto de la barra cuenta lo mismo que la lista:
«1 en estado Inactivo», «0 en estado Activo» con su mensaje diciendo cómo salir del filtro.

**Y apareció un callejón sin salida que ninguna prueba veía.** Eliges Baja, escribes la fecha,
cambias de opinión a Activo — y el campo de fecha **se esconde con su valor dentro**. La guarda
de coherencia bloquea el envío, el único campo editable que queda es el estado, y no hay forma
de borrar la fecha: el único camino era cerrar el panel y volver a abrirlo.

Ninguna prueba lo veía porque las dos mitades del CHECK, por separado, estaban bien. El fallo
estaba en la TRANSICIÓN entre ellas. Se corrigió con un `effect` que limpia la fecha al salir de
Baja, y `trabajadores.spec.ts` pasó a 9 casos: los 7 del CHECK más los 2 de la transición, uno
de ellos conservando el comportamiento roto para que se vea la diferencia.

Eso no vuelve inútil a `fechaBajaIncoherente`: esa guarda sigue describiendo el CHECK de la
base y `enviarEstado` sigue mandando `null` fuera de la baja. Lo que cambia es que el estado
imposible deja de ser **alcanzable** desde la interfaz.

> **Queda un registro de prueba en la empresa `prueba`**: `ZZ-PRUEBA-01`, «Registro De Prueba»,
> puesto Operador. Se dejó en Activo. No hay borrado —el trabajador no tiene borrado lógico—,
> así que retirarlo es darlo de baja, y eso es irreversible: la decisión es de quien opera.

### Paso 4 — Proveedores, y el N+1 del backend corregido (2026-08-28)

**Primero el backend, como manda el criterio acordado:** los dos últimos servicios que
proyectaban con una LLAMADA A MÉTODO —`ServicioClientesEf` y `ServicioProveedoresEf`— pasan a
devolver un árbol de expresión. Con la forma anterior EF materializaba las entidades y corría
la proyección en memoria, así que `bd.Rentas.Count(...)` y `bd.OrdenesCompra.Count(...)` eran
**una consulta por fila**: cincuenta proveedores en pantalla, cincuenta y un viajes a Neon.

Es el mismo arreglo de los cinco anteriores, y con él **la lista de servicios rotos baja de
ocho a seis**. Los que quedan —expediente de equipo, cotizaciones, rentas, contratos y las dos
de órdenes— siguen esperando su pantalla. Compilación en verde y **338 pruebas del backend**
pasando, verificadas compilando a otra carpeta porque la API estaba corriendo desde Visual
Studio (la trampa `MSB3027`, ya anotada en la bitácora del backend).

**Proveedores** es molde estándar sin nada propio: `activo` booleano y `PATCH .../activo`. Lo
único que conviene saber es por qué su tabla cuenta ÓRDENES y no equipos: el proveedor vive en
la orden de compra —`equipo` no tiene `proveedor_id`, se quitó del modelo el 2026-08-25— y
desde un equipo se llega por `equipo → orden_compra_detalle → orden_compra → proveedor`. La
advertencia del retiro habla de órdenes por lo mismo.

Estrena `nucleo/api/api-terceros.ts`, separado de `ApiOrganizacion` por lo que responden:
organización describe a la empresa misma, terceros a quien está fuera. Es el mismo corte que ya
hace el menú.

**Y nace el grupo COMERCIAL del menú**, con Proveedores como su primera pantalla —la regla es
que un grupo y su primera ruta se agregan JUNTOS—. Clientes, Cotizaciones, Rentas y Contratos
entran ahí conforme existan.

**Verificado en el navegador:** ruta, título, `<h1>`, el grupo nuevo abriéndose solo por la ruta
activa y cerrando a los otros dos, la barra con su filtro de tres opciones, el botón y el
mensaje de vacío correcto.

**Sin verificar:** el alta, la edición y el retiro. La sesión caducó a mitad de la prueba.

> **Un síntoma que conviene mirar.** Al caducar la sesión durante un POST, el botón se quedó en
> «Guardando…» **indefinidamente y sin mensaje de error**, en vez de propagar el fallo o llevar
> a `/entrar?expirada=1`. `convenciones.md` ya advierte de este modo de fallo —«el error tiene
> que propagarse a cada suscriptor, o sus pantallas se quedan enviando para siempre»—. No se
> investigó a fondo: la observación queda anotada para comprobarla con la sesión viva.

#### Proveedores, verificada — y el arreglo del backend confirmado

Con la API reiniciada, el 500 desapareció. Alta, edición —precarga los ocho campos—, retiro con
su confirmación diciendo qué cambia, y reactivación. `axe-core`: **0 violaciones, 40 aprobadas**,
con panel abierto y cerrado.

#### Clientes cierra el paso 4

La pantalla con más campos de la fase. Dos cosas mandan sobre su forma:

**El contacto y el domicilio van DENTRO del cliente.** Se quitaron `contacto_cliente` y
`domicilio_cliente` el 2026-08-25 y sus campos viven en el propio cliente. El precio, dicho en
voz alta: **un cliente tiene UN contacto y UN domicilio**. Si mañana hace falta el domicilio
fiscal aparte del de entrega, o dos contactos —cobranza y operación—, hay que volver a sacar la
tabla y migrar. En el DTO llegan agrupados en dos objetos, y por eso el formulario los pinta
como cuatro bloques con `<fieldset>` y `<legend>`: veinte campos seguidos no se recorren, y los
encabezados de sección son navegables por un lector de pantalla.

**El estado es un enum de tres valores** —Activo, Suspendido, Baja— así que tiene su panel y su
filtro propios, no el booleano de serie. La diferencia con Trabajadores: aquí el cambio **no
arrastra fecha**, `CambioEstadoCliente` solo lleva el estado, así que no hay CHECK que
coordinar. Baja sigue siendo irreversible y pasa por `Confirmacion`.

**Los tres importes son NÚMEROS Y OBLIGATORIOS** —`decimal` e `int` no anulables en el alta—.
Un `<input type="number">` escribe `null` al vaciarse, así que se declaran `number | null`, que
es lo que el accesor pone de verdad, y se traducen a 0 al enviar. Declararlos como texto compila
y revienta con `.trim is not a function`, la trampa que ya costó una depuración en Modelos.

**Verificado en el navegador:** alta con los cuatro bloques, país por defecto «México», el
cambio de estado con su aviso solo al elegir Baja y el verbo del botón cambiando a «Dar de
baja», el filtro contra el servidor —«1 en estado Activo», «0 en estado Baja» con su mensaje— y
`axe-core` en **0 violaciones y 40 aprobadas**.

> **Dos registros de prueba** quedan en la empresa `prueba`: `ZZ-PROV-01` (proveedor, activo) y
> `ZZ-CLI-01` (cliente, activo). Ninguno se puede borrar —no hay borrado en este modelo—, así
> que retirarlos o darlos de baja es decisión de quien opera.

### Paso 5a — Equipos, la lista (2026-08-28)

La entidad central de la fase. Tres cosas la separan de todo lo anterior:

**El estado no se captura entero.** Son ocho, y solo cuatro se ponen a mano: Disponible, En
mantenimiento, Fuera de servicio y Baja. Los otros —Reservado, Rentado, En traslado y Vendido—
los pone la operación al confirmar una renta, un traspaso o una venta, y **el servidor los
rechaza con un 400 explícito**. No es una regla inventada por la pantalla: está en
`ServicioEquiposEf` como `EstadosDeDocumento`, y se leyó del código antes de escribir el
desplegable. Ofrecerlos dejaría el calendario y el estado contándose cosas distintas; el panel
ofrece los cuatro y **explica por qué faltan los otros**, en vez de dejar que se descubra el 400
al pulsar Guardar.

**Mover la ubicación NO es un traspaso.** Corrige el dato del expediente; el traspaso es su
propio proceso con su registro en `transferencia_equipo`. La ayuda del campo lo dice, porque es
el malentendido natural.

**Es la primera pantalla con DELETE.** `equipo` es una de las tres entidades con borrado lógico
—las otras son `archivo` y `tenant`—, así que aquí hay tres acciones por fila y no dos. Se
agregó `FabricaDeRecursos.borrar()`, y **deliberadamente NO en `RecursoRest`**: ponerlo en la
interfaz común ofrecería a diecisiete pantallas una operación que su endpoint no expone.

Tanto el cambio de estado como el borrado pueden responder **409** —el servidor rechaza sacar de
circulación una máquina con calendario ocupado—. Ese 409 es la garantía de no-traslape hablando,
así que se muestra con el texto del servidor.

**Nace el grupo OPERACIÓN** del menú, con Equipos como su primera pantalla.

**Verificado en el navegador:** alta con marca y modelo resueltos por el servidor, el panel de
estado ofreciendo solo los cuatro capturables con su aviso, el cambio a «En mantenimiento» con
nota, el borrado con su confirmación diciendo qué cambia, y la vuelta al estado vacío.
`axe-core`: **0 violaciones, 40 aprobadas**. El equipo de prueba se creó y se eliminó en la
misma verificación, así que no queda basura.

**Lo que falta del paso 5:** el EXPEDIENTE —la pantalla de detalle con documentos y precios por
equipo—. Ahí vive `ServicioDocumentosEquipoEf`, marcado como que truena, y ya sabemos que esa
clasificación conviene comprobarla en vez de creerla.

### Paso 5 cerrado — el expediente del equipo (2026-08-28)

Pantalla de DETALLE en `/equipos/:id`, no una hoja: se llega pulsando el código en la lista. Tres
secciones —datos, documentos y precios— y tres paneles.

**El backend rompía, y esta vez el plan lo tenía bien.** `ServicioDocumentosEquipoEf` proyectaba
con una llamada a método y desreferenciaba `a.Archivo!.NombreOriginal`: sin `Include`, esa
navegación llega en nulo cuando la proyección corre en memoria. Se comprobó en vivo — el
endpoint devolvía **200 con la lista vacía**, se subió un documento (**201 Created**) y desde
ese momento **se colgaba**. Corregido como los cuatro anteriores. Van **cinco servicios
arreglados**; quedan cinco.

**Tres cosas propias de esta pantalla:**

**La subida va como `multipart/form-data`**, no como JSON: un base64 crece un tercio y obliga a
tener el archivo entero en memoria a los dos lados. Se manda un `FormData` **sin fijar
`Content-Type`** — el navegador tiene que ponerlo él para incluir el `boundary`.

**El archivo NO puede vivir en el `FormGroup`**: un `<input type="file">` es de solo lectura y
un control reactivo no puede escribirlo. Vive en una señal aparte, y por eso no tiene `touched`
y `errorVisible` no le sirve — hizo falta una bandera `intentoSubir` propia.

**La descarga es un blob, no un `<a href>`**: necesita el `Bearer`, y un enlace normal no lo
lleva. Se pide como blob, se crea una URL temporal y **se revoca**; sin revocarla cada descarga
retiene el archivo entero en memoria hasta recargar.

**Y un precio no se edita: se CIERRA.** El catálogo dice QUÉ se cobra; `equipo_tarifa` dice
CUÁNTO, por equipo y con vigencia. Cambiarlo es ponerle fecha de fin al vigente y cargar el
nuevo, de forma que el histórico queda. Un `EXCLUDE` impide dos vigentes para la misma
combinación.

**Verificado contra la aplicación:** subida (201), la lista mostrando el documento, la descarga
—34 B, nombre original, URL revocada—, la carga de un precio, **el 409 del `EXCLUDE` con el
mensaje del servidor** —«Ya hay un precio vigente para ese concepto y ese cliente en esas
fechas. Cierra el anterior antes de cargar el nuevo.»— y el cierre del precio pasando a
«Cerrado». Los datos de prueba se borraron al terminar.

#### Un fallo de accesibilidad que solo esta pantalla podía destapar

`axe` marcó `scrollable-region-focusable` sobre la caja `overflow-x-auto` de la tabla de precios.
Hasta ahora colaba de milagro: **las filas siempre llevan botones**, y tabular por ellos arrastra
el scroll de rebote. Aquí, al cerrar el único precio, su acción desapareció — y una caja que se
desplaza sin nada enfocable dentro **no se puede desplazar con teclado** (WCAG 2.1.1).

Corregido con `tabindex="0"` en el contenedor de las **17 tablas** del producto, no solo en esta:
cualquier tabla puede quedarse sin acciones en una fila, y además desplazar una tabla ancha con
el teclado es útil en todas. **No** se puso en los esqueletos: van `aria-hidden` y un enfocable
dentro de contenido oculto a lectores es otra violación, `aria-hidden-focus`.

### Paso 6 cerrado — Disponibilidad y Traspasos (2026-08-28)

Dos pantallas, y la primera **rompe el molde a propósito**.

**Disponibilidad NO ES UN LISTADO, ES UNA PREGUNTA.** Por eso no lleva `app-barra-herramientas`:
no hay búsqueda que filtre lo que ya está en pantalla, hay un PERIODO que decide qué se
pregunta. El servidor rechaza la consulta sin fechas con un 400 —«qué hay disponible» sin
periodo no es algo que el calendario pueda contestar— así que la pantalla **no pide nada hasta
tenerlas**, y su vacío inicial dice eso y no «no hay equipos».

El periodo se aplica **al pulsar Consultar, no al teclear**. Es la diferencia con las otras diez:
allí la búsqueda filtra sola con retardo, y aquí no puede — mientras se escribe una fecha pasa
por estados inválidos («2026-0», 31 de febrero) que serían un 400 por cada tecla.

De cada equipo libre se abre su CALENDARIO, con todo lo que lo ocupa —incluido lo ya liberado— y
la opción de bloquearlo. **Solo se ofrecen tres motivos**: Mantenimiento, Reparación y Bloqueo.
Renta, Reserva y Traslado los pone un Proceso porque salen de un documento, y ofrecerlos dejaría
el calendario diciendo que hay una renta donde no hay ninguna.

**Traspasos es la primera tabla del producto SIN columna de acciones.** Un traspaso es un hecho
histórico: no se edita ni se borra.

#### La garantía de la fase, verificada de punta a punta

`ocupacion_equipo` con su `EXCLUDE` es la pieza que sostiene todo, y se comprobó en los tres
sitios donde asoma:

| Acción                                    | Respuesta del servidor                                                                                |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Bloquear un periodo ya ocupado            | **409** — «El equipo ZZ-DISP-01 ya esta ocupado por Mantenimiento desde 2026-09-01 hasta 2026-09-30.» |
| Consultar ese mismo periodo               | **0 equipos libres** — el calendario y la consulta se cuentan lo mismo                                |
| Eliminar un equipo con calendario ocupado | **409** — «no se puede eliminar mientras este rentado, reservado o en mantenimiento»                  |

Los tres mensajes se muestran con el texto del servidor, que es lo que el plan pide: un «error
al guardar» convertiría la mejor garantía del producto en un fallo genérico.

#### Un hueco mío que el propio repo ya había anticipado

El desplegable de DESTINO ofrecía «Bodega Sur», que es una **sucursal**: no almacena equipo, y un
TRIGGER de la base rechaza el traspaso hacia ella. Ofrecerla era invitar a un error garantizado.

Lo peor es que estaba escrito desde hacía días, en `api-organizacion.ts`: _«Ojo con esa última:
no debe ofrecer sucursales, porque una sucursal no almacena equipo. Ese recorte se hace con
`AlmacenaEquipo` del lado del servidor, no filtrando esta lista en memoria.»_ Lo leí al escribir
Trabajadores y no lo apliqué al llegar a Traspasos.

Corregido con `FabricaDeRecursos.selectorFiltrado()`, que memoriza por recurso **y por
parámetros** —dos desplegables del mismo recurso con filtros distintos se pisarían— y
`ApiOrganizacion.selectorAlmacenes()`. El FILTRO de la tabla sigue ofreciendo las tres
ubicaciones: el historial pudo salir de cualquiera.

#### Y un apilado que funcionaba pero se leía mal

Abrir el bloqueo desde el calendario dejaba **dos paneles laterales abiertos a la vez**, del
mismo tamaño, uno tapando al otro exactamente. Dos `<dialog>` modales apilados funcionan —el de
arriba gana la capa superior y el de abajo queda inerte— pero que algo funcione no lo hace
legible. Ahora abrir el bloqueo cierra el calendario, y al guardar o cancelar el calendario
vuelve, que es donde se ve el bloqueo recién creado.

`axe-core` en las dos pantallas: **0 violaciones**. Los datos de prueba se borraron al terminar.

### Paso 7 cerrado — Cotizaciones, y el `ToString()` de un enum dentro del árbol (2026-08-28)

Dos pantallas, el mismo reparto que Equipos → Expediente: `/cotizaciones` trae el encabezado y
`/cotizaciones/:id` trae lo que cuelga de él. **El listado va SIN LÍNEAS a propósito** —el
servidor devuelve `Array.Empty`—: son N por documento y cincuenta cotizaciones no se pintan con
sus renglones.

#### Lo que manda es el servidor, y se leyó antes de escribir la interfaz

Cuatro reglas salieron de `ServicioCotizacionesEf` y ninguna se inventó aquí:

1. **La máquina de estados.** `SIGUIENTES` en `cotizacion.ts` es el espejo de `Transiciones`.
   La pantalla ofrece solo las transiciones válidas para no invitar al error; **la garantía es
   el 409 del servidor**, cuyo texto se muestra tal cual. Los tres estados terminales —Rechazada,
   Vencida, Cancelada— están AUSENTES de la tabla, no con lista vacía: con `[]` el botón de
   cambiar estado se seguiría dibujando y abriría un desplegable sin opciones. `cotizacion.spec.ts`
   (7 casos) fija esa forma, incluido el atajo que parece razonable y el motor prohíbe:
   Borrador **no** llega a Aceptada.
2. **Editar solo aplica en Borrador**, así que el lápiz solo sale en esas filas.
3. **Las líneas solo se tocan en Borrador.** Fuera de él no se dibujan ni «Agregar línea» ni el
   bote de basura, y en su lugar hay una frase que dice por qué. Un botón deshabilitado sin
   motivo se lee como un fallo de la aplicación.
4. **Enviar exige líneas** y el cliente tiene que estar Activo. Lo segundo se resolvió con
   `selectorClientesActivos()`; lo primero **no se duplica** en el cliente, se enseña la
   respuesta del servidor.

Y la ubicación: **una bodega no cotiza**. `FiltroUbicaciones.EsAdministrativa` ya existía en el
servidor esperando a esta pantalla, igual que `AlmacenaEquipo` esperaba a la de Traspasos, así
que el desplegable usa `selectorAdministrativas()` y no recorta en memoria. Es el mismo error
que costó una corrección en el paso 6, evitado esta vez por haberlo leído primero.

#### El defecto del backend de este paso NO se parece a los anteriores

La tabla de más abajo marcaba `ServicioCotizacionesEf` como «truena» por la proyección escrita
como llamada a método. Eso era cierto y se corrigió igual que las otras cinco —árbol de
expresión, con `Array.Empty<CotizacionLineaDto>()` en vez de `[]` porque una expresión de
colección no cabe en un árbol (CS9175)—. **Pero había un segundo defecto, de otra familia, y
ese es el que apareció al usar la pantalla:**

```csharp
.Select(l => new CotizacionLineaDto(..., l.Tarifa.Unidad.ToString(), ...))
```

`Unidad.ToString()` no se traduce: la columna guarda el entero y los rótulos «Hora», «Día»…
solo viven en el CLR. Lo importante es **cuándo** falla:

> Los defectos de proyección por llamada a método solo aparecen **con la primera fila** — con la
> tabla vacía el `Select` no corre sobre nada. Este NO: la traducción a SQL ocurre **antes** de
> ejecutar, así que revienta igual con cero líneas.

Por eso el síntoma fue el peor posible: `POST /api/cotizaciones` respondía **500** al crear la
primera cotización —porque `CrearAsync` termina llamando a `ObtenerAsync`— **con la cotización
ya guardada**. La pantalla mostró el error correctamente y el botón volvió a «Guardar», pero la
fila estaba en la base.

El arreglo es el que `ServicioEquipoTarifasEf` ya documentaba desde el paso 5: **proyección en
dos pasos**. La consulta trae la unidad CRUDA —un entero, que sí se traduce— y el rótulo se
resuelve después, en memoria, con un `record Fila` interno y su `ADto()`. Ese servicio era el
único que lo necesitaba; ahora son dos.

**Lo que hay que revisar al llegar a Rentas, Contratos y Órdenes:** buscar `ToString()` dentro
de un `Select`, no solo proyecciones escritas como método. Son dos defectos distintos con dos
síntomas distintos y hasta hoy solo estaba escrito uno.

#### Lo que se agregó a la plomería compartida

- `FabricaDeRecursos.publicar()` — el hermano de `parcheo()`, para un POST a una SUBRUTA que
  también tiene que recargar el listado. El primer caso es la línea de una cotización: cambia el
  total del documento, que es una columna de la tabla. Existe por lo mismo que `parcheo`: los dos
  mapas de recarga son privados y sin esto cada servicio reimplementaría la doble recarga.
- `ApiOrganizacion.selectorAdministrativas()` y `ApiTerceros.selectorClientesActivos()`.
- El detalle **no** está en el mapa de la fábrica —lo crea `detalleDe()` por pantalla—, así que
  lo refresca quien lo montó. Está dicho en el docblock de `agregarLinea`.

#### Tres cosas que solo se vieron USANDO la pantalla

Ninguna de las tres la habría cazado el compilador, y las tres salieron en el navegador.

**1. `validadorRequerido` en un campo numérico NUNCA deja enviar.** El validador pasa por
`texto()`, que devuelve `''` para cualquier valor que no sea una cadena — y un
`<input type="number">` mete un **number** en el control. Así que devolvía `{ required: true }`
se escribiera lo que se escribiera, en la cantidad y en el precio de una línea.

El síntoma es de los que desconciertan: el formulario se ve completo, **no sale ni un mensaje de
error** —los avisos aparecen con `touched` y esos campos se rellenan sin tocarlos— y el botón de
guardar simplemente está apagado, sin nada que explique por qué.

Es el mismo hilo que la trampa ya escrita del `NumberValueAccessor`: **lo que acaba dentro del
control lo decide el ACCESOR, no la declaración del formulario**, y aquí el validador estaba
escrito para lo que decía la declaración. Se agregaron `validadorCantidad` (> 0) y
`validadorImporte` (>= 0) —los dos límites son los del servidor— con 7 casos anexados a
`validadores.spec.ts`, incluido uno que deja el defecto a la vista:
`validadorRequerido(control(3))` devuelve `{ required: true }`.

Se revisaron las once pantallas restantes: **ningún otro sitio** pone `validadorRequerido` en un
control numérico.

**2. Los filtros se apilaban.** Los dos `<select>` iban dentro de un solo
`<div filtros class="flex flex-wrap gap-2">`, lo que los convierte en **un único elemento flex**;
se envolvían entre ellos en vez de alinearse con la búsqueda, y arrastraban al botón primario
hacia abajo. Va **un `[filtros]` por filtro**, sin envoltorio, como en Equipos. Escrito en
[sistema de diseño](sistema-de-diseno.md).

**3. El `<option>` vacío del cliente** en el FORMULARIO decía «Cualquier cliente», que es el
texto del FILTRO. En un formulario la opción vacía significa «falta elegir», no «valen todos».

#### El ciclo, probado de punta a punta

Con la cotización que había quedado huérfana del 500:

| Paso                     | Resultado                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Enviar SIN líneas        | 409 del servidor, literal: «No se puede enviar una cotizacion sin lineas.» El panel se queda abierto, donde se tomó la decisión |
| Agregar línea sin equipo | Alta correcta; el servidor recalcula subtotal y total a $4,500.00 y el detalle se refresca                                      |
| La unidad                | Se pinta «3 **Hora**» — es el `ToString()` que reventaba antes del arreglo                                                      |
| Enviar                   | Pasa a Enviada; desaparece «Agregar línea» y el bote de basura, y sale la frase que dice por qué                                |
| Transiciones ofrecidas   | Borrador → Enviada, Cancelada · Enviada → los cinco · Aceptada → solo Cancelada                                                 |
| El listado               | Refleja Aceptada y $4,500.00 sin recargar a mano, y el lápiz desaparece al salir de Borrador                                    |

`axe-core` en las dos pantallas, con el panel lateral abierto y cerrado: **0 violaciones**.

`ng build` limpio, **219 pruebas** en verde.

### Paso 8 — Rentas, el criterio de salida de la fase (2026-08-28)

Dos pantallas otra vez, pero esta no se parece a Cotizaciones: **aquí se compromete el
calendario**. Una cotización es una propuesta; una renta confirmada aparta máquinas en fechas
concretas, y un `EXCLUDE` de la base impide que dos rentas se pisen.

#### Lo que hace distinta a esta pantalla: cuatro acciones que NO son un cambio de estado

Confirmar, extender, cerrar y cancelar tienen **endpoint propio** porque cada una hace más que
cambiar una columna:

| Acción            | Qué hace de verdad                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmar         | Inserta una `ocupacion_equipo` **por línea**, en transacción. Si el `EXCLUDE` rechaza una sola, **se deshace entera**                                               |
| Extender          | Mueve el fin de la renta y el de sus ocupaciones. El `EXCLUDE` revalida solo                                                                                        |
| Cerrar / Cancelar | Marcan las ocupaciones `activo = false`. **Liberar no es borrar**: el `EXCLUDE` es parcial (`WHERE activo`), así que el periodo queda libre sin perder el histórico |

El `PATCH .../estado` cubre solo los dos pasos que no tocan nada —Confirmada → Activa y Activa →
Devuelta— y el controlador **rechaza los otros con 400**, no con 409. `ACCIONES` en `renta.ts`
es el espejo de esas tres reglas a la vez, con 7 casos en `renta.spec.ts`.

**Las cuatro viven en el DETALLE, no en el listado.** Confirmar aparta máquinas y cancelar las
libera; las dos se deciden mirando QUÉ equipos lleva la renta, y eso solo se ve en el detalle.
Un menú de fila invitaría a confirmar sin haber mirado.

#### La asimetría que más se nota al usarla

**Los equipos solo se tocan en Borrador; los cargos, en cualquier estado salvo Cerrada y
Cancelada.** No es una inconsistencia del servidor: una línea genera una fila de calendario y un
cargo no lleva equipo. Cobrar un flete extra con la máquina ya en la obra es lo normal; agregarle
una máquina a una renta confirmada no lo es. Las dos secciones lo dicen en su encabezado en vez
de dejar un botón deshabilitado sin motivo.

Y una regla de negocio que la pantalla respeta y conviene tener escrita: **una renta Activa no se
cancela**. La máquina está en la obra; cancelar diría que nunca salió. Se devuelve y se cierra.

#### Dos detalles que el molde de Cotizaciones no cubría

- **`datetime-local`, no `date`.** `Inicio` y `Fin` son `DateTime`, no `DateOnly`: el calendario
  razona con horas, y una renta que arranca a las 8:00 y otra que termina a las 7:00 del mismo
  día **no** se traslapan. Con solo la fecha el motor no podría distinguirlas.
- **Los horómetros de devolución van FUERA del `FormGroup`.** Son un mapa `lineaId → lectura` de
  tamaño variable y opcionales uno a uno; solo viajan los que tienen valor, porque mandar `0` por
  un equipo sin horómetro sería inventarse una lectura.

#### El defecto del backend, y esta vez solo era uno

`ServicioRentasEf` tenía la proyección escrita como método —`.Select(r => Encabezado(r))`—, que
desreferencia `r.Cliente!` y `r.Trabajador!` y por tanto **truena con la primera renta**.
Convertido a `Expression<Func<Renta, RentaDto>>`, con `Array.Empty` en lugar de `[]` por el
CS9175 de siempre.

**Se buscó también el segundo defecto —`ToString()` dentro de un `Select`— y aquí no hay
ninguno.** Era la advertencia que quedó escrita al cerrar Cotizaciones, y buscarla costó un
`grep`; encontrarla habría costado otra depuración en el navegador.

#### Tres cosas que solo se vieron USANDO la pantalla

**1. La frontera entre hora de pared y instante.** El campo entrega `2026-09-01T08:00` sin zona;
la columna es `timestamptz`. `System.Text.Json` lo lee como `DateTime` con `Kind=Unspecified` y
**Npgsql solo escribe `Kind=Utc` en un `timestamptz`**. La excepción no es una violación de
restricción, así que no la atrapa el `catch` del servicio: **500 al crear la primera renta**.

Y el atajo que ya usaban Traspasos y el alta de precio —pegarle una `Z` al texto— **aquí sería
peor que el error**: ahí el campo es `date` y la hora da igual; aquí la hora ES el dato. Alguien
en México capturando las 08:00 guardaría las 08:00 UTC, o sea las 02:00 locales, y el `EXCLUDE`
compararía instantes corridos seis horas. Sería un fallo silencioso en la garantía que sostiene
la fase.

Cerrado con `nucleo/formularios/fecha-hora.ts` —`aInstante` y `aCampoLocal`—, que deja la
conversión al navegador, que sí sabe en qué zona está. **Limitación anotada:** la zona es la del
NAVEGADOR, no la de la empresa; `tenant.zona_horaria` existe y no se usa en ningún cálculo.
9 casos en `fecha-hora.spec.ts`, escritos **sin fijar un huso** —el de la máquina que corre las
pruebas no se controla— comprobando la RELACIÓN: que ida y vuelta cierren.

**2. El horómetro de devolución se indexa por EQUIPO, y el docblock decía LÍNEA.**

```csharp
/// Lectura de horometro por linea al devolver.          ← decía
if (!lecturas.TryGetValue(linea.EquipoId, out var lectura))   ← hace
```

Indexé por `linea.id` siguiendo la documentación, y **no pasó nada**: ninguna clave casó, la
lectura se descartó, la renta se cerró igual y el horómetro quedó en blanco. **Sin error, sin
aviso.** Eso es lo peligroso, no el desajuste: una clave desconocida se ignora en silencio.
Corregidos los dos lados —la pantalla y el docblock del servidor—, con una nota de que rechazar
con 400 sería más seguro y por qué no se cambió todavía (el mapa PARCIAL, solo los equipos que sí
llevan horómetro, es un caso legítimo que hay que poder distinguir de la clave equivocada).

**3. Un detalle de lectura, no un defecto:** el mensaje del `EXCLUDE` da las fechas en UTC
—«hasta 2026-09-16» para un fin capturado el 15 a las 18:00 locales—. El instante guardado es
correcto; lo que no está localizado es el texto del servidor. Anotado, no tocado: cambiarlo es
del lado del backend y afecta a todos los mensajes de conflicto.

#### El ciclo, probado de punta a punta contra la API real

| Paso                                                | Resultado                                                                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmar SIN equipos                               | 409 literal: «No se puede confirmar una renta sin equipos.» Sigue en Borrador                                                          |
| Agregar equipo                                      | Subtotal, total y saldo los calcula el servidor; el horómetro de salida lo toma del equipo                                             |
| Confirmar                                           | → Confirmada. Las acciones cambian a `activar / extender / cancelar`, y la sección de equipos pasa a explicar por qué ya no se tocan   |
| **Segunda renta, MISMO equipo, fechas traslapadas** | **El `EXCLUDE` la rechaza**: «El equipo ZZ-RENTA-01 ya esta ocupado por Renta desde 2026-09-01 hasta 2026-09-16.» Se queda en Borrador |
| Entregar                                            | → Activa. **«Cancelar renta» desaparece** — una renta activa no se cancela. Los cargos sí se siguen ofreciendo                         |
| Extender al 25/09                                   | Mueve el periodo y registra la extensión conservando el fin anterior                                                                   |
| Devolver y cerrar                                   | → Cerrada. La lectura de horómetro queda en la línea y actualiza el equipo                                                             |
| **Reconfirmar la segunda renta**                    | **Ahora SÍ pasa**: cerrar liberó el calendario. «Liberar no es borrar» comprobado en los dos sentidos                                  |

El periodo se lee «8:00 a.m. – 6:00 p.m.», exactamente lo capturado: la ida y vuelta no corre las
horas.

`axe-core` en las dos pantallas: **0 violaciones**. Verificado a 1280 —una sola fila—, 768 y 375
sin desbordamiento horizontal.

`ng build` limpio, **240 pruebas** en verde.

### Paso 9 — Contratos, y el defecto de proyección CERRADO en los 33 servicios (2026-08-28)

Dos pantallas más, y con ellas se acaba la corrección que venía arrastrándose desde el paso 4.

#### Lo que hace distinto a un contrato

**CUELGA DE UNA RENTA Y SOLO PUEDE HABER UNO.** Lo garantiza el `UNIQUE contrato_renta_unica`.
La pantalla **no recorta** el desplegable a las rentas sin contrato, y eso es deliberado: ese
filtro no existe en el servidor, y calcularlo aquí exigiría traerse los contratos y cruzarlos —
con el selector paginado a 200, el cruce sería **silenciosamente incompleto** en cuanto la
empresa pase de ese número. Se ofrecen todas y el 409 dice cuál ya tiene, nombrando el folio.

Es la misma regla que rige los mensajes de lista vacía: **no afirmar sobre lo que no se
consultó.** El texto de ayuda decía «Solo se ofrecen las que no tienen uno» y se corrigió al
darme cuenta de que era una promesa que la pantalla no cumple.

**NO HAY EDICIÓN.** No existe `PUT`: un contrato se crea, se le mueven las cláusulas mientras
está en Borrador y después es **inmutable, impuesto por un trigger** —no solo por el servicio—.
Por eso el listado no tiene lápiz, solo el ojo.

**Se usa `editable` del DTO, no una comparación local.** El servidor lo trae calculado; hoy vale
`estado === Borrador`, y el día que el motor cambie qué es editable la pantalla se entera sola.

**Las cláusulas son una COPIA congelada.** Al crear el contrato se les copia título y texto;
corregir mañana la plantilla del catálogo no reescribe lo que alguien firmó. La tabla marca el
origen —del catálogo o propia— porque `clausulaId` viene nulo cuando se redactó ahí.

Tres campos toman valor de la renta al omitirse: las fechas, el depósito —**es el mismo dinero**,
capturarlo dos veces es como los dos documentos acaban diciendo cifras distintas— y las
cláusulas, que vacías copian **todas las obligatorias activas**. Por eso la selección de
cláusulas vive FUERA del `FormGroup`: vacía no significa «ninguna», significa «las obligatorias»,
y un `FormArray` de casillas obligaría a distinguir «no toqué nada» de «desmarqué todo», que es
una distinción que el contrato del servidor no tiene.

Y un rechazo que la tabla de transiciones **no puede predecir**: autorizar exige cláusulas. Eso
depende de los datos, no del estado, así que se deja llegar el 409 y se muestra su texto.

#### HALLAZGO BLOQUEANTE: dos de los cuatro estados del contrato son INALCANZABLES

Salió probando el ciclo en el navegador. **Borrador → Autorizado funciona; a partir de ahí no se
puede mover nada.** Firmado y Terminado no se pueden alcanzar por ningún camino, y `firmadoEn`
no puede llegar a tener valor nunca.

La causa está en el esquema:

```sql
CREATE TRIGGER contrato_inmutable
    BEFORE UPDATE OR DELETE ON contrato
    FOR EACH ROW
    WHEN (OLD.estado <> 1)                              -- cualquier fila fuera de Borrador
    EXECUTE FUNCTION contrato_proteger_autorizado();    -- y la funcion SIEMPRE lanza
```

El trigger no distingue QUÉ columna cambia: rechaza cualquier `UPDATE` sobre un contrato que ya
salió de Borrador, **incluido el `UPDATE` que solo mueve `estado`**. Como `CambiarEstadoAsync`
hace exactamente eso, el segundo cambio de estado de la vida de un contrato siempre falla.

**Es una contradicción DENTRO del backend, no entre el backend y la pantalla:**

| Dice                               | Qué declara                                                    |
| ---------------------------------- | -------------------------------------------------------------- |
| `IServicioContratos`               | «FUERA DE BORRADOR NO SE TOCA NADA» — coherente con el trigger |
| `ServicioContratosEf.Transiciones` | `Autorizado → Firmado, Terminado` y `Firmado → Terminado`      |
| `EstadoContrato`                   | Cuatro valores, con CHECK `BETWEEN 1 AND 4`                    |
| `ContratoDto.FirmadoEn`            | Existe, y `CambiarEstadoAsync` lo pone al pasar a Firmado      |

Gana el trigger, así que **tres filas de `Transiciones` están muertas**, dos estados del enum no
se usan y un campo del DTO es siempre nulo.

**Se corrigió con la migración `EmpresaContratoAvanzaEstado`** después de consultarlo: la
comprobación se mueve del `WHEN` al cuerpo de la función para poder mirar QUÉ columna cambia. El
contenido sigue congelado —comparado columna por columna— y lo único que avanza es el ciclo de
vida: `estado`, `firmado_en` y `actualizado_en`.

**Por qué 22 pruebas de esquema en verde no lo vieron:** el trigger sí tenía pruebas —17 a 21— y
todas cubrían la misma mitad, la del contenido congelado. Ninguna comprobaba que el estado pueda
avanzar. Es la forma más cara de un hueco: no falta la prueba de algo que nadie escribió, falta
**la contraparte** de una que sí existe. Se agregaron las 31-35.

- **Si la intención es que el contrato se pueda firmar** —y `FirmadoEn` y el alcance apuntan
  fuerte a eso—, el trigger está de más: tiene que dejar avanzar `estado`, `firmado_en` y
  `actualizado_en`, y seguir prohibiendo el resto. Eso se hace moviendo la comprobación del
  `WHEN` al cuerpo de la función, comparando columna por columna.
- **Si la intención es que Autorizado sea el final**, entonces sobran dos valores del enum,
  `FirmadoEn`, tres filas de `Transiciones` y el endpoint que las ofrece.

**La pantalla se dejó reflejando `Transiciones`**, que es el contrato documentado del servidor, y
no recortada a la única transición que hoy funciona. Recortarla escondería el defecto detrás de
una decisión de interfaz, y entonces nadie volvería a mirarlo. Hoy el intento falla mostrando el
texto del motor, que dice la verdad aunque no la diga bien: «El contrato ya no se puede
modificar», cuando lo que se pidió fue avanzar su estado.

#### El defecto de proyección, cerrado

Con Contratos y las dos Órdenes quedan corregidos **los 13 servicios** que escribían su
proyección como método. La barrida sobre `src/Maquinaria.Infraestructura/Servicios/` confirma:

- **Ninguna proyección por llamada a método.** Las únicas coincidencias son comentarios que
  describen la forma vieja.
- **Ningún `ToString()` dentro de un árbol.** Los dos que quedan —`ServicioEquipoTarifasEf` y
  `ServicioCotizacionesEf`— están en el `ADto()` de su `record Fila`, o sea del lado del cliente,
  que es exactamente donde tienen que estar.

#### El ciclo del contrato, probado de punta a punta

| Paso                                                | Resultado                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| Crear desde una renta                               | Vigencia y depósito tomados de la renta                             |
| Casilla de cláusula **sin marcar**                  | Copia la obligatoria sola, marcada «Del catálogo»                   |
| Segundo contrato, misma renta                       | 409: «La renta REN-2026-00001 ya tiene contrato»                    |
| Autorizar sin cláusulas                             | 409, el que la tabla de transiciones no puede predecir              |
| Cláusula redactada a mano                           | Aparece como «Propia»                                               |
| Borrador → Autorizado → **Firmado** → **Terminado** | Funciona tras la migración; `firmadoEn` tiene valor por primera vez |

Fijado con `contrato.spec.ts` (6 casos), que existe sobre todo para que la fila
`Autorizado → [Firmado, Terminado]` **no se recorte**: recortarla sería volver a esconder el
defecto en vez de arreglarlo.

#### Las Órdenes se corrigieron sin pantalla delante

Rompiendo el criterio de «se arregla al llegar a su pantalla». La razón: el arreglo es mecánico y ya probado cinco veces, y agruparlo
ahorra un reinicio del backend. Lo que NO se ahorra es la comprobación: las pantallas del paso 10
siguen pendientes y ese arreglo sigue **sin verificarse contra datos reales**, igual que estaba.

### Paso 10 — Órdenes de compra y de venta, y el alcance cerrado (2026-08-28)

Cuatro pantallas y un grupo de menú nuevo, **COMPRAS**, que es el otro lado del mostrador: no va
en COMERCIAL —eso es lo que se le vende al cliente como servicio— sino aparte.

Las dos usan el módulo `compras`, **incluida la de VENTA**, y no es un descuido: así lo declara
el servidor, con `[RequierePermiso("compras.consultar")]` en los dos controladores. El menú
filtra por lo que el permiso exige, no por lo que el nombre sugiere.

#### Finalizar no es un cambio de estado, y cada una hace lo contrario de la otra

|            | Qué hace finalizar                                                                           |
| ---------- | -------------------------------------------------------------------------------------------- |
| **Compra** | **Registra cada línea como un equipo del catálogo.** Es por donde entra maquinaria al parque |
| **Venta**  | **Saca los equipos del parque y les CIERRA el calendario**                                   |

Lo segundo es lo que conecta esta pantalla con la garantía que sostiene la fase: sin cerrar el
calendario, una máquina vendida seguiría apareciendo libre y alguien la rentaría.

Las dos son **todo o nada**, y `PATCH .../estado` con `Finalizada` responde **400** —«usa el
endpoint de finalizacion»—, no 409: es una petición mal dirigida, no un conflicto. La guarda vive
en el SERVICIO y no en el controlador, al revés que en Rentas; se comprobó antes de asumir que
faltaba.

#### Tres decisiones de la interfaz que vale la pena tener escritas

**El código interno se pide al FINALIZAR, no al capturar la línea.** Es una decisión de
inventario, no de compra: cuando se cotiza la máquina todavía no se sabe con qué número entra al
parque. El panel pide los datos de TODAS las líneas de golpe porque el Proceso es todo o nada;
pedirlos de una en una sugeriría que se van registrando por separado.

**Una línea es UNA máquina.** La cantidad tiene que ser 1 si va a registrar equipo, porque
`orden_compra_detalle` tiene un solo `equipoId` con índice único. Tres excavadoras iguales son
tres líneas — que además es lo correcto, porque cada una tiene su número de serie.

**El desplegable de venta SÍ se recorta, y el de contratos no.** Un equipo marcado solo para
`Renta` lo rechaza el servidor; aquí se filtra localmente por `proposito`. Parece contradecir la
decisión del paso 9, y no lo hace:

> La regla no es «filtrar siempre» ni «nunca». Es **filtrar solo con lo que la respuesta ya
> trae**. `proposito` viaja en cada fila del equipo, así que el recorte es exacto. Saber qué
> rentas ya tienen contrato exigía cruzar con una segunda lista paginada, y ese cruce habría
> quedado incompleto en silencio pasadas 200 filas.

`FiltroEquipos.Proposito` existe pero admite UN valor, y aquí hacen falta dos —`Venta` y
`RentaYVenta`—, así que la consulta no puede expresarlo de todos modos.

#### El ciclo completo, probado contra la API real

| Paso                                                 | Resultado                                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Crear orden de compra                                | `OC-2026-00001`, con el proveedor resuelto — **verifica la proyección corregida sin pantalla delante** |
| Agregar línea                                        | Caterpillar 320D, serie, año, $1,850,000                                                               |
| Autorizar                                            | Las líneas pasan a solo lectura                                                                        |
| Finalizar **sin llenar los datos**                   | El aviso sale **al pulsar**, no antes: los campos viven fuera del `FormGroup` y no tienen `touched`    |
| Finalizar con datos                                  | → Finalizada, y la columna pasa de «Se registra al finalizar» a `ZZ-COMPRA-01`                         |
| **La máquina en `/equipos`**                         | Aparece con su serie, tipo y ubicación                                                                 |
| Vender una máquina marcada solo-renta                | El servidor la rechaza; ahora ni se ofrece                                                             |
| Crear venta, agregar el equipo, autorizar, finalizar | → Finalizada                                                                                           |
| **La máquina en `/disponibilidad`**                  | **Ya no aparece libre.** El calendario quedó cerrado                                                   |

Ese último renglón es el círculo entero: comprar → entra al parque → vender → sale y deja de
poder rentarse.

Y el desplegable de ubicación al registrar ofrece solo bodegas y patios, no sucursales:
`selectorAlmacenes` otra vez.

`ng build` limpio, **240 pruebas** en verde, `axe-core` 0 violaciones en las dos listas.

### El eslabón que faltaba — convertir una cotización aceptada en renta (2026-08-28)

Con esto el ciclo del alcance —cotizar → aprobar → **rentar** → cerrar— deja de tener un salto a
mano en medio.

#### Qué se perdía sin esta pantalla

El endpoint existía y `ApiRentas.desdeCotizacion` ya lo llamaba, pero **nada lo ofrecía**. La
renta se recapturaba, y el problema no era el trabajo:

- **El precio se tecleaba.** El backend copia los precios CONGELADOS justamente para que «el
  número que el cliente recuerda y el que el sistema factura» sean el mismo. Recapturando, una
  cifra mal tecleada no la detecta nada.
- **El vínculo no existía nunca.** `cotizacionId` solo lo pone este endpoint, así que
  `RentaDto.cotizacionFolio` era siempre nulo y el detalle decía «Sin definir» para siempre. Otro
  campo del modelo que ninguna ruta podía llenar — el tercero de la fase, después de `firmadoEn`
  y de los dos estados muertos del contrato.

#### Dónde vive y por qué

En el **detalle de la cotización**, como acción primaria cuando está Aceptada. Es el paso
siguiente del ciclo, así que se lleva el amarillo y «Cambiar estado» pasa a secundaria.

Pide solo lo que la cotización no tiene: **periodo, lugar, depósito y anticipo**. El cliente, el
responsable, el descuento y los impuestos se arrastran solos.

**No navega solo a la renta al terminar**, y ese es el detalle que importa: `pendientes` viene en
esa respuesta y en ningún otro sitio. Saltar a la renta lo tiraría, y nadie se enteraría de que
hay líneas sin máquina — hasta que la renta no se dejara confirmar, sin explicación.

#### El hueco que apareció al probarlo

`pendientes` se produce cuando una línea se cotizó por TIPO de equipo. Y resulta que **el
formulario de línea mandaba `tipoEquipoId: null` fijo**: desde la aplicación no se podía cotizar
por tipo, así que ese camino era inalcanzable y el bloque de pendientes, decoración.

Se agregó el campo. Se deshabilita si ya se eligió una máquina concreta, porque entonces sobra:
la conversión mira `equipoId` primero y el tipo solo cuenta cuando no hay equipo.

Es el mismo patrón que ya apareció tres veces esta fase — **una capacidad del modelo que ninguna
pantalla podía ejercer**—, y esta vez salió porque la pantalla que la consume se construyó
primero.

#### Probado de punta a punta

| Caso                             | Resultado                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Convertir una NO Aceptada        | El botón ni se dibuja; el 409 del servidor queda de red                                             |
| Línea con equipo                 | Pasa a la renta **con el precio cotizado**                                                          |
| Línea sin equipo ni tipo (flete) | Va a «Otros cargos», no a equipos                                                                   |
| **Línea por TIPO**               | **Sale en `pendientes`**: «2 x Excavadora 20 (Tarifa de flete) a 4,200.00: falta asignar el equipo» |
| El vínculo                       | El detalle de la renta ya muestra `COT-2026-00001`, y la nota «Desde cotizacion COT-2026-00001»     |

`ng build` limpio, **240 pruebas** en verde.

### Límites por empresa, y las hojas pasaron a paneles — 2026-09-01

Dos cosas del panel de plataforma, no de la aplicación de empresa.

#### Los cupos de una empresa se administran desde su fila

`tenant_limite` existía desde la Fase 0 y **no tenía API ni pantalla**. Ahora sí: botón
«Límites» en cada fila de `/empresas`, y un panel con los cuatro tipos.

| Verbo    | Ruta                                              |
| -------- | ------------------------------------------------- |
| `GET`    | `/api/plataforma/empresas/{slug}/limites`          |
| `PUT`    | `/api/plataforma/empresas/{slug}/limites/{clave}`  |
| `DELETE` | `/api/plataforma/empresas/{slug}/limites/{clave}`  |

Los tres devuelven **la lista completa ya actualizada**, así que el panel se repinta de la
respuesta y no puede quedarse enseñando el estado anterior. Es el mismo criterio que
`CambiarActivoAsync` con el plan.

Cuatro decisiones que no son obvias:

- **Salen siempre los cuatro tipos**, tenga o no fila la empresa. `tenant_limite` es dispersa
  —solo guarda excepciones— y enseñar únicamente las filas existentes pintaría una empresa
  recién dada de alta como si no tuviera límites, cuando lo que pasa es que los hereda todos.
- **Cada fila dice de dónde sale su número**: «Negociado» si hay excepción, «Por defecto (…)»
  si no. Sin eso, `300` y `300` se leen igual viniendo de un acuerdo con el cliente o del
  catálogo, y el botón de quitar aparecería sin explicación.
- **Quitar borra la fila; no escribe el valor por defecto en ella.** Con la fila puesta, el día
  que cambie el catálogo esa empresa se queda anclada al número viejo sin que nadie lo pidiera.
- **La pantalla avisa de que todavía no se aplican.** Nada en el sistema lee estos valores para
  bloquear una operación —está en `maquinaria-backend/docs/guias/estado-y-pendientes.md`—, y un
  panel que deja fijar un cupo promete que el cupo se respeta. Callarlo sería dejar que alguien
  confíe en un tope que no existe.

El backend guarda con seguimiento y `SaveChanges`, no con `ExecuteUpdateAsync`, **a propósito**:
mover el cupo de un cliente es de las decisiones más privilegiadas del sistema y el interceptor
de auditoría solo ve lo que pasa por `SaveChanges`.

#### La hoja inferior se borró: un solo patrón de formulario

Las tres capas de plataforma —alta de empresa, alta de plan y los límites— pasaron de
`disposicion/hoja.ts` a `disposicion/panel-lateral.ts`. Con eso la hoja se quedó **sin ningún
llamador**, y se borró: el componente, su plantilla, sus 6 pruebas del gesto y su CSS
(`hoja-inferior`, `hoja-en-gesto`, su `::backdrop`). Son **111 líneas menos de `styles.css`**.

El reparto anterior era «hoja en plataforma, panel en empresa», con el argumento de que en
plataforma los formularios son cortos y no hay una tabla debajo compitiendo por la atención.
**Las dos mitades eran falsas**: el alta de una empresa tiene siete campos, y la lista de
empresas es justo lo que la hoja tapaba al subir.

Lo que se perdió, dicho en voz alta: el gesto de arrastre y los anclajes. Un panel tiene un solo
tamaño. En un teléfono se ve como se veía la hoja abierta del todo, sin el arrastre — y eso lo
resuelve la utilidad `panel-lateral`, que ya era responsiva, no cada pantalla.

Un defecto que destapó la migración: **el panel de límites no llevaba `[pie]`**, y ese hueco es
un contenedor con `border-t`, así que vacío pinta un filete suelto al fondo. Se le puso su botón
de cerrar. De los 38 paneles de las pantallas de empresa, los 38 tienen pie: era el único fuera
de norma.

#### Comprobado, y lo que no

`ng build` limpio y **234 pruebas en 20 archivos**, todas pasan (eran 240 en 21; las 6 que
faltan se fueron con la hoja). El paquete inicial bajó de 501.42 a **500.22 kB**.

**No se ha visto en el navegador.** La pantalla vive detrás del login de superadministrador.
Falta comprobar a 375, 768 y 1280: que el panel no tape la tabla en el ancho grande, que a 375
ocupe todo el ancho sin hueco a la derecha, los tres caminos de cierre, y que «Sin límite»
deshabilite el número y `[Quitar]` solo salga donde dice «Negociado».

#### Y una deuda que esto destapó

El paquete inicial está **rozando el budget de aviso de 500 kB** —ya estaba en 499.67 antes de
tocar nada—, así que casi cualquier pantalla nueva lo cruza. La sospecha es que `textos.ts`, con
los dos idiomas, viaja en el arranque. El README dice 373.59 kB y está desactualizado en ~126 kB.

### Lo que sigue, en orden

**El alcance de la Fase 1 tiene pantalla completa.** Los 136 endpoints tienen cliente y ninguna
capacidad del modelo quedó sin forma de ejercerse.

Lo que queda no son pantallas:

1. **Asignar la máquina de un pendiente desde la renta.** Hoy la conversión los informa y hay que
   ir a agregar la línea a mano, releyendo el texto. Un botón que precargue tarifa, cantidad y
   precio del pendiente ahorraría el retecleo — y es el mismo argumento del precio congelado.
2. **Las pruebas del backend no se han corrido desde el 2026-08-27.** Exigen parar la API; está
   anotado en el documento del backend con la tabla de qué se comprobó de cada servicio.
3. **`prettier --check` no sirve como puerta**: marca 73 archivos por finales de línea, todos
   preexistentes y con el contenido idéntico. Hasta resolverlo no se puede usar en CI.
4. Pendiente arrastrado: **`/inicio` sigue diciendo «Implementados 0»**.
5. **Convertir una cotización aceptada en renta.** El endpoint existe
   —`POST rentas/desde-cotizacion/{id}`— y `ApiRentas.desdeCotizacion` ya lo llama, pero
   **ninguna pantalla lo ofrece todavía**. Es el eslabón que une los pasos 7 y 8, y lo que
   falta es dónde ponerlo: pide un periodo y un lugar que la cotización no tiene, así que es
   un panel propio, no un botón suelto. Su respuesta trae `pendientes` —las líneas cotizadas
   por TIPO, que no pasan a la renta porque cada línea necesita máquina concreta— y eso hay
   que enseñarlo, no descartarlo en silencio.
6. Pendiente arrastrado: **`/inicio` sigue diciendo «Implementados 0»** con las 21 pantallas de
   módulo funcionando. La causa es literal —`const IMPLEMENTADOS = new Set<string>()`, vacío en
   `inicio.ts:27`— y ahora que el alcance está casi cerrado ya se puede llenar de una vez en
   lugar de irlo persiguiendo.

   Ojo con la cifra: **21 son las carpetas de `paginas/empresa/` sin contar las cuatro de acceso
   ni `inicio`**, e incluye las de DETALLE —expediente, cotización, renta, contrato—, que no
   tienen entrada de menú propia. Los módulos del plan son menos que las pantallas.

### Estado del backend, por pantalla que falta

De 33 servicios, 13 escribían su proyección como método y EF la evaluaba en el CLIENTE.
**Los 13 están corregidos desde el 2026-08-28**, y una barrida sobre `Servicios/` confirma que
no queda ninguna proyección por llamada a método ni ningún `ToString()` dentro de un árbol.

La tabla se deja como historial de en qué orden fueron apareciendo y con qué se comprobó cada
uno — **las dos Órdenes son las únicas que se corrigieron sin pantalla delante**, así que su
arreglo compila y está razonado pero no se ha visto funcionar:

| Paso | Pantalla             | Servicio                     | Qué pasa                                                                    |
| ---- | -------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| 4    | Clientes             | `ServicioClientesEf`         | ~~N+1, no truena~~ **TRUENA** · corregido 2026-08-28                        |
| 4    | Proveedores          | `ServicioProveedoresEf`      | ~~N+1, no truena~~ **TRUENA** · corregido 2026-08-28                        |
| 5    | Expediente de equipo | `ServicioDocumentosEquipoEf` | ~~truena~~ corregido 2026-08-28                                             |
| 7    | Cotizaciones         | `ServicioCotizacionesEf`     | ~~truena~~ corregido 2026-08-28 · **y además un `ToString()` sin traducir** |
| 8    | Rentas               | `ServicioRentasEf`           | ~~truena~~ corregido 2026-08-28 · sin `ToString()`, se buscó                |
| 9    | Contratos            | `ServicioContratosEf`        | ~~truena~~ corregido 2026-08-28 · sin `ToString()`, se buscó                |
| 10   | Órdenes de compra    | `ServicioOrdenesCompraEf`    | ~~truena~~ corregido y **verificado** 2026-08-28                            |
| 10   | Órdenes de venta     | `ServicioOrdenesVentaEf`     | ~~truena~~ corregido y **verificado** 2026-08-28                            |

> **La clasificación «no truena» de esas dos filas era FALSA**, y se comprobó dando de alta la
> primera fila desde la pantalla de Proveedores: el endpoint pasó a responder **500**. La
> proyección en memoria lanza su conteo sobre la MISMA conexión mientras el lector del listado
> sigue abierto. Con la tabla vacía no se nota —el `Select` no corre sobre nada—, que es
> exactamente por qué la clasificación se escribió mal: se miró con las tablas vacías.

«Truena» es `NullReferenceException` **en cuanto la tabla tenga una fila**, no antes: con cero
filas el `Select` no corre sobre nada y todo parece bien.

> **El `ToString()` de un enum es OTRO defecto, y no espera a la primera fila.** La traducción a
> SQL ocurre antes de ejecutar, así que la consulta revienta con la tabla vacía. Apareció en
> Cotizaciones al crear la primera —`CrearAsync` llama a `ObtenerAsync`— y devolvió 500 **con la
> fila ya guardada**. Al llegar a cada pantalla que falta hay que buscar los DOS: proyección
> escrita como método, y `ToString()` dentro de un `Select`. El arreglo y su razonamiento están en
> `maquinaria-backend/docs/guias/estado-y-pendientes.md`, sección «Las proyecciones se evaluaban
> en el cliente».

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

| Medida      | Valor                                |
| ----------- | ------------------------------------ |
| Endpoints   | **136** en 30 controladores MVC      |
| Compilación | 0 errores, 0 advertencias            |
| Pruebas     | **339** en verde                     |
| Migraciones | 5 en la central, 8 en las de empresa |

Las once rebanadas de la Fase 1 están escritas. El backend **no bloquea** al frontend en
nada, salvo los dos huecos de §3.

### Frontend

| Medida       | Valor                                            |
| ------------ | ------------------------------------------------ |
| Pruebas      | **148** en 10 archivos                           |
| Componentes  | 26, todos `OnPush`, ninguno con HTML en el `.ts` |
| Aplicaciones | 3, por subdominio                                |

La Fase 0 está cerrada: accesos, guards, interceptores de token y refresco, i18n en dos
idiomas, armazones y navegación. El panel de plataforma está en pie.

**La aplicación de empresa tiene UNA pantalla**: `/inicio`. Nada más.

### El hueco, en números

|                                     |                                               |
| ----------------------------------- | --------------------------------------------- |
| Endpoints que el front consume hoy  | **19** — 11 de plataforma, 8 de autenticación |
| Endpoints **sin una sola pantalla** | **117**                                       |

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

| Clave de módulo  | Pantallas que desbloquea                                         | Endpoints |
| ---------------- | ---------------------------------------------------------------- | --------- |
| `equipos`        | Marcas · Modelos · Tipos · Categorías · Equipos · Transferencias | 48        |
| `rentas`         | Tarifas · Rentas                                                 | 20        |
| `contratos`      | Cláusulas · Contratos                                            | 12        |
| `compras`        | Órdenes de compra · Órdenes de venta                             | 14        |
| `usuarios`       | Puestos · Trabajadores                                           | 10        |
| `clientes`       | Clientes                                                         | 5         |
| `proveedores`    | Proveedores                                                      | 5         |
| `cotizaciones`   | Cotizaciones                                                     | 7         |
| `disponibilidad` | Disponibilidad                                                   | 4         |
| `sucursales`     | Ubicaciones                                                      | 5         |

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
campo —su identidad _es_ el nombre, con `UNIQUE` encima—, `categoria_equipo` tiene código,
nombre y descripción, y `modelo_equipo` cuelga de dos llaves foráneas. **No abstraer un
componente genérico de catálogo con un solo ejemplo escrito**; ver §10.5 del plan del
backend.

**Cuatro CRUD con estado:** Ubicaciones, Trabajadores, Clientes y Proveedores. Igual que un
catálogo pero con más campos, y con `PATCH {id}/estado` en lugar de `/activo` en Clientes y
Trabajadores.

**Equipos: lista más expediente.** Seis endpoints propios y dos recursos anidados —cuatro de
documentos y tres de tarifas—. El expediente es una pantalla de detalle, no una hoja.

**Comercial: maestro-detalle con máquina de estados.**

| Pantalla     | Endpoints | Lo que la hace distinta                                                                                                                     |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Cotizaciones | 7         | Líneas que se agregan y quitan una por una, más `PATCH {id}/estado`                                                                         |
| **Rentas**   | **15**    | **Cinco procesos**: confirmar, extender, cerrar, cancelar y crear desde cotización. Líneas _y_ conceptos, que son dos colecciones distintas |
| Contratos    | 7         | Cláusulas que se enganchan del catálogo, más `GET por-renta/{rentaId}`                                                                      |

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

| Campo               | Regla                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `texto`             | Búsqueda libre. Cada módulo decide sobre qué columnas aplica                                  |
| `activo`            | **Nulo trae activos e inactivos**, que no es lo mismo que `false`                             |
| `incluirEliminados` | Exige el permiso `.eliminar` del módulo                                                       |
| `numero`            | **Base 1**, como lo cuenta la gente                                                           |
| `tamano`            | Por defecto 50, **techo 200**                                                                 |
| `orden`             | Se valida contra lista blanca en el servidor; un valor no reconocido cae al orden por defecto |

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

| Razón          | HTTP    | Cuándo                                           | Qué hace la pantalla                               |
| -------------- | ------- | ------------------------------------------------ | -------------------------------------------------- |
| `Invalido`     | **400** | Dato mal capturado                               | Marcar el campo                                    |
| `NoEncontrado` | **404** | La fila no existe o está borrada                 | Aviso y volver a la lista                          |
| `Conflicto`    | **409** | Choca con el estado o con una garantía del motor | **Explicar el choque.** Es el caso del no-traslape |

Los tres llegan como `ProblemDetails`; el texto sale de `detail` y **no se traduce en el
front** —está redactado en el servidor para ser uniforme—. Ver la regla en `AGENTS.md`.

**El 409 merece trato propio en las pantallas de renta y disponibilidad.** Un "Error al
guardar" convierte la mejor garantía del producto en un fallo genérico.

---

## 6. api:sync — HECHO el 2026-08-27

Se hizo **antes de la primera pantalla**, no después. Cierra los pendientes 13, 14 y 18.

### Qué herramienta, y por qué

| Herramienta                           | Genera                             | Veredicto   |
| ------------------------------------- | ---------------------------------- | ----------- |
| **`openapi-typescript` 7.13.0**       | **Solo tipos**                     | **Elegida** |
| `orval`                               | Tipos más hooks y servicios        | Descartada  |
| `@openapitools/openapi-generator-cli` | Servicios Angular con `HttpClient` | Descartada  |
| `ng-openapi-gen`                      | Servicios Angular                  | Descartada  |

Las tres descartadas generan **servicios con `HttpClient` y Observables**, y eso pelea de
frente con las convenciones de este repo: el `httpResource` vive en el servicio, se exponen
`Signal<T>`, hay recursos compartidos que se piden una sola vez, `undefined` significa "no
pidas todavía" y el refresco va serializado. Código generado no sabe nada de eso, y mantener
las dos capas cuesta más que escribir la delgada a mano.

**Lo que hacía falta no era un cliente generado: era que los contratos de datos dejaran de
escribirse a mano.** `api.ts` se queda como está.

### Los dos archivos, y por qué son dos

| Archivo                      | Qué es                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `nucleo/api/**generado.ts**` | Salida cruda de la máquina, ~9,100 líneas. **El nombre es la advertencia**: no se edita nunca                             |
| `nucleo/api/contratos.ts`    | La superficie curada, a mano. Re-exporta con nombres del dominio: `export type Marca = components['schemas']['MarcaDto']` |

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

| Defecto               | Alcance        | Qué producía                                     |
| --------------------- | -------------- | ------------------------------------------------ |
| Numéricos como unión  | **279 campos** | `readonly modelos: number \| string`             |
| Enums sin sus valores | **15 tipos**   | `EstadoRenta = number`. Nada impedía mandar `99` |

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

| #     | Pantalla                        | Estado                | Depende de        | Por qué en este lugar                                                 |
| ----- | ------------------------------- | --------------------- | ----------------- | --------------------------------------------------------------------- |
| **1** | **Marcas**                      | **hecha**             | —                 | **Define el patrón de pantalla de módulo.** Cinco endpoints, un campo |
| 2     | Los otros seis catálogos        | **hechas**            | 1                 | Mismo molde                                                           |
| 3     | Ubicaciones · Trabajadores      | Ubicaciones **hecha** | 2 (puestos)       | Trabajador cuelga de puesto                                           |
| 4     | Clientes · Proveedores          | —                     | —                 | CRUD independiente                                                    |
| 5     | Equipos y su expediente         | —                     | 2, 3              | Su formulario consulta marca, modelo, tipo, categoría y ubicación     |
| 6     | Disponibilidad · Transferencias | —                     | 5                 | Sin equipos no hay calendario                                         |
| 7     | Cotizaciones                    | —                     | 4, 5, 2 (tarifas) | Cliente, equipos y conceptos cobrables                                |
| 8     | **Rentas**                      | —                     | 7                 | **Cierra el criterio de salida**                                      |
| 9     | Contratos                       | —                     | 8, 2 (cláusulas)  | Cuelgan de una renta                                                  |
| 10    | Órdenes de compra y de venta    | —                     | 4, 5              | Proveedor y equipo                                                    |

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

| Ancho | Resultado                                                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 375   | El `<body>` NO se desplaza en horizontal; la caja de la tabla sí (560 > 342). Cero elementos desbordando fuera de ella. Cero enfocables fuera de pantalla — el cajón se oculta de verdad, no solo se traslada |
| 768   | Sin desbordes; la tabla de 4 columnas cabe sin desplazamiento                                                                                                                                                 |
| 1280  | Sin desbordes; menú en columna fija                                                                                                                                                                           |

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

| Documento dice                                                           | Realidad en el repo                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `06-alcance-fase1.md` §2: M25 Usuarios y permisos "Construido"           | Sin endpoints de empresa (§3.1)                                                             |
| `06-alcance-fase1.md` §2: M4 Clientes incluye "obras"                    | No existe la entidad ni la tabla (§3.2)                                                     |
| `inicio.ts`: `IMPLEMENTADOS = new Set(['usuarios'])`                     | No hay ruta `/usuarios`                                                                     |
| `01-arquitectura.md` §10.6a: se genera el **cliente HTTP** y se commitea | Se generan **solo los tipos**; `api.ts` sigue a mano. Desviación consciente, razonada en §6 |
| `01-arquitectura.md` §10.6a: el cliente va en `src/app/core/api/`        | Va en `src/app/nucleo/api/`. No existe `core/` en este repo                                 |

**Cerrada en esta revisión:** `api:sync` no existía y los tipos estaban escritos a mano. Hoy
existe, junto con `api:check`, y el documento OpenAPI del backend se corrigió para que valga
la pena generarlos (§6).

Cuando el disco y el documento no coinciden, **gana el disco** y se corrige el documento.
