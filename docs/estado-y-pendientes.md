# Estado y pendientes

Última verificación: 2026-09-09 (compilando; **no** en el navegador).

## Agregar equipo a una renta, como en cotizaciones — 2026-09-09

Tres cosas en el mismo panel, pedidas juntas: los cargos dentro, el cálculo a la vista y la obra
creable.

### Los cargos, en el mismo formulario

Es la maquinaria de `cotizacion.ts` trasplantada, con sus cuatro trampas ya conocidas:

- **`FormArray.controls` se muta en el sitio**, así que empujar una fila no despierta a nadie:
  `versionCargos` + una copia en el `computed`.
- **`track fila` y no `track $index`**: con el índice, Angular reutiliza los nodos y
  `formGroupName` sigue apuntando al grupo descartado — el arreglo tiene los valores buenos y
  los campos muestran los viejos.
- **`markAsPristine()` tras `clear()` + `push()`**, o el prellenado deja de ocurrir a partir de
  la segunda línea, para toda la vida del componente.
- **El efecto lee `cargos.pristine` directo y no a través de un `computed`** que dependa de
  `versionCargos`, o se dispara a sí mismo sin fin.

Las cuatro están en `CLAUDE.md` porque cada una costó un arreglo. Aquí no costaron ninguno: se
escribieron ya bien, que es para lo que sirve haberlas anotado.

Al elegir la máquina llegan sus precios cargados —una fila por concepto y **una vacía al final**
para agregar más— y cada fila avisa si su cifra se aparta de la del equipo, con un botón para
volver. **Cambiar una cifra no toca `equipo_tarifa`**: cambia lo que se guarda en esta renta.

### El cálculo, a la vista

Debajo del costo de la máquina: «Se calcula: 2.54 Día × $2,500.00 = $6,350.00. Escribe una cifra
para apartarte». Es exactamente lo que el servidor va a poner si el campo se deja en blanco.

**Se enseña porque un número que aparece solo después de guardar no se revisa.** Y cuando la
máquina no tiene costo para esa unidad sale el otro mensaje —«no tiene costo cargado por Día, así
que saldrá en cero»— en lugar de un cero silencioso en el total del contrato. Las dos ramas
tienen datos reales en `maquinaria_prueba`: MQ01TOLUCA tiene los cuatro costos, ZZ-COMPRA-01
ninguno.

`unidadesDelPeriodo` viene del DTO; lo que se calcula aquí es solo la multiplicación.

### La obra, escribiéndola

El `<select>` de obras pasó a ser un **`datalist`**: se teclea, el navegador filtra entre las
obras de **este cliente** —el servidor rechaza la de otro— y si lo escrito no está, el panel
revela el código y el domicilio y **la crea al guardar**. Con un `<select>` cerrado, una renta a
una obra nueva obligaba a salir a Proyectos, darla de alta y volver.

**La ubicación no se pregunta**: el alta de obra abre las dos filas —la obra y su ubicación de
tipo Proyecto— en una transacción del servidor. Eso ya era así desde el MVP; lo que faltaba era
poder llegar ahí desde aquí.

Son dos peticiones encadenadas y en ese orden: sin la obra no hay id con el que relacionar la
línea. Un fallo al agregar la línea deja la obra creada, y es lo correcto — una obra es un
catálogo del cliente y queda para el siguiente intento.

### Dos cosas que dejé anotadas en lugar de resolver

1. **El recorte de obras por cliente es local y tiene techo**: el selector pide 200 activas de
   una vez. Con más de 200 en la empresa, un cliente podría tener obras invisibles y alguien
   crearía una duplicada. Se acepta por lo mismo que el resto de los desplegables; el día que
   una empresa pase de 200 obras activas, se filtra en el servidor.
2. **La elección del costo por unidad está duplicada** con el servidor, a sabiendas: vive en
   `nucleo/api/costo-de-equipo.ts`, marcada como espejo en los dos lados, con tres pruebas
   probadas al revés —sabotearla tumba las tres—.

### Comprobado

`ng build` limpio, **334 pruebas** (tres más), i18n simétrica, Prettier limpio en lo tocado.

> **Sin abrir en el navegador con sesión iniciada.** Y `maquinaria_prueba` ya tiene 1 obra y un
> solo cliente, así que el `datalist` va a mostrarla.

---

## Asignar la obra de una máquina, que no se podía — 2026-09-09

**Yo había dicho que esto ya estaba, y no.** El panel de alta de línea sí ofrece la obra; lo que
no existía era **cambiarla después**, y toda renta que viene de una cotización llega sin ella.

### El botón va en cada renglón, y NO solo en Borrador

Está fuera del `@if (esBorrador())` a propósito: la obra no toca el calendario y se sabe después
de confirmar. Lo que la cierra es que la máquina se haya entregado, y de eso responde el
servidor con un 409 — no la pantalla, porque el estado de entrega es suyo.

### El sitio de entrega solo aparece SIN obra

Con obra sale de ella —tiene ubicación obligatoria— y el servidor **rechaza** uno que la
contradiga. Ofrecer los dos campos sueltos, como estaba el alta hasta hoy, era ofrecer un 400:
elegías obra y sitio, y la petición se caía. Ahora con obra se enseña el sitio que va a quedar,
que es la mitad útil del campo.

Eso hay que arreglarlo **en los dos paneles** —el alta y el nuevo— y por eso la condición vive
en un `computed` compartido, `obra(id)`, con un `toSignal` por formulario: un `FormGroup` no es
reactivo y un `computed` que lo lea directo se queda con el primer valor. Es la trampa que ya
costó varios arreglos en este repo.

### El tropiezo: el orden de los campos ES el orden de ejecución

Puse los dos `toSignal` con las demás señales, arriba, y los formularios se declaran más abajo:
**TS2729, «used before its initialization»**. Un campo de clase no puede leer otro declarado
después. Movidos detrás de los formularios, con la razón escrita al lado.

### Comprobado

`ng build` limpio, **331 pruebas**, i18n simétrica, Prettier limpio en lo tocado.

> **Sin abrir en el navegador con sesión iniciada.** Y el desplegable de obras va a salir
> **vacío**: `maquinaria_prueba` no tiene ninguna. Sale el aviso que lo dice.

---

## La renta lee su estructura, ya no la reconstruye — 2026-09-09

**Esta entrada borra la de abajo, escrita esa misma tarde.** `agruparPorEquipo` y sus cinco
pruebas duraron unas horas.

### El agrupamiento se fue al modelo

La pantalla agrupaba las líneas planas por máquina para leer la renta como una cotización,
porque `renta_linea` tenía una fila por *(equipo, concepto)*. Esa tarde la tabla pasó a tener
**una fila por máquina con sus cargos dentro**, así que el DTO llega agrupado y agrupar aquí
sería rehacer lo que el modelo ya dice.

Se fueron `BloqueDeEquipo`, `agruparPorEquipo` y las cinco pruebas que fijaban sus decisiones
—el orden de captura, el bloque sin línea de máquina, el importe como suma—. Las tres las
garantiza ahora el modelo. **Y con ellas se fue la única prueba automática de esto**: ninguna de
las 547 del servidor construye un `AltaRentaLinea`, así que lo que verifica el cambio es el
ensayo contra la base, no la suite.

### La tabla, ahora casi idéntica a la de la cotización

Un `tbody` por máquina: arriba su costo, su cantidad y el total del renglón; debajo una fila por
cargo, sangrada. Se fue la columna «Modelo» —pasa debajo del código, con el destino y la obra— y
el costo de cada cargo sale en las dos columnas de horómetro, que son de la máquina y no del
cargo: §8 pide separar precio cobrado y costo real para el margen del flete.

### Un panel de cargo, dos destinos

Los campos son idénticos, así que es **el mismo panel**: con máquina el cargo va a su renglón;
sin ella, a los cargos de la renta. Lo decide `lineaDelCargo()`, y el título lo dice — sin él no
habría forma de saber cuál de las dos cosas se está haciendo. Dos paneles iguales con distinto
botón de guardar habrían sido dos sitios donde arreglar el mismo campo.

El prellenado del precio **se mudó** del panel de línea al de cargo: allí el precio dejó de ser
el de una tarifa —es el costo de la máquina, que pone el servidor del propio equipo— y aquí es
donde vive una tarifa del catálogo.

### «Asignar» copia ahora todos los conceptos

Precargaba UNO, porque una línea de renta llevaba una sola tarifa y los demás se habían pasado
como cargos de la renta. Ahora la línea lleva N, así que se copian **todos**, con el precio
cotizado, y el renglón de la renta queda igual que el de la propuesta.

### Dos tropiezos, los dos del compilador

1. **Un comentario HTML entre los atributos de una etiqueta no es HTML válido.** Angular lo
   rechaza con «Opening tag "app-panel-lateral" not terminated», que no menciona el comentario.
   Va antes de la etiqueta.
2. **`api:sync` corrido antes de terminar el backend** dejó `precioUnitario?: number` sin `null`,
   y el error salía en la pantalla y no en el sitio del problema. El contrato se regenera
   **después** del último cambio del servidor, no a mitad.

### Comprobado

`ng build` limpio, **331 pruebas** (cinco menos, las del agrupamiento), i18n simétrica, Prettier
limpio en todo lo tocado.

> **Sin abrir en el navegador con sesión iniciada.**

---

## El panel de conversión pregunta menos y adivina más — 2026-09-09

### Las fechas ya no se vuelven a teclear

`abrirConversion` reseteaba `inicio` y `fin` a cadena vacía, con las fechas propuestas de la
cotización visibles tres centímetros más arriba en la ficha. Ahora salen prellenadas de
`periodoInicio` / `periodoFin`.

**Con `aCampoLocal`, no con `slice(0, 16)`** sobre el ISO: eso enseñaría la hora de Greenwich en
un campo que significa hora de pared, que es el corrimiento de seis husos que `fecha-hora.ts`
existe para evitar. La función ya estaba escrita y ya tenía pruebas; era el único sitio donde
había que llamarla.

Y la ayuda dice **de dónde salen**. Dos campos ya llenos en un panel que se acaba de abrir se
leen como un valor por omisión cualquiera y nadie los revisa — y son los que apartan el
calendario. Cuando la cotización no propuso fechas, el texto cambia y lo dice.

### El selector de trabajadores vivió un día exacto

Entró el 2026-09-08, cuando la cotización dejó de llevar responsable y este panel heredó la
pregunta. Salió hoy, cuando la renta dejó de exigirlo. Con él se van tres claves de i18n y el
`validadorRequerido` del campo.

**El alta directa de una renta lo conserva, pero opcional.** Dejarlo obligatorio ahí habría
dejado una renta convertida —que ya no lleva responsable— **imposible de editar** sin nombrar a
alguien que nadie capturó: el formulario de edición se abre con el valor de la renta, y ese valor
es nulo. Es el tipo de bloqueo que no se ve al hacer el cambio y aparece a la semana.

Tres sitios más había que tocar por la misma razón, y ninguno lo dice el compilador con
claridad: la ficha del detalle pintaba `{{ r.trabajador }}` a pelo —ahora con `?? sinDato`, para
que un hueco no se lea como un fallo—, el reset de la edición necesitaba `?? ''` porque el
`<select>` es de texto, y el envío manda `null` en lugar de la cadena vacía.

`rentas.errorResponsable` **se queda**: lo sigue usando el panel de extensión, donde el
responsable sí es obligatorio porque `renta_extension.trabajador_id` no se aflojó.

### Depósito y anticipo, explicados en la pantalla

Se preguntó qué eran, y la respuesta estaba solo en el código. Ahora está debajo de cada campo:
el **depósito** es una garantía que se devuelve y **no baja el saldo**; el **anticipo** es un
pago a cuenta y **sí lo baja**. Los dos son dinero por adelantado y confundirlos descuadra la
cuenta del cliente.

Una respuesta que solo vive en una conversación se pierde en cuanto la persona que preguntó no
es la que captura.

### Comprobado

`ng build` limpio, **336 pruebas**, i18n simétrica, Prettier limpio en todo lo tocado. Y contra
la base: de las 5 cotizaciones de `maquinaria_prueba`, **3 traen periodo y 2 no**, así que las
dos ramas de la ayuda tienen datos reales que las ejercitan.

> **Sin abrir en el navegador con sesión iniciada.**

---

## Equipos, el nombre de la máquina y la renta con formato de cotización — 2026-09-09

Lo que quedaba de la petición grande. Tres cosas distintas, y una de ellas **deshace un aviso
que se había construido esa misma mañana**.

### El aviso de «precios que aún no rigen» se retiró completo

La entrada de abajo lo defendía con razón: la máquina tenía dos precios y solo se trajo uno,
porque el segundo empezaba en noviembre, y callarlo era la mitad de la confusión. Ese día se
construyó el sobre `aplican` / `noAplicanAun`, el aviso con su fecha y su equivalente de una
frase en la renta.

Horas después se retiró la vigencia de `equipo_tarifa`. **Sin vigencia no hay precios futuros
que avisar**: hay uno por concepto y punto. Se fueron el sobre, el aviso, el campo «vigencia
desde», su ayuda y las cuatro claves de i18n que lo escribían.

No es trabajo perdido: el aviso era la respuesta correcta al problema que había esa mañana. Lo
que cambió fue el problema.

### El expediente: el precio se corrige, y el concepto se crea desde ahí

Donde había **cerrar un precio con fecha** hay ahora **corregirlo o quitarlo**, contra el PUT y
el DELETE nuevos. El panel es uno solo para alta y corrección: en corrección el concepto se pinta
como texto y no como campo —cambiarlo sería otro precio— y **sigue en el formulario**, porque
`disable()` lo quitaría de `value`, que es la trampa que ya está en el CLAUDE.md.

Y el concepto **se escribe**, con `datalist`, como la marca y el modelo del alta de equipo. Era
un `<select>` cerrado que mandaba a la pantalla de Tarifas y de vuelta. Si lo escrito no está en
el catálogo, el panel revela lo que hace falta para darlo de alta —código, unidad, tipo y dónde
se cobra— y **se crea al guardar**, en dos peticiones encadenadas: sin la tarifa no hay id con el
que cargar el precio.

Dos decisiones que se ven en el panel:

- **Dónde se cobra es un desplegable de tres**, no dos casillas. La base exige que la tarifa
  aplique al menos a una cosa; con casillas, «ninguna de las dos» se vería bien y el servidor lo
  rechazaría. Un desplegable hace ese estado irrepresentable.
- **El código se sugiere y queda editable.** `codigoDesdeNombre` lo saca del nombre —«Renta por
  día» → `RENTA-POR-DIA`— y recorta a los 30 que caben en la columna: un código truncado por el
  servidor sería un 400 por algo que la pantalla ya sabía. Quien crea el concepto sabe mejor si
  su casa lo llama `RENTA-DIA`.

`mismoNombre` se mudó de `equipos.ts` a `nucleo/formularios/texto.ts` en cuanto tuvo un segundo
consumidor: un ayudante importado de una página a otra convierte esa página en librería sin que
nadie lo haya decidido.

### `descripcion` es el nombre, y sale en trece pantallas

Después del Código Interno en el formulario —donde era un `<textarea>` al final—, debajo del
código en la tabla del parque, y **al lado del código en cada referencia a una máquina**: los
cinco desplegables que la eligen, las líneas de renta y de venta, el historial de movimientos,
el taller, la disponibilidad y los dos reportes.

**Los DTOs mandan el código y el nombre sueltos y la pantalla los junta**, en dos funciones de
i18n: `comun.equipoEnLista` para un desplegable —«EX-001 — Excavadora 20 t · Caterpillar 320D»—
y `comun.equipoEnLinea` para un renglón, donde no hay modelo que poner —«Excavadora 20 t
(EX-001)»—. Antes la línea de cotización llegaba ya compuesta desde el servidor, y eso dejaba a
la línea nombrando la máquina de una forma y al desplegable que la eligió de otra.

