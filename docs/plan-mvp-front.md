# Plan del MVP — frontend

> **Este documento manda sobre qué pantallas se construyen y en qué orden.** El alcance del
> producto está en `maquinaria-backend/docs/08-alcance-mvp.md` y el plan del modelo, las
> migraciones y las rebanadas en `09-plan-mvp.md`. Aquí está la mitad que falta: **las pantallas**.
>
> Escrito el **2026-09-01**, cuando el MVP sustituyó a la Fase 1 como entregable vigente.
> Sustituye a [`plan-fase1-front.md`](plan-fase1-front.md) donde los dos se contradigan.

---

## 1. El punto de partida

Las **21 pantallas de módulo** de la Fase 1 están en pie y verificadas en el navegador, con su
molde común: barra con búsqueda y filtros al servidor, tabla con paginación y columna fijada,
hoja inferior para el alta y la edición, confirmación antes de retirar, esqueletos de carga y
0 violaciones de axe.

**Ese molde no cambia.** Lo que sigue es el patrón canónico de
[`plan-fase1-front.md`](plan-fase1-front.md) §8 y las convenciones de
[`convenciones.md`](convenciones.md): ningún componente lleva HTML dentro del `.ts`, todo filtro
va al servidor, y una pantalla nueva necesita su ruta, su línea de menú con la clave de módulo y
sus textos en **los dos** idiomas.

---

## 2. Pantallas nuevas — 9

| Pantalla | Ruta | Módulo del permiso | Forma |
|---|---|---|---|
| Movimientos | `/movimientos` | `movimientos` | listado con filtros + alta manual · **hecha 2026-09-02**, sustituye a Traspasos |
| Proyectos | `/proyectos` | `proyectos` | catálogo; **el alta crea proyecto y ubicación a la vez** · **hecha 2026-09-02** |
| Mantenimiento | `/mantenimiento` | `mantenimiento` | listado + panel de apertura · **hecha 2026-09-02** |
| Detalle de mantenimiento | `/mantenimiento/:id` | `mantenimiento` | finalizar, cancelar, costo, regreso · **hecha 2026-09-02** |
| Usuarios | `/usuarios` | `usuarios` | invitar, editar, estado, asignar roles · **hecha 2026-09-02** |
| Roles y permisos | `/roles` | `usuarios` | matriz de módulo × acción por rol · **hecha 2026-09-02** |
| Bitácora | `/bitacora` | `usuarios` | auditoría con filtros y panel de detalle · **hecha 2026-09-02** |
| Reportes | `/reportes` | `reportes` | seis categorías con periodo compartido · **hecha 2026-09-02, sin exportación** |
| Dashboard | `/tablero` | `dashboard` | cinco bloques con clic al listado filtrado · **hecha 2026-09-02** |

Los tres catálogos nuevos —tipo de tarifa, tipo de cliente, tipo de proveedor y motivo de
movimiento— **no llevan pantalla propia de menú**: entran como pestañas de la sección de
Catálogos, con el mismo componente que los siete que ya existen.

---

## 3. Pantallas que cambian

| Pantalla | Qué cambia |
|---|---|
| **Equipos** (alta y expediente) | Los **cuatro costos** en el alta —hora, día, semana, mes; se rotulaban «tarifa de referencia» hasta el 2026-09-09 y ahora son de donde sale el costo que la cotización calcula sola—, `descripcion` como **NOMBRE de la máquina** justo después del código, fecha de alta obligatoria. **Se retira la pestaña de precios** por equipo y cliente, y con ella el propósito, el origen, el valor actual y «quién la recibe» —lo pone el responsable de la ubicación—. **La ubicación deja de ser editable**: se mueve con un movimiento, y el expediente muestra su historial. En el expediente, un precio **se corrige o se quita** (era cerrarlo con fecha) y su concepto **se escribe**: si no está en el catálogo, se crea desde ahí |
| **Ubicaciones** | Los cinco tipos nuevos, el responsable y la marca de administrativa —que solo aparece cuando el tipo es *Otra*— |
| **Tarifas** | Agrupadas por tipo. **Sin precio**: la columna desaparece del catálogo |
| **Rentas** (detalle) | El **proyecto y el destino por línea**, no en la cabecera. Dos acciones nuevas: **registrar entrega** y **registrar devolución**, cada una con su panel —horómetro, ubicación, condición— y su acta en PDF. Se retira el bloque de lugar en texto libre. Y desde el 2026-09-09 **se lee con el formato de la cotización**: un bloque por máquina, arriba la renta con su total y debajo sus cargos sangrados, más la **unidad** del documento |
| **Cotizaciones** | El **tipo Renta o Venta**, el periodo propuesto, la vigencia obligatoria y **convertir a venta** junto a convertir a renta. Desde el 2026-09-09, la **unidad** del documento y el costo de la máquina **calculado**; fuera el cliente, la ubicación y las condiciones |
| **Ventas** | Documentos adjuntos, y los estados presentados como *Confirmada* y *Cerrada* — el vocabulario del documento, sin tocar los valores guardados |
| **Clientes** | Tipo de cliente, RFC obligatorio, y el **expediente con pestañas**: datos, rentas, cotizaciones, ventas y documentos |
| **Proveedores** | Tipo de proveedor y observaciones |
| **Inicio** | Deja de ser la lista de módulos: la entrada de la empresa pasa a ser el Dashboard |

Y una que **sale del menú**: **órdenes de compra**. Compras es P2 en el documento nuevo, así que
su ruta y su entrada de menú se retiran juntas —la regla de
[`convenciones.md`](convenciones.md): *una opción que no lleva a ningún lado es peor que un menú
corto*—. Sus textos se quedan en `textos.ts` para cuando vuelva.

