/**
 * Los tipos de la API, con nombres del dominio.
 *
 * ESTE ES EL ARCHIVO QUE SE MANEJA A MANO. Los de abajo, los de sesión, siguen escritos
 * aquí; los de negocio se RE-EXPORTAN de `generado.ts`, que produce `npm run api:sync`
 * desde `/openapi/v1.json` y **no se edita nunca**.
 *
 * Por qué la capa intermedia y no importar el generado desde cada pantalla:
 *
 * - Los nombres del generado son los del servidor —`MarcaDto`, `PaginaOfMarcaDto`— y
 *   arrastran su sufijo técnico a veintiocho pantallas.
 * - Si el backend renombra un DTO, **rompe aquí y en un solo sitio**, no repartido.
 * - `generado.ts` son ~9,100 líneas de máquina. Que nadie tenga que abrirlo es el punto.
 *
 * Los de sesión se quedan a mano por ahora; pasarlos al generado es lo que cierra el
 * pendiente 18. Ver `docs/plan-fase1-front.md` §6.
 */

import type { components } from './generado';

// ------------------------------------------------------------------ listados --

/**
 * Lo que acepta TODO listado de la API. Se enlaza con `[FromQuery]`, así que los nombres
 * llevan mayúscula inicial: son los de la cadena de consulta, no los de C#.
 *
 * `Activo` nulo NO es lo mismo que `false`: nulo trae activos e inactivos.
 *
 * `Tamano` tiene techo de 200 en el servidor, y no es preferencia de interfaz sino su
 * defensa: sin él, `?Tamano=1000000` trae la tabla entera. La pantalla no ofrece
 * «mostrar todos».
 */
export interface FiltroListado {
  readonly Texto?: string;
  readonly Activo?: boolean;
  readonly IncluirEliminados?: boolean;
  /** Base 1, como lo cuenta la gente. */
  readonly Numero?: number;
  readonly Tamano?: number;
  readonly Orden?: string;
  readonly Descendente?: boolean;
}

/**
 * Los filtros propios de cada módulo.
 *
 * El backend los declara heredando de `Filtro` —`FiltroTarifas`, `FiltroTiposEquipo`…— y
 * aquí se reproduce esa herencia en lugar de meter todos los campos en `FiltroListado`.
 * Con un tipo único, la pantalla de marcas aceptaría `AplicaRenta` sin que nada la corrija.
 *
 * Los nombres van con mayúscula inicial porque son los de la cadena de consulta, igual que
 * en `FiltroListado`.
 */
export interface FiltroTarifas extends FiltroListado {
  readonly AplicaRenta?: boolean;
  readonly AplicaVenta?: boolean;
  readonly Unidad?: UnidadTarifa;
}

export interface FiltroTiposEquipo extends FiltroListado {
  readonly CategoriaEquipoId?: string;
}

export interface FiltroModelosEquipo extends FiltroListado {
  readonly MarcaId?: string;
  readonly TipoEquipoId?: string;
}

export interface FiltroClausulas extends FiltroListado {
  readonly Obligatoria?: boolean;
}

/**
 * `AlmacenaEquipo` y `EsAdministrativa` NO son campos de la ubicación: se DERIVAN del tipo,
 * y en la base son columnas generadas. Como filtro sí existen, y son la forma correcta de
 * pedir «solo donde cabe una máquina» —el alta de equipo y los traspasos— sin que la pantalla
 * tenga que saber que eso significa bodega o patio.
 */
export interface FiltroUbicaciones extends FiltroListado {
  readonly Tipo?: TipoUbicacion;
  readonly AlmacenaEquipo?: boolean;
  readonly EsAdministrativa?: boolean;
}

/**
 * `Activo` del filtro base SÍ aplica aquí, pero NO significa lo mismo que en un catálogo: el
 * trabajador no tiene columna `activo`, así que el servidor lo lee como «no dado de baja».
 * Para separar a quien está de incapacidad de quien se fue, el filtro fino es `Estado`, y es
 * el que usa la pantalla.
 */
export interface FiltroTrabajadores extends FiltroListado {
  readonly PuestoId?: string;
  readonly UbicacionId?: string;
  readonly Estado?: EstadoTrabajador;
}

/**
 * Una página de resultados.
 *
 * `total` es el conteo COMPLETO de las filas que cumplen el filtro, no las de esta
 * página: es lo que permite pintar «51-100 de 3,842». Cuesta un `COUNT` extra en el
 * servidor y se paga a propósito.
 *
 * Una página vacía es un **200 con `filas: []`**, nunca un 404.
 */
