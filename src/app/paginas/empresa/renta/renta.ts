import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { type Observable, map, of, switchMap } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiCotizaciones } from '../../../nucleo/api/api-cotizaciones';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import { ApiProyectos } from '../../../nucleo/api/api-proyectos';
import { ApiRentas } from '../../../nucleo/api/api-rentas';
import type {
  CotizacionLinea,
  EstadoRenta,
  RentaConcepto,
  PrecioVigente,
  RentaLinea,
  RentaLineaTarifa,
} from '../../../nucleo/api/contratos';
import { costoDelEquipoPorUnidad } from '../../../nucleo/api/costo-de-equipo';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { aInstante } from '../../../nucleo/formularios/fecha-hora';
import { unidadesEntre } from '../../../nucleo/api/periodo-en-unidades';
import { codigoDesdeNombre, mismoNombre } from '../../../nucleo/formularios/texto';
import {
  validadorCantidad,
  validadorImporte,
  validadorRequerido,
} from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';

// **SIN `BloqueDeEquipo` NI `agruparPorEquipo`.** Vivieron unas horas del 2026-09-09: la
// pantalla agrupaba las líneas planas por máquina para leerlas como una cotización, porque
// `renta_linea` tenía una fila por *(equipo, concepto)*.
//
// Esa misma tarde la tabla cambió: **una línea por máquina, con sus cargos dentro**, igual que
// `cotizacion_linea`. El DTO ya llega agrupado, así que agrupar aquí sería rehacer en la
// pantalla lo que el modelo ya dice — y las cinco pruebas que lo fijaban se fueron con él.

const BORRADOR: EstadoRenta = 1;
const CONFIRMADA: EstadoRenta = 2;
const ACTIVA: EstadoRenta = 5;
const DEVUELTA: EstadoRenta = 8;
const CERRADA: EstadoRenta = 9;
const CANCELADA: EstadoRenta = 10;

/** Ver `MONEDA` en `cotizaciones.ts`: la Fase 1 no lleva divisa por documento. */
const MONEDA = 'MXN';

/**
 * QUÉ SE PUEDE HACER DESDE CADA ESTADO. Es el espejo de tres cosas del servidor a la vez, y por
 * eso está en un solo sitio en lugar de repartido en `@if`:
 *
 * - la tabla `Transiciones` de `ServicioRentasEf`,
 * - las guardas de cada Proceso —confirmar exige Borrador, extender exige Confirmada o Activa,
 *   cerrar exige Activa o Devuelta, cancelar exige Borrador o Confirmada—,
 * - y el filtro del propio controlador, que **rechaza con 400** un `PATCH .../estado` hacia
 *   Confirmada, Cerrada o Cancelada porque esos mueven el calendario y tienen endpoint propio.
 *
 * Un estado ausente de este mapa es terminal: Cerrada y Cancelada no ofrecen nada.
 *
 * **La copia no es la garantía.** Quien manda es el servidor, que responde 409 —o 400— y ese
 * texto se muestra tal cual. Esto existe para no OFRECER lo que se va a rechazar.
 */
export const ACCIONES: Readonly<Record<number, readonly string[]>> = {
  [BORRADOR]: ['confirmar', 'cancelar'],
  [CONFIRMADA]: ['activar', 'extender', 'cancelar'],
  [ACTIVA]: ['devolver', 'extender', 'cerrar'],
  [DEVUELTA]: ['cerrar'],
  // Cerrada y Cancelada NO están: son terminales, y su ausencia es lo que apaga la barra.
};

/**
 * El detalle de una renta: sus equipos, sus cargos, sus extensiones y **las cuatro acciones que
 * mueven el calendario**.
 *
 * POR QUÉ LAS ACCIONES VIVEN AQUÍ Y NO EN LA LISTA: confirmar aparta máquinas en fechas
 * concretas y cancelar las libera. Las dos se deciden mirando QUÉ equipos lleva la renta, y eso
 * solo se ve en esta pantalla. Un menú de fila invitaría a confirmar sin haber mirado.
 *
 * TRES ASIMETRÍAS DEL SERVIDOR QUE LA PANTALLA RESPETA:
 *
 * **Los equipos solo se tocan en Borrador**; los cargos, en cualquier estado salvo Cerrada y
 * Cancelada. La razón es la misma que separa las dos tablas: una línea genera una fila de
 * `ocupacion_equipo` y un cargo no lleva equipo. Cobrar un flete extra con la máquina ya en la
 * obra es normal; agregarle una máquina a una renta confirmada no lo es.
 *
 * **Confirmar es todo o nada.** Inserta una ocupación por línea en una transacción; si el
 * `EXCLUDE` rechaza una sola, se deshace entera. Por eso el aviso lo dice antes de pulsar.
 *
 * **Una renta Activa no se cancela**, se devuelve y se cierra — la máquina está en la obra, y
 * cancelar diría que nunca salió.
 */