Y las cuatro tarifas del equipo se rotulan **«Costo por hora/día/semana/mes»**: dejaron de ser un
precio sugerido y son de donde sale el costo que la cotización calcula sola.

### La renta se lee como la cotización

Se preguntó qué significaba «el mismo formato» y la respuesta fue **cómo se ve la información**,
no el modelo. Así que `renta_linea` sigue plana y la pantalla agrupa: un `tbody` por máquina,
arriba la renta con su cantidad, su precio y el **total del bloque** en negrita, y debajo sus
cargos sangrados. Dos niveles en una tabla, idéntico a la cotización.

La columna «Modelo» desaparece —pasa debajo del código, con el destino y el proyecto— y las nueve
columnas quedan en siete.

`agruparPorEquipo` es una **función pura exportada** y no un método privado, para que las cinco
pruebas midan esa función y no una copia suya. Fijan las tres decisiones que no se deducen
leyendo la plantilla: el orden es el de captura y no el del código —ordenar por código movería un
renglón de sitio al agregarle un cargo—, un bloque puede no tener línea de máquina, y el importe
del bloque es la suma.

### El tropiezo, que ya está en el CLAUDE.md

**Una coma final en una llamada dentro de una plantilla es un argumento más.** Prettier la exige
en el `.ts` de al lado y el parser de Angular no la acepta: «Unexpected token )» y «Expected 3
arguments, but got 4», cinco veces a la vez. Falla en `ng build`, así que se ve — la trampa es
que la costumbre viene del archivo vecino.

### Comprobado

**333 pruebas** (nueve más), `ng build` limpio, i18n simétrica, Prettier limpio en todo lo
tocado. Las cinco del agrupamiento se probaron **al revés**: sabotear la función tumba tres, así
que no son adorno.

Se retiraron siete claves de i18n que quedaron sin uso —las del propósito, el origen y los
precios futuros— y quedan seis huérfanas **anteriores** a este cambio, que no se tocan por no
ensanchar el diff.

> **Sin abrir en el navegador con sesión iniciada.**

---

## El prellenado sí ocurría: no se veía — 2026-09-09

Segundo fallo del mismo día en el mismo panel, y con un síntoma que costaba de creer: la nota
«Por defecto $2,000.00 / Hora» aparecía **debajo de un desplegable que decía «Sin definir»**, con
la cantidad en 1 y el precio en 0. El dato estaba bien; la vista no.

### `track $index` no vuelve a enlazar `formGroupName`

`ponerPrecios` vacía el arreglo y empuja grupos **nuevos**, ya con su valor. Con el índice como
clave, Angular reutiliza los nodos del DOM —el índice no cambió— y las directivas
`formGroupName` / `formControlName` **siguen apuntando a los grupos descartados**. De ahí la
incoherencia exacta que se veía: la nota se lee del arreglo nuevo, y los campos siguen atados a
los viejos.

Con `track fila` —identidad del grupo— reemplazarlo destruye y recrea el nodo, las directivas se
enlazan al grupo nuevo y el valor se pinta. Lo fija `filas-reemplazadas.spec.ts`, que mide **las
dos formas** en el DOM: la rota conserva el valor viejo, la buena lo repinta.

Es de la misma familia que las otras cuatro trampas de formularios reactivos: compila, no avisa,
y solo se ve usando la pantalla.

### Y el otro motivo por el que faltaba una tarifa

La máquina tenía dos precios asignados y solo se trajo uno: el segundo empieza el **27 de
noviembre**. La exclusión es correcta —prellenar con él pondría en la cotización una cifra que
todavía no rige— pero **callarla no**, y era la mitad de la confusión.

> **Todo lo de esta sección se retiró horas después**, cuando la vigencia salió de
> `equipo_tarifa`: sin vigencia no hay precios futuros que avisar. Ver la entrada de arriba. Lo
> que sigue describe por qué existió, que es la parte que se puede reutilizar.

Así que el endpoint dejó de devolver una lista y devuelve un **sobre**: `aplican` y
`noAplicanAun`. El panel prellena con el primero y **avisa del segundo con su fecha** —«Operador
Jornada — $800.00 / Jornada, desde el 27 nov 2026»—. Los cerrados sí se descartan sin decir
nada: un precio que ya no rige es histórico, y el histórico se consulta en el expediente.

En la renta, que lleva una sola tarifa por línea, el aviso es una frase: si la máquina no tiene
precio para ese concepto **pero sí tiene alguno que aún no rige**, lo dice.

### Y para que no vuelva a pasar por lo mismo

El campo «vigencia desde» del expediente salía **vacío**. El servicio lo lee como «ahora», que es
correcto y silencioso: nada decía que esa fecha decide desde cuándo rige el precio. Ahora arranca
en **hoy** —cambiarla es una decisión, no un efecto de no haber mirado el campo— y su ayuda avisa
de que una fecha futura deja el precio inactivo y no se traerá al cotizar.

`hoyEnCampo()` en `fecha-hora.ts` da la fecha en hora **local** y no en UTC, que es lo contrario
del resto de ese archivo: `toISOString()` da el día en Greenwich y al oeste, de las 18:00 en
adelante, el campo arrancaría en MAÑANA.

**324 pruebas** (dos nuevas), `ng build` limpio, i18n simétrica. Comprobado en el paquete
compilado que los textos nuevos llegaron.

> **Sin abrir en el navegador con sesión iniciada.** Lo que se comprobó del fallo es su mecánica,
> con una prueba que lo reproduce en el DOM.

---

## El prellenado dejaba de ocurrir, y una fila vacía para agregar — 2026-09-09

El cliente lo describió por el síntoma: «el precio ya debe estar por defecto en el input y la
tarifa, porque me pide seleccionarla». Era un **fallo real**, no una preferencia.

### La causa: `pristine` no se limpia al rehacer las filas

El panel rellena los conceptos con los precios de la máquina **solo si nadie ha escrito nada**,
y esa pregunta se le hace a `FormArray.pristine`. `abrirLinea` rehacía el arreglo con `clear()`
+ `push()` creyendo que eso lo devolvía a su estado inicial.

**No lo devuelve.** `markAsDirty` propaga HACIA ARRIBA —del control a su grupo y de su grupo al
arreglo— y ni `clear()` ni `push()` tocan ese estado del padre. Así que **en cuanto alguien
teclaba una cifra, el arreglo quedaba sucio para toda la vida del componente**: la primera línea
se prellenaba y ninguna más.

Lo peor era que el síntoma no se parecía a la causa. Nada falla, nada avisa: simplemente la
tarifa llega vacía, y quien lo ve concluye que el prellenado no existe.

`abrirLinea` ahora llama `markAsPristine()` en el arreglo, y **cinco pruebas nuevas fijan la
trampa** —incluida la que demuestra que rehacer las filas no basta—. Está en `CLAUDE.md`, en la
sección del `FormArray`.

### Y una fila vacía al final

Al prellenar, después de las tarifas de la máquina se añade **una fila en blanco** para agregar
lo que la máquina no trae: un flete, unas maniobras. Eso obligó a tres cambios que no son
cosméticos:

- **`tarifaId` dejó de ser obligatoria por fila.** Con `validadorRequerido`, la fila vacía
  dejaba el formulario inválido y el botón de guardar apagado **sin explicación visible**: una
  fila en blanco que el usuario no puso y un botón muerto.
- Lo que se exige de verdad —**al menos un concepto**— se comprueba aparte, en `puedeAgregar`, y
  las filas sin tarifa **se descartan al enviar**, recalculando el `orden` sobre las que quedan
  (ese orden decide cuál se vuelve línea de renta al convertir).
- Cuando ninguna fila tiene concepto, la lista **lo dice** en lugar de dejar el botón apagado
  sin motivo.

Cuatro pruebas más fijan la propiedad que lo hace posible: que una fila en blanco sea VÁLIDA, y
que una cantidad en cero siga invalidándola.

`ng build` limpio, **322 pruebas** (nueve nuevas), i18n simétrica. Comprobado en el paquete
compilado: «Elige al menos un concepto» y los rótulos por fila están en el bundle.

> **Sin abrir en el navegador con sesión iniciada.** Lo que se comprobó del fallo es su
> mecánica, con pruebas que lo reproducen; que la pantalla ya traiga la tarifa no se ha visto.

---

## El precio de la máquina se cambia donde se lee — 2026-09-09

Petición del cliente, mirando el panel: quería **cambiar ahí mismo el precio** que trae el
equipo, y que lo cambiado sea lo que se guarde en `cotizacion_linea_tarifa`. No tocar
`equipo_tarifa`: eso sigue siendo lo que propone.

### El problema era tener dos sitios

La lista «PRECIOS DE ESTA MÁQUINA» era un cartel de **solo lectura al lado** de los campos
editables. Un valor que se mira en un sitio y se escribe en otro invita exactamente a intentar
cambiarlo donde no se puede — y es lo que pasó.

Así que se funden: **el campo editable de cada fila ES el precio de la máquina**, y debajo se
dice cuál era el de por defecto. La comparación que daba el cartel no se pierde, se acerca: la
nota se queda a la vista tras editar, así que se lee «cotizado 600 · por defecto 500 / Hora» en
el mismo sitio donde se cambió.

Y cuando lo capturado se aparta del por defecto, aparece un **«usar ese»** que devuelve *esa*
fila a su precio. Existe porque «Traer precios del equipo» reemplaza TODAS las filas, y quien se
equivocó en una cifra no quiere perder las otras dos que ya ajustó.

### Y los conceptos pasaron de tarjetas a LISTA

Segunda pasada, la misma tarde: lo anterior era funcionalmente lo pedido pero dibujado como una
**tarjeta por concepto**, con su propio rótulo de campo cada vez. Con tres tarifas eso no se lee
como una lista de precios sino como tres formularios.

Ahora los rótulos suben a **una sola cabecera de columnas** —Tarifa · Cantidad · Precio— y cada
concepto es una fila de esa rejilla, con su botón de quitar al final. Las columnas se declaran
igual en la cabecera y en las filas; si dejan de coincidir, la cabecera deja de rotular lo que
hay debajo.

Tres consecuencias que hubo que resolver:

- **Sin `<label>` visible**, cada control lleva su `aria-label` con el número de fila. Sin eso un
  lector de pantalla anuncia tres «Tarifa» indistinguibles. Tres claves nuevas por idioma.
- **Un solo renglón de error por fila**: tres `app-error-campo` en columna descuadrarían la
  rejilla, y los tres mensajes dicen lo mismo —falta algo en esta fila—.
- Con una sola fila, donde iría el botón de quitar queda un **hueco** y no un botón muerto; el
  hueco además mantiene la rejilla cuadrada con la cabecera.

Comprobado en el paquete compilado que la clase de rejilla llegó al chunk **y que Tailwind generó
su CSS**: un valor arbitrario que el escáner no vea no produce regla, y la fila se rompería en
silencio.

### Dos detalles que cambiaron de sitio

- **«Traer precios del equipo» subió a la cabecera de conceptos**, junto a «Añadir concepto», y
  ahora se ve **siempre que la máquina tenga precios**. Antes solo aparecía si las filas ya
  estaban tocadas, y eso lo escondía justo cuando se necesita: después de cambiar una cifra y
  querer volver atrás.
- El `(change)` del desplegable de equipo pasa el valor **del evento** y no lee el control. No
  se observó un fallo por esto, es una precaución: en ese `<select>` hay dos escuchas de
  `change` —la de `formControlName` y la propia— y su orden no está garantizado, así que leer el
  control podía devolver el valor anterior y pedir los precios de la máquina que se acababa de
  dejar.

### Lo que se quedó fuera

`conceptosIntactos` quedó muerto al desaparecer el cartel —lo usaban su aviso y su botón— y con
él dos claves de diccionario; y `renta.preciosDelEquipo`, que nunca se llegó a usar porque la
pantalla de renta no pinta lista, solo la nota junto al campo. Tres claves retiradas en los dos
idiomas.

**La renta no cambió**: su campo de precio ya era editable con la nota debajo, que es el mismo
modelo al que la cotización acaba de llegar.

`ng build` limpio, 313 pruebas, 54 secciones por idioma. Comprobado **contra el paquete
compilado**, no contra el código: «Por defecto» y «usar ese» están en el bundle, y
«no se sobrescriben solos» y «Precios de esta máquina» ya no.

> **Sin abrir en el navegador con sesión iniciada.**

---

## Cotizaciones: sin cliente ni ubicación, con unidad — 2026-09-09

El porqué está en la bitácora del backend. Aquí, lo que cambia en pantalla.

### El listado

Pierde el filtro de cliente y su columna, y la búsqueda pasa a ser **solo por folio**. El panel
de alta pierde cliente, ubicación y condiciones, y gana **Unidad justo después de Tipo**, porque
se leen juntos: «una cotización de renta, por día».

### El detalle

Donde estaban cliente y ubicación ahora está lo que gobierna los importes: **la unidad y las
unidades que el periodo da de sí**. Y cuando no hay periodo lo dice —«Sin periodo: la máquina no
suma»— en lugar de dejar las líneas en cero sin explicación.

En la tabla de líneas, las columnas de cantidad y precio **dejan de ser un guion** para las
líneas con máquina: ahí van las unidades del periodo y el costo unitario del equipo. Una línea
sin máquina sigue con el guion — vive solo de sus conceptos.

### El panel de conversión

Gana **cliente y condiciones**, que la cotización dejó de llevar y la renta sí necesita. Con el
responsable que ya pedía, son tres preguntas: es el precio de haber quitado esos campos del
documento que no los usaba.

### Once claves de diccionario retiradas y tres añadidas

Retiradas con el recorrido por sección y borrado de atrás hacia adelante, que es la herramienta
fiable cuando los nombres de clave se repiten entre secciones —`cualquierCliente` aparecía cuatro
veces—. Y un aviso para el que venga: **un script que valida todo y escribe al final no aplicó
nada cuando abortó**, mientras que uno que escribe por paso deja el trabajo a medias. Costó una
asimetría entre idiomas detectarlo: el inglés tenía las claves de unidad y el español no.

`ng build` limpio, 324 pruebas, 54 secciones por idioma.

> **Sin abrir en el navegador con sesión iniciada.**

---

## Fuera el precio por cliente — 2026-09-09

Corrige la entrada de abajo: el prellenado se queda, la distinción de procedencia no. El porqué
está en la bitácora del backend.

### Lo que desaparece de la pantalla

- En **cotización**, el distintivo «precio de este cliente» / «precio de lista» de cada renglón
  del bloque de precios. Ya no hay dos precios entre los que elegir, así que no hay procedencia
  que señalar. El bloque se queda: sigue sirviendo para comparar lo cotizado con lo cargado.
- En **renta**, el mismo distintivo junto al precio traído. La nota de que el precio **no se
  tecleó** se queda: sin decirlo, una cifra que aparece sola se lee como un valor por omisión y
  nadie la revisa.
- En el **expediente**, el desplegable de cliente del panel de precios y su columna en la tabla.
- En **disponibilidad**, el filtro de cliente completo. **Ese es el que importa**: existía solo
  para ver el precio negociado de esa cuenta, así que habría quedado como un desplegable que
  cambia el resultado en nada.

Y con ellos, el selector de clientes que expediente y disponibilidad seguían declarando: código
que ya no leía nadie.

### Once claves de diccionario retiradas, en los dos idiomas