export interface Pagina<T> {
  readonly filas: readonly T[];
  readonly numero: number;
  readonly tamano: number;
  readonly total: number;
  readonly paginas: number;
}

// ------------------------------------------------------------------ catalogos --

/** Una marca de maquinaria: Caterpillar, Komatsu, JCB. */
export type Marca = components['schemas']['MarcaDto'];

/**
 * El alta de una marca. UN SOLO CAMPO: su identidad *es* el nombre, con `UNIQUE` encima.
 *
 * Sale opcional del generado —`{ nombre?: string }`— porque el DTO del servidor es un
 * `readonly record struct` y .NET no marca requeridos sus miembros. El formulario lo
 * exige de todos modos, y el servidor también.
 */
export type AltaMarca = components['schemas']['AltaMarca'];

/** El cuerpo del `PATCH .../activo`. Lo comparten los siete catálogos. */
export type CambioDeActivo = components['schemas']['CambioDeActivoCatalogo'];

/** Categoría de equipo: excavación, carga, compactación. De ella cuelgan los tipos. */
export type Categoria = components['schemas']['CategoriaEquipoDto'];
export type AltaCategoria = components['schemas']['AltaCategoriaEquipo'];

/** Tipo de equipo: excavadora, retroexcavadora. Cuelga de una categoría. */
export type TipoEquipo = components['schemas']['TipoEquipoDto'];
export type AltaTipoEquipo = components['schemas']['AltaTipoEquipo'];

/** Modelo: el 320D de Caterpillar. Cuelga de una marca y, opcionalmente, de un tipo. */
export type ModeloEquipo = components['schemas']['ModeloEquipoDto'];
export type AltaModeloEquipo = components['schemas']['AltaModeloEquipo'];

/**
 * Un concepto cobrable: renta por día, flete, limpieza.
 *
 * `unidad` llega como número. Los nombres de cada valor están en el `@description` del tipo
 * generado, que los toma del enum de C#: 1 Hora · 2 Día · 3 Semana · 4 Mes · 5 Evento ·
 * 6 Kilómetro.
 */
export type Tarifa = components['schemas']['TarifaDto'];
export type AltaTarifa = components['schemas']['AltaTarifa'];
export type UnidadTarifa = components['schemas']['UnidadTarifa'];

/** Cláusula de contrato, del catálogo que se engancha a cada contrato. */
export type Clausula = components['schemas']['ClausulaDto'];
export type AltaClausula = components['schemas']['AltaClausula'];

/** Puesto de trabajo. De él cuelgan los trabajadores. */
export type Puesto = components['schemas']['PuestoDto'];
export type AltaPuesto = components['schemas']['AltaPuesto'];

// --------------------------------------------------------------- organizacion --

/**
 * Una ubicación física: bodega, sucursal o patio. **Los tres al mismo nivel**, no una
 * jerarquía: un patio no está dentro de una sucursal.
 *
 * `almacenaEquipo` y `esAdministrativa` llegan CALCULADOS y salen opcionales del generado
 * porque el servidor los deriva del tipo —en la base son columnas generadas— y nadie los
 * captura. El alta, coherente con eso, solo acepta `tipo`.
 */
export type Ubicacion = components['schemas']['UbicacionDto'];
export type AltaUbicacion = components['schemas']['AltaUbicacion'];

/**
 * El tipo llega como número: 1 Bodega · 2 Sucursal · 3 Patio.
 *
 * Al ser numérico, un `<option>` que lo lleve necesita `[ngValue]` y no `[value]`. Está
 * razonado en `AGENTS.md`; con `[value]` el control recibe la cadena «1» y el servidor
 * responde 400.
 */
export type TipoUbicacion = components['schemas']['TipoUbicacion'];

/**
 * Una persona de la organización.
 *
 * UN TRABAJADOR NO ES UN USUARIO. El trabajador es la persona —quien opera la máquina, quien
 * levanta la renta—; el usuario es la cuenta. El operador de patio puede no tener acceso al
 * sistema y hay que poder registrarlo igual, así que `usuarioId` es un enlace OPCIONAL.
 */
export type Trabajador = components['schemas']['TrabajadorDto'];
export type AltaTrabajador = components['schemas']['AltaTrabajador'];

/**
 * El cambio de estado, con la fecha que la baja exige.
 *
 * VA APARTE DEL ALTA A PROPÓSITO. El CHECK `trabajador_baja_coherente` de la base exige que el
 * estado Baja y su fecha viajen juntos; dejar que un PUT los moviera por separado es la forma
 * de topar con ese CHECK como un 500 en lugar de como un mensaje.
 */