---

## 3.bis El menú, reestructurado — 2026-09-01

El negocio fijó la estructura del menú de empresa, y ya está aplicada:

| Sección | Contiene hoy |
|---|---|
| **Catálogos** | Marcas, categorías, tipos, modelos, tarifas, tipos de tarifa, cláusulas, puestos, **clientes y sus tipos**, **proveedores y sus tipos**, motivos de movimiento |
| **Equipos** | Equipos, ubicaciones, movimientos, **mantenimiento**, disponibilidad |
| **Rentas** | **Proyectos**, cotizaciones, rentas, contratos |
| **Ventas** | Órdenes de venta, **órdenes de compra** |
| **Reportes** | **Tablero, reportes** |
| **Configuración** | **Usuarios, roles y permisos, trabajadores, bitácora** |

Tres decisiones que conviene poder discutir sin leer código:

- **Clientes y proveedores viven en Catálogos.** Son maestros que usan por igual Rentas y
  Ventas; meterlos en uno sesgaría al otro. Moverlos es una línea.
- **Ubicaciones, movimientos y disponibilidad viven en Equipos.** Las cuatro pantallas
  responden la misma pregunta desde ángulos distintos: qué máquinas hay, dónde están, qué se
  movió y qué está libre.
- **Las obras viven en Rentas, no en Catálogos.** Un proyecto parece un maestro y no lo es: es
  donde se asignan máquinas, y el sitio del que hablan la línea de renta y el movimiento.
- **La cotización vive en Rentas** aunque pueda ser de venta: es la misma pantalla y el mismo
  documento, y duplicar la entrada en dos grupos haría creer que son dos cosas.

**Reportes dejó de estar vacío el 2026-09-02**: lleva el tablero y los seis reportes. El
mecanismo que lo escondía sigue ahí —`disposicion-empresa` descarta los grupos sin opciones— y
es lo que permite declarar un grupo antes de tener sus pantallas sin ensuciar el menú.

**Órdenes de compra volvió al menú el 2026-09-02.** Salió el día anterior con el argumento de
que compras es P2, y era un recorte del *menú*, no del código: la pantalla, sus endpoints y su
módulo llevaban meses funcionando y solo estaban inalcanzables sin teclear la URL. Esconder lo
que existe no reduce el alcance, lo vuelve invisible.

**Y órdenes de venta pasó a exigir `ventas.*`.** Pedía `compras.*` porque el controlador se
escribió copiando el simétrico, cuando el módulo `ventas` todavía no existía: vender maquinaria
requería permiso de comprar refacciones.

> **Un desajuste que el menú deja a la vista:** la opción de **Ventas declara el módulo
> `compras`**, no `ventas`, porque es lo que el controlador exige hoy
> —`[RequierePermiso("compras.consultar")]`—. El MVP creó el módulo `ventas` y el endpoint
> todavía no lo declara. Hasta que se cambie en el servidor, el menú tiene que pedir lo que el
> servidor pide de verdad: si aquí dijera `ventas`, la opción no se dibujaría para nadie.

**Vigilado por pruebas.** `menu-empresa.spec.ts` cruza el menú contra `rutas-empresa.ts`: toda
opción tiene su ruta registrada, ninguna ruta se repite, y las claves de módulo tienen forma de
clave. Es el error que el repo ya pagó en agosto —un grupo con tres rutas inexistentes que caía
en el comodín— y que hasta hoy solo vigilaba una convención escrita.

---

## 4. Orden de construcción

El mismo de las rebanadas del backend, porque cada pantalla necesita su endpoint. Los números
son los de [`09-plan-mvp.md`](../../maquinaria-backend/docs/09-plan-mvp.md) §6.

1. **Catálogos** (rebanada 1) — las cuatro pestañas nuevas y el catálogo de tarifas sin precio.
2. **Ubicaciones y Proyectos** (2) — los cinco tipos, y el alta de proyecto que crea las dos filas. **Hecho el 2026-09-02**.
3. **Movimientos** (3) — listado, alta manual, y el historial dentro del expediente del equipo. **Hecho el 2026-09-02**; se llevó por delante la pantalla de Traspasos.
4. **Entrega y devolución** (4) — los dos paneles del detalle de renta, con sus actas.
5. **Usuarios, roles y bitácora** (5 y 6) — la sección de Configuración.
6. **Mantenimiento** (7).
7. **Cotizaciones y Ventas** (8).
8. **Reportes y exportación** (9), y **Dashboard** (10).
9. **Notificaciones** (11) y los **formatos** restantes (12).

---

## 5. Tres cosas que este plan añade al molde

- **Confirmación con resumen de cambios.** El documento lo pide en §4.1: *si una acción afecta
  disponibilidad, ubicación o estado, mostrar resumen de cambios antes de confirmar*. Entrega,
  devolución, traspaso, abrir y cerrar mantenimiento y finalizar venta **no** se confirman con el
  diálogo genérico de «¿seguro?»: enseñan qué va a pasar —qué máquina, de dónde a dónde, con qué
  estado resultante—.
- **Los indicadores se pueden abrir.** Cada KPI del dashboard navega al listado ya filtrado que lo
  compone. Un número que no se puede abrir obliga a reconstruir el filtro a mano, y entonces nadie
  comprueba si el número era cierto.
- **Las acciones que el rol no permite se ocultan y además se bloquean en el servidor.** Lo primero
  ya lo hace el menú por intersección de permisos; lo segundo lo garantiza `[RequierePermiso]`. El
  documento exige las dos (§4.1) y conviene decir que **la del servidor es la que protege**.