Se comprobó una por una con `grep t().<sección>.<clave>` que ninguna quedaba en uso antes de
tocarlas. Y el borrado **no se hizo por número de línea del archivo original**, que es la lección
del día anterior: cada clave se localizó dentro de su sección, se recogieron los 22 rangos antes
de borrar nada, y se borraron de atrás hacia adelante para que los índices anteriores siguieran
valiendo. El script aborta si una clave no aparece, si una sección no aparece dos veces —una por
idioma— o si las dos mitades dejan de ser simétricas.

`ng build` limpio, 313 pruebas, 54 secciones por idioma.

> **Sin abrir en el navegador con sesión iniciada.**

---

## Los precios de la máquina llegan solos — 2026-09-09

El porqué está en la bitácora del backend. Aquí, cómo se comporta.

> **CORREGIDA EL MISMO DÍA: el precio por cliente se retiró**, y con él los distintivos de
> procedencia que esta entrada describe. Ver la entrada de arriba. Todo lo demás sigue vigente.

### En la cotización: se elige la máquina y los conceptos aparecen

Con su precio, su unidad y un distintivo que dice **de dónde salió cada uno** — «precio de este
cliente» o «precio de lista». Sin ese distintivo nadie sabe si la cifra que ve es el descuento
pactado o el precio público, y no poder distinguirlo es peor que no traerlo.

El bloque de precios se queda a la vista aunque las filas se editen, así que se puede comparar lo
que se está cotizando con lo que la máquina tiene cargado —«cotizado 1800, precio 2000»—. Esa
comparación antes exigía abrir el expediente en otra pestaña.

### **No pisa lo que ya se escribió**, y esa es la parte que importa

`pristine` de Angular es exactamente la pregunta que hacía falta: se vuelve falso cuando el
usuario teclea y **no** cuando el valor lo pone el código. Así:

- filas intactas → se rellenan solas al elegir la máquina, y elegir otra las reemplaza;
- filas ya editadas → no se toca nada, y aparece un botón «Traer estos precios» con un aviso que
  explica por qué no pasó solo.

Es el fallo que el `datalist` en cascada ya provocó una vez: un prellenado que borra lo capturado.

> **UN BUCLE INFINITO EVITADO, y quedó documentado.** El efecto leía `conceptosIntactos()`, un
> `computed` que depende de la señal de versión que el propio prellenado incrementa — el efecto
> se disparaba a sí mismo sin fin. Se corrigió leyendo `pristine` **del formulario**, que no es
> una señal y por tanto no crea dependencia. El `computed` sigue existiendo para la plantilla,
> que sí necesita redibujarse.

### En la renta capturada directo: se rellena el precio, no las filas

Una línea de renta lleva **una sola** tarifa —es la que aparta calendario y a la que se refieren
las horas incluidas—, así que aquí no hay filas que sustituir: en cuanto se conocen la máquina y
el concepto, el precio entra en el campo, con la misma nota de procedencia y la misma guarda de
`pristine`.

**Y el camino de «asignar máquina» desde una cotización NO dispara el prellenado**, a propósito:
ahí manda el precio COTIZADO, que es lo que el cliente aceptó. Dejar que el catálogo lo pisara
sería destruir justo lo que ese camino existe para conservar.

### Dos cosas que se dicen en voz alta

- **Moneda.** `equipo_tarifa.moneda` existe y la aplicación es solo MXN. Un precio en dólares
  entraría al subtotal como si fueran pesos y nada avisaría, así que se filtran — y los que
  quedan fuera se **cuentan y se dicen**. Callarlo sería peor que no traer nada.
- **Una máquina sin precios cargados** no es un error, pero se dice: quien la eligió espera que
  los conceptos lleguen solos, y el silencio se lee como que la pantalla no funciona.

`ng build` limpio, 313 pruebas, i18n simétrica. El diccionario, editado **por contenido** con
guardián de coincidencia única.

> **Sin abrir en el navegador con sesión iniciada.** Ni el prellenado ni el bloque de precios se
> han visto en pantalla.

---

## Cotizaciones: una línea con varios conceptos — 2026-09-08

El porqué está en la bitácora del backend. Aquí, lo que eso significa en pantalla.

### Fuera «Responsable» de dos sitios, y aparece en un tercero

Del panel de alta y del encabezado del detalle. Y **entra en el panel de conversión a renta**,
que es donde la pregunta tiene sentido: la renta sí exige responsable y ya no lo hereda, y quien
firma el contrato no tiene por qué ser quien cotizó.

### La tabla de líneas tiene dos niveles, en UNA sola tabla

La fila de la **línea** —lo que se ofrece, con su importe en negrita— y debajo una fila por
**concepto**, sangrada, cada una con su cantidad, su unidad y su precio.

Se descartó una tabla anidada por línea: cada una traería su propia cabecera y las columnas no
cuadrarían entre sí, que es justo lo que hace ilegible una propuesta. Así, las cantidades y los
precios de todos los conceptos caen en la misma columna. Un `tbody` por línea hace el
agrupamiento explícito y el borde separa renglones, no conceptos.

En la fila de la línea, cantidad y precio muestran un guion: **esos datos viven en los
conceptos**, y dejar el hueco en blanco se leería como un dato que falta.

### El alta captura la línea y sus conceptos de una vez

Un `FormArray` con «Añadir concepto», empezando por uno. **La última fila no se puede quitar**:
el servidor rechaza una línea sin conceptos, así que con una sola fila el botón no se dibuja en
lugar de dibujarse muerto.

> **Una trampa nueva, y está documentada en `CLAUDE.md`:** `FormArray.controls` es el mismo
> arreglo mutado en el sitio, así que empujar una fila **no cambia su referencia** y sin zonas no
> despierta al detector — la fila nueva no se dibujaba. Se resolvió con una señal de versión que
> se incrementa en cada alta y baja, y un `computed` que devuelve una COPIA. Un `computed` que
> devolviera `controls` tal cual no sirve: memoriza por referencia y la referencia nunca cambia.

Los conceptos de una línea que **ya existe** se añaden y se quitan uno a uno, con su propio
panel. No hay edición: para corregir una cantidad o un precio se quita el concepto y se vuelve a
poner, porque un concepto es un renglón de la propuesta, no un campo.

### El orden de los conceptos NO es decorativo

El primero es el que pasa a ser línea de renta al convertir; los demás van como cargos. La ayuda
del formulario lo dice, porque es la clase de detalle que se descubre tarde y mal.

### Y en la renta, la sección «por asignar» cambió de significado

Existía para las líneas cotizadas por CATEGORÍA. Esa columna se retiró, así que ahora lista las
líneas cotizadas **sin máquina** —que la conversión pasó como cargos— y sigue ofreciendo
asignarles un equipo con su precio cotizado.

**Puede sobrar información y es deliberado**: un flete legítimo aparece ahí y debe quedarse como
cargo. Se prefiere ofrecerlo de más que perder el camino de asignar la máquina, que era la
función que la categoría hacía posible. La cabecera lo dice: es una revisión, no una lista de
pendientes. Y avisa de algo que antes no hacía falta: **el cargo sigue ahí**, hay que quitarlo si
se sustituyó por una línea.

`ng build` limpio, 313 pruebas, simetría comprobada: 54 secciones por lado, y la garantía de
verdad es el compilador —`EN_US: Textos` con `Textos = typeof ES_MX`—. El diccionario se editó
**por contenido**, con un guardián que exige una coincidencia única por reemplazo: abortó dos
veces —una clave inglesa que aparecía tres veces— en lugar de escribir en el sitio equivocado,
que es exactamente lo que faltaba esta mañana.

> **Sin abrir en el navegador con sesión iniciada.** Ni la tabla de dos niveles ni el
> `FormArray` se han visto funcionando.

---

## Motivos de movimiento: la pantalla depende de quien la abre — 2026-09-08

Corrige la entrada de abajo, escrita horas antes con la peticion mal leida: no era «que nadie
pueda», era **«que solo el administrador pueda»**. Vuelven el alta, la edicion y el retiro —
pero solo se dibujan si `accesoTotal`.

### `accesoTotal` y nunca el nombre del rol

```ts
protected readonly esAdministrador = computed(
  () => this.sesion.identidad()?.accesoTotal === true);
```

Cada empresa renombra sus roles, asi que un `codigo === 'administrador'` se rompe en la primera
que lo llame «Dueño». Es la misma regla que ya sigue `puedeVerModulo`.

**ESTO NO ES SEGURIDAD, ES INTERFAZ.** La puerta de verdad son los tres endpoints, que son
`[SoloAdministrador]`. Aqui solo se decide que se pinta, para no ofrecer botones que el servidor
va a rechazar — que es la peor forma de decirle a alguien que no tiene permiso.

### Tres cosas que aparecen y desaparecen juntas

La accion de la barra (`Nuevo motivo`), la columna de acciones de la cabecera y los dos botones
por fila. Las tres bajo el mismo `@if (esAdministrador())`: si la columna se quedara, la tabla
tendria una cabecera vacia para todos los demas.

### La frase de arriba cambia segun quien mira

Y las dos versiones dicen algo util:

- al **administrador** se le avisa de lo unico que no puede hacer, antes de intentarlo y recibir
  un 409;
- a **los demas** se les explica por que no hay boton, que si no se lee como un permiso que les
  falta y acaba en una pregunta a soporte.

### El codigo de los nueve va deshabilitado, con `[attr.disabled]`

Y **no** con `control.disable()`: deshabilitar por el control saca el campo de
`formulario.value`, y el PUT saldria con el codigo en nulo — que el servidor leeria como un
intento de vaciarlo. Esta escrito en `CLAUDE.md` y es la trampa que ya costo una sesion.

La lista de los nueve codigos esta **tres veces** —disparador, servicio del backend y esta
pantalla— y es consciente: la del disparador manda, la del servicio da el mensaje, esta solo
decide si el campo se pinta gris. La alternativa era un endpoint que contestara «¿cuales son
intocables?», y eso es una peticion de red para pintar un `disabled`.

### Lo que se queda fuera

Sigue sin buscador, sin filtro y sin paginacion: son nueve, y diez el dia que se añada uno. Los
demas catalogos los llevan porque crecen sin techo; este no. El esqueleto sigue con nueve filas
exactas, y ahora sin la silueta de los botones de accion — que la mayoria de los usuarios no
vera.

El bloque del diccionario paso de 8 claves a ~30 por idioma, incluidas `avisoAdmin`,
`soloLectura` y `codigoDelContrato`. Editado **por contenido y nunca por numero de linea**.
`ng build` limpio, 313 pruebas, simetria comprobada: 54 secciones por lado, cero asimetrias.

> **Sin abrir en el navegador con sesion iniciada.** La condicion `accesoTotal` no se ha visto
> con dos usuarios distintos delante, que es la unica forma de comprobar una pantalla que cambia
> segun quien entra.

---

## Motivos de movimiento: pantalla de solo lectura — 2026-09-08

Los nueve motivos ya no se anaden, ni se editan, ni se retiran. El porque esta en la bitacora
del backend; aqui, lo que eso significa en pantalla.

### Se reescribio, no se le quitaron botones

Tenia busqueda diferida, filtro de tres estados, paginacion, panel de alta, edicion y retiro:
andamiaje para un catalogo que crece. Con nueve filas que no pueden cambiar, todo eso son
controles que no hacen nada — y **un control que no hace nada es peor que su ausencia, porque
promete algo**. De 533 lineas a menos de la mitad.

Queda la tabla —codigo, motivo, descripcion— y una frase arriba.

### La frase va arriba y siempre visible

No en un globo de ayuda. **Quien abre un catalogo espera poder anadir; sin esa frase, la
ausencia del boton se lee como un permiso que le falta**, y el siguiente paso es preguntar a
soporte por un permiso que no existe. Dice lo que pasa y por que: los movimientos que el sistema
registra solo los buscan por su codigo.

### Dos detalles que cambian de significado

- **El vacio ya no invita a crear.** Los nueve vienen de la semilla, asi que una lista vacia
  significa una base a medio migrar. Decir «crea el primero» seria mentir dos veces: no se
  puede crear, y falta algo. Ahora dice que avise a soporte.
- **El esqueleto tiene nueve filas exactas.** En los demas es una estimacion —una lista de largo
  desconocido no se puede espejar—, pero este catalogo esta cerrado y su tamano se sabe. Se
  redibujo tambien: el anterior tenia la silueta de los tres chips y de los dos botones de
  accion por fila, y un esqueleto que no coincide con lo que llega se lee como un fallo.

El servicio expone `listadoDeMotivos` y nada mas. No hay `crear`, `editar` ni `cambiarActivo`,
y no es que se hayan omitido: **serian metodos que contestan con una excepcion de PostgreSQL**.

El diccionario paso de 40 claves a 8 en ese bloque. Se reemplazo el bloque entero por contenido
—nunca por numero de linea, que es la leccion de esta manana— y la simetria entre idiomas quedo
comprobada: 54 secciones por lado, cero asimetrias.

---

## Fuera los tipos de cliente y de proveedor — 2026-09-08

Las dos pantallas, sus rutas, sus entradas de menu, sus dos recursos y sus dos selectores. Y el
campo de tipo del alta de cliente y del alta de proveedor, que era obligatorio en los dos.

### Y de paso, texto muerto de dos turnos

Los bloques `tiposCliente`, `tiposProveedor` y el `tipos` que quedo huerfano al retirar la
pantalla de tipos de equipo el 2026-09-07. **Una clave que falta no compila, pero una clave que
SOBRA no molesta a nadie** — y por eso se acumula. 54 secciones por idioma donde habia 57.

### Un destrozo mio y como se arreglo

Borre las claves del diccionario **por numero de linea**, calculando los indices sobre el
archivo original y aplicandolos despues de haber quitado ya cuatro bloques enteros. Los indices
se habian corrido: ocho borrados cayeron en lineas equivocadas del bloque `en-US` y se llevaron
por delante `restablecer.titulo`, `restablecer.tituloInvalida`, `equipos.crearApoyo`,
`equipos.editarTitulo`, `clientes.contactoNombre`, `clientes.contactoPuesto` y la linea de
apertura de la seccion `categorias`, que dejo sus claves colgando dentro de `marcas`.

**No hay control de versiones en este proyecto**, y ni `dist/`, ni `.angular/cache`, ni el dev
server tenian el texto: el bundle anterior no existia. Lo que permitio la reparacion fue la
SIMETRIA de los dos diccionarios: `es-MX` y `en-US` tienen la misma estructura, asi que un
recorrido con contador de llaves —que no necesita que el archivo compile— señala exactamente
que clave existe en uno y falta en el otro.

Los seis textos ingleses **se volvieron a escribir** a partir del español. Son mecanicos
—«Your new password», «Edit machine», «Contact name»— pero no son los originales, y si alguno
tenia un matiz distinto, se perdio.

**La leccion, y va a `CLAUDE.md`: en este archivo se borra por CONTENIDO, nunca por numero de
linea.** Un `replace` de la cadena exacta con su `assert` de cuantas veces aparece no puede
caer en el sitio equivocado. El segundo intento se hizo asi y salio a la primera.

---

## La marca también se escribe, y el alta queda en cuatro campos — 2026-09-07

Corrección de la entrada de abajo: cuando la escribí, la marca seguía siendo un `<select>`
—entendí que la lista de creables eran categoría, modelo y año—. El cliente aclaró que **los
tres catálogos** del alta deben filtrar y crear, así que la marca pasó a `<input>` con
`datalist` igual que los otros dos.

Eso cambia dos cosas más allá del campo:

- **Las sugerencias de modelo se acotan por el NOMBRE de la marca, no por su id.** La marca es
  texto libre: mientras se teclea puede no corresponder a ninguna del catálogo, y entonces no
  hay nada que acotar — lo que se está escribiendo es una marca nueva y todavía no tiene
  modelos.