export type CambioEstadoTrabajador = components['schemas']['CambioEstadoTrabajador'];

/**
 * El estado llega como número: 1 Activo · 2 Inactivo · 3 Baja.
 *
 * Numérico, así que un `<option>` que lo lleve necesita `[ngValue]`, igual que `TipoUbicacion`.
 * Y **Baja no es reversible**: la persona dejó la empresa. Inactivo sí lo es —incapacidad,
 * permiso, suspensión—.
 */
export type EstadoTrabajador = components['schemas']['EstadoTrabajador'];

// ------------------------------------------------------------------- terceros --

/**
 * Un proveedor.
 *
 * Vive en la ORDEN DE COMPRA: `equipo` no tiene `proveedor_id` —se quitó el 2026-08-25— y desde
 * un equipo el proveedor se alcanza por `equipo → orden_compra_detalle → orden_compra →
 * proveedor`. Un dato en un solo lugar. Por eso la columna de la tabla cuenta órdenes y no
 * equipos: es la relación que existe de verdad.
 */
export type Proveedor = components['schemas']['ProveedorDto'];
export type AltaProveedor = components['schemas']['AltaProveedor'];

/**
 * Un cliente, con su contacto y su domicilio DENTRO.
 *
 * Se quitaron las tablas `contacto_cliente` y `domicilio_cliente` el 2026-08-25 y sus campos
 * viven en el propio cliente. El precio, dicho en voz alta: **un cliente tiene UN contacto y UN
 * domicilio**. Si mañana hace falta el domicilio fiscal aparte del de entrega, o dos contactos
 * —cobranza y operación—, hay que volver a sacar la tabla y migrar. Fue decisión del negocio.
 *
 * En el DTO llegan agrupados en dos objetos aunque en la tabla sean columnas planas, y la
 * pantalla los pinta como dos bloques.
 */
export type Cliente = components['schemas']['ClienteDto'];
export type AltaCliente = components['schemas']['AltaCliente'];
export type ContactoCliente = components['schemas']['ContactoCliente'];
export type DomicilioCliente = components['schemas']['DomicilioCliente'];

/**
 * El estado llega como número: 1 Activo · 2 Suspendido · 3 Baja.
 *
 * Numérico, así que un `<option>` que lo lleve necesita `[ngValue]`. A diferencia del
 * trabajador, **el cambio de estado no arrastra fecha**: `CambioEstadoCliente` solo lleva el
 * estado, así que aquí no hay CHECK que respetar ni panel con dos campos.
 */
export type EstadoCliente = components['schemas']['EstadoCliente'];
export type CambioEstadoCliente = components['schemas']['CambioEstadoCliente'];

/** Su único filtro propio. El `Activo` del filtro base no aplica: el cliente tiene `Estado`. */
export interface FiltroClientes extends FiltroListado {
  readonly Estado?: EstadoCliente;
}

// -------------------------------------------------------------------- equipos --

/**
 * Un equipo del parque. **La entidad central de la fase**: lo que se renta, lo que se traspasa
 * y lo que se vende.
 *
 * `equipo` NO tiene `proveedorId` —se quitó del modelo el 2026-08-25—: el proveedor vive en la
 * orden de compra y desde aquí se alcanza por
 * `equipo → orden_compra_detalle → orden_compra → proveedor`.
 *
 * Es una de las TRES entidades con borrado lógico —las otras son `archivo` y `tenant`—, así que
 * es la primera pantalla de la fase que tiene un `DELETE` de verdad.
 */
export type Equipo = components['schemas']['EquipoDto'];

/**
 * `estado` NO está en el alta: un equipo nace Disponible y se mueve con su propia acción o con
 * los procesos —confirmar una renta lo pone Rentado, finalizar una venta lo pone Vendido—. Si
 * el PUT lo aceptara, una corrección de notas podría sacar de la calle una máquina rentada.
 */
export type AltaEquipo = components['schemas']['AltaEquipo'];

/** El cambio de estado lleva una NOTA opcional: por qué entró a mantenimiento, por ejemplo. */
export type CambioEstadoEquipo = components['schemas']['CambioEstadoEquipo'];

/**
 * Ocho estados: 1 Disponible · 2 Reservado · 3 Rentado · 4 EnTraslado · 5 EnMantenimiento ·
 * 6 FueraDeServicio · 7 Vendido · 8 Baja.
 *
 * **La pantalla no los mueve todos.** Reservado, Rentado y Vendido los pone el motor al
 * confirmar una renta o finalizar una venta; ofrecerlos a mano dejaría el calendario y el
 * estado contándose cosas distintas. Ver `ESTADOS_MANUALES` en la pantalla.
 */