@Component({
  selector: 'app-renta',
  imports: [CurrencyPipe, DatePipe, ErrorCampo, PanelLateral, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './renta.html',
})
export class RentaDetalle {
  private readonly api = inject(ApiRentas);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly cotizaciones = inject(ApiCotizaciones);
  private readonly equipos = inject(ApiEquipos);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly proyectosApi = inject(ApiProyectos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly locale = idioma;
  protected readonly moneda = MONEDA;
  protected readonly mal = errorVisible;

  /** Puede llegar `undefined` pese al tipo — ver `expediente.ts`. */
  readonly id = input('');

  protected readonly tarifas = this.catalogos.selectorTarifas();
  protected readonly equiposDisponibles = this.equipos.selectorEquipos();
  protected readonly trabajadores = this.organizacion.selectorTrabajadores();
  /**
   * A dónde se entrega ESTA máquina: la «Ubicación de entrega» de §11.1.
   *
   * Sustituye a las diez columnas `lugar_*` de texto libre que tenía la renta y que se
   * retiraron el 2026-09-03. Va en la línea y no en la renta porque una renta puede llevar
   * tres máquinas a tres sitios distintos — y porque «Obra Torre Norte» escrito a mano no es
   * una ubicación del sistema: no se puede mover una máquina hacia ella ni contarla en el
   * reporte por ubicación.
   */
  protected readonly ubicaciones = this.organizacion.selectorUbicacionesActivas();
  protected readonly proyectos = this.proyectosApi.selectorActivos();

  private readonly detalle = this.api.detalleDe(this.id);

  protected readonly renta = this.detalle.renta;

  /**
   * La máquina y el concepto elegidos en el panel, **como señales**.
   *
   * Un `FormControl` no es una señal, así que su valor no puede gobernar un `httpResource`. Se
   * espejan desde el `(change)` de cada desplegable, que es el gesto que dispara la consulta.
   */
  private readonly equipoElegido = signal('');
  private readonly tarifaElegida = signal('');

  // NO SE PASA EL CLIENTE: el precio ya no depende de él desde el 2026-09-09.
  private readonly preciosDelEquipo = this.equipos.preciosVigentesDe(this.equipoElegido);

  /**
   * Los precios que aplican hoy a la máquina elegida, **solo los de la moneda del documento**.
   *
   * `equipo_tarifa.moneda` existe y la aplicación es solo MXN: un precio en dólares entraría al
   * importe como si fueran pesos y nada avisaría.
   */
  protected readonly precios = computed(() =>
    this.preciosDelEquipo.precios().filter((p) => p.moneda === MONEDA),
  );

  // SIN AVISO DE PRECIOS FUTUROS: `equipo_tarifa` dejó de tener vigencia el 2026-09-09, así
  // que un concepto tiene un precio o no lo tiene.

  /** El precio del concepto elegido, si la máquina lo tiene cargado. */
  protected readonly precioElegido = computed(() => {
    const tarifa = this.tarifaElegida();

    return tarifa ? (this.precios().find((p) => p.tarifaId === tarifa) ?? null) : null;
  });
  protected readonly extensiones = this.detalle.extensiones;
  protected readonly cargando = this.detalle.cargando;
  /**
   * La cotización de la que salió esta renta, si salió de una.
   *
   * Cadena vacía cuando no hay: `detalleDe` no pide nada con un id vacío, que es como se
   * expresa «todavía no» en toda la capa de API. Una renta creada a mano no dispara petición.
   */
  private readonly cotizacionId = computed(() => this.renta()?.cotizacionId ?? '');

  private readonly deLaCotizacion = this.cotizaciones.detalleDe(this.cotizacionId);

  protected readonly lineas = computed<readonly RentaLinea[]>(() => this.renta()?.lineas ?? []);

  protected readonly conceptos = computed<readonly RentaConcepto[]>(
    () => this.renta()?.conceptos ?? [],
  );

  /** Los equipos solo en Borrador: después tienen calendario detrás. */
  protected readonly esBorrador = computed(() => this.renta()?.estado === BORRADOR);

  /**
   * Lo que se cotizó SIN MÁQUINA y por tanto pasó a la renta como cargo.
   *
   * **CAMBIÓ DE SIGNIFICADO EL 2026-09-08.** Hasta hoy eran las líneas cotizadas por CATEGORÍA
   * —«una retroexcavadora», sin decir cuál— y la lista se leía como «esto falta». Esa columna
   * se retiró a petición del cliente, así que una línea sin máquina ya no se distingue de un
   * flete: la lista ahora es «esto pasó como cargo, mira si alguna tenía que reservar máquina».
   *
   * **Y por eso puede sobrar información**: un flete legítimo aparece aquí y debe quedarse como
   * cargo. Se prefiere ofrecerlo de más que perder el camino de asignar la máquina, que era la
   * función que la categoría hacía posible.
   *
   * Se lee de la cotización y no del texto de `pendientes` que devolvió la conversión: así se
   * puede precargar el alta con la tarifa, la cantidad y el PRECIO COTIZADO reales.
   *
   * **La lista no se encoge al asignar**, y conviene saber por qué: no existe vínculo entre una
   * línea cotizada y la de renta que la resuelve. Marcarlo por parecido —misma tarifa, misma
   * cantidad, mismo precio— apagaría las DOS si la cotización trae dos renglones idénticos, que
   * es un caso normal. La tabla de equipos está justo debajo y dice qué se lleva agregado.
   */
  protected readonly cotizadasSinMaquina = computed<readonly CotizacionLinea[]>(() =>
    (this.deLaCotizacion.cotizacion()?.lineas ?? []).filter((l) => l.equipoId === null),
  );

  /** El concepto que manda de una línea cotizada: el primero, igual que en la conversión. */
  protected primerConcepto(linea: CotizacionLinea) {
    return linea.tarifas[0];
  }

  /** Cómo se rotula una línea cotizada sin máquina: su texto, o su primer concepto. */
  protected rotuloCotizado(linea: CotizacionLinea): string {
    return linea.descripcion ?? linea.tarifas[0]?.tarifa ?? '';
  }

  /** Los cargos en cualquier estado menos los dos terminales: no tocan el calendario. */
  protected readonly admiteCargos = computed(() => {
    const estado = this.renta()?.estado;

    return estado !== undefined && estado !== CERRADA && estado !== CANCELADA;
  });

  private readonly acciones = computed<readonly string[]>(() => {
    const estado = this.renta()?.estado;

    return estado === undefined ? [] : (ACCIONES[estado] ?? []);
  });

  protected readonly puedeConfirmar = computed(() => this.acciones().includes('confirmar'));
  protected readonly puedeActivar = computed(() => this.acciones().includes('activar'));
  /**
   * SI HAY ALGUNA MÁQUINA FUERA: entregada y sin devolver.
   *
   * Existe para **tapar una trampa que abrí yo mismo el 2026-09-11**. El botón global «Marcar
   * como devuelta» pasa la renta a Devuelta con un `PATCH .../estado`, y `ProcesoDevolverLinea`
   * exige que la renta esté **Activa**: apretarlo con máquinas fuera dejaría esas máquinas sin
   * poder devolverse nunca, sin movimiento de vuelta y con el equipo marcado Rentado para
   * siempre.
   */
  protected readonly hayMaquinasFuera = computed(() =>
    this.lineas().some((l) => l.entregadoEn !== null && l.devueltoEn === null),
  );

  /**
   * El botón global **solo cuando no queda nada fuera**. Con máquinas fuera se devuelve una por
   * una —ahí es donde se escribe el movimiento— y la renta pasa a Devuelta ella sola con la
   * última. Lo que sigue justificando el botón es la renta cuyas máquinas nunca salieron: esa no
   * tiene devolución que registrar y necesita una forma de cerrarse.
   */
  protected readonly puedeDevolver = computed(
    () => this.acciones().includes('devolver') && !this.hayMaquinasFuera(),
  );
  protected readonly puedeExtender = computed(() => this.acciones().includes('extender'));
  protected readonly puedeCerrar = computed(() => this.acciones().includes('cerrar'));
  protected readonly puedeCancelar = computed(() => this.acciones().includes('cancelar'));
  protected readonly sinAcciones = computed(() => this.acciones().length === 0);

  protected readonly enviando = signal(false);
  protected readonly panelLinea = signal(false);
  protected readonly panelConcepto = signal(false);

  /**
   * LA MÁQUINA A LA QUE SE LE ESTÁ AGREGANDO UN CARGO, si es a una.
   *
   * **Un solo panel para los dos destinos**, porque los campos son idénticos: con máquina el
   * cargo va a `renta_linea_tarifa` —suma al renglón de esa máquina—; sin ella, a
   * `renta_concepto` —suma a la renta y no es de ningún equipo—. Dos paneles iguales con
   * distinto botón de guardar habrían sido dos sitios donde arreglar el mismo campo.
   */
  protected readonly lineaDelCargo = signal<RentaLinea | null>(null);

  protected readonly panelDestino = signal(false);
  protected readonly panelMovida = signal(false);

  /**
   * La máquina que se está entregando o devolviendo, y cuál de las dos.
   *
   * **Nulo es «el panel está cerrado»**, así que una sola señal sirve para las dos cosas: qué
   * línea y qué operación. Dos señales sueltas podrían quedar en desacuerdo.
   */
  protected readonly movida = signal<{
    readonly linea: RentaLinea;
    readonly tipo: 'entrega' | 'devolucion';
  } | null>(null);

  /** La máquina a la que se le está asignando obra. */
  protected readonly lineaDelDestino = signal<RentaLinea | null>(null);

  /**
   * Una fila de cargo en blanco.
   *
   * Los numéricos son `number | null`: un campo vaciado escribe `null`, nunca cadena vacía. Y
   * por eso NO llevan `validadorRequerido`, que pasa por `texto()` y devuelve `''` para todo lo
   * que no sea una cadena — la trampa está en `validadores.ts`.
   */
  private filaDeCargo() {
    return this.fb.group({
      tarifaId: [''],
      cantidad: [1 as number | null, validadorCantidad],
      precioUnitario: [0 as number | null, validadorImporte],
    });
  }

  /** El apoyo del panel, que dice a qué se le está cargando. */
  protected readonly apoyoDelCargo = computed(() => {
    const linea = this.lineaDelCargo();

    return linea === null
      ? t().renta.agregarConceptoApoyo
      : t().renta.agregarCargoApoyo(linea.codigoInterno);
  });
  protected readonly panelExtension = signal(false);
  protected readonly panelCierre = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.detalle.error());

  protected readonly formularioLinea = this.fb.group({
    equipoId: ['', validadorRequerido],

    // **SIN `tarifaId`, SIN `cantidad`, SIN `precioUnitario` Y SIN `horasIncluidas`.**
    //
    // La tarifa salió el 2026-09-09: la línea es la MÁQUINA y sus cargos van en `cargos`.
    //
    // Los otros tres salieron el 2026-09-10, a petición del cliente. La cantidad y el costo
    // **se calculan** —del periodo con su unidad, y del costo que el equipo tiene cargado— así
    // que pedirlos era ofrecer que alguien teclee un número que el documento ya sabe. El panel
    // de la cotización nunca los pidió; este los pedía por herencia de cuando la línea era «una
    // máquina y una tarifa», y entonces sí se capturaban.
    //
    // `horasIncluidas` **no se calcula de nada** —es un dato del contrato, §7— y se fue por otra
    // razón: hoy nada la usa, porque el cobro por hora excedida es Fase 2. La columna y el
    // endpoint la siguen aceptando, así que volver a ofrecerla es agregar un campo.
    // Opcional al capturar: una renta en Borrador se arma antes de saber a qué patio va. El
    // destino se puede poner aquí o más tarde, antes de entregar.
    ubicacionDestinoId: [''],

    /**
     * LA OBRA, **por su nombre y no por su id**. Es un campo de texto con `datalist`: se
     * teclea, el navegador filtra entre las obras del cliente de esta renta, y si lo escrito no
     * está se **crea al guardar** — con su ubicación, que el servidor abre en la misma
     * transacción.
     *
     * Era un `<select>` cerrado hasta el 2026-09-09, y con él una renta a una obra nueva
     * obligaba a salir a Proyectos, darla de alta y volver.
     */
    obraTexto: [''],

    // ── Los dos de abajo SOLO se usan cuando la obra no existe ──
    codigoObra: [''],
    domicilioObra: [''],

    /** Los cargos de la máquina, **en el mismo formulario**, igual que en la cotización. */
    cargos: this.fb.array([this.filaDeCargo()]),
  });

  /**
   * Las filas de cargo, PARA LA PLANTILLA.
   *
   * **Se lee de una señal a propósito, y hace falta.** `FormArray.controls` es el mismo arreglo
   * mutado en el sitio: empujar una fila no cambia su referencia y, sin zonas, no despierta a
   * nadie — la fila nueva no se dibujaría. Así que `versionCargos` se incrementa en cada alta y
   * baja, y esto devuelve una COPIA, que sí es una referencia nueva.
   *
   * Es la misma maquinaria que en `cotizacion.ts`, y por la misma trampa: está en `CLAUDE.md`.
   */
  private readonly versionCargos = signal(0);

  protected readonly filasDeCargo = computed(() => {
    this.versionCargos();

    return [...this.formularioLinea.controls.cargos.controls];
  });

  protected readonly formularioConcepto = this.fb.group({
    tarifaId: ['', validadorRequerido],
    trabajadorId: [''],
    descripcion: [''],
    cantidad: [1 as number | null, validadorCantidad],
    precioUnitario: [0 as number | null, validadorImporte],
    costo: [null as number | null],
  });

  /**
   * A DÓNDE VA UNA MÁQUINA que ya está en la renta.
   *
   * **Panel propio y no parte del alta**, porque el momento es otro: la obra se suele saber
   * después de confirmar, y lo que viene de una cotización llega siempre sin ella —una
   * propuesta no dice a qué patio va la máquina—. Hasta el 2026-09-09 no había forma de
   * ponerla después, así que esas rentas se quedaban sin obra para siempre.
   */
  protected readonly formularioDestino = this.fb.group({
    proyectoId: [''],
    ubicacionDestinoId: [''],
  });

  /**
   * LA ENTREGA O LA DEVOLUCIÓN de una máquina. **Un solo formulario para las dos**, porque los
   * campos son idénticos: quién la movió, con qué horómetro, cuándo y una nota.
   *
   * **`trabajadorId` SÍ es obligatorio aquí, y no contradice haber retirado el «responsable»**
   * de la renta, la cotización y la prórroga: aquel decía quién tecleó —y eso lo guarda la
   * auditoría—, este dice **quién fue con la máquina**. Es un hecho de la operación que no se
   * deduce de ningún sitio, y `movimiento.trabajador_id` es NOT NULL.
   */
  protected readonly formularioMovida = this.fb.group({
    trabajadorId: ['', validadorRequerido],
    horometro: [null as number | null],
    fecha: [''],
    observaciones: [''],
  });

  /**
   * Los valores de los dos formularios COMO SEÑAL. Un `FormGroup` no es reactivo: un `computed`
   * que lo lea directo se queda con el primer valor y el panel no descubriría nunca que se
   * eligió una obra. Es la trampa que ya costó varios arreglos en este repo.
   */
  private readonly valoresLinea = toSignal(this.formularioLinea.valueChanges, {
    initialValue: this.formularioLinea.getRawValue(),
  });

  private readonly valoresDestino = toSignal(this.formularioDestino.valueChanges, {
    initialValue: this.formularioDestino.getRawValue(),
  });

  // **SIN `obraDeLaLinea`**: el campo del alta paso a ser TEXTO el 2026-09-09 —se escribe la
  // obra y se crea si no existe— asi que quien la resuelve es `obraEscrita`, mas abajo. El
  // panel de destino sigue con un `<select>` y su id, porque ahi no se crean obras.

  /** La obra elegida en el panel de destino. */
  protected readonly obraDelDestino = computed(() =>
    this.obra(this.valoresDestino().proyectoId ?? ''),
  );

  private obra(id: string) {
    return id === '' ? null : (this.proyectos().find((p) => p.id === id) ?? null);
  }

  /**
   * LAS OBRAS QUE SE PUEDEN ELEGIR: **solo las del cliente de esta renta**.
   *
   * El servidor rechaza la obra de otro cliente —la renta del cliente A no se acumula en el
   * centro de costo del B— así que ofrecerlas sería ofrecer un 400. `selectorActivos` trae
   * todas las activas; el recorte es local porque **`clienteId` viaja en cada fila**.
   */
  protected readonly obrasDelCliente = computed(() => {
    const cliente = this.renta()?.clienteId;

    return cliente === undefined ? [] : this.proyectos().filter((p) => p.clienteId === cliente);
  });

  // **EL RECORTE ES LOCAL Y TIENE UN TECHO**: el selector pide 200 obras activas de una vez
  // —ver `TAMANO_SELECTOR`— así que una empresa con más de 200 podría dejar fuera alguna de
  // este cliente, y quien la busque acabaría creando una duplicada. Se acepta por lo mismo que
  // en el resto de los desplegables: paginar uno es peor que el problema que resuelve. El día
  // que una empresa pase de 200 obras ACTIVAS, esto se filtra en el servidor.

  /** La obra escrita, si corresponde a una del cliente. */
  protected readonly obraEscrita = computed(() => {
    const texto = this.valoresLinea().obraTexto ?? '';

    return texto.trim() === ''
      ? null
      : (this.obrasDelCliente().find((o) => mismoNombre(o.nombre, texto)) ?? null);
  });

  /** Si lo escrito es una obra NUEVA: hay texto y el cliente no la tiene. */
  protected readonly obraNueva = computed(
    () => (this.valoresLinea().obraTexto ?? '').trim() !== '' && this.obraEscrita() === null,
  );

  /**
   * EL EQUIPO ELEGIDO EN EL PANEL, resuelto contra la lista.
   *
   * Hace falta entero y no solo su id: de él salen los cuatro costos con los que se calcula el
   * de la máquina.
   */
  private readonly equipoDeLaLinea = computed(() => {
    const id = this.valoresLinea().equipoId ?? '';

    return id === '' ? null : (this.equiposDisponibles().find((e) => e.id === id) ?? null);
  });

  /**
   * **EL COSTO DE LA MÁQUINA, CALCULADO A LA VISTA.**
   *
   * Es lo que el servidor va a poner si el campo se deja en blanco: las unidades del periodo de
   * la renta por el costo que el equipo tiene cargado **para la unidad del documento**. Se
   * enseña porque un número que aparece solo después de guardar no se revisa; y porque cuando
   * sale en cero, la razón —el equipo no tiene costo para esa unidad— se ve aquí y no en el
   * total del contrato.
   *
   * `unidadesDelPeriodo` viene del DTO y **no se cuenta aquí**: sus tres decisiones —diferencia
   * exacta con decimales, un mes son 30 días, redondeo al alza— viven en `PeriodoEnUnidades`, y
   * contarlas otra vez en la pantalla es garantizar que los dos números se separen.
   */
  protected readonly costoCalculado = computed(() => {
    const equipo = this.equipoDeLaLinea();
    const renta = this.renta();

    if (equipo === null || renta === undefined || renta === null) {
      return null;
    }

    // **LA ELECCIÓN VIVE EN UN SOLO SITIO, con pruebas**: es el espejo de un `switch` del
    // servidor, y si los dos se separan la pantalla dice un número y se guarda otro.
    const porUnidad = costoDelEquipoPorUnidad(equipo, renta.unidad);

    return {
      unidades: renta.unidadesDelPeriodo ?? 0,
      porUnidad,
      total: (renta.unidadesDelPeriodo ?? 0) * (porUnidad ?? 0),
    };
  });

  // **EL BLOQUE DE ARRIBA VA AQUI Y NO CON LAS OTRAS SEÑALES**: `toSignal` lee los
  // formularios, y un campo de clase no puede usar otro declarado mas abajo — TS2729, «used
  // before its initialization». El orden de los campos ES el orden de ejecucion.

  protected readonly formularioExtension = this.fb.group({
    finNuevo: ['', validadorRequerido],
    // **SIN `trabajadorId` desde el 2026-09-11.** Tercera vez que se retira el mismo campo por
    // el mismo argumento —cotizacion el 08, conversion el 09, prorroga ahora—: lo que
    // registraba lo guarda la auditoria.
    motivo: [''],
  });

  private readonly valoresExtension = toSignal(this.formularioExtension.valueChanges, {
    initialValue: this.formularioExtension.getRawValue(),
  });

  // Detras del formulario que lee, y no con las otras señales: el orden de los campos ES el
  // orden de ejecucion, y un `toSignal` sobre un campo declarado mas abajo es TS2729.

  protected readonly formularioCierre = this.fb.group({
    nota: [''],
  });

  /**
   * Los horómetros de devolución, FUERA del `FormGroup`.
   *
   * Son de tamaño variable —depende de cuántos equipos lleve la renta— y opcionales uno a uno.
   * Un `FormRecord` daría lo mismo con más ceremonia; lo que sí importa es que solo viajen los
   * que tienen valor: mandar `0` por un equipo sin horómetro sería inventarse una lectura.
   *
   * **LA CLAVE ES EL `equipoId`, NO EL `id` DE LA LÍNEA.** El docblock de `CierreDeRenta` dice
   * «por linea» y eso es falso: `RegistrarDevolucionAsync` hace
   * `lecturas.TryGetValue(linea.EquipoId, ...)`. Y **una clave que no case se ignora en
   * silencio** —sin error, sin aviso—, así que indexar mal no falla: descarta la lectura y la
   * renta se cierra igual, con el horómetro en blanco. Costó una pasada por el navegador
   * descubrirlo. El docblock del servidor quedó corregido.
   */
  protected readonly horometros = signal<Readonly<Record<string, number>>>({});

  constructor() {
    /**
     * **EL PRECIO DEL CARGO SE RELLENA SOLO, y solo si nadie lo ha tocado.**
     *
     * En cuanto se conocen la máquina y el concepto, el precio que el equipo tiene cargado para
     * ese concepto entra en el campo. `pristine` es la pregunta correcta: se vuelve falso cuando
     * el usuario escribe y **no** cuando el valor se pone por código, así que esto nunca pisa
     * una cifra capturada a mano.
     *
     * **RELLENABA EL DE LA LÍNEA hasta el 2026-09-09**, cuando la línea llevaba una tarifa. Ya
     * no: el precio de la línea es el costo de la MÁQUINA y lo pone el servidor del propio
     * equipo. Lo que se prellena aquí es el cargo, que es donde vive una tarifa del catálogo.
     */
    effect(() => {
      const precio = this.precioElegido();
      const campo = this.formularioConcepto.controls.precioUnitario;

      if (precio !== null && campo.pristine) {
        campo.setValue(precio.precio);
        campo.markAsPristine();
      }
    });

    /**
     * **LOS CARGOS DE LA MÁQUINA SE PRELLENAN, y solo sobre filas intactas.**
     *
     * Al elegir la máquina llegan sus precios cargados, una fila por concepto y una vacía al
     * final. Si el usuario ya escribió algo, el efecto NO toca nada: el botón «Traer precios
     * del equipo» sigue ahí y la decisión es suya.
     *
     * SE LEE `pristine` DEL ARREGLO Y NO A TRAVÉS DE UN `computed`: uno que dependiera de
     * `versionCargos` —que `ponerPrecios` incrementa— haría que el efecto se dispare a sí mismo
     * **sin fin**. `pristine` no es una señal, así que consultarlo no crea dependencia y el
     * efecto solo reacciona a `precios()`. Está en `CLAUDE.md`, y costó un cuelgue en la
     * cotización.
     */
    effect(() => {
      if (this.precios().length > 0 && this.formularioLinea.controls.cargos.pristine) {
        this.ponerPrecios();
      }
    });

    effect(() => {
      const r = this.renta();

      this.barra.configurar({
        titulo: t().renta.titulo,
        contexto: r ? t().renta.contexto(r.folio) : '',
        busqueda: null,
        accion: null,
      });
    });
  }

  protected nombreEstado(estado: EstadoRenta): string {
    return t().rentas.estados[estado] ?? String(estado);
  }

  protected escribirHorometro(equipoId: string, valor: string): void {
    this.horometros.update((actual) => {
      const copia = { ...actual };

      if (valor.trim() === '') {
        delete copia[equipoId];
      } else {
        copia[equipoId] = Number(valor);
      }

      return copia;
    });
  }

  // ------------------------------------------------------------------- equipos --

  protected abrirLinea(): void {
    this.errorMutacion.set(null);
    this.cotizadaEnCurso.set(null);
    this.reiniciarLinea();
    this.panelLinea.set(true);
  }

  /**
   * Deja el panel de línea en blanco. **`clear()` + una fila y `markAsPristine()`**, que no es
   * opcional: `markAsDirty` propaga hacia arriba y ni `clear()` ni `push()` tocan el estado del
   * padre, así que en cuanto alguien teclea una cifra el arreglo queda sucio para toda la vida
   * del componente — y el prellenado deja de ocurrir a partir de la segunda línea. Costó
   * exactamente eso en la cotización el 2026-09-09; está en `CLAUDE.md`.
   */
  private reiniciarLinea(): void {
    const cargos = this.formularioLinea.controls.cargos;

    cargos.clear();
    cargos.push(this.filaDeCargo());
    cargos.markAsPristine();

    this.versionCargos.update((v) => v + 1);

    this.formularioLinea.patchValue({
      equipoId: '',
      ubicacionDestinoId: '',
      obraTexto: '',
      codigoObra: '',
      domicilioObra: '',
    });

    // La señal también, o al reabrir llegarían los precios de la máquina anterior.
    this.equipoElegido.set('');
  }

  protected agregarFilaDeCargo(): void {
    this.formularioLinea.controls.cargos.push(this.filaDeCargo());
    this.versionCargos.update((v) => v + 1);
  }

  protected quitarFilaDeCargo(indice: number): void {
    this.formularioLinea.controls.cargos.removeAt(indice);
    this.versionCargos.update((v) => v + 1);
  }

  /**
   * El desplegable de la máquina cambió: se espeja a la señal que gobierna la consulta.
   *
   * **EL VALOR VIENE DEL EVENTO Y NO DEL CONTROL**, y es deliberado: en el mismo `<select>` hay
   * dos escuchas de `change` —la de `formControlName` y esta— y su orden no está garantizado.
   * Leer el control podía devolver el valor ANTERIOR, con lo que se pedían los precios de la
   * máquina que se acababa de dejar.
   */
  protected alElegirEquipoEnLinea(valor: string): void {
    this.equipoElegido.set(valor);
  }

  /**
   * **LO QUE VA A COSTAR ALARGAR, antes de guardarlo.**
   *
   * Las unidades del tramo que se agrega —del fin actual al nuevo— por el costo de máquina de
   * cada línea, sumado. Es exactamente lo que el servidor va a cobrar.
   *
   * **Se enseña porque hasta el 2026-09-10 extender no cobraba nada**, y el cambio no se nota
   * en ningún sitio si no se dice: quien alarga una renta ve las mismas fechas de siempre y un
   * total que ahora sube. Mejor que lo vea antes.
   *
   * Las unidades se cuentan y no vienen del DTO —el DTO trae las del periodo COMPLETO, no las
   * del tramo, que solo existe mientras se teclea—. Ese conteo vive en `unidadesEntre`, con
   * pruebas, porque es el espejo de `PeriodoEnUnidades` del servidor.
   */
  protected readonly costoDeLaExtension = computed(() => {
    const renta = this.renta();
    const nuevo = this.valoresExtension().finNuevo ?? '';

    if (renta === null || renta === undefined || nuevo === '') {
      return null;
    }

    const hasta = new Date(nuevo);
    const desde = new Date(renta.fin);

    if (Number.isNaN(hasta.getTime()) || hasta <= desde) {
      return null;
    }

    const unidades = unidadesEntre(desde, hasta, renta.unidad);

    // El costo de máquina de cada línea, con su precio CONGELADO. Los cargos no entran: un
    // flete es un evento y un operador se capturó con su propia cantidad.
    const porUnidad = this.lineas().reduce((suma, l) => suma + l.precioUnitario, 0);

    return { unidades, porUnidad, total: unidades * porUnidad };
  });

  /** Sugiere el código de la obra nueva a partir del nombre. NO pisa lo escrito a mano. */
  protected alEscribirObra(): void {
    if (!this.obraNueva() || this.formularioLinea.controls.codigoObra.value !== '') {
      return;
    }

    this.formularioLinea.controls.codigoObra.setValue(
      codigoDesdeNombre(this.formularioLinea.controls.obraTexto.value),
    );
  }

  /** El precio que la máquina trae para el concepto de una fila, si lo trae. */
  protected porDefectoDe(tarifaId: string): PrecioVigente | null {
    return tarifaId ? (this.precios().find((x) => x.tarifaId === tarifaId) ?? null) : null;
  }

  /** Si lo capturado en la fila se aparta del precio de la máquina. */
  protected seApartaDelPorDefecto(indice: number): boolean {
    const fila = this.filasDeCargo()[indice];

    if (fila === undefined) {
      return false;
    }

    const defecto = this.porDefectoDe(fila.controls.tarifaId.value);

    return defecto !== null && fila.controls.precioUnitario.value !== defecto.precio;
  }

  /** Devuelve UNA fila a su precio por defecto, sin tocar las otras que ya se ajustaron. */
  protected usarElPorDefecto(indice: number): void {
    const fila = this.filasDeCargo()[indice];
    const defecto = fila && this.porDefectoDe(fila.controls.tarifaId.value);

    if (fila !== undefined && defecto) {
      fila.controls.precioUnitario.setValue(defecto.precio);
    }
  }

  /**
   * Sustituye las filas por los precios que el equipo tiene cargados.
   *
   * **SUSTITUYE en lugar de añadir**: si añadiera, elegir otra máquina dejaría los cargos de la
   * anterior mezclados con los nuevos y el importe de la línea sumaría los dos.
   *
   * `markAsPristine` al terminar: lo que hay en las filas lo puso el código, no el usuario, así
   * que elegir otra máquina puede volver a rellenarlas. En cuanto alguien teclee, deja de poder.
   */
  protected ponerPrecios(): void {
    const precios = this.precios();

    if (precios.length === 0) {
      return;
    }

    const cargos = this.formularioLinea.controls.cargos;

    cargos.clear();

    for (const precio of precios) {
      const fila = this.filaDeCargo();

      fila.setValue({
        tarifaId: precio.tarifaId,
        // La cantidad NO viene del catálogo: `equipo_tarifa` guarda el precio por unidad, y
        // cuántas se cobran es la decisión de este documento.
        cantidad: 1,
        precioUnitario: precio.precio,
      });

      cargos.push(fila);
    }

    // **UNA FILA VACÍA AL FINAL, para agregar más sin buscar un botón.** Es lo que hace que la
    // lista se lea como lo que es: lo que la máquina trae, y sitio para lo que no —un flete,
    // unas maniobras—. Se descarta al enviar si sigue vacía.
    cargos.push(this.filaDeCargo());
    cargos.markAsPristine();

    this.versionCargos.update((v) => v + 1);
  }

  /**
   * LA LÍNEA COTIZADA QUE SE ESTÁ ASIGNANDO a una máquina, si se está asignando alguna.
   *
   * **Existe para que sus conceptos viajen con ella.** El panel solo pregunta la máquina; los
   * cargos —con la cantidad y el PRECIO COTIZADO— salen de aquí al guardar. Sin esta señal
   * habría que recapturarlos, y reteclear un precio es donde una cifra se desvía de lo que el
   * cliente aceptó.
   */
  private readonly cotizadaEnCurso = signal<CotizacionLinea | null>(null);

  /**
   * Abre el alta de equipo con lo cotizado detrás, y deja solo la máquina por elegir.
   *
   * **Los datos salen de la línea cotizada, no del texto de `pendientes`.** Ese texto es una
   * frase y precargar desde ahí exigiría parsearla, que además depende del idioma. Aquí se lee
   * la cotización de verdad.
   *
   * **PRECARGABA UN SOLO CONCEPTO hasta el 2026-09-09**, porque una línea de renta llevaba una
   * sola tarifa y los demás se habían pasado como cargos de la renta. Ahora la línea lleva N,
   * así que **se copian TODOS** y el renglón de la renta queda igual que el de la propuesta.
   *
   * La cantidad y el costo de la máquina se dejan en blanco: la línea cotizada NO traía máquina
   * —es lo que la puso en esta lista— así que no hay costo de máquina que copiar. Lo pone el
   * servidor del equipo que se elija.
   */
  protected asignarDesde(cotizada: CotizacionLinea): void {
    if (cotizada.tarifas.length === 0) {
      return;
    }

    this.errorMutacion.set(null);
    this.reiniciarLinea();
    this.cotizadaEnCurso.set(cotizada);
    this.panelLinea.set(true);
  }

  protected cerrarLinea(): void {
    this.panelLinea.set(false);
    this.cotizadaEnCurso.set(null);
  }

  protected puedeAgregarLinea(): boolean {
    if (!this.formularioLinea.valid || this.enviando()) {
      return false;
    }

    // **EL CÓDIGO SOLO HACE FALTA CUANDO ADEMÁS HAY QUE ABRIR LA OBRA.** Se comprueba aquí y no
    // con un validador porque es condicional: un `validadorRequerido` fijo bloquearía el botón
    // al elegir una obra que ya existe. Es lo mismo que el concepto nuevo del expediente.
    return !this.obraNueva() || this.formularioLinea.controls.codigoObra.value.trim() !== '';
  }

  protected agregarLinea(): void {
    if (!this.puedeAgregarLinea()) {
      this.formularioLinea.markAllAsTouched();
      return;
    }

    const v = this.formularioLinea.getRawValue();

    // **LA OBRA PRIMERO, si hay que crearla.** Son dos peticiones encadenadas y en este orden:
    // sin la obra no hay id con el que relacionar la línea. El servidor abre la obra Y su
    // ubicación en una transacción, así que aquí no hay dos pasos que puedan quedar a medias.
    //
    // Un fallo al agregar la línea deja la obra creada, y es lo correcto: una obra es un
    // catálogo del cliente y queda disponible para el siguiente intento.
    const obra: Observable<string | null> = this.obraNueva()
      ? this.proyectosApi.proyectos
          .crear({
            codigo: v.codigoObra.trim(),
            nombre: v.obraTexto.trim(),
            // EL CLIENTE SALE DE LA RENTA: una obra de otro cliente la rechaza el servidor.
            clienteId: this.renta()?.clienteId ?? '',
            domicilio: v.domicilioObra.trim() === '' ? null : v.domicilioObra.trim(),
            latitud: null,
            longitud: null,
            fechaInicio: null,
            fechaFin: null,
            contactoNombre: null,
            contactoTelefono: null,
            observaciones: null,
          })
          .pipe(map((p) => p.id))
      : of(this.obraEscrita()?.id ?? null);

    // LOS CARGOS: las filas con concepto. La vacía del final se descarta, que es lo que la hace
    // ofrecible sin obligar a llenarla.
    const cargos = this.filasDeCargo()
      .map((f) => f.getRawValue())
      .filter((f) => f.tarifaId !== '')
      .map((f, i) => ({
        tarifaId: f.tarifaId,
        trabajadorId: null,
        descripcion: null,
        cantidad: f.cantidad ?? 1,
        precioUnitario: f.precioUnitario ?? 0,
        costo: null,
        orden: i,
      }));

    // LOS CONCEPTOS COTIZADOS ganan, cuando esto viene de «asignar»: van con el PRECIO
    // ACORDADO, que es lo que el cliente aceptó, y no con el del catálogo de hoy.
    const cotizados = (this.cotizadaEnCurso()?.tarifas ?? []).map((c, i) => ({
      tarifaId: c.tarifaId,
      trabajadorId: null,
      descripcion: null,
      cantidad: c.cantidad,
      precioUnitario: c.precioUnitario,
      costo: null,
      orden: i,
    }));

    this.ejecutar(
      obra.pipe(
        switchMap((proyectoId) =>
          this.api.agregarLinea(this.id(), {
            equipoId: v.equipoId,
            // **LOS TRES VAN NULOS Y ESO ES EL VALOR ÚTIL**: nulo es «pon el del documento», y
            // el servidor cuenta las unidades del periodo y toma el costo del equipo para su
            // unidad. Solo la conversión desde una cotización manda cifras, porque ahí manda el
            // precio ACORDADO.
            cantidad: null,
            precioUnitario: null,
            horasIncluidas: null,
            // Vacío va NULO, no cadena vacía: el servidor espera un GUID o nada. Y con obra va
            // nulo de todas formas: el sitio sale de ella.
            ubicacionDestinoId: proyectoId === null ? v.ubicacionDestinoId || null : null,
            proyectoId,
            orden: this.lineas().length + 1,
            // En una sola petición: si un cargo estuviera mal, el servidor rechaza la línea
            // entera y no queda media máquina guardada.
            tarifas: cotizados.length > 0 ? cotizados : cargos,
          }),
        ),
      ),
      () => this.cerrarLinea(),
    );
  }

  protected async quitarLinea(linea: RentaLinea): Promise<void> {
    const sigue = await this.preguntar(
      t().renta.quitar,
      t().renta.confirmarQuitarEquipo(linea.codigoInterno),
    );

    if (sigue) {
      this.ejecutar(this.api.quitarLinea(this.id(), linea.id));
    }
  }

  // -------------------------------------------------------------------- cargos --

  /**
   * Abre el panel de cargo. **Con `linea`, el cargo es de esa máquina**; sin ella, de la renta.
   */
  protected abrirConcepto(linea: RentaLinea | null = null): void {
    this.errorMutacion.set(null);
    this.lineaDelCargo.set(linea);
    this.formularioConcepto.reset({
      tarifaId: '',
      trabajadorId: '',
      descripcion: '',
      cantidad: 1,
      precioUnitario: 0,
      costo: null,
    });
    // El prellenado del precio lee los del EQUIPO de la línea. Sin máquina no hay de dónde.
    this.equipoElegido.set(linea?.equipoId ?? '');
    this.tarifaElegida.set('');
    this.panelConcepto.set(true);
  }

  /** El desplegable de concepto cambió: se espeja a la señal que gobierna el prellenado. */
  protected alElegirConcepto(): void {
    this.tarifaElegida.set(this.formularioConcepto.controls.tarifaId.value);
  }

  protected cerrarConcepto(): void {
    this.panelConcepto.set(false);
    this.lineaDelCargo.set(null);
  }

  protected puedeAgregarConcepto(): boolean {
    return this.formularioConcepto.valid && !this.enviando();
  }

  protected agregarConcepto(): void {
    if (!this.puedeAgregarConcepto()) {
      this.formularioConcepto.markAllAsTouched();
      return;
    }

    const v = this.formularioConcepto.getRawValue();
    const linea = this.lineaDelCargo();

    const cargo = {
      tarifaId: v.tarifaId,
      trabajadorId: v.trabajadorId || null,
      descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
      cantidad: v.cantidad ?? 0,
      precioUnitario: v.precioUnitario ?? 0,
      costo: v.costo,
    };

    // MISMO CUERPO, DOS DESTINOS. Es lo que hace que un solo panel sirva a los dos: con máquina
    // el cargo cuelga de su línea, sin ella de la renta.
    this.ejecutar(
      linea === null
        ? this.api.agregarConcepto(this.id(), cargo)
        : this.api.agregarTarifa(this.id(), linea.id, { ...cargo, orden: 0 }),
      () => this.cerrarConcepto(),
    );
  }

  // ------------------------------------------------------------------ el destino --

  /** Abre el panel de obra con lo que la línea ya tenga. */
  protected abrirDestino(linea: RentaLinea): void {
    this.errorMutacion.set(null);
    this.lineaDelDestino.set(linea);
    this.formularioDestino.reset({
      proyectoId: linea.proyectoId ?? '',
      // Con obra no se pinta el campo, así que da igual lo que lleve; sin obra es el sitio que
      // tenga puesto.
      ubicacionDestinoId: linea.proyectoId === null ? (linea.ubicacionDestinoId ?? '') : '',
    });
    this.panelDestino.set(true);
  }

  protected cerrarDestino(): void {
    this.panelDestino.set(false);
    this.lineaDelDestino.set(null);
  }

  protected guardarDestino(): void {
    const linea = this.lineaDelDestino();

    if (linea === null || this.enviando()) {
      return;
    }

    const v = this.formularioDestino.getRawValue();

    this.ejecutar(
      this.api.asignarDestino(this.id(), linea.id, {
        proyectoId: v.proyectoId || null,
        // **CON OBRA VA NULO**, no el sitio del campo: el servidor lo saca de la obra y
        // rechaza uno que la contradiga. Mandarlo sería mandar un 400.
        ubicacionDestinoId: v.proyectoId === '' ? v.ubicacionDestinoId || null : null,
      }),
      () => this.cerrarDestino(),
    );
  }

  // --------------------------------------------------- la entrega y la devolución --

  /**
   * Si esta máquina se puede entregar: la renta está Confirmada o Activa y no ha salido.
   *
   * **El sitio de entrega hace falta** —el CHECK `movimiento_destino` lo exige— así que el
   * botón se dibuja igual y el servidor explica qué falta. Ofrecerlo y que diga «asígnale su
   * obra» enseña el camino; esconderlo deja a alguien buscando por qué no puede.
   */
  protected sePuedeEntregar(linea: RentaLinea): boolean {
    const estado = this.renta()?.estado;

    return (estado === CONFIRMADA || estado === ACTIVA) && linea.entregadoEn === null;
  }

  /** Si se puede devolver: salió y no ha vuelto. */
  protected sePuedeDevolver(linea: RentaLinea): boolean {
    return (
      this.renta()?.estado === ACTIVA && linea.entregadoEn !== null && linea.devueltoEn === null
    );
  }

  protected abrirMovida(linea: RentaLinea, tipo: 'entrega' | 'devolucion'): void {
    this.errorMutacion.set(null);
    this.movida.set({ linea, tipo });
    this.formularioMovida.reset({
      trabajadorId: '',
      // **EL HORÓMETRO ARRANCA CON EL DE SALIDA en la devolución**, que es el mínimo que
      // acepta: el servidor rechaza uno menor, y empezar en blanco hace que quien captura
      // tenga que ir a buscarlo a la tabla.
      horometro: tipo === 'devolucion' ? linea.horometroSalida : null,
      fecha: '',
      observaciones: '',
    });
    this.panelMovida.set(true);
  }

  protected cerrarMovida(): void {
    this.panelMovida.set(false);
    this.movida.set(null);
  }

  protected guardarMovida(): void {
    const cual = this.movida();

    if (cual === null || !this.formularioMovida.valid || this.enviando()) {
      this.formularioMovida.markAllAsTouched();
      return;
    }

    const v = this.formularioMovida.getRawValue();

    const cuerpo = {
      trabajadorId: v.trabajadorId,
      horometro: v.horometro,
      // A INSTANTE, no el texto del campo — ver `fecha-hora.ts`. Vacío es «ahora», y lo
      // resuelve el servidor.
      fecha: v.fecha === '' ? null : aInstante(v.fecha),
      observaciones: v.observaciones.trim() === '' ? null : v.observaciones.trim(),
    };

    this.ejecutar(
      cual.tipo === 'entrega'
        ? this.api.entregarLinea(this.id(), cual.linea.id, cuerpo)
        : this.api.devolverLinea(this.id(), cual.linea.id, cuerpo),
      () => this.cerrarMovida(),
    );
  }

  /** Quita un cargo DE UNA MÁQUINA. La máquina se queda: su línea vive de su propio costo. */
  protected async quitarTarifa(linea: RentaLinea, cargo: RentaLineaTarifa): Promise<void> {
    const sigue = await this.preguntar(
      t().renta.quitar,
      t().renta.confirmarQuitarCargo(cargo.tarifa),
    );

    if (sigue) {
      this.ejecutar(this.api.quitarTarifa(this.id(), linea.id, cargo.id));
    }
  }

  protected async quitarConcepto(concepto: RentaConcepto): Promise<void> {
    const sigue = await this.preguntar(
      t().renta.quitar,
      t().renta.confirmarQuitarCargo(concepto.tarifa),
    );

    if (sigue) {
      this.ejecutar(this.api.quitarConcepto(this.id(), concepto.id));
    }
  }

  // ------------------------------------------------ los cuatro que mueven el calendario --

  protected async confirmar(): Promise<void> {
    const r = this.renta();

    if (r === null) {
      return;
    }

    const sigue = await this.preguntar(
      t().renta.confirmarTitulo,
      t().renta.confirmarMensaje(r.folio),
      t().renta.confirmar,
      // No es destructivo: aparta, no borra. El negro se reserva para lo que se pierde.
      false,
    );

    if (sigue) {
      this.ejecutar(this.api.confirmar(this.id()));
    }
  }

  protected async activar(): Promise<void> {
    const r = this.renta();

    if (r === null) {
      return;
    }

    const sigue = await this.preguntar(
      t().renta.activarTitulo,
      t().renta.activarMensaje(r.folio),
      t().renta.activar,
      false,
    );

    if (sigue) {
      this.ejecutar(this.api.cambiarEstado(this.id(), ACTIVA));
    }
  }

  protected async devolver(): Promise<void> {
    const r = this.renta();

    if (r === null) {
      return;
    }

    const sigue = await this.preguntar(
      t().renta.devolverTitulo,
      t().renta.devolverMensaje(r.folio),
      t().renta.devolver,
      false,
    );

    if (sigue) {
      this.ejecutar(this.api.cambiarEstado(this.id(), DEVUELTA));
    }
  }

  protected abrirExtension(): void {
    this.errorMutacion.set(null);
    this.formularioExtension.reset({ finNuevo: '', motivo: '' });
    this.panelExtension.set(true);
  }

  protected cerrarExtension(): void {
    this.panelExtension.set(false);
  }

  protected puedeExtenderYa(): boolean {
    return this.formularioExtension.valid && !this.enviando();
  }

  protected extender(): void {
    if (!this.puedeExtenderYa()) {
      this.formularioExtension.markAllAsTouched();
      return;
    }

    const v = this.formularioExtension.getRawValue();

    this.ejecutar(
      this.api.extender(this.id(), {
        // Mismo cruce de frontera que en el alta — ver `fecha-hora.ts`.
        finNuevo: aInstante(v.finNuevo) ?? '',
        // NULO: dejo de preguntarse el 2026-09-11. Quien alargo la renta lo guarda la auditoria.
        trabajadorId: null,
        motivo: v.motivo.trim() === '' ? null : v.motivo.trim(),
      }),
      () => this.cerrarExtension(),
    );
  }

  protected abrirCierre(): void {
    this.errorMutacion.set(null);
    this.horometros.set({});
    this.formularioCierre.reset({ nota: '' });
    this.panelCierre.set(true);
  }

  protected cerrarPanelCierre(): void {
    this.panelCierre.set(false);
  }

  protected cerrarRenta(): void {
    if (this.enviando()) {
      return;
    }

    const lecturas = this.horometros();
    const v = this.formularioCierre.getRawValue();

    this.ejecutar(
      this.api.cerrar(this.id(), {
        // Nulo y no `{}` cuando no se capturó ninguna: un mapa vacío y «no hay lecturas» son
        // lo mismo para el servidor, pero el nulo lo dice sin ambigüedad.
        horometrosDevolucion: Object.keys(lecturas).length === 0 ? null : lecturas,
        nota: v.nota.trim() === '' ? null : v.nota.trim(),
      }),
      () => this.cerrarPanelCierre(),
    );
  }

  protected async cancelar(): Promise<void> {
    const r = this.renta();

    if (r === null) {
      return;
    }

    const sigue = await this.preguntar(
      t().renta.cancelarTitulo,
      t().renta.cancelarMensaje(r.folio),
      t().renta.cancelar,
      // Este SÍ es destructivo y no se deshace.
      true,
    );

    if (sigue) {
      this.ejecutar(this.api.cancelar(this.id()));
    }
  }

  // ------------------------------------------------------------------ plomería --

  private preguntar(
    titulo: string,
    mensaje: string,
    confirmar = t().renta.confirmarAccion,
    peligro = true,
  ): Promise<boolean> {
    if (this.enviando()) {
      return Promise.resolve(false);
    }

    return this.confirmacion.pedir({ titulo, mensaje, confirmar, peligro });
  }

  /**
   * El mismo envoltorio para las nueve mutaciones: bandera, limpiar el error, y al terminar
   * refrescar el detalle.
   *
   * **El detalle lo refresca quien lo montó**, no el servicio: ese recurso lo crea `detalleDe`
   * por pantalla y no está en el mapa de la fábrica. El LISTADO sí lo recarga el servicio.
   *
   * El error se deja tal cual llega: aquí aterrizan el 409 del `EXCLUDE` —«el equipo ya está
   * dado en esas fechas»—, el de confirmar sin equipos y el 400 de un estado que tiene endpoint
   * propio. Los tres explican qué pasó mejor que cualquier texto genérico.
   */
  private ejecutar(peticion: Observable<unknown>, alTerminar?: () => void): void {
    this.enviando.set(true);
    this.errorMutacion.set(null);

    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.detalle.recargar();
        alTerminar?.();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