- **La cadena de creación pasó a tres pasos**: marca y categoría en paralelo —son independientes—
  y el modelo después, porque se crea CON las dos y necesita sus ids. Si algo falla a mitad, lo
  que quedó creado son entradas de catálogo válidas, nunca un modelo colgando de nada.

Crear una marca es directo: su catálogo solo pide el nombre. La categoría sigue necesitando que
se le derive un código.

### Y el formulario ya no tiene Tipo

Se retiró con la tabla, en el mismo cambio de abajo. **Si sigue apareciendo en pantalla, lo que
se está viendo es un build anterior**: `ng serve` recompila al guardar, pero si el proceso se
levantó antes de estos cambios o se quedó atascado en un error de compilación, sigue sirviendo
el último bundle bueno. Está descrito en `CLAUDE.md`: cuando un cambio deja de aparecer, el
primer sitio donde mirar es la salida del dev server, no el código.

---

## Los catálogos del equipo se escriben, y se crean si no existen — 2026-09-07

Dos cambios que vienen juntos: se retiró el tipo de máquina y el modelo y la categoría dejaron
de ser desplegables cerrados.

### La pantalla de Tipos se va entera

Ruta, entrada de menú, recurso y selector. Todo lo que la usaba —cotización, disponibilidad,
expediente, modelos, orden de compra— pasó a la categoría. El razonamiento está en la bitácora
del backend.

### Modelo, categoría y año: `<input>` con `datalist`

Se teclea, el navegador filtra, y **si lo escrito no está en el catálogo se crea al guardar**.
Es lo que se pidió.

**Nativo y no un combobox propio, y esto no es pereza.** Un `role="combobox"` obliga a
implementar flechas, Home y End; anunciar el rol sin su contrato de teclado es peor que no
anunciarlo, y está escrito en las convenciones de este repo. El `datalist` trae filtrado,
teclado y lector de pantalla hechos.

El control guarda **texto**, no un id, porque el id no existe todavía cuando alguien teclea. Se
resuelve —o se crea— al enviar: primero la categoría y después el modelo, **encadenados y no en
paralelo**, porque un modelo nuevo se crea con su categoría y necesita ese id. Si la categoría
falla, el modelo no llega a crearse y no queda un catálogo a medias.

### El riesgo que esto mete, y lo que lo contiene

Dejar crear escribiendo llena el catálogo de duplicados: «Excavadora», «excavadora» y
«Excavadora » son el mismo concepto y tres altas distintas si la comparación es `===`. En dos
semanas el catálogo deja de servir para agrupar, que era su único trabajo.

Lo contiene `mismoNombre`, que normaliza espacios, mayúsculas **y acentos** — «Camión» encuentra
«Camion», que es el caso que aparece a los dos días. Está exportada para que la prueba mida esa
función y no una copia suya.

Y el código de una categoría nueva se deriva del nombre, con sufijo si ya está tomado: el
catálogo lo exige y el alta rápida no lo pregunta. Sin eso, dos nombres que se reducen al mismo
código darían un 409 que no significa nada para quien está capturando una máquina.

### Un efecto que se retiró

Había uno que **borraba el modelo al cambiar de marca**. Tenía sentido con un `<select>` —un
valor fuera de la lista se pinta en blanco— y deja de tenerlo con texto libre: borrar lo que
alguien tecleó porque cambió un filtro es perder su trabajo. Ahora la marca solo acota las
sugerencias, y si el texto no corresponde a ningún modelo de esa marca, se crea uno.

Crear un modelo **sí exige marca**: dos marcas pueden tener un «320» y son modelos distintos.
Sin marca se rechaza con un mensaje en lugar de inventar a cuál pertenece.

Los dos catálogos se crean con `equipos.crear`, el mismo permiso que da de alta la máquina, así
que quien puede lo uno puede lo otro.

---

## Marca y categoría dejan de ser sólo un filtro — 2026-09-03

El cliente pidió guardarlas en `equipo`, así que el `EquipoDto` ahora trae `marcaId` y
`categoriaEquipoId` propios. En la pantalla eso cambia dos cosas.

**La precarga al editar deja de buscar en el catálogo.** Antes se resolvía la marca recorriendo
los modelos —`todosLosModelos().find(...)`— y eso devolvía cadena vacía si los catálogos aún no
habían respondido: la edición se abría diciendo «Todas las marcas» con la lista entera. Ahora
sale del propio equipo, que siempre la trae.

**Y la lista gana dos filtros**, por marca y por categoría, que es lo que las columnas nuevas
hacen barato: el servidor los resuelve con índice propio en vez de unir con dos catálogos.

Los dos `<select>` preseleccionan con `[selected]` en cada `<option>`, nunca con `[value]` en el
`<select>`. El filtro de ubicación que ya estaba usa `[value]` y hoy funciona por casualidad
—arranca vacío y la primera opción es la vacía—; se rompería en cuanto alguien lo inicialice
con algo. No se tocó, pero queda anotado.

---

## Marca y Categoría faltaban en el alta de un equipo — 2026-09-03

Lo preguntó el cliente después del cuadre de esquema: «me parece que en el alta del equipo hace
falta Marca y Categoría». Tenía razón, y **el hueco no era de base de datos sino de pantalla**,
que es justo el que mi comparación anterior no vio.

### Por qué se me pasó

En la tabla que hice al comparar §5.1 marqué las dos como «indirecto» y seguí adelante: la marca
cuelga del modelo y la categoría del tipo, así que la información está y el esquema cuadra.
**Estructuralmente es cierto y como respuesta es insuficiente.** El documento las pide como
campos «Catálogo · Seleccionable desde Catálogos», y eso no describe dónde se guarda el dato:
describe cómo se elige.

Lo que había en la pantalla era un desplegable de modelos que decía **«320D»** y otro de tipos
que decía **«Excavadora»**, los dos listas planas del catálogo entero. Con dos marcas que tengan
un modelo de nombre parecido, elegir bien era imposible — y no había forma de acotar.

### Lo que NO se hizo: guardarlas en `equipo`

Sería el arreglo obvio y está mal. `equipo.marca_id` junto a `equipo.modelo_equipo_id` permite
una fila que dice «Caterpillar» cuyo modelo dice «Komatsu», y entonces hay **dos respuestas a la
misma pregunta** y ninguna manda. El esquema ya estaba bien; lo que faltaba era el formulario.

### Lo que sí: dos cascadas

Marca acota los modelos, categoría acota los tipos, y ninguna de las dos se manda al servidor.
Además, **cada opción lleva su padre dentro** —`Caterpillar · 320D`, `Excavadoras · Excavadora
hidráulica`— también con el filtro puesto: sin filtrar es lo único que distingue dos «320D», y
con filtro confirma que el filtro es el que se cree.

Y al elegir un modelo se **propone su tipo** si el catálogo lo declara
(`modelo_equipo.tipo_equipo_id`, que existía para esto y nadie usaba). No sobreescribe lo ya
elegido: quien puso un tipo a mano no quiere que se lo cambien por corregir el modelo. Es la §1
del documento —capturar una vez y reutilizar— en el sitio más pequeño posible.

### La guarda que casi no puse

Filtrar obliga a limpiar lo elegido cuando sale de la lista, o el `<select>` se pinta en blanco
mientras el formulario se cree lleno. Pero el efecto que limpia tiene un caso que **no es
teórico**: los catálogos llegan por `httpResource`, y hasta que responden **la lista está
vacía** — y una lista vacía no contiene nada, ni el modelo correcto.

Sin `permitidos.length > 0`, abrir la edición de un equipo antes de que carguen los catálogos le
**borra el modelo**, y quien guarda cree que no tocó nada. Es exactamente la familia de fallos
que llevo tropezando toda la semana: no revienta, no avisa y el compilador no lo ve.

Queda fijado en `equipos.spec.ts`, cuya cuarta prueba es esa y solo esa. 318 pruebas de
frontend, cuatro nuevas.

### Lo que ya estaba bien

El LISTADO sí mostraba marca y tipo —`{{ equipo.marca }} {{ equipo.modelo }}` y su columna de
tipo—, y los dos DTO ya traían el nombre del padre (`ModeloEquipoDto.Marca`,
`TipoEquipoDto.Categoria`). **No hizo falta tocar el backend ni la base**: el dato estaba, la
plantilla no lo usaba.

---

## La estructura, cuadrada contra el documento — 2026-09-03

Lo que el cuadre de esquema significó en la interfaz. El razonamiento está en la bitácora del
backend.

### El lugar de la renta desaparece del formulario

Eran once campos —descripción obligatoria más calle, colonia, municipio, estado, código postal,
contacto y teléfono— repartidos entre el alta de renta, el paso de conversión de una cotización
y el detalle. Ya no están.

**En su lugar, la línea captura su ubicación de entrega**, elegida del catálogo. Es lo que pide
§11.1 y es lo correcto: una renta puede llevar tres máquinas a tres sitios, y un nombre del
catálogo sirve para mover la máquina y para el reporte por ubicación; una frase escrita a mano
no sirve para ninguna de las dos cosas.

El destino se muestra **dentro de la celda del equipo**, no en una columna propia: la tabla de
líneas ya tiene siete y una octava obligaría a fijar dos para poder leerla de lado.

### Dos campos que pasan a obligatorios

- **RFC del cliente.** Lleva ahora `[validadorRequerido, validadorRfc]`, y son dos porque
  `validadorRfc` **acepta el vacío a propósito** —sigue siendo opcional en proveedores, §9—.
  Con uno solo, el formulario dejaría enviar y el servidor contestaría 400.
- **Vigencia de la cotización**, con su aviso propio. Es un `<input type="date">`, que guarda
  texto, así que `validadorRequerido` sirve — a diferencia de un `<select>` numérico, donde da
  `{ required: true }` siempre. Esa distinción ya costó dos pantallas esta misma semana.

### Cuatro tarifas de referencia en la ficha del equipo

Con su nota al pie diciendo lo que son: precios **sugeridos**, no lo que se cobra. Sin esa
línea, cuatro campos de dinero en la ficha invitan a creer que de ahí sale la factura.

---

## Los campos del documento funcional que faltaban — 2026-09-03

El cliente comparó el sistema con la especificación funcional y preguntó por qué no se respetan
sus campos. En el frontend faltaban los de tres formularios, más el desdoble de `notas` en
cuatro pantallas. El razonamiento completo está en la bitácora del backend; aquí, lo que cambia
en la interfaz.

### Un campo de texto donde el documento pide dos

Equipos, Rentas, Cotizaciones y Ventas tenían un único `notas`. Ahora cada uno tiene **el que se
imprime** —Descripción en Equipos, Condiciones en Rentas y Cotizaciones, Condiciones de pago en
Ventas— **y el interno**, cada uno con su texto de ayuda diciendo cuál es cuál. Sin esa ayuda el
desdoble no sirve de nada: dos cajas de texto seguidas sin explicación se rellenan al azar.

### Movimientos: dos campos y un archivo

- **Folio de referencia**, texto libre, en el formulario y en la tabla —dentro de la celda del
  motivo, no en una novena columna que obligaría a fijar dos.
- **Evidencia**, con su enlace de descarga en la misma celda.

**El `<input type="file">` va FUERA del formulario reactivo**, en una señal. No es una
preferencia: un `<input type="file">` no tiene accesor de valor de Angular, así que con
`formControlName` el control guardaría la cadena `C:\fakepath\foto.jpg` que expone el
navegador, nunca el `File`. Es la cuarta variante de la misma familia de trampas que ya costó
`[ngValue]`, `number | null` y `[selected]`.

Y el envío pasó a ser **dos peticiones encadenadas**: se sube la evidencia, y su id entra en el
alta. Si la subida falla, el `switchMap` no llega a correr y el movimiento no se registra, con
el formulario intacto para reintentar. No se puede hacer al revés porque la tabla es
append-only.

### Cotizaciones: tipo y periodo

El `<select>` de Renta o Venta con `[ngValue]` —es numérico— y **sin validador**, que es la
trampa que ya costó dos pantallas el mismo día: `validadorRequerido` pasa por `texto()` y en un
campo numérico responde `{ required: true }` siempre. Con dos opciones y sin opción vacía no
puede estar vacío por construcción.

**El periodo propuesto aparece y desaparece con el tipo**, no se queda deshabilitado: en una
cotización de venta no significa nada y un CHECK de la base lo rechaza. Para que aparezca al
cambiar el tipo hace falta leer los valores como señal —`toSignal(valueChanges)`—, porque un
`FormGroup` no es reactivo y un `computed` que lo lea directo se congela en el primer valor.

### Ventas: el papel

Sección de documentos en el detalle de la orden, con su panel de subida. **No se esconde fuera
de Borrador** como la de líneas, y es deliberado: la factura y el último comprobante llegan
después de cerrar la venta.

Los adjuntos vienen **dentro del detalle de la orden**, no en un recurso propio: son pocos por
venta y la pantalla ya pide la orden entera. El precio es que la subida tiene que recargar el
detalle a mano —la fábrica no conoce esa ruta—, y está escrito donde se hace.

### Lo que no se pudo comprobar en el navegador

La verificación con datos reales quedó pendiente: la sesión del panel se perdió al reiniciar y
no hay credenciales de desarrollo documentadas. `ng build` limpio y 314 pruebas en verde **no
son suficientes y esta misma bitácora lo demuestra**: los cuatro defectos del 2026-09-03 pasaron
las dos cosas. Hace falta abrir las cuatro pantallas.

---

## Verificación en el navegador con datos reales: cuatro defectos — 2026-09-03

Sesión real en la empresa `prueba`, API local, las nueve pantallas del MVP abiertas una por una.
**`ng build` limpio y 314 pruebas en verde no habían detectado ninguno de los cuatro.** Los tres
del frontend solo se veían usando la pantalla; el cuarto solo con datos en la base.

### 1. Mantenimiento no pintaba su lista — `NG0602`

`talleres` llamaba a `selectorUbicacionesActivas()` **dentro de un `computed`**. Ese selector es
perezoso y crea su `httpResource` en la primera llamada, así que se creaba dentro de un contexto
reactivo: `NG0602: effect() cannot be called from within a reactive context`.

El síntoma no parecía una excepción: la sección de la lista quedaba en **2 px de borde**, sin
filas y sin mensaje de vacío, y el único rastro estaba en la consola. Arreglado moviendo el
selector a un campo. La trampa quedó escrita en `CLAUDE.md` con su grep: `selectorX()()`.

### 2. Movimientos y Mantenimiento: el botón de enviar nunca se habilitaba

Puse `validadorRequerido` en el `<select>` numérico del `tipo`. Ese validador lee el control con
`texto()`, que devuelve `''` para cualquier cosa que no sea cadena, así que en un campo numérico
responde `{ required: true }` **siempre**.

**Está documentado en el docblock del propio validador y en `convenciones.md`, y aun así lo
escribí en dos pantallas.** El síntoma es el peor de esa familia: formulario aparentemente
completo, ningún mensaje —los avisos necesitan `touched` y un campo con valor por omisión no se
toca nunca— y el botón apagado sin explicación.

Arreglo: **quitar el validador**. Un `<select>` de enum con valor inicial y sin opción vacía no
puede estar vacío por construcción.

### 3. El inicio decía «29 de 26»

`MODULOS_DEL_CATALOGO` era una constante `26` copiada a mano del catálogo central, y quedó
obsoleta el 2026-09-01 cuando el MVP añadió tres módulos. Y `IMPLEMENTADOS` seguía sin los siete
módulos construidos desde entonces, incluido `usuarios` — cuyo comentario decía «el backend no
expone endpoints de usuarios ni de roles», cierto hasta que expuso catorce.

Ahora son 29 y 16, y esta empresa lee **29 de 29 · 16 implementados**.

### 4. Dos reportes respondían 500 (ver la bitácora del backend)