export type EstadoEquipo = components['schemas']['EstadoEquipo'];

/** 1 Renta · 2 Venta · 3 RentaYVenta. Un solo ciclo de vida, que puede terminar en venta. */
export type PropositoEquipo = components['schemas']['PropositoEquipo'];

/** 1 Compra · 2 CargaInicial. De dónde salió el equipo al entrar al sistema. */
export type OrigenEquipo = components['schemas']['OrigenEquipo'];

export interface FiltroEquipos extends FiltroListado {
  readonly UbicacionId?: string;
  readonly TipoEquipoId?: string;
  readonly ModeloEquipoId?: string;
  readonly Estado?: EstadoEquipo;
  readonly Proposito?: PropositoEquipo;
}

/**
 * Un documento del expediente: foto, factura, póliza, manual, certificado u otro.
 *
 * La fila vive en `equipo_archivo` y el contenido en el almacén. **Las dos mitades se crean
 * juntas** en un proceso del servidor, que es lo que evita archivos huérfanos en el bucket y
 * filas que apuntan a nada.
 */
export type DocumentoEquipo = components['schemas']['DocumentoEquipoDto'];

/** 1 Foto · 2 Factura · 3 Póliza · 4 Manual · 5 Certificado · 6 Otro. Numérico: `[ngValue]`. */
export type TipoArchivoEquipo = components['schemas']['TipoArchivoEquipo'];

/**
 * El precio de un concepto para un equipo, con vigencia.
 *
 * **AQUÍ VIVE EL PRECIO, no en el catálogo de tarifas.** El catálogo dice QUÉ se cobra —renta
 * diaria, flete, operador—; esta tabla dice CUÁNTO, por equipo, con fecha, y opcionalmente para
 * un cliente concreto.
 *
 * `clienteId` nulo es el precio de LISTA; con cliente es el negociado, y gana sobre el de
 * lista. Un `EXCLUDE` impide que existan dos vigentes para la misma combinación, y por eso
 * cargar un precio puede responder **409**.
 */
export type EquipoTarifa = components['schemas']['EquipoTarifaDto'];
export type AltaEquipoTarifa = components['schemas']['AltaEquipoTarifa'];

// ------------------------------------------------------ disponibilidad y traspasos --

/**
 * Una fila del calendario físico de un equipo.
 *
 * **`ocupacion_equipo` es la pieza que sostiene la fase.** La regla «un equipo no puede tener
 * dos rentas traslapadas» no se implementa consultando cinco tablas: todo lo que ocupa un
 * equipo —renta, reserva, mantenimiento, traslado, bloqueo— inserta una fila ahí, y un
 * `EXCLUDE` con índice GiST hace **imposible** que dos se traslapen.
 *
 * `fin` nulo es «sin fecha de fin»: bloquea todo lo posterior. Es lo correcto para un equipo
 * fuera de servicio.
 */
export type Ocupacion = components['schemas']['OcupacionDto'];

/**
 * Seis motivos, y **solo tres se capturan a mano**: Mantenimiento, Reparación y Bloqueo. Renta,
 * Reserva y Traslado los pone un Proceso, porque salen de un documento. Numérico: `[ngValue]`.
 */
export type MotivoOcupacion = components['schemas']['MotivoOcupacion'];
export type AltaBloqueo = components['schemas']['AltaBloqueo'];

/** Un equipo libre en el periodo consultado, con lo que hace falta para cotizarlo. */
export type EquipoDisponible = components['schemas']['EquipoDisponibleDto'];

/**
 * El periodo es OBLIGATORIO: «qué hay disponible» sin fechas no es una pregunta que esa tabla
 * pueda contestar, y el servidor rechaza la consulta sin él con un 400.
 */
export interface FiltroDisponibilidad extends FiltroListado {
  readonly Desde?: string;
  readonly Hasta?: string;
  readonly TipoEquipoId?: string;
  readonly UbicacionId?: string;
  /** Para cotizar el precio negociado de ese cliente en lugar del de lista. */
  readonly ClienteId?: string;
}

/**
 * Un traspaso de equipo entre ubicaciones que almacenan.
 *
 * **Solo de almacén a almacén** —bodega o patio, nunca desde ni hacia una sucursal— y lo impone
 * un TRIGGER de la base, no el código de la aplicación. Una sucursal administra y cotiza; no
 * guarda máquinas.
 */
export type Transferencia = components['schemas']['TransferenciaDto'];

/**
 * `fin` decide si el traspaso OCUPA el calendario.
 *
 * Si viene, se ocupa con motivo Traslado y el equipo no se puede rentar en ese periodo. Si no
 * viene, el traspaso se registra como instantáneo y no toca el calendario. Es opcional a
 * propósito: cerrar un traslado en curso es logística —M8, Fase 2—, y sin ese cierre una
 * ocupación «hasta que llegue» se quedaría abierta para siempre.
 */
export type AltaTransferencia = components['schemas']['AltaTransferencia'];

export interface FiltroTransferencias extends FiltroListado {
  readonly EquipoId?: string;
  readonly UbicacionId?: string;
}

// --------------------------------------------------------------- cotizaciones --

/**
 * Una cotización: la propuesta comercial, con sus líneas.
 *
 * **El listado llega SIN líneas** —`lineas: []`— a propósito: son N por documento y una pantalla
 * de cincuenta cotizaciones no las pinta. El detalle sí las trae.
 */
export type Cotizacion = components['schemas']['CotizacionDto'];

/**
 * Una línea. **La define su TARIFA**; el equipo y el tipo son contexto OPCIONAL.
 *
 * Los dos pueden venir nulos, y eso importa: una línea de flete no tiene equipo ni tipo. El
 * CHECK que exigía uno de los dos se quitó el 2026-08-25 porque hacía imposible cotizar un flete.
 */
export type CotizacionLinea = components['schemas']['CotizacionLineaDto'];

/**
 * El FOLIO no va en el alta: lo genera el sistema. Aceptarlo dejaría que dos capturistas
 * eligieran el mismo y que alguien saltara la numeración.
 */
export type AltaCotizacion = components['schemas']['AltaCotizacion'];

/**
 * El PRECIO UNITARIO se captura, no se calcula. La fase no escoge la tarifa conveniente ni
 * decide si doce días son semana más días: un vendedor captura lo que acordó y el documento lo
 * conserva. El IMPORTE sí se calcula, en el servidor: cantidad por precio.
 */
export type AltaCotizacionLinea = components['schemas']['AltaCotizacionLinea'];

/**
 * Siete estados: 1 Borrador · 2 Enviada · 3 EnRevisión · 4 Aceptada · 5 Rechazada · 6 Vencida ·
 * 7 Cancelada.
 *
 * **No se mueve a cualquiera desde cualquiera**: hay una máquina de estados en el servidor y las
 * transiciones inválidas responden 409. La pantalla ofrece solo las válidas — ver
 * `SIGUIENTES` en `cotizaciones.ts`.
 */
export type EstadoCotizacion = components['schemas']['EstadoCotizacion'];

export interface FiltroCotizaciones extends FiltroListado {
  readonly ClienteId?: string;
  readonly Estado?: EstadoCotizacion;
  readonly Desde?: string;
  readonly Hasta?: string;
}

// --------------------------------------------------------------------- rentas --

/**
 * Una renta: la operación real, y **el criterio de salida de la Fase 1**.
 *
 * Igual que la cotización, **el listado llega SIN líneas ni conceptos** —los dos arreglos vacíos—
 * porque son N por documento. El detalle los trae en consultas aparte.
 *
 * `vencida` y `porVencer` son **derivados de la fecha, no almacenados**: la renta Activa cuyo fin
 * ya pasó está vencida, y la que vence en tres días está por vencer. Guardarlos exigiría un
 * proceso nocturno que recorriera la tabla; calcularlos no puede quedar desactualizado.
 */
export type Renta = components['schemas']['RentaDto'];

/**
 * **Lo que se renta.** Una fila por equipo, con `equipoId` OBLIGATORIO, y es **lo único que genera
 * filas de `ocupacion_equipo`**: dos equipos, dos filas de calendario.
 *
 * Por eso las líneas **solo se tocan en Borrador**: a partir de Confirmada tienen calendario
 * detrás. Los conceptos no — ver `RentaConcepto`.
 */
export type RentaLinea = components['schemas']['RentaLineaDto'];

/**
 * **Lo que se cobra además**: flete, operador, maniobras. No lleva equipo, así que no toca el
 * calendario.
 *
 * Y esa es la razón de que se puedan agregar y quitar **en cualquier estado salvo Cerrada y
 * Cancelada**, al contrario que las líneas: cobrar un flete extra con la máquina ya en la obra es
 * lo normal, y nada de eso mueve una ocupación.
 *
 * El `costo` va aparte del importe porque el flete lo pide explícitamente: el margen es la resta.
 */