`clientes` y `movimientos`. El `ProblemDetails` viene saneado, así que desde el navegador solo se
veía «Error interno»; se identificaron por descarte sobre el código y se confirmaron arreglados
volviendo a pedirlos.

### Lo que sí funcionó a la primera, comprobado con datos

- **Tablero**: los cinco bloques con cifras reales (2 máquinas, 1 disponible), 18 tarjetas
  enlazadas y 1 sin enlace —el costo del mes—, y ninguna destacada porque todas las cifras «que
  duelen» estaban en cero. La regla de no destacar un cero se cumple sola.
- **Reportes**: el parque agrupado por estado, tipo y ubicación; utilización con 22.58% en una
  máquina y su definición al pie; y el reporte de movimientos devolviendo **la fila migrada del
  traspaso viejo** (tipo 3, motivo Reacomodo) — la migración de datos queda verificada.
- **Roles**: los tres repartos cuadran al permiso. Gerente **62**, Operaciones **21**, Ventas
  **21**, y el Administrador con 0 y su aviso, sin acciones.
- **Usuarios**: el filtro trae Gerente, Operaciones y Ventas —sin el de acceso total— y al
  usuario con acceso total no se le ofrece el botón de roles.
- **Mantenimiento, ciclo completo**: se abrió `MTO-2026-00001` sobre ZZ-RENTA-01 sin taller
  (201), el panel de cierre **no pidió ubicación de regreso** —la máquina no salió—, la
  cancelación pidió confirmación con su consecuencia escrita, y quedó Cancelado **con FIN en
  blanco**, que es lo que el `CHECK` exige.
- **Bitácora**: las cuatro filas de esa operación con su módulo relleno, y `OcupacionEquipo`
  atribuida a **Disponibilidad** — el caso exacto que un mapeo por espacio de nombres habría
  puesto en `equipos`. El desplegable de módulos ofrece solo los dos que tienen registros.
- **El refresco de token, en vivo**: al reiniciar la API, dos peticiones dieron 401 y el
  interceptor las reintentó con éxito. Es la regla del single-flight funcionando de verdad.

### Responsividad: 375, 768 y 1280

Medida con `getBoundingClientRect` y no con capturas, porque **el panel del navegador estaba
oculto y las animaciones se congelan en su primer fotograma** — el cajón del menú aparecía a
medio camino en cada captura. Es la trampa que ya estaba escrita en `convenciones.md`.

- **375**: el `<body>` no desborda (`scrollWidth` = 375), el cajón fuera de pantalla en −264, y
  la tabla de 1040 px con scroll **dentro de su caja** de 341.
- **768**: igual, y la primera columna `sticky` con **fondo opaco propio**.
- **1280**: el menú pasa a columna fija en 0 y el contenido arranca en 264 — deja de
  superponerse. Sin desborde.
- Tablero a 1280: cuatro columnas desde `xl`, 19 tarjetas en cinco bloques.

### Dos cosas de la mecánica de verificación que costaron un rato

- **Con viewport emulado, los clics por coordenada se desalinean**: el panel escala el contenido
  para caber y las coordenadas de la captura no son las del viewport. Dos clics sobre «Último
  mes» no hicieron nada; el mismo botón por su elemento funcionó. Con emulación, interactuar por
  elemento, no por posición.
- **El árbol de accesibilidad no entra en un `<dialog>` modal abierto**, así que los campos de un
  panel lateral no salen en él y no hay refs que usar.

### Lo que queda anotado y no se tocó

- **Las fechas se muestran crudas** —`2026-09-03T17:04:20.613813Z`— en las cinco pantallas
  nuevas. Es el patrón que ya traía el repo (los traspasos lo hacían igual), pero ahora está en
  más sitios. Merece un formateador en `i18n` y una pasada por todas las pantallas.
- **En el diálogo de cancelar un mantenimiento los dos botones se llaman casi igual**: «Cancelar»
  cierra el diálogo y «Cancelar el trabajo» ejecuta. En una pregunta sobre cancelar algo, el
  primero es ambiguo; el verbo seguro debería ser «Volver».
- **El bloque del parque en el tablero no suma**: TOTAL 2 con 1 disponible y 0 en el resto,
  porque la segunda máquina está **Vendida** y ese estado no tiene tarjeta. El total la cuenta y
  el desglose no. O el total excluye lo que salió del parque, o falta la tarjeta.

---

## Las siete pantallas que faltaban del MVP — 2026-09-02

`ng build` limpio en 560 kB y **314 pruebas en verde**. Siete pantallas nuevas: tablero,
bitácora, usuarios, roles y permisos, mantenimiento, detalle de mantenimiento y reportes. Con
ellas, las nueve que el plan del MVP listaba están hechas.

### El tablero: cada cifra es un enlace

Cinco bloques en **una sola petición** —cinco llamadas darían cinco esqueletos parpadeando en la
pantalla que más se abre— y **cada número abre el listado que lo explica**. Un indicador que no
se puede abrir es un número que nadie puede verificar, y es lo que separa un tablero de un
adorno. Los dos que no tienen a dónde llevar —el costo del mes— van sin enlace, y se nota porque
no reaccionan al ratón.

**Lo destacado es lo que duele**: rentas vencidas, cotizaciones aceptadas sin renta, máquinas sin
ubicación. Y **si valen cero dejan de destacarse**: destacar un cero enseña a ignorar el
destacado.

### La bitácora explica sus propios huecos

Dos cosas que el dato no dice solo y la pantalla sí:

- Una fila **sin módulo** puede ser de sesión —no pertenece a ninguno— o anterior a hoy, cuando
  la columna no existía. Las viejas no se rellenaron: la tabla es *append-only* y ni una
  migración la reescribe. El panel lo explica en lugar de dejar un guion mudo.
- El rol `administrador` en la columna de roles significa que la acción **pasó por el bypass de
  acceso total**, no por un permiso concedido. Es justo lo que se audita.

El detalle va en un panel y no en columnas: los dos `jsonb` pueden ser cuarenta campos.

### Usuarios: la liga vive en la pantalla, no en el panel

Invitar devuelve la liga **y existe solo en esa respuesta** —del token solo se guarda el hash—,
así que se muestra fuera del panel, copiable, hasta que alguien la descarta. Es la misma decisión
que el alta de una empresa: el panel se cierra con el mismo gesto que lo abrió.

**Al usuario con acceso total no se le ofrecen los roles**, porque el servidor los rechaza: no se
dibuja la acción en vez de dejar que descubra el 409. Y el correo va deshabilitado en la edición
con `[attr.disabled]`, no con `control.disable()` — eso lo sacaría del valor del formulario.

### Roles: la matriz vacía del administrador NO significa que no pueda nada

Aparece el primero porque es el que explica a los demás, con un aviso: **vacía significa que no
le hacen falta**, porque salta la verificación. Sus acciones no se dibujan.

La matriz se manda **completa**, no como deltas: lo que no quede marcado se quita. Eso la vuelve
idempotente y evita que dos personas editando a la vez se dejen a medias. Con 29 módulos × 6
acciones, cada módulo lleva su casilla de «todo el módulo»: sin ella la pantalla sería inusable.

### Mantenimiento: el taller opcional se explica antes, no al cerrar

El campo dice que con taller la máquina sale y que al cerrar habrá que decir a dónde vuelve. Sin
él, alguien lo descubriría al intentar finalizar y recibir un 400.

El filtro por omisión son **los abiertos**, no todos: la pregunta que trae a alguien aquí es «qué
hay en el taller», y dos años de trabajos cerrados encima la esconden.

### Reportes: seis pestañas, un periodo, y ninguna petición sin fechas

Los cuatro reportes de periodo **no piden nada mientras falten las fechas** —`undefined` como URL
es como se dice «no pidas todavía»—, y la pantalla dice «elige un periodo» en lugar de mostrar
una tabla vacía: no es un vacío, es una pregunta que nadie ha hecho.

El botón «último mes» es un **atajo explícito, no un valor por omisión**: el servidor rechaza un
reporte sin periodo justamente para que nadie lea un total sin saber de qué habla, y ponerlo solo
al pulsar mantiene esa propiedad.

La definición de utilización está escrita **en la pantalla**, y las columnas de días son lo que
permite verificar el porcentaje sin conocer la fórmula.

### El menú quedó completo

Equipos suma Mantenimiento; Reportes deja de estar vacío con Tablero y Reportes; Configuración
pasa de una pantalla a cuatro —Usuarios, Roles y permisos, Trabajadores y Bitácora—, **las cuatro
bajo el módulo `usuarios`**: son la misma pregunta —quién es de esta empresa y qué puede hacer—
vista desde cuatro ángulos.

### Lo que no se pudo verificar

**Ninguna pantalla se probó con datos reales**: requieren sesión de empresa y las credenciales no
están en el repo. Lo que sí se comprobó: los nueve endpoints nuevos responden **401 y no 404**
—existen y están protegidos—, las rutas están registradas y la prueba del menú cruza cada opción
contra `rutas-empresa.ts`.

---

## Nada del plan limitaba los módulos; el menú sí — 2026-09-02

Revisión de las **tres compuertas** que deciden qué módulos ve alguien, de fuera hacia dentro:

1. **La suscripción del tenant y su plan.** `DirectorioTenantsEf` resuelve los módulos como
   `suscripcion (Prueba o Activa) ⨯ plan_modulo ⨯ modulo.activo`. El plan `base` —el que usan
   las cinco empresas— incluye **los 29 módulos del catálogo**, sembrados con
   `INSERT ... SELECT` sin enumerar, y los 29 están `activo = true`. **Aquí no hay recorte.**
2. **Los permisos del rol**, intersecados con lo anterior en `acceso.ts`. El rol
   `administrador` trae `acceso_total`, así que salta la verificación y ve todo lo que el plan
   concede.
3. **El menú.** Aquí estaba el recorte de verdad, y era doble.

### Los dos recortes que se quitaron

- **Órdenes de compra volvió al menú.** Salió el 2026-09-01 porque compras es P2 del MVP, y fue
  un recorte del *menú*, no del código: la pantalla, sus siete endpoints y su módulo llevaban
  meses funcionando, solo inalcanzables sin teclear la URL. Esconder lo que existe no reduce el
  alcance, lo vuelve invisible.
- **Órdenes de venta pasó a exigir `ventas.*`.** Pedía `compras.*` —el controlador se escribió
  copiando el simétrico, cuando el módulo `ventas` no existía—, así que **vender maquinaria
  requería permiso de comprar refacciones**, y el módulo 23 del catálogo no lo usaba nadie.

### Lo que sigue sin verse, y no es una compuerta

**16 de los 29 módulos no tienen pantalla**: dashboard, logística, las dos inspecciones,
evidencias, horómetros, mantenimiento, órdenes de trabajo, próximo servicio, refacciones, pagos,
facturación, notificaciones, reportes, QR y subrenta. Existen en el catálogo central, el plan los
concede y sus permisos se emiten en el token — lo que falta es la pantalla y, en la mayoría, el
endpoint. No hay nada que desbloquear ahí; hay que construirlo.

El grupo **Reportes** está declarado vacío y por eso no se dibuja: `disposicion-empresa` descarta
los grupos sin opciones.

### Una advertencia que conviene tener presente

**Los 8 roles de sistema que no son `administrador` se sembraron SIN una sola fila de
`rol_permiso`.** No es una política, es una semilla a medias: quien entre con el rol Ventas,
Rentas, Taller u Operador ve el menú **completamente vacío**, porque la intersección con sus
permisos es el conjunto nulo. Hoy no se nota porque el único usuario real es el administrador.
Repartir permisos por rol es la rebanada 6 del plan; hasta entonces, cualquier usuario que no
sea administrador está mudo.

### Y el caché

`SegundosCacheTenant` son **60 segundos**, en las dos llaves —por id y por slug—. Un cambio en
`plan_modulo` no aparece al instante: hay que esperar el minuto o reiniciar la API. Es lo que
hizo parecer que la migración del plan no había servido.

---

## Movimientos sustituye a Traspasos, y la ubicación deja de editarse — 2026-09-02

`ng build` limpio en 532 kB y **300 pruebas en verde**. Tres pantallas tocadas y una borrada.

### La pantalla nueva, y la que se fue

**Movimientos** (`/movimientos`) es el historial físico: nueve tipos, filtros por tipo, equipo y
ubicación, y captura manual. **Traspasos se borró entera** —componente, plantilla, esqueleto y
su bloque de textos—: un traspaso es un movimiento de tipo 3, y tener las dos pantallas daría
dos formas de mover una máquina, una con rastro y otra sin él. El bloque de textos se fue con
ella a propósito: texto muerto es peor que texto de más, porque el siguiente que lo lea creerá
que la pantalla existe.

**SIN COLUMNA DE ACCIONES, y esta vez no es una elección de la pantalla.** La tabla es
*append-only* y un trigger de la base rechaza el UPDATE, así que no hay editar ni borrar que
ofrecer. Una captura equivocada se corrige con el movimiento contrario.

### El formulario cambia de forma según el tipo

Es la matriz del backend hecha interfaz, y el origen **no se pide nunca**: es donde el equipo
está ahora, y lo resuelve el servidor. Se muestra como dato al elegir la máquina, para que quien
captura vea de dónde va a salir.

- Destino: en la salida y el traspaso. En la asignación a proyecto **no se pregunta**, porque es
  el sitio de la obra.
- Obra: solo en la asignación, obligatoria.
- Cliente: solo en la salida, el único tipo cuyo destino puede no ser nuestro.

**Y los tipos ofrecidos dependen de la máquina.** Una sin ubicación solo admite la entrada al
inventario —los otros ocho exigen origen—; una con ubicación no la admite. Ofrecer los cuatro
siempre daría dos rechazos garantizados según cuál se elija. Hay un `effect` que corrige el tipo
seleccionado al cambiar de máquina: sin él quedaría elegida una opción que ya no está en la
lista, y el `<select>` mostraría en blanco un control que el formulario cree lleno.

Lo que el tipo no pide **se manda nulo**, no lo que quedó escrito en el control. Quien eligió una
obra y luego cambió a Traspaso dejaría un `proyectoId` colgado que el servidor guardaría en un
movimiento que no va a ninguna obra.

### El expediente del equipo ya no mueve la ubicación

El campo va **deshabilitado en la edición** y con un texto que dice qué hacer en su lugar. Y
deshabilitado en el marcado, con `[attr.disabled]`, **no en el control**: un control
deshabilitado por código sale de `formulario.value`, y el PUT mandaría `ubicacionId` nulo — que
el servidor leería como un intento de moverla. Deshabilitado y no oculto porque quien abre el
expediente tiene que poder ver dónde está la máquina.

En el **alta** el campo sigue vivo, y al elegir ubicación aparece un desplegable de
**responsable**: el alta con ubicación escribe el movimiento de entrada al inventario, y un
movimiento siempre tiene quien lo firma. Sin ubicación no se pide.

### El historial dentro del expediente, sin alta

Tercera sección, la primera de las tres tablas: responde la pregunta que trae a alguien al
expediente de una máquina antes que sus papeles y sus precios. **No tiene alta**, y no es un
olvido — un movimiento se captura en su pantalla, donde el formulario cambia de forma según el
tipo. Una versión reducida aquí sería la que no sabe que una asignación a proyecto exige obra.

Comparte recurso con la pantalla de Movimientos: es la misma ruta con `EquipoId` puesto, así que
registrar un movimiento allá recarga esto sin que nadie se acuerde. El filtro es un `computed`
sobre `id()` —que es un `input()`, o sea una señal—; con un objeto literal fijo se quedaría con
el primer id para siempre.

### Y antes de esto, Proyectos

La pantalla de obras cerró la rebanada 2 del frontend: chips de los tres estados, cambio de
estado por fila y el alta que **crea la obra y su ubicación a la vez** —por eso pide dirección y
no un desplegable de ubicaciones: cuando se abre una obra, su sitio todavía no existe—. Cerrar
pregunta antes; suspender y reactivar no, que son reversibles.

### Una prueba del diccionario tiraba cuatro por culpa de una

`i18n.spec.ts` llama a cada texto con función pasando `7` en el primer argumento, y un texto de
un solo parámetro que trate ese dato como cadena —`estado.toLowerCase()`— **revienta el recorrido
entero**: caían las cuatro pruebas del bloque, con un mensaje que no nombraba la clave culpable.
Dos arreglos: la redacción pasó a «en estado X», que es la de la casa y respeta el nombre del
estado tal cual; y `hojas()` ahora reintenta con cadena si el `7` lanza, para que el próximo caso
así se vea como lo que es y no como cuatro fallos sin relación.

### Pendiente que se ve desde aquí

El **puerto del servidor de desarrollo pasó a 4301** en `.claude/launch.json`, con el comando
declarado: el 4200 lo tiene tomado otra aplicación de esta máquina, y sin el comando la
configuración solo se acoplaba a un servidor ya levantado.

Lo que **no se pudo verificar en el navegador**: la pantalla con datos reales. Requiere una
sesión de empresa, y las credenciales no están en el repo. Lo que sí se comprobó: `/movimientos`
está registrada —lleva al login, no cae al `**`—, el endpoint responde **401** y no 404, y
`/api/transferencias` ya devuelve **404**.

---

## La rebanada 1, cerrada · y el menú en seis secciones — 2026-09-01

**El tipo ya se elige en las tres pantallas** que ganaron una columna obligatoria en la base:
Tarifas, Clientes y Proveedores. Cada una trae su desplegable con los tipos **activos** —recurso
compartido y perezoso, `selectorTiposTarifa()` y compañía— y precarga el primero del catálogo:
un desplegable obligatorio que arranca vacío obliga a un clic que no decide nada.

Tarifas gana además **columna de tipo** en la tabla, que es por lo que se agrupa el catálogo, y
su esqueleto la refleja.

> **`[value]` y no `[ngValue]` en los tres**, y conviene decir por qué no contradice la regla: el
> id de un tipo es un **uuid**, o sea texto, así que el accesor escribe en el control exactamente
> lo que dice el atributo. `ngValue` es para enums, números y objetos —como la unidad de la
> tarifa, que sigue usándolo—.

**Clientes y Proveedores inyectan además `ApiCatalogos`**, porque la URL de los tipos es
`/api/catalogos/...` aunque la pantalla sea de terceros. Es el mismo reparto que ya hacía
`trabajadores` con los puestos.

### Lo que NO se hizo de esta rebanada, y por qué

El plan pedía **retirar la pestaña de precios del expediente** del equipo. **Se posterga a la
migración 5**, que es la que elimina `equipo_tarifa`.

El motivo es el mismo que ya costó un susto hoy en el backend: retirar la pantalla mientras la
tabla sigue existiendo **le quita al usuario la única forma de ver precios que siguen en su base
de datos**, sin ganar nada — la decisión solo aprieta cuando la columna desaparece. Retirar la
interfaz y los datos en el mismo paso es la secuencia segura, y es la misma disciplina de
expandir → contraer aplicada en el orden correcto.

---

## El ambiente local apuntaba a Railway — 2026-09-01

**Síntoma:** con la API local levantada y respondiendo, el login de una empresa decía
«No se pudo contactar al servidor. Revisa que la API esté levantada». Se buscó el fallo en la
API, que estaba bien.

**Causa:** la entrada de `localhost` de `AMBIENTES` tenía
`urlApi: 'https://maquinaria-backend-development.up.railway.app'`. Así que el navegador llamaba
al **despliegue**, no a la API local. Y ese ambiente rechaza el origen
`http://<slug>.localhost:<puerto>` —su `Cors:DominioBase` es `maqvia.com` y exige https—, con lo
que la petición se bloquea antes de recibir respuesta. El frontend solo ve **estado 0**, y su
mensaje para el estado 0 es justamente «no se pudo contactar al servidor».

**Por qué engaña tanto, y es la parte que vale registrar:** el mensaje es correcto —el servidor
no contestó— pero apunta al servidor equivocado. Un rechazo de CORS y una API caída se ven
idénticos desde el navegador, a propósito: la respuesta bloqueada no llega ni con su código de
estado. La forma de distinguirlos es mirar QUÉ origen y QUÉ destino, no si el proceso está vivo.

**Arreglo:** `urlApi: 'http://localhost:5123'` en la entrada de `localhost`. Es además lo que el
propio archivo afirma más abajo: el ambiente al que cae un anfitrión desconocido «apunta a una
API que no existe fuera de la máquina del desarrollador». Con la URL de Railway, esa frase era
falsa.

**Comprobado** desde la página, contra la API local y con una credencial inventada:
`POST /api/empresas/bajio/sesion` devuelve **401 con su ProblemDetails**. El transporte funciona;
lo que fallaba era la dirección.

---

## Las cuatro pantallas de catálogo del MVP — 2026-09-01

`/tipos-tarifa`, `/tipos-cliente`, `/tipos-proveedor` y `/motivos-movimiento`, con su ruta, su
entrada en el grupo **Catálogos** del menú y sus textos en los dos idiomas. Derivadas del molde de
`puestos`, que es el catálogo simple canónico: mismos filtros, mismo esqueleto, mismo panel
lateral, misma confirmación al retirar.

Cada una declara **el módulo de su propio controlador**, que no siempre es el que sugiere el
nombre: tipos de tarifa exige `rentas` —agrupa tarifas—, y motivos de movimiento exige
`movimientos`, uno de los tres módulos que el MVP agrega. `motivos-movimiento` **no lleva columna
de conteo** porque la tabla `movimiento` es la rebanada 3 y todavía no existe.

**Verificado:** `ng build` pasa —y es lo único que revisa las plantillas—, las cuatro producen su
propio *chunk* diferido, y `ng test` sigue en verde con 251 pruebas. **No verificado:** la tabla,
el alta y la edición con sesión abierta; hace falta una cuenta de la empresa `prueba` para eso.

### El presupuesto del paquete inicial se subió a 600 kB

Estaba en **500 kB y el paquete medía 499.67**: cualquier pantalla nueva lo rompía. Con estos
cuatro diccionarios —cuatro bloques por dos idiomas— quedó en **522.83 kB**.

Se subió el aviso a 600 kB, y hay que decir que **eso no arregla la causa**: `textos.ts` va
entero en el paquete inicial, así que cada pantalla nueva paga su diccionario en la primera
carga, la vea el usuario o no. **El arreglo de fondo es partir el diccionario** para que los
textos de una pantalla viajen en su *chunk* diferido, como ya viaja su componente. Son 4 700
líneas y toca a las 25 pantallas, así que no entra en esta rebanada; queda anotado como el
primer candidato cuando el paquete vuelva a apretar.

### Y una trampa de entorno, para no volver a caer

**El puerto 4200 lo tiene otra aplicación** en esta máquina —«Teckio»—, así que abrir
`localhost:4200` no muestra este repo: muestra el otro. La comprobación de estas pantallas se
hizo en el **4301**, y `.claude/launch.json` quedó apuntando ahí. Si alguien verifica en el 4200
y ve algo que no reconoce, es eso.

---

## El MVP redefine el alcance — 2026-09-01

Llegó un documento funcional nuevo —MVP, 12 módulos, prioridades P0 a P2— y el entregable vigente
pasa a ser ese. Las pantallas están en [`plan-mvp-front.md`](plan-mvp-front.md); el modelo, las
migraciones y las rebanadas, en `maquinaria-backend/docs/08-alcance-mvp.md` y `09-plan-mvp.md`.

**Las 21 pantallas de módulo de la Fase 1 se quedan** y su molde no cambia. Lo que cambia:

- **9 pantallas nuevas:** movimientos, proyectos, mantenimiento y su detalle, usuarios, roles y
  permisos, bitácora, reportes y dashboard de empresa.
- **9 pantallas se ajustan.** Las tres que más: en **equipos** desaparece la pestaña de precios
  —el catálogo de tarifas ya no guarda importes— y **la ubicación deja de ser editable**, porque
  la mueve un movimiento; en **rentas**, el proyecto y el destino pasan a ser **por línea** y
  aparecen dos acciones que no existían, registrar entrega y registrar devolución; y **inicio**
  deja de ser la lista de módulos para ser el dashboard.
- **Órdenes de compra sale del menú**, con su ruta, porque compras es P2. Sus textos se quedan en
  `textos.ts` para cuando vuelva — el mismo criterio que se aplicó al grupo «Operación» el
  2026-08-25.

> **Las cifras de este documento están viejas otra vez.** Decía 26 componentes y 116 pruebas; el
> 2026-08-31 eran **73 componentes con sus 73 `.html` hermanos y 240 pruebas en 21 archivos**, y
> desde entonces han entrado más confirmaciones. La tabla de medidas de abajo hay que volver a
> medirla, no leerla.

## Estado actual

El repo ya **no** es scaffolding. Son **tres aplicaciones separadas por subdominio**, con
su árbol de rutas, su armazón y su menú, sobre 19 commits (`HEAD` en `69890c4`) más el
trabajo del 2026-08-25, que todavía está en el árbol de trabajo sin commitear.

Verificado en disco hoy:

| Medida                        | Valor                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Pruebas                       | **116 en 9 archivos**, todas pasan (`npx ng test --watch=false`)               |
| Componentes                   | **26**, todos con `OnPush`, y **26** `.html` hermanos                          |
| Plantillas dentro de un `.ts` | **cero** (`grep -rn "template:" src/` no devuelve nada)                        |
| Build de producción           | **373.59 kB** crudos / **103.85 kB** transferidos, más **22** chunks diferidos |
| Salida                        | `dist/maquinaria-frontend/browser`                                             |

Las cifras del documento anterior —39 pruebas en 2 archivos, 17 componentes, 290.25 kB—
eran de tres tandas de trabajo atrás y hoy son falsas en los tres casos. El reparto por
archivo de prueba, que es lo que dice de verdad dónde hay red y dónde no:

| Archivo                                             | Pruebas                   |
| --------------------------------------------------- | ------------------------- |
| `nucleo/ambiente/tenant.spec.ts`                    | 31 (casi todas `it.each`) |
| `paginas/plataforma/dashboard/resumen.spec.ts`      | 21                        |
| `nucleo/i18n/i18n.spec.ts`                          | 11                        |
| `nucleo/sesion/interceptor-refresco.spec.ts`        | 11                        |
| `nucleo/api/api-plataforma.spec.ts`                 | 10                        |
| `nucleo/api/api.spec.ts`                            | 9                         |
| `paginas/plataforma/salud-esquemas/esquema.spec.ts` | 9                         |
| `nucleo/sesion/acceso.spec.ts`                      | 8                         |

> Esta tabla es del 2026-08-25 y **se quedó corta**: al 2026-09-01 la suite son **234 pruebas
> en 20 archivos**. `disposicion/hoja.spec.ts` (6) salió de la lista al borrarse la hoja
> inferior — ver `plan-fase1-front.md`.

Los chunks diferidos que importan por tamaño son los de las pantallas del panel:
`dashboard` 20.01 / 5.37 kB, `planes` 15.61 / 4.31 kB, `empresas` 13.23 / 3.65 kB y
`salud-esquemas` 12.65 / 3.19 kB (crudo / transferido).

La plantilla de bienvenida de Angular ya no existe: `src/app/app.html` es
`<router-outlet />` y `app.css` se borró.

### Las tres aplicaciones

`src/app/app.routes.ts` no registra rutas: exporta `rutasDelAnfitrion()`, que **elige**
un árbol según el anfitrión. No hay un guard tapando rutas ajenas — esas rutas
sencillamente no se registran, igual que el backend aísla por base de datos.

| Anfitrión                      | Aplicación          | Árbol                 |
| ------------------------------ | ------------------- | --------------------- |
| `admin.<dominio>`              | Superadministración | `rutas-plataforma.ts` |
| `<slug>.<dominio>`             | La empresa `<slug>` | `rutas-empresa.ts`    |
| `<dominio>`, `login.<dominio>` | Portal de entrada   | `rutas-portal.ts`     |

Se resuelve una vez al arrancar: el anfitrión no cambia sin recargar, y cambiar de
empresa es cambiar de origen.

### Cómo está organizado `src/app/`