export type RentaConcepto = components['schemas']['RentaConceptoDto'];

/**
 * El registro de un alargue. Conserva el `finAnterior`, que es el dato histórico por el que la
 * tabla existe: sin él no se puede contestar «cuánto se alargó esta renta».
 */
export type ExtensionRenta = components['schemas']['ExtensionRentaDto'];

/**
 * **DÓNDE SE TRABAJA VA AQUÍ DENTRO**, no en una tabla `obra`. `descripcion` es obligatoria y el
 * resto de la dirección es opcional.
 *
 * El precio de esa simplificación está dicho en el alcance: no se puede agrupar rentabilidad por
 * obra de forma confiable.
 */
export type LugarRenta = components['schemas']['LugarRenta'];

/** El folio lo genera el sistema, igual que en la cotización. */
export type AltaRenta = components['schemas']['AltaRenta'];

/** El `equipoId` es obligatorio: sin máquina concreta no hay fila de calendario. */
export type AltaRentaLinea = components['schemas']['AltaRentaLinea'];

export type AltaRentaConcepto = components['schemas']['AltaRentaConcepto'];

/** `finNuevo` tiene que ir MÁS ALLÁ del fin actual: el CHECK `extension_avanza` lo exige. */
export type AltaExtension = components['schemas']['AltaExtension'];

/**
 * Los horómetros de devolución van por LÍNEA, en un mapa `lineaId → lectura`, y son OPCIONALES:
 * no todos los equipos llevan horómetro, y el módulo de horómetros es Fase 2.
 */
export type CierreDeRenta = components['schemas']['CierreDeRenta'];

/**
 * Lo que la conversión NECESITA y la cotización no tiene: el periodo real y el lugar de trabajo.
 *
 * Una cotización no los lleva —cotiza un precio, no un compromiso de fechas—, y por eso convertir
 * no es un botón de un clic: hay que preguntarlos. El depósito y el anticipo van aparte porque
 * tampoco están cotizados.
 */
export type ConversionARenta = components['schemas']['ConversionARenta'];

/**
 * Lo que devuelve convertir una cotización aceptada.
 *
 * **`pendientes` no es un error, es trabajo por hacer.** Una cotización puede pedir «una
 * excavadora de 20 t» —tipo, sin equipo—, y una renta necesita la máquina concreta porque cada
 * línea genera calendario. Esas líneas NO pasan a la renta y se informan aquí para que quien
 * captura las asigne antes de confirmar.
 */
export type ConversionDeCotizacion = components['schemas']['ConversionDeCotizacion'];

/**
 * Diez estados: 1 Borrador · 2 Confirmada · 3 PorEntregar · 4 EnTraslado · 5 Activa ·
 * 6 PorVencer · 7 Vencida · 8 Devuelta · 9 Cerrada · 10 Cancelada.
 *
 * **Cuatro de los pasos NO son un cambio de estado**, son Procesos con endpoint propio, porque
 * mueven el calendario: confirmar (ocupa), extender (mueve el fin de las ocupaciones), cerrar y
 * cancelar (liberan). El `PATCH .../estado` cubre solo los dos que no tocan nada —Confirmada →
 * Activa y Activa → Devuelta— y **rechaza los otros con un 400**.
 *
 * Ver `ACCIONES` en `rentas.ts`, que es el espejo de esa tabla.
 */
export type EstadoRenta = components['schemas']['EstadoRenta'];

export interface FiltroRentas extends FiltroListado {
  readonly ClienteId?: string;
  readonly EquipoId?: string;
  readonly Estado?: EstadoRenta;
  readonly Desde?: string;
  readonly Hasta?: string;
}

// ------------------------------------------------------------------ contratos --

/**
 * Un contrato: el papel que respalda una renta.
 *
 * **CUELGA DE UNA RENTA, Y SOLO PUEDE HABER UNO.** Lo garantiza el `UNIQUE contrato_renta_unica`
 * de la base; el servidor además lo explica con un 409 en vez de dejar salir la violación cruda.
 * Por eso no se crea desde un botón suelto: se crea desde la renta que va a respaldar.
 *
 * `editable` viene **calculado por el servidor** —es `estado === Borrador`— y existe para que la
 * pantalla apague la edición en lugar de dejar intentarlo y recibir un 409. Se usa ese campo y no
 * una comparación propia: el día que el motor cambie qué es editable, esto se entera solo.
 */