| Carpeta               | Qué hay                                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nucleo/ambiente/`    | `configuracion.ts`, `tenant.ts` (+ `tenant.spec.ts`), `sitio.ts`, `titulo-pagina.ts`                                                                                                                                        |
| `nucleo/api/`         | `api.ts` (+ `api.spec.ts`), `api-plataforma.ts` (+ `api-plataforma.spec.ts`), `contratos.ts`, `contratos-plataforma.ts`, `mensaje-error.ts`                                                                                 |
| `nucleo/i18n/`        | `i18n.ts` (+ `i18n.spec.ts`) y `textos.ts` con los dos idiomas                                                                                                                                                              |
| `nucleo/sesion/`      | `sesion.ts`, `sesion-plataforma.ts`, `acceso.ts` (+ `acceso.spec.ts`), `guard-sesion.ts`, `guard-plataforma.ts`, `interceptor-token.ts`, `refresco-sesion.ts`, `interceptor-refresco.ts` (+ `interceptor-refresco.spec.ts`) |
| `disposicion/`        | `disposicion-empresa`, `disposicion-plataforma`, `menu-lateral`, `menu-usuario`, `opciones-menu.ts`, `barra.ts`, `panel-lateral`, `barra-herramientas`, `confirmacion`                                                                                  |
| `paginas/acceso/`     | Piezas compartidas del acceso: `marco-acceso`, `campo-contrasena`, `selector-idioma`, `bandera`                                                                                                                             |
| `paginas/empresa/`    | `iniciar-sesion`, `aceptar-invitacion`, `solicitar-restablecimiento`, `restablecer-contrasena`, `inicio` (con `esqueleto`)                                                                                                  |
| `paginas/plataforma/` | `iniciar-sesion`, `dashboard` (+ `resumen.ts`, `esqueleto`), `empresas` (+ `esqueleto`), `planes` (+ `esqueleto`), `salud-esquemas` (+ `esquema.ts`, `esqueleto`)                                                           |
| `paginas/portal/`     | `seleccionar-empresa`                                                                                                                                                                                                       |

Cada pantalla se renombró por **lo que se hace en ella**. **Las URL no cambiaron**:
`/entrar`, `/invitacion`, `/recuperar`, `/restablecer`, `/inicio`, `/empresas`. Las que
se agregaron después llevan el mismo criterio: `/dashboard`, `/planes`, `/esquemas`.

No existen `src/app/core/`, `features/`, `shared/` ni `src/environments/`: la
configuración de ambiente es un solo archivo, `nucleo/ambiente/configuracion.ts`.

### Regla de código que rige desde ahora

**Ningún componente lleva HTML dentro del `.ts`.** Ni una plantilla en línea, ni un
`template:` de una sola línea: todo el marcado va en un `.html` hermano referenciado con
`templateUrl`. Está escrita en [`AGENTS.md`](../AGENTS.md) (idéntico a
`.claude/CLAUDE.md`) y desarrollada en [convenciones](convenciones.md). Hoy se cumple en
los 26 componentes.

### Qué funciona de punta a punta

- **Acceso de empresa sin tercer campo.** La empresa sale del subdominio
  (`tenantActual()`), no del formulario: son **dos campos**, correo y contraseña.
- **Restablecimiento de contraseña completo**, en dos pantallas (`/recuperar` y
  `/restablecer`), contra los endpoints nuevos de la API.
- **Refresco de token de empresa, y con él la Fase 0 del frontend cerrada.** Un 401 de la
  API de empresa canjea el token de refresco y **reintenta la petición**, así que el token
  de acceso de 15 minutos ya no obliga a volver a entrar. Son
  `nucleo/sesion/refresco-sesion.ts` —el canje, serializado— y `interceptor-refresco.ts`
  —el 401 y el reintento—, registrado ANTES del interceptor de token en `app.config.ts`
  para que el reintento salga con el `Bearer` nuevo sin tocar ninguna cabecera.

  Lo que gobierna esta pieza es que **la rotación no tiene ventana de gracia**: dos
  refrescos concurrentes canjean el mismo token, el servidor lee el segundo como robo y
  revoca toda la cadena de sesiones del usuario. De ahí el single-flight; el razonamiento
  del `shareReplay` y del `refCount: false` está en
  [convenciones](convenciones.md#sesión-el-refresco-del-token-va-serializado), y el
  contrato del endpoint —401 único, 429, obligación de serializar— en
  [integración con el backend](integracion-backend.md#refresco-de-la-sesión-de-empresa).

  **El refresco de plataforma no existe**, y no por olvido: el backend no tiene
  `sesion_refresh` para plataforma. `interceptor-refresco` descarta `/api/plataforma/**`
  en su primera línea y hay prueba de que un 401 de ese ámbito se propaga tal cual.

  Cuando el canje falla no hay reintento posible: se limpia la sesión y se navega a
  `/entrar?expirada=1`, con `entrarEmpresa.expirada` en los dos idiomas y su bloque ya
  pintado en la pantalla de acceso — el mismo patrón de `?activada=1` y `?restablecida=1`.

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
- **`TituloPagina`** compone el título de la pestaña como «pantalla · producto», y lo
  recompone al cambiar de idioma sin esperar a la siguiente navegación.
- **Resumen de la superadministración** (`/dashboard`), la pantalla de entrada del panel.
  Cuatro indicadores, una lista de avisos y las últimas altas, derivado de `GET /empresas`
  —sin endpoint de estadísticas y sin una sola cifra estimada, que es lo que prohíbe el
  sistema de diseño— más el reporte de esquemas para el aviso de desfase. La lógica de
  agregación vive aparte en `resumen.ts`, como función pura, con 21 casos de prueba.

  Los cuatro motivos de atención que sabe detectar son un alta **fallida**, una empresa
  **lista sin plan** —su base existe y su gente no ve ningún módulo—, una base con el
  **esquema desfasado** y una base **sin comparar**. Ese último es más grave que el
  desfase: desfasada se arregla migrando, sin comparar puede pedir desplegar.

  El diseño sigue el boceto de referencia —barra de la pantalla con búsqueda y acción
  principal, cuatro indicadores con el último destacado en negro y amarillo, banda de
  gráfica y avisos, tabla con chips de filtro— pero **cada hueco se llenó con el dato real
  que le corresponde**, no con el del boceto: donde el boceto pedía «utilización semanal»
  van **altas por mes**, que es la única serie temporal que la lista de empresas permite
  calcular.

  **El aviso de esquema desfasado MENTÍA hasta hoy, y así se arregló.** `resumen.ts`
  deducía el desfase comparando el `versionEsquema` de cada empresa contra **la más
  avanzada de la lista**, y esa referencia es circular: si TODAS las empresas están una
  migración atrás, la más avanzada es una de ellas y el dashboard reportaba **cero
  desfase** — que es exactamente el estado en el que estaba el sistema. Ahora `resumir()`
  recibe un tercer parámetro `salud: SaludEsquemas | null = null` y decide con
  `estadoDeEsquema()`, la misma función pura que usa la pantalla de esquemas.
  `esquemaReferencia()` se borró y el campo pasó a `versionDisponible`, que es la
  migración más avanzada **del binario que respondió**. El parámetro es opcional a
  propósito: **sin reporte no se afirma nada del esquema de nadie.** `resumen.spec.ts`
  pasó de 19 a 21 `it`, y en el camino se borraron los tres de `describe('esquemaReferencia')`:
  describían el comportamiento roto y por eso no podían verlo.

- **Salud de esquemas** (`/esquemas`), contra `GET /api/plataforma/salud/esquemas`. Una
  tabla por empresa con la versión aplicada, las migraciones pendientes y su estado, más
  la leyenda de los tres estados debajo. Las dos funciones puras que la sostienen viven en
  `salud-esquemas/esquema.ts` con 9 pruebas: `estadoDeEsquema()` y `migracionLegible()`,
  que parte `20260824232637_EmpresaCatalogosOrganizacion` en fecha y nombre **sin perder un
  carácter** y sin pasar por `DatePipe` —esas cifras no son un instante en una zona
  horaria, son parte de un identificador, y el locale las movería de día en México—.

  **Tres estados y no dos**: al día, desfasada y **sin comparar**. `versionReconocida: false`
  gana sobre todo lo demás, y en ese caso `desfasada` y `migracionesPendientes` no se leen:
  colapsarlo a dos estados esconde el caso peligroso, una base POR DELANTE del código
  desplegado, pintándola igual que una al día.

  El endpoint lee la `version_esquema` que la base central tiene registrada y **no se
  conecta a las bases de las empresas**, así que una migración aplicada a mano no se ve
  hasta la siguiente corrida de `migrar-empresas`. La pantalla lo dice en su nota de
  limitación en lugar de dejar que se lea como un reporte infalible.

- **Tarjetas de indicador, listas de aviso, chips de filtro y campos de formulario** como
  `@utility` en `src/styles.css`, siguiendo la especificación del sistema de diseño. De los
  cinco componentes que ese documento describía sin que existieran, el único que sigue sin
  `@utility` es la **tabla**: hoy son cuatro tablas (empresas, planes, salud de esquemas y
  las últimas altas del dashboard) con las clases escritas en cada `.html`.
- **La lista de empresas, el catálogo de planes y el reporte de esquemas son recursos
  COMPARTIDOS** (`ApiPlataforma`, con `httpResource`): dos pantallas que los lean hacen
  **una** petición entre las dos, en lugar de una cada una en cada navegación. Las
  mutaciones recargan su propia lista dentro del servicio. Las reglas —y las tres trampas
  de `httpResource`, incluida la de que `value()` lanza en estado de error— están en
  [convenciones](convenciones.md#datos-httpresource-y-el-recurso-compartido).

  El reporte de esquemas se expone **sin `defaultValue`**, al contrario que las listas:
  aquí el vacío no es `[]` sino «todavía no hay reporte», y un reporte de relleno con cero
  desfasadas se pintaría como un reporte de verdad que dice que no hay nada que atender.
  Que se pide una sola vez para las dos pantallas está fijado con `http.verify()` en
  `api-plataforma.spec.ts`.

  **Las dos consultas de liga también son recursos** (`Api.consultaDeInvitacion` y
  `Api.consultaDeRestablecimiento`), por fábrica en vez de campo del servicio: llevan
  parámetros de la pantalla y no las comparte nadie. Las pantallas de invitación y de
  restablecimiento perdieron su `effect` con `subscribe` dentro, y la consulta se rehace sola
  si cambia el token. El resto de `api.ts` son mutaciones y se quedan con `subscribe`, que es
  lo correcto.

  De paso salió un fallo ANTERIOR a los recursos: `withComponentInputBinding` pone
  `undefined` en un `input()` cuando el parámetro no está en la URL, pisando su valor por
  defecto, así que `token() === ''` era falso, se pedía la liga `undefined` y el 404 hacía
  que **una liga que faltaba se viera como una liga caducada**. Arreglado con
  comprobaciones falsy y fijado con pruebas.

- **Una sola barra superior por pantalla**, dibujada por el armazón y alimentada por la
  pantalla como DATOS a través de `disposicion/barra.ts` — título, contexto, búsqueda y
  acción principal—, junto al botón del menú, Salir y el avatar de iniciales, que son del
  armazón. El porqué de que sea un servicio y no proyección de contenido está en
  [convenciones](convenciones.md#la-barra-superior).
- **Catálogo comercial** (`/planes`): la lista de planes con sus módulos y el formulario
  para crear uno, más retirar y reactivar. Contra los cuatro endpoints reales del backend.

  **La regla que gobierna la pantalla**: un plan ES su conjunto de módulos, así que **no hay
  ni un campo de cupos** —los cupos cuelgan de la empresa, en `tenant_limite`—. Meterlos ahí
  contradiría el modelo, que dice literalmente «LOS MODULOS SON LA DEFINICION DEL PLAN».

  **No hay editar, y la pantalla lo explica en voz alta** en lugar de dejar a quien llega
  buscando el botón: la suscripción no guarda importe —solo apunta al plan— así que cambiar
  el precio reescribiría lo que pagaron los suscriptores anteriores, y quitar un módulo se lo
  quita a todos retroactivamente. Se retira el plan y se crea su sucesor.

> **Lo que sigue habla de la HOJA INFERIOR, que se borró el 2026-09-01.** Se deja como estaba
> porque es la bitácora de ese día, pero hoy el alta de empresa, la de plan y los límites viven
> en el panel lateral (`disposicion/panel-lateral.ts`). El porqué está en
> [el plan de la Fase 1](plan-fase1-front.md) y en
> [convenciones](convenciones.md#capas-panel-lateral-y-globo-de-ayuda).

- **El alta de empresa vive en la hoja inferior**, con la misma fórmula que planes. La barra
  de `/empresas` por fin tiene acción principal —«Nueva empresa», con `alPulsar` y no `ruta`,
  así que el armazón pinta un `<button>`— y el formulario de siete campos está en
  `<app-hoja [anclajes]="[50, 70, 95]">`. Antes no había acción porque un botón amarillo que
  apuntara al formulario de más abajo no llevaba a ninguna parte.

  **La confirmación del alta se queda en la PANTALLA, no en la hoja**, y es deliberado:
  lleva la liga de invitación, que es justo lo que hay que poder leer con calma y copiar;
  dentro de una hoja que se descarta con un gesto desaparecería con el mismo movimiento que
  la abrió. Y `puedeEnviar()` exige que haya al menos un plan activo, porque
  `AprovisionarEmpresa` lo rechaza en el servidor.

- **Hoja inferior arrastrable reutilizable** (`disposicion/hoja.ts`), sobre un `<dialog>`
  nativo con `showModal()`: se agarra del asa, tiene anclajes configurables y se cierra
  tirándola hacia abajo o con un gesto rápido. La usan el alta de plan y el alta de empresa.
  Las dos capas —la hoja y el globo de ayuda `popover`— y sus trampas están en
  [convenciones](convenciones.md#capas-panel-lateral-y-globo-de-ayuda).

  **Tenía un fallo visible y se arregló el 2026-08-25.** El `<dialog>` está clavado al fondo
  con `inset: auto 0 0` y el arrastre se aplicaba entero como `translate`; hacia arriba eso
  es NEGATIVO, así que la hoja **se despegaba del borde inferior** y dejaba ver el velo
  debajo, con el pie y su acción principal subiendo con ella, para volver de golpe al soltar.
  Medido en navegador real a 720 px de alto: 200 px de arrastre daban **200 px de hueco**.

  El gesto ahora es **asimétrico**: **subir es CRECER** —`min(98dvh, calc(<anclaje>dvh +
<subida>px))`— y **bajar es DESPLAZARSE**, que sigue en el `translate` porque al descartarla
  la hoja sí tiene que irse por debajo del borde. Medido después: 360 px en reposo, **560 px
  con 200 de arrastre y 0 de hueco**, y 706 px con un arrastre enorme, que es el freno de
  98dvh sobre 720. El `min()` va en CSS y no en JS porque mezcla `dvh` con `px`. Se quitó la
  goma elástica del anclaje más alto: amortiguaba a un cuarto, pero lo conseguía levantando
  la hoja del fondo — el mismo fallo en pequeño. `hoja.spec.ts` fija la regla con 6 pruebas:
  **el `translate` nunca es negativo.**

- **Tablas con la primera columna fija.** `planes` pasó de **seis columnas a cinco**: la
  píldora de estado se mudó DENTRO de la celda del plan, pegada al nombre, donde se lee
  mejor, en vez de ocupar columna propia (`planes.colEstado` quedó sin uso y se retiró de los
  dos idiomas). La columna del plan se **fija a la izquierda** con `sticky left-0`, fondo
  opaco y filete a la derecha, y `min-w-180` bajó a `min-w-160`. `empresas` recibió el mismo
  tratamiento.

  **Verificado en navegador real a 375 px**: contenido de 640 px en una caja de 375, que se
  desplaza dentro de su caja, `position: sticky` calculado, fondo opaco, y tras desplazar
  265 px la primera columna seguía en `left: 0`. El documento **no** se desplaza en
  horizontal, que es la regla dura de la convención.

- **Esqueletos de carga en todas las pantallas con datos en vuelo**: `dashboard`, `empresas`,
  `planes`, `salud-esquemas` y `empresa/inicio`, cada uno en un componente hermano. El texto
  de «Cargando…» no se perdió, se movió: `comun.cargando` ya solo aparece como el
  `role="status"` `sr-only` de esos esqueletos.
- **Todo responsivo**, comprobado en 375, 768 y 1280. El menú lateral es un **cajón** por
  debajo de `lg` —con hamburguesa, velo y cierre con Escape— y una columna fija desde ahí;
  antes ocupaba 264 px fijos a cualquier ancho, lo que dejaba un teléfono con 111 px de
  contenido. La regla, los cortes y las trampas están en
  [convenciones](convenciones.md#responsivo) y en [`AGENTS.md`](../AGENTS.md).

---

## Pendientes

Ordenados de "rompe algo" a "hay que decidirlo". **Los números no se reciclan**: un
pendiente cerrado deja su hueco, porque los commits y los otros documentos lo citan por
número.

### Internacionalización y metadatos

5. ~~El selector de idioma no traduce nada.~~ **HECHO (2026-08-25).** Español y
   México-inglés completos, cambio en vivo y preferencia recordada en
   `maquinaria.idioma`. Ver [internacionalización](convenciones.md#internacionalización)
   en las convenciones.
6. ~~No hay locale de Angular configurado.~~ **HECHO (2026-08-25).** `LOCALE_ID` sale del
   idioma guardado y se registran los datos de `es-MX` y `en` en `app.config.ts`.

   **Lo que queda de esta parte**, y no es poco:

   - **`LOCALE_ID` se fija al arrancar**, así que cambiar de idioma en vivo NO mueve
     fechas, números ni moneda. Hoy no se nota porque no hay un solo `| date` ni
     `| number` en la aplicación; el primero que se escriba tiene que decidir entre
     pasarle el locale al pipe o recargar al cambiar de idioma. Anotado con un comentario
     `ponytail:` en `nucleo/i18n/i18n.ts`.
   - **La zona horaria por tenant sigue sin resolverse.** El backend guarda en UTC con
     zona de presentación **por empresa**, y el locale no la lleva: `es-MX` no dice
     si la empresa opera en Tijuana o en Cancún. Eso es un dato de `IdentidadEmpresa`
     que la API todavía no manda.
   - **Los textos que vienen de la API siguen en español**, siempre. `mensaje-error.ts`
     traduce lo que genera el front, pero el `detail` del `ProblemDetails` se muestra
     tal cual y la API no lee `Accept-Language`. Es la costura visible del inglés y se
     arregla en el backend, no aquí.

### Falta de tooling

7. **Sin linter.** No hay ESLint ni `angular-eslint` instalados, ni script `lint`.
8. **Prettier instalado pero sin script.** Hay `.prettierrc` y el binario en
   `node_modules` (3.9.6), pero ni `format` ni `format:check`, así que el formato no se
   verifica en ningún punto.
9. **Sin CI.** No hay workflows de GitHub Actions ni gate de build/test en los PR. Con 116
   pruebas en verde, es justo lo que falta para que sirvan de red: hoy nadie las corre si
   quien escribe el commit no se acuerda.
10. **Sin pruebas end-to-end.** Angular CLI no trae framework de e2e; la elección sigue
    siendo una decisión abierta.
11. **Cobertura desigual — mejoró mucho, y sigue desigual.** De 39 pruebas en 2 archivos a
    **179 en 15**. Lo que ya tiene red: las dos funciones puras del arranque (`tenant`,
    `acceso`), el diccionario y el cambio de idioma (`i18n`), los tres servicios de API con
    `HttpTestingController` —incluida la regresión de que `value()` no debe lanzar en error y
    las cuatro de que el listado de catálogos reacciona al filtro—, la agregación del
    dashboard (`resumen`), la lectura del esquema (`esquema`), el interceptor de refresco
    (11 casos, con el single-flight y el 401 de plataforma que se propaga), la hoja inferior
    (6 casos de gesto sobre el `<dialog>` real), el diálogo de confirmación, `mensaje-error`
    (8 casos, nacidos del 400 que no decía nada), el `NumberValueAccessor` (5 casos) y la
    guarda de coordenadas de Ubicaciones (6). Las tres últimas, abajo.

    Lo que **sigue sin una sola prueba**: los dos guards (`guard-sesion`, `guard-plataforma`),
    `interceptor-token`, los dos almacenes de sesión, `titulo-pagina` y `opciones-menu`.

    De las pantallas hay **cuatro** con archivo de prueba —Modelos, Ubicaciones, Trabajadores
    y el detalle de Cotización—, y ninguna de ellas prueba la pantalla: cada una fija **una
    regla que el compilador no ve** y que ya costó una depuración. Están listadas abajo.

    Las pruebas nuevas de esta tanda no son de pantalla sino **de lo que Angular hace por
    debajo**, que es donde el compilador no ayuda:

    - `nucleo/api/mensaje-error.spec.ts`: los `errors` por campo ganan al `title` genérico.
    - `paginas/empresa/modelos/modelos.spec.ts`: un `<input type="number">` mete un number en
      el control —y `null` al vaciarse, nunca cadena vacía—.
    - `paginas/empresa/cotizacion/cotizacion.spec.ts` (7 casos): la forma de la tabla de
      transiciones copiada del servidor. Lo que fija no es que la copia esté al día —eso no
      se puede comprobar desde aquí— sino que un estado TERMINAL esté ausente y no con lista
      vacía: con `[]` el botón de cambiar estado se seguiría dibujando y abriría un
      desplegable sin opciones.
    - `paginas/empresa/ubicaciones/ubicaciones.spec.ts`: un `computed` que lee
      `getRawValue()` **no reacciona**. Guarda la versión rota junto a la buena para que la
      diferencia se vea.

12. ~~Falta el interceptor de refresco de token.~~ **HECHO (2026-08-25), y con él se cierra
    la Fase 0 del frontend.** `refresco-sesion.ts` + `interceptor-refresco.ts`, con
    single-flight obligatorio porque la rotación no tiene ventana de gracia. **Solo para la
    sesión de empresa**: el backend no tiene `sesion_refresh` para plataforma, así que un
    401 de `/api/plataforma/**` se propaga tal cual y eso sigue siendo una decisión de
    esquema abierta del backend, no un pendiente de este repo. Contrato en
    [integración con el backend](integracion-backend.md#refresco-de-la-sesión-de-empresa).
13. ~~Falta `api:sync`.~~ **HECHO (2026-08-27).** `npm run api:sync` genera
    `nucleo/api/generado.ts` desde `/openapi/v1.json`, y `npm run api:check` verifica que
    esté al día sin escribir —es lo que le falta al gate de CI del pendiente 9—. El archivo
    generado **no se edita**: el nombre es la advertencia. `contratos.ts` se queda a mano
    como superficie curada y re-exporta con nombres del dominio.
14. ~~La herramienta generadora no está elegida.~~ **HECHO (2026-08-27):
    `openapi-typescript` 7.13.0**, con `--immutable` y `--alphabetize`. Se descartaron
    `orval`, `openapi-generator-cli` y `ng-openapi-gen` porque las tres generan **servicios
    con `HttpClient` y Observables**, que pelean con `httpResource` + señales, los recursos
    compartidos y el refresco serializado. Lo que hacía falta no era un cliente generado
    sino que los contratos de datos dejaran de escribirse a mano. El razonamiento completo
    está en [plan de la Fase 1](plan-fase1-front.md#6-apisync--hecho-el-2026-08-27).

    **Al generar por primera vez salieron tipos débiles, y se arregló en el backend.**
    `AddOpenApi()` se llamaba pelado: 279 campos salían como `number | string` y 15 enums
    como `number` sin sus valores. Con el transformador `Arranque/EsquemaOpenApi.cs` quedan
    en **0** y `EstadoRenta` pasó de `number` a `1 | 2 | … | 10`.

15. **El token de refresco vive en `localStorage`**, no en cookie `HttpOnly`. Es una
    divergencia consciente con el diseño y hay que resolverla antes de producción; está
    explicada en
    [integración con el backend](integracion-backend.md#dominios-en-producción-y-la-cookie-del-refresh-token)
    y no se repite aquí. **El cambio es de los dos lados a la vez**: el backend tampoco
    manda hoy el token de refresco por cookie, lo devuelve en el cuerpo de la respuesta de
    login y de refresco.
16. **`SaludEsquemas.versionDisponible` está tipado como `string` y el servidor puede
    mandar `null`.** El backend lo calcula como `disponibles.Count > 0 ? disponibles[^1] :
null` (`SaludEsquemas.cs`), o sea nulo si el ensamblado no trajera ninguna migración —no
    puede pasar en producción, pero el contrato lo permite—. `resumen.ts` ya lo trata como
    `string | null`; el tipo de `contratos-plataforma.ts` es más optimista que la API.

    **La herramienta que lo habría cazado ya existe** (pendiente 13), pero el desajuste
    sigue en pie: `contratos-plataforma.ts` no se ha reescrito contra `generado.ts`. Se
    cierra cuando esos tipos pasen a re-exportar del generado en lugar de declararse a mano.

### Producto

16. **Las pantallas de los módulos son la Fase 1 en adelante**, y el menú de empresa hoy
    solo tiene el inicio. El pendiente estaba mal escrito en tres cosas y así queda
    corregido:

    - **No existe ninguna `MENU_EMPRESA`.** Es la **función** `menuEmpresa()` de
      `disposicion/opciones-menu.ts`, y es función a propósito: una constante de módulo se
      evalúa al cargar y se queda congelada en el idioma de ese momento.
    - **El andamiaje es un paso más largo de lo que decía.** Una pantalla nueva necesita su
      entrada en `rutas-empresa.ts`, su línea en `menuEmpresa()` con la clave de módulo,
      **y** sus textos: `titulos.<clave>` y `menu.<clave>` en los DOS bloques de idioma de
      `textos.ts`. Sin eso no compila — que es justo la gracia del diccionario tipado. Los
      cuatro pasos están escritos en
      [convenciones](convenciones.md#el-andamiaje-de-una-pantalla-nueva).
    - **La entrada de menú y su ruta se agregan JUNTAS.** El 2026-08-25 se retiró de
      `menuEmpresa()` un grupo `Operación` con `/equipos`, `/clientes` y `/rentas`:
      `rutas-empresa.ts` no registra ninguna de las tres, así que para un plan que las
      contratara la opción se dibujaba, y al pulsarla caía en el `path: '**'` y volvía a
      `/inicio`. Un menú que no lleva a ningún lado es peor que un menú corto. Los textos
      `menu.operacion`, `menu.equipos`, `menu.clientes` y `menu.rentas` **se quedaron en
      `textos.ts` a propósito**, para que vuelvan con su pantalla; hoy están sin uso y eso
      es intencional, no basura por limpiar.

17. **El dominio de producción no está registrado**, así que la configuración de
    Cloudflare Pages sigue pendiente. La ruta de salida que hay que darle es
    `dist/maquinaria-frontend/browser`.

### Cerrados desde la revisión anterior

Se listan para que nadie los reabra, con su número retirado:

- **1. El `<title>` de `index.html` desincronizado de `sitio.nombre`.** Ya dice
  `RETROMAQ`, y `<html lang="es-MX">`. Sigue siendo sincronización manual: `index.html` es
  HTML estático y no puede leer `sitio.ts`, y el propio archivo lo advierte en un comentario.
- **2. El target de `ng test` obsoleto en `.vscode/launch.json`.** Se quitó: apuntaba a
  `http://localhost:9876/debug.html`, que es de **Karma**, y este proyecto corre con Vitest
  sobre jsdom. **No hay configuración que lo reemplace, y no es un olvido**:
  `@angular/build:unit-test` no levanta ningún servidor ni sirve ninguna URL que un Chrome
  pueda abrir. El archivo lo deja escrito para que nadie la «arregle» reintroduciéndola.
- **3. Los dos `.svg.original` sin commitear en `public/`.** No existen: `public/` tiene
  hoy `excavadora.webp`, `favicon.ico` y las dos banderas ya limpias.
- **4. Los dos SVG de excavadora sin usar.** Borrados (`excavator-svgrepo-com.svg` y
  `excavator-bulldozer-svgrepo-com.svg`), que se copiaban al build sin que nadie los
  referenciara.
- **El «0» de accesibilidad: `selector-idioma` con `role="listbox"` sin flechas.** Bajado a
  ARIA de divulgación, igual que `menu-usuario`: `aria-haspopup="true"` +
  `aria-expanded`, botones normales y `aria-current` en lugar del `aria-selected` que pedía
  el `role="option"`. **Estaba peor de lo que decía el documento**: no solo mentían los
  roles, **faltaba toda la conducta** —sin Escape, sin cierre al clicar fuera— y al elegir
  idioma el foco caía a `<body>` (WCAG 2.4.3). Ahora Escape cierra y devuelve el foco al
  disparador, y el clic fuera cierra sin moverlo.
- **El «0» de esqueletos: `plataforma/empresas` y `empresa/inicio` con «Cargando…» en
  texto.** Los dos tienen su `esqueleto.ts` hermano.
- **12. El interceptor de refresco**, arriba, con el detalle de qué quedó fuera.

Y de revisiones anteriores: `lang="es-MX"` en `index.html`, la prueba `app.spec.ts` que se
rompía al quitar la plantilla de bienvenida — desapareció con ella —, el componente `App`
sin `OnPush`, la integración HTTP, la **decisión de CORS** (CORS explícito en la API, no
proxy en el dev server), el **shell completo de la Fase 0** y el **sistema de diseño sobre
Tailwind v4**.

---

## Plan de desarrollo

Se trabaja en **rebanadas verticales**: cada módulo se termina de punta a punta antes de
pasar al siguiente (`03-plan-desarrollo.md` §1).

```
Entidad → Migración → Caso de uso → Endpoint → Pruebas → Pantalla Angular → Funciona
```

No "todo el backend y luego todo el frontend": con 26 módulos, esa separación son seis
meses sin nada demostrable.

| Fase                 | Alcance                                                                 | Lo que aporta el front                                  |
| -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| **0 — Fundación**    | Multi-tenancy, aprovisionamiento, auth                                  | Shell: layout, login, guards, interceptores, navegación |
| **1 — Núcleo**       | Equipos, clientes, obras, tarifas, disponibilidad, cotizaciones, rentas | Pantallas del ciclo cotizar → aprobar → rentar → cerrar |
| **2 — Operación**    | Contratos, logística, inspecciones, evidencias, horómetros, daños       | Captura con fotografías                                 |
| **3 — Taller**       | Mantenimiento, órdenes de trabajo, refacciones, compras                 |                                                         |
| **4 — Finanzas**     | Pagos, cobranza, CFDI, rentabilidad                                     | Reportes                                                |
| **5 — Campo**        | PWA con offline, sincronización, GPS, firmas, QR                        | La fase más difícil del front                           |
| **6 — Inteligencia** | Predicción, pricing dinámico, analítica                                 | Requiere histórico real                                 |

**La Fase 0 del front está CERRADA (2026-08-25)**: armazones, accesos, guards, interceptor
de token, interceptor de refresco y navegación. Lo que queda pegado a la Fase 0 no es
shell: es tooling (7 a 11) y decisiones de despliegue (15, 17). El panel de
superadministración —empresas, planes, resumen, salud de esquemas— también está en pie, y
eso ya es más que la fundación.

Al cerrar la Fase 1 el sistema **ya es vendible**. Dashboard, notificaciones y reportes
no son fases: cada fase agrega los suyos al cerrar.

La PWA offline de la Fase 5 se diseña desde ahora: los IDs se generan en el cliente (de
ahí uuid v7) y hay resolución de conflictos.

---

## Divergencias con los documentos de diseño

Los documentos de `maquinaria-backend/docs/` son especificación, no inventario.
Diferencias detectadas al 2026-08-25:

| Documento dice                                                    | Realidad en disco                                                                                                                                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular 22 / Angular CLI 22.1.4                                   | **Angular 21.2.21** (`@angular/core`, CLI y `@angular/build`, los tres 21.2.21)                                                                                                                                         |
| Node v24.19.0, npm 11.17.0                                        | **Node v22.14.0, npm 10.9.2**, medido hoy en esta máquina — y `package.json` declara `packageManager: npm@11.6.2`, que no es el que corre. La revisión anterior anotaba v24.11.1 / 11.6.2: ese dato también quedó viejo |
| Repos `maquinaria_back` / `maquinaria_front`                      | `maquinaria-backend` / `maquinaria-frontend`                                                                                                                                                                            |
| Salida del build `dist/maquinaria-front/browser` (§10, línea 127) | **`dist/maquinaria-frontend/browser`**                                                                                                                                                                                  |
| Checklist marca el frontend como "Angular 22 listo"               | Es Angular 21, y ya no es scaffolding: tres aplicaciones en pie y la Fase 0 cerrada                                                                                                                                     |
| Login con tres campos, incluido el identificador de empresa       | **Dos campos**: la empresa sale del subdominio                                                                                                                                                                          |
| Organización por feature en `core/` / `features/` / `shared/`     | `nucleo/` + `disposicion/` + `paginas/` agrupadas por aplicación                                                                                                                                                        |
| `src/environments/` con reemplazo de archivos por configuración   | Un solo archivo, `nucleo/ambiente/configuracion.ts`                                                                                                                                                                     |
| Cliente de API generado desde OpenAPI                             | `contratos.ts` escrito **a mano**; `api:sync` no existe (pendiente 13), y ya se le escapó un tipo (pendiente 18)                                                                                                        |
| Refresh token en cookie `HttpOnly`                                | En `localStorage`, y el backend lo devuelve en el cuerpo (pendiente 15)                                                                                                                                                 |
| §9 prevé cuatro interceptores: JWT, refresh, errores y `tenant`   | Tres decididos: JWT y refresh **existen**, `tenant` **no hace falta** —el slug va en la ruta—, y el de errores sigue pendiente: cada pantalla llama a `mensajeDeError` a mano                                           |

Lo que **dejó de ser divergencia** en esta revisión: el comando `migrar-empresas` del
backend, que el documento anterior daba por pendiente y hoy existe
(`dotnet run --project src/Maquinaria.Api -- migrar-empresas`, con
`Aplicacion/Empresas/MigrarEmpresas.cs`). Es lo que aplica lo que la pantalla de salud de
esquemas señala, así que el aviso ya tiene salida.

Cuando el disco y el documento no coinciden, **gana el disco** y se corrige el documento.