export type Contrato = components['schemas']['ContratoDto'];

/**
 * Una cláusula del contrato, **con su propia copia del título y del texto**.
 *
 * Se CONGELAN al crear el contrato. Corregir mañana la plantilla del catálogo no reescribe lo que
 * alguien ya firmó, que es justo el punto.
 *
 * `clausulaId` es solo la referencia de dónde salió y es **anulable** por dos razones: la cláusula
 * puede ser propia —negociada con ese cliente, sin plantilla— y la del catálogo puede cambiar
 * después sin que este contrato se entere.
 */
export type ContratoClausula = components['schemas']['ContratoClausulaDto'];

/**
 * El alta. Tres campos toman valor de la RENTA cuando se omiten, y eso es deliberado:
 *
 * - `fechaInicio` y `fechaFin` → las de la renta.
 * - `deposito` en 0 → el de la renta. **Es el mismo dinero**, y capturarlo dos veces es la forma
 *   de que los dos documentos acaben diciendo cifras distintas.
 * - `clausulasDelCatalogo` vacía → **todas las obligatorias activas**. Es lo que se quiere casi
 *   siempre y evita que un contrato salga sin la cláusula de penalización por olvido.
 */
export type AltaContrato = components['schemas']['AltaContrato'];

/** Una cláusula propia: se redacta en el contrato y no existe en el catálogo. */
export type AltaContratoClausula = components['schemas']['AltaContratoClausula'];

/**
 * Cuatro estados: 1 Borrador · 2 Autorizado · 3 Firmado · 4 Terminado.
 *
 * **No hay Cancelado**, y no es un olvido: el enum migrado no lo tiene.
 *
 * Transiciones: Borrador → Autorizado · Autorizado → Firmado o Terminado · Firmado → Terminado.
 * Terminado es terminal. Además **autorizar exige cláusulas**: un contrato sin términos es un
 * papel en blanco, y una vez autorizado ya no se le pueden agregar.
 *
 * Ver `SIGUIENTES` en `contrato.ts`.
 */
export type EstadoContrato = components['schemas']['EstadoContrato'];

export interface FiltroContratos extends FiltroListado {
  readonly ClienteId?: string;
  readonly Estado?: EstadoContrato;
}

// -------------------------------------------------------------------- ordenes --

/**
 * Una orden de COMPRA: maquinaria que entra al parque.
 *
 * **Finalizarla es lo que da de alta los equipos en el catálogo**, y por eso no es un cambio de
 * estado sino un Proceso con endpoint propio. `PATCH .../estado` con `Finalizada` responde **400**
 * —«usa el endpoint de finalizacion»—, no 409: es una petición mal dirigida, no un conflicto.
 */
export type OrdenCompra = components['schemas']['OrdenCompraDto'];

/**
 * Una línea de compra: UNA máquina.
 *
 * **La cantidad tiene que ser 1 si la línea va a registrar equipo**, y es una adaptación al
 * esquema migrado: `orden_compra_detalle` tiene un solo `equipoId` con índice único, así que una
 * línea no puede producir tres máquinas. Tres excavadoras iguales son tres líneas — que además es
 * lo correcto, porque cada una tiene su número de serie.
 *
 * `equipoId` y `codigoInterno` vienen nulos hasta que la orden se finaliza.
 */
export type OrdenCompraDetalle = components['schemas']['OrdenCompraDetalleDto'];

export type AltaOrdenCompra = components['schemas']['AltaOrdenCompra'];

export type AltaOrdenCompraDetalle = components['schemas']['AltaOrdenCompraDetalle'];

/**
 * Lo que hace falta para que una línea de compra se vuelva un equipo del catálogo.
 *
 * **El código interno se pide al FINALIZAR, no al capturar la línea**, y es deliberado: es una
 * decisión de inventario, no de compra. Cuando se cotiza una máquina todavía no se sabe con qué
 * número va a entrar al parque.
 */
export type RegistroDeEquipo = components['schemas']['RegistroDeEquipo'];

/**
 * Una orden de VENTA: maquinaria que sale del parque.
 *
 * Al finalizarla, **el equipo sale del parque y se le cierra el calendario** para que no pueda
 * rentarse después. Esa es la pieza que conecta la venta con la garantía de no-traslape: sin
 * cerrar el calendario, una máquina vendida seguiría apareciendo libre y alguien la rentaría.
 *
 * **Adaptación anotada:** el alcance describe cerrarlo con `motivo = Venta`; `MotivoOcupacion` no
 * tiene ese valor y el CHECK de la base es `BETWEEN 1 AND 6`. Se cierra con `Bloqueo` y una nota
 * que dice de qué venta salió. El efecto sobre la disponibilidad es idéntico; lo que se pierde es
 * distinguir «vendido» de «bloqueado» leyendo solo el motivo.
 */
export type OrdenVenta = components['schemas']['OrdenVentaDto'];

/** Una línea de venta: un equipo EXISTENTE que se vende. Al revés que la de compra. */
export type OrdenVentaDetalle = components['schemas']['OrdenVentaDetalleDto'];

export type AltaOrdenVenta = components['schemas']['AltaOrdenVenta'];

export type AltaOrdenVentaDetalle = components['schemas']['AltaOrdenVentaDetalle'];

/**
 * Cuatro estados, compartidos por compras y ventas: 1 Borrador · 2 Autorizada · 3 Finalizada ·
 * 4 Cancelada.
 *
 * Transiciones: Borrador → Autorizada o Cancelada · Autorizada → Finalizada o Cancelada.
 * Finalizada y Cancelada son terminales.
 *
 * **Pero Finalizada NO se alcanza por el `PATCH`**: tiene endpoint propio porque registra equipos
 * —en compras— o los saca del parque y les cierra el calendario —en ventas—. Ver `ACCIONES` en
 * `orden-compra.ts` y `orden-venta.ts`.
 */
export type EstadoOrden = components['schemas']['EstadoOrden'];

/** `ContraparteId` es el PROVEEDOR en compras y el CLIENTE en ventas: el filtro es compartido. */
export interface FiltroOrdenes extends FiltroListado {
  readonly ContraparteId?: string;
  readonly Estado?: EstadoOrden;
}

// -------------------------------------------------------------------- sesion --

export interface InvitacionVigente {
  readonly correo: string;
  readonly nombre: string;
  /** Razón social, para mostrar a qué empresa se está entrando. */
  readonly empresa: string;
}

/**
 * La respuesta 202 de pedir un restablecimiento.
 *
 * `mensaje` es SIEMPRE el mismo texto, exista o no la cuenta: el backend lo construye
 * una sola vez para que las dos respuestas sean idénticas byte a byte. La pantalla lo
 * muestra tal cual y no lo interpreta; si lo tradujera a «te mandamos el correo», el
 * formulario pasaría a decir qué correos están registrados.
 */
export interface RestablecimientoSolicitado {
  readonly mensaje: string;
}

/** Lo que devuelve definir la contraseña nueva. */
export interface RestablecimientoAplicado {
  readonly correo: string;
  /** El slug. */
  readonly empresa: string;
}

export interface SesionEmpresa {
  readonly token: string;
  readonly expiraEn: string;
  readonly tokenRefresco: string;
  readonly nombre: string;
  readonly correo: string;
  /** El slug. */
  readonly empresa: string;
  readonly accesoTotal: boolean;
  readonly permisos: readonly string[];
}

export interface IdentidadEmpresa {
  readonly correo: string;
  readonly nombre: string;
  readonly empresa: string;
  readonly razonSocial: string;
  readonly accesoTotal: boolean;
  readonly permisos: readonly string[];
  /** Módulos que incluye el plan contratado. La interfaz oculta lo que no está. */
  readonly modulos: readonly string[];
}

/** Lo que devuelve la API en cualquier error, por `AddProblemDetails`. */
export interface DetalleProblema {
  /**
   * Los errores por campo de un `ValidationProblemDetails`. Solo vienen en los 400 que
   * genera el enlace de modelo de ASP.NET; los rechazos de negocio traen `detail`.
   */
  readonly errors?: Readonly<Record<string, readonly string[]>>;
  readonly title?: string;
  readonly detail?: string;
  readonly status?: number;

  /**
   * Código ESTABLE del problema, cuando el servidor lo emite. Viaja en `extensions` y no es
   * texto para leer: existe para que este lado pueda traducir el mensaje a SU idioma.
   *
   * El `detail` sigue llegando y sigue siendo lo que se muestra cuando el código no se
   * reconoce, así que un mensaje nuevo del servidor no se queda mudo mientras nadie lo
   * traduzca. Los códigos están en `Maquinaria.Api/Errores/CodigosProblema.cs`.
   */
  readonly codigo?: string;

  /** Segundos que faltan para reintentar. Solo en `demasiados_intentos`. */
  readonly segundos?: number;

  /** Qué fila no se encontró: `marca`, `renta`, `cliente`… Solo en `no_encontrado`. */
  readonly entidad?: string;
}
