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
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiCotizaciones } from '../../../nucleo/api/api-cotizaciones';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import { ApiRentas } from '../../../nucleo/api/api-rentas';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type {
  AltaCotizacionLineaTarifa,
  ConversionDeCotizacion,
  CotizacionLinea,
  CotizacionLineaTarifa,
  EstadoCotizacion,
  PrecioVigente,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { aCampoLocal, aInstante } from '../../../nucleo/formularios/fecha-hora';
import {
  validadorCantidad,
  validadorImporte,
  validadorRequerido,
} from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';

/** `EstadoCotizacion.Borrador`: el único estado en el que se tocan las líneas. */
const BORRADOR: EstadoCotizacion = 1;

/** `EstadoCotizacion.Aceptada`: el único desde el que se convierte en renta. */
const ACEPTADA: EstadoCotizacion = 4;

/** Ver `MONEDA` en `cotizaciones.ts`: la Fase 1 no lleva divisa por documento. */
const MONEDA = 'MXN';

/**
 * LAS TRANSICIONES VÁLIDAS, copiadas del servidor.
 *
 * Es el espejo de `Transiciones` en `ServicioCotizacionesEf`. **La copia no es la garantía**:
 * quien manda es el servidor, que responde 409 a una transición inválida y ese texto se muestra
 * tal cual. Esto solo existe para no OFRECER lo que se va a rechazar — un desplegable con los
 * siete estados invita a un error garantizado.
 *
 * Se declara lo permitido y no lo prohibido, igual que allá: agregar un estado obliga a decidir
 * desde dónde se llega a él en vez de que quede alcanzable desde todas partes por omisión.
 * Rechazada, Vencida y Cancelada son TERMINALES: no están en la tabla, y desde ellas el panel
 * dice que no hay a dónde ir en lugar de ofrecer un desplegable vacío.
 *
 * Si el servidor cambia su tabla y esta se queda vieja, el síntoma es benigno en un sentido
 * —se ofrece de menos— y visible en el otro: el 409 aparece con su explicación.
 */
export const SIGUIENTES: Readonly<Record<number, readonly EstadoCotizacion[]>> = {
  1: [2, 7], // Borrador  → Enviada, Cancelada
  2: [3, 4, 5, 6, 7], // Enviada   → En revisión, Aceptada, Rechazada, Vencida, Cancelada
  3: [4, 5, 6, 7], // En revisión → Aceptada, Rechazada, Vencida, Cancelada
  4: [7], // Aceptada  → Cancelada. No es terminal: de ahí sale la renta.
};

/**
 * El detalle de una cotización: sus datos, sus líneas y su estado.
 *
 * ES UNA PANTALLA DE DETALLE, no un panel: cuelga de `/cotizaciones/:id` y se llega con el ojo
 * de la lista. El reparto es el mismo que en el expediente del equipo — el listado trae el
 * encabezado, el detalle trae lo que cuelga de él.
 *
 * **DOS NIVELES DESDE EL 2026-09-08, y es el cambio que pidió el cliente.** Una línea es **lo
 * que se ofrece** —una máquina, o un concepto descrito— y lleva N **conceptos cobrables**, cada
 * uno con su cantidad y su precio. El importe sube: cantidad por precio en cada concepto, su
 * suma en la línea, la suma de las líneas en el subtotal. La retroexcavadora con su renta
 * diaria, su flete y sus maniobras es UN renglón con tres conceptos, y no tres renglones
 * sueltos que el cliente lee como tres cargos sin relación.
 *
 * **Las líneas solo se tocan en Borrador.** No es una preferencia de la pantalla: las cuatro
 * escrituras —agregar y quitar línea, agregar y quitar concepto— responden 409 en cualquier
 * otro estado. Por eso fuera de Borrador no se dibujan los botones, y en su lugar hay una línea
 * de texto que dice por qué.
 *
 * **Enviar exige líneas.** Una cotización vacía enviada al cliente es un documento sin
 * contenido, y a partir de Enviada ya no se puede corregir. El servidor lo rechaza con 409 y su
 * texto lo explica; aquí no se duplica la comprobación, se enseña la respuesta.
 *
 * **Ningún importe se calcula aquí.** Los tres niveles los recalcula el servidor en cada cambio
 * y **nunca los acepta del cuerpo**: un total capturado a mano que no cuadre con las líneas deja
 * dos números y ninguna forma de saber cuál vale.
 */
@Component({
  selector: 'app-cotizacion',
  imports: [CurrencyPipe, DatePipe, ErrorCampo, PanelLateral, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cotizacion.html',
})
export class CotizacionDetalle {
  private readonly api = inject(ApiCotizaciones);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly equipos = inject(ApiEquipos);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly terceros = inject(ApiTerceros);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly apiRentas = inject(ApiRentas);
  private readonly ruteador = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly locale = idioma;
  protected readonly moneda = MONEDA;
  protected readonly mal = errorVisible;

  /**
   * El id de la cotización, desde la ruta.
   *
   * Puede llegar `undefined` pese al tipo: `withComponentInputBinding` asigna `undefined`
   * cuando el parámetro no está, PISANDO el valor por defecto del `input()`. De ahí que el
   * servicio compruebe con `id() ? ... : undefined` en vez de contra cadena vacía.
   */
  readonly id = input('');

  protected readonly tarifas = this.catalogos.selectorTarifas();
  protected readonly equiposDisponibles = this.equipos.selectorEquipos();

  /**
   * La máquina elegida en el panel, **como señal**.
   *
   * Un `FormControl` no es una señal, así que su valor no puede gobernar un `httpResource`.
   * Se espeja aquí desde el `(change)` del desplegable: es el gesto que de verdad dispara la
   * consulta, y espejar solo eso evita una petición por cada tecla si algún día el campo
   * pasara a ser de texto.
   */
  private readonly equipoElegido = signal('');

  // NO SE PASA EL CLIENTE: el precio ya no depende de él. `equipo_tarifa.cliente_id` se
  // retiró el 2026-09-09 a petición del cliente, y con él la precedencia que el servidor
  // resolvía.
  private readonly preciosDelEquipo = this.equipos.preciosVigentesDe(this.equipoElegido);

  /**
   * Los precios que aplican hoy a la máquina elegida, **solo los de la moneda del documento**.
   *
   * `equipo_tarifa.moneda` existe y la aplicación es solo MXN: un precio cargado en dólares
   * entraría al subtotal como si fueran pesos y **nada avisaría**. Se filtran, y los que quedan
   * fuera se cuentan para poder decirlo — callarlo sería peor que no traer nada.
   */
  protected readonly precios = computed(() =>
    this.preciosDelEquipo.precios().filter((p) => p.moneda === MONEDA),
  );

  protected readonly preciosEnOtraMoneda = computed(
    () => this.preciosDelEquipo.precios().length - this.precios().length,
  );

  // **YA NO HAY PRECIOS FUTUROS.** `preciosFuturos` vivió unas horas del 2026-09-09,
  // mientras `equipo_tarifa` tenía vigencia: avisaba de los que aún no regían para que una
  // máquina con dos tarifas asignadas y una sola traída no pareciera un fallo. Retirada la
  // vigencia hay **un precio por concepto y punto**, así que no hay nada que avisar.

  /** Para no decir «esta máquina no tiene precios» mientras se están pidiendo. */
  protected readonly cargandoPrecios = this.preciosDelEquipo.cargando;

  // **SIN SELECTOR DE TRABAJADORES.** Existió un día exacto: entró el 2026-09-08, cuando la
  // cotización dejó de llevar responsable y el panel de conversión heredó la pregunta, y salió
  // el 2026-09-09, cuando la renta dejó de exigirlo. Lo que la columna registraba lo guarda la
  // auditoría, que apunta cada operación a la cuenta que la hizo.
  //
  // NI DE CATEGORÍAS: la línea dejó de llevarla en la misma tanda del 08. Cotizar «una
  // retroexcavadora» sin decir cuál se escribe ahora en la descripción, y la conversión ya no
  // lo puede reclamar como pendiente.

  /**
   * Los clientes ACTIVOS, y **solo para convertir en renta**.
   *
   * La cotizacion dejo de llevar cliente el 2026-09-09, asi que la renta ya no lo puede
   * heredar — y lo exige: de ella salen el contrato y la factura. Solo los activos porque
   * `CrearAsync` de rentas rechaza a uno suspendido o dado de baja.
   */
  protected readonly clientes = this.terceros.selectorClientesActivos();

  private readonly detalle = this.api.detalleDe(this.id);

  protected readonly cotizacion = this.detalle.cotizacion;
  protected readonly cargando = this.detalle.cargando;

  protected readonly lineas = computed<readonly CotizacionLinea[]>(
    () => this.cotizacion()?.lineas ?? [],
  );

  /** En Borrador se agregan y se quitan líneas; fuera de él, el servidor responde 409. */
  protected readonly esBorrador = computed(() => this.cotizacion()?.estado === BORRADOR);

  /**
   * Solo una Aceptada se convierte, y lo exige el servidor con un 409.
   *
   * **NO se comprueba si YA se convirtió**, y no es un olvido: convertir no mueve el estado de la
   * cotización —sigue Aceptada— y no hay endpoint que conteste «¿esta cotización ya generó
   * renta?». Averiguarlo exigiría listar rentas y cruzar por `cotizacionId`: el mismo cruce
   * paginado que se rechazó en Contratos, con el mismo riesgo de quedar incompleto en silencio.
   *
   * Convertir dos veces crea dos rentas, las dos válidas y las dos apuntando a la misma
   * cotización. Si eso llega a doler, la guarda va en el SERVIDOR, que es quien puede contestar
   * esa pregunta sin paginar.
   */
  protected readonly esAceptada = computed(() => this.cotizacion()?.estado === ACEPTADA);

  /**
   * A qué estados se puede pasar desde el actual.
   *
   * Vacío significa TERMINAL, y eso es un mensaje, no un desplegable sin opciones.
   */
  protected readonly siguientes = computed<readonly EstadoCotizacion[]>(() => {
    const actual = this.cotizacion()?.estado;

    return actual === undefined ? [] : (SIGUIENTES[actual] ?? []);
  });

  protected readonly enviando = signal(false);
  protected readonly panelLinea = signal(false);
  protected readonly panelConcepto = signal(false);
  protected readonly panelEstado = signal(false);
  protected readonly panelConversion = signal(false);

  /** La línea a la que se le va a añadir un concepto. Solo mientras el panel está abierto. */
  protected readonly lineaDestino = signal<CotizacionLinea | null>(null);

  /**
   * Lo que la conversión devolvió: la renta creada y los avisos de lo que no pasó como línea.
   *
   * Se guarda en lugar de navegar de inmediato porque **esos avisos hay que leerlos**: dicen qué
   * renglones se pasaron como cargos y por tanto no apartaron calendario, y saltar a la renta
   * los tiraría a la basura.
   */
  protected readonly conversion = signal<ConversionDeCotizacion | null>(null);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.detalle.error());

  /**
   * El alta de una línea: lo que se ofrece, y **sus conceptos en el mismo formulario**.
   *
   * Van juntos porque el servidor rechaza una línea sin ninguno: crearla vacía y añadirle el
   * primero después dejaría, entre las dos peticiones, un renglón que no significa nada.
   */
  protected readonly formularioLinea = this.fb.group({
    // Vacío = sin equipo, que es válido: una línea de flete no tiene máquina.
    equipoId: [''],

    /**
     * De qué se trata el renglón. **Es lo único que describe una línea sin equipo** desde que
     * la categoría salió: «una retroexcavadora» y «flete a la obra» solo se distinguen por
     * este texto, y la conversión a renta ya no puede reclamar la primera como pendiente.
     */
    descripcion: [''],

    conceptos: this.fb.array([this.filaDeConcepto()]),
  });

  /**
   * Las filas de conceptos, PARA LA PLANTILLA.
   *
   * **Se lee de una señal a propósito, y hace falta.** `FormArray.controls` es el mismo arreglo
   * mutado en el sitio: empujar una fila no cambia su referencia y, sin zonas, no despierta a
   * nadie — la fila nueva no se dibujaría. Así que `versionConceptos` se incrementa en cada
   * alta y baja, y esto devuelve una COPIA, que sí es una referencia nueva.
   *
   * Un `computed` que devolviera `controls` tal cual no serviría: memoriza por referencia y la
   * referencia nunca cambia.
   */
  private readonly versionConceptos = signal(0);

  protected readonly filasDeConcepto = computed(() => {
    this.versionConceptos();

    return [...this.formularioLinea.controls.conceptos.controls];
  });

  /** El alta de un concepto sobre una línea que ya existe. */
  protected readonly formularioConcepto = this.fb.group({
    tarifaId: ['', validadorRequerido],
    cantidad: [1 as number | null, validadorCantidad],
    precioUnitario: [0 as number | null, validadorImporte],
  });

  protected readonly formularioEstado = this.fb.group({
    estado: [1 as EstadoCotizacion],
  });

  /**
   * Lo que la cotización no tiene y la renta necesita.
   *
   * `datetime-local` porque el calendario razona con horas — ver `fecha-hora.ts`. El depósito y
   * el anticipo tampoco están cotizados; el descuento y los impuestos SÍ se arrastran solos desde
   * la cotización, así que no se preguntan.
   *
   * **EL RESPONSABLE ENTRÓ EL 2026-09-08**, cuando la cotización dejó de llevarlo.
   */
  protected readonly formularioConversion = this.fb.group({
    // **EL CLIENTE Y LAS CONDICIONES ENTRARON EL 2026-09-09**, cuando la cotizacion dejo de
    // llevarlos. La renta SI los necesita: de ella salen el contrato y la factura. Se preguntan
    // una vez, aqui, en lugar de dos veces.
    clienteId: ['', validadorRequerido],
    condiciones: [''],
    // SIN `trabajadorId`: se preguntaba aqui desde el 2026-09-08 y salio el 2026-09-09. Lo que
    // registraba —quien levanto la renta— lo guarda la auditoria, que apunta la operacion a la
    // cuenta que la hizo. Era, encima, la unica pregunta del panel cuya respuesta el sistema ya
    // tenia.
    inicio: ['', validadorRequerido],
    fin: ['', validadorRequerido],
    deposito: [0 as number | null],
    anticipo: [0 as number | null],
  });

  constructor() {
    effect(() => {
      const c = this.cotizacion();

      this.barra.configurar({
        titulo: t().cotizacion.titulo,
        contexto: c ? t().cotizacion.contexto(c.folio) : '',
        busqueda: null,
        accion: null,
      });
    });

    /**
     * **EL PRELLENADO AUTOMÁTICO, y solo sobre filas intactas.**
     *
     * Al elegir la máquina, sus conceptos llegan con el precio que aplica hoy. Si el usuario ya
     * escribió algo, el efecto NO toca nada: el botón «Traer precios del equipo» de la cabecera
     * sigue ahí y la decisión es suya. Pisar lo capturado es el fallo que el `datalist` en
     * cascada ya provocó una vez.
     */
    effect(() => {
      // SE LEE `pristine` DEL FORMULARIO Y NO A TRAVÉS DE UN `computed`: uno que dependiera de
      // `versionConceptos` —que `ponerPrecios` incrementa— haría que el efecto se dispare a sí
      // mismo **sin fin**. `pristine` no es una señal, así que consultarlo no crea dependencia
      // y el efecto solo reacciona a `precios()`. Está escrito en `CLAUDE.md`.
      if (this.precios().length > 0 && this.formularioLinea.controls.conceptos.pristine) {
        this.ponerPrecios();
      }
    });
  }

  /**
   * Una fila de concepto en blanco.
   *
   * Los dos numéricos son `number | null`: un campo vaciado escribe `null`, nunca cadena vacía.
   * Y por eso NO llevan `validadorRequerido`, que pasa por `texto()` y devuelve `''` para todo
   * lo que no sea cadena: puesto aquí daría `{ required: true }` siempre y el botón de guardar
   * no se habilitaría nunca. Costó una depuración; está explicado en `validadores.ts`.
   *
   * Los dos límites son los del servidor: cantidad > 0, precio >= 0.
   */
  private filaDeConcepto() {
    return this.fb.group({
      // **SIN `validadorRequerido`, y es lo que permite la fila vacía del final.** Con él, esa
      // fila dejaría el formulario inválido y el botón de guardar apagado sin explicación
      // visible: el usuario vería una fila en blanco que él no puso y un botón muerto.
      //
      // Lo que se exige de verdad —al menos un concepto— se comprueba en `puedeAgregar`, y las
      // filas sin tarifa se descartan al enviar. El servidor rechaza la lista vacía igual.
      tarifaId: [''],
      cantidad: [1 as number | null, validadorCantidad],
      precioUnitario: [0 as number | null, validadorImporte],
    });
  }

  protected nombreEstado(estado: EstadoCotizacion): string {
    return t().cotizaciones.estados[estado] ?? String(estado);
  }

  /** Cómo se rotula una línea cuando hay que nombrarla: su máquina, su texto, o su primer concepto. */
  protected rotuloDeLinea(linea: CotizacionLinea): string {
    // El código y el nombre llegan sueltos y se juntan aquí, en el mismo sitio que la
    // plantilla: hasta el 2026-09-09 los componía el servidor, y eso dejaba a esta línea
    // nombrando la máquina de una forma y al desplegable que la eligió de otra.
    const maquina =
      linea.codigoInterno === null
        ? null
        : t().comun.equipoEnLinea(linea.codigoInterno, linea.nombre);

    return maquina ?? linea.descripcion ?? linea.tarifas[0]?.tarifa ?? t().cotizacion.sinDato;
  }

  // ------------------------------------------------------------------ alta de línea --

  protected abrirLinea(): void {
    this.errorMutacion.set(null);

    const conceptos = this.formularioLinea.controls.conceptos;

    // Se vacía y se deja UNA fila: reabrir el panel no debe arrastrar los conceptos de la
    // línea anterior. `clear()` y no `reset()`, que dejaría las filas de más en blanco.
    conceptos.clear();
    conceptos.push(this.filaDeConcepto());

    // **`markAsPristine` Y NO ES OPCIONAL: sin esto el prellenado dejaba de ocurrir.**
    //
    // `markAsDirty` propaga HACIA ARRIBA —del control a su grupo y de su grupo al arreglo— y ni
    // `clear()` ni `push()` tocan ese estado del padre. Así que en cuanto alguien teclaba una
    // cifra, el arreglo quedaba sucio para TODA la vida del componente: la primera línea se
    // prellenaba y ninguna más, y el síntoma no se parecía a la causa —«la tarifa me la pide en
    // vez de traerla»—. Lo fija `prellenado.spec.ts`.
    conceptos.markAsPristine();

    this.versionConceptos.update((v) => v + 1);

    this.formularioLinea.patchValue({ equipoId: '', descripcion: '' });
    // La señal también, o al reabrir el panel llegarían los precios de la máquina anterior.
    this.equipoElegido.set('');
    this.panelLinea.set(true);
  }

  protected cerrarLinea(): void {
    this.panelLinea.set(false);
  }

  protected agregarFilaDeConcepto(): void {
    this.formularioLinea.controls.conceptos.push(this.filaDeConcepto());
    this.versionConceptos.update((v) => v + 1);
  }

  /**
   * El desplegable de la máquina cambió: se espeja a la señal que gobierna la consulta.
   *
   * **EL VALOR VIENE DEL EVENTO Y NO DEL CONTROL**, y es deliberado: en el mismo `<select>` hay
   * dos escuchas de `change` —la de `formControlName`, que actualiza el control, y esta—, y su
   * orden no está garantizado. Leer el control podía devolver el valor ANTERIOR, con lo que se
   * pedían los precios de la máquina que se acababa de dejar. Leer el DOM no depende de eso.
   */
  protected alElegirEquipo(valor: string): void {
    this.equipoElegido.set(valor);
  }

  /**
   * El precio que la máquina trae para el concepto de una fila, si lo trae.
   *
   * Se consulta por `tarifaId` de la fila y no por posición: las filas se reordenan al quitar
   * una, y emparejar por índice acabaría mostrando el precio de otro concepto.
   */
  protected porDefectoDe(tarifaId: string): PrecioVigente | null {
    return tarifaId ? (this.precios().find((p) => p.tarifaId === tarifaId) ?? null) : null;
  }

  /** Si lo capturado en la fila se aparta del precio de la máquina. */
  protected seApartaDelPorDefecto(indice: number): boolean {
    const fila = this.filasDeConcepto()[indice];

    if (fila === undefined) {
      return false;
    }

    const defecto = this.porDefectoDe(fila.controls.tarifaId.value);

    return defecto !== null && fila.controls.precioUnitario.value !== defecto.precio;
  }

  /**
   * Devuelve UNA fila a su precio por defecto. **No toca `equipo_tarifa`**: lo que cambia es lo
   * que se va a guardar en la línea.
   *
   * Existe porque `ponerPrecios` reemplaza TODAS las filas, y quien se equivocó en una cifra no
   * quiere perder las otras dos que ya ajustó.
   */
  protected usarElPorDefecto(indice: number): void {
    const fila = this.filasDeConcepto()[indice];

    if (fila === undefined) {
      return;
    }

    const defecto = this.porDefectoDe(fila.controls.tarifaId.value);

    if (defecto !== null) {
      fila.controls.precioUnitario.setValue(defecto.precio);
    }
  }

  /**
   * Sustituye las filas por los precios de la máquina.
   *
   * **UNA FILA POR CONCEPTO, y sustituye en lugar de añadir**: si añadiera, elegir otra máquina
   * dejaría los conceptos de la anterior mezclados con los nuevos y el importe de la línea
   * sumaría las dos.
   *
   * `markAsPristine` al terminar: lo que hay en las filas lo puso el código, no el usuario, así
   * que elegir otra máquina puede volver a rellenarlas. En cuanto alguien teclee, deja de poder.
   */
  protected ponerPrecios(): void {
    const precios = this.precios();

    if (precios.length === 0) {
      return;
    }

    const conceptos = this.formularioLinea.controls.conceptos;

    conceptos.clear();

    for (const precio of precios) {
      const fila = this.filaDeConcepto();

      fila.setValue({
        tarifaId: precio.tarifaId,
        // La cantidad NO viene del catálogo: `equipo_tarifa` guarda el precio por unidad y
        // cuántas unidades se cotizan es la decisión comercial de este documento.
        cantidad: 1,
        precioUnitario: precio.precio,
      });

      conceptos.push(fila);
    }

    // **UNA FILA VACÍA AL FINAL, para agregar más sin buscar un botón.** Es lo que hace que la
    // lista se lea como lo que es: lo que la máquina trae, y sitio para lo que no trae —un
    // flete, unas maniobras—. Se descarta al enviar si sigue vacía.
    conceptos.push(this.filaDeConcepto());

    conceptos.markAsPristine();
    this.versionConceptos.update((v) => v + 1);
  }

  /** Las filas con concepto elegido: las únicas que se guardan. */
  private conceptosConTarifa() {
    return this.formularioLinea.controls.conceptos.controls.filter(
      (fila) => fila.controls.tarifaId.value !== '',
    );
  }

  /**
   * Si no hay ningún concepto elegido. La lista lo dice en lugar de dejar el botón apagado sin
   * motivo: un botón muerto es la peor forma de pedir un dato.
   */
  protected readonly sinNingunConcepto = computed(() => {
    this.versionConceptos();

    return this.conceptosConTarifa().length === 0;
  });

  /**
   * Quita una fila del formulario. **La última no se quita**: el servidor rechaza una línea sin
   * conceptos, así que dejar el formulario en cero solo llevaría a un 400.
   */
  protected quitarFilaDeConcepto(indice: number): void {
    const conceptos = this.formularioLinea.controls.conceptos;

    if (conceptos.length <= 1) {
      return;
    }

    conceptos.removeAt(indice);
    this.versionConceptos.update((v) => v + 1);
  }

  /**
   * **AL MENOS UN CONCEPTO, además de que el formulario sea válido.** Lo primero ya no lo dice
   * la validación: la tarifa dejó de ser obligatoria por fila para que la fila vacía del final
   * no apague el botón.
   */
  protected puedeAgregar(): boolean {
    return this.formularioLinea.valid && this.conceptosConTarifa().length > 0 && !this.enviando();
  }

  protected agregar(): void {
    if (!this.puedeAgregar()) {
      this.formularioLinea.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioLinea.getRawValue();

    this.api
      .agregarLinea(this.id(), {
        equipoId: v.equipoId || null,
        descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
        // El orden lo pone la posición actual: las líneas se pintan por `orden` ascendente.
        orden: this.lineas().length + 1,
        // El orden del concepto es su posición en el formulario, y no es decorativo: al
        // convertir en renta, el PRIMERO es el que pasa a ser la línea de renta y aparta
        // calendario. Los demás van como cargos.
        // LAS FILAS SIN TARIFA SE DESCARTAN: es la fila vacía del final, que está para
        // agregar y no para enviarse. El `orden` se recalcula sobre las que quedan, porque es
        // el que decide cuál se vuelve línea de renta al convertir.
        tarifas: v.conceptos
          .filter((c) => c.tarifaId !== '')
          .map((c, i) => ({
            tarifaId: c.tarifaId,
            cantidad: c.cantidad ?? 0,
            precioUnitario: c.precioUnitario ?? 0,
            orden: i,
          })),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          // El listado lo recarga el servicio; el detalle lo pide quien lo montó.
          this.detalle.recargar();
          this.cerrarLinea();
        },
        error: (e: unknown) => {
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  protected async quitar(linea: CotizacionLinea): Promise<void> {
    if (this.enviando()) {
      return;
    }

    const sigue = await this.confirmacion.pedir({
      titulo: t().cotizacion.quitar,
      mensaje: t().cotizacion.confirmarQuitar(this.rotuloDeLinea(linea)),
      confirmar: t().cotizacion.quitar,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    this.api.quitarLinea(this.id(), linea.id).subscribe({
      next: () => {
        this.enviando.set(false);
        this.detalle.recargar();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  // --------------------------------------------------------------- conceptos sueltos --

  protected abrirConcepto(linea: CotizacionLinea): void {
    this.errorMutacion.set(null);
    this.lineaDestino.set(linea);
    this.formularioConcepto.reset({ tarifaId: '', cantidad: 1, precioUnitario: 0 });
    this.panelConcepto.set(true);
  }

  protected cerrarConcepto(): void {
    this.panelConcepto.set(false);
  }

  protected puedeAgregarConcepto(): boolean {
    return this.formularioConcepto.valid && !this.enviando() && this.lineaDestino() !== null;
  }

  protected agregarConcepto(): void {
    const linea = this.lineaDestino();

    if (!this.puedeAgregarConcepto() || linea === null) {
      this.formularioConcepto.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioConcepto.getRawValue();

    const alta = {
      tarifaId: v.tarifaId,
      cantidad: v.cantidad ?? 0,
      precioUnitario: v.precioUnitario ?? 0,
      // Al final de los que ya tiene: el primero manda al convertir y no se le quita el sitio.
      orden: linea.tarifas.length,
    } satisfies AltaCotizacionLineaTarifa;

    this.api.agregarTarifa(this.id(), linea.id, alta).subscribe({
      next: () => {
        this.enviando.set(false);
        this.detalle.recargar();
        this.cerrarConcepto();
      },
      error: (e: unknown) => {
        // Aquí aterriza el 409 del concepto repetido en la misma línea.
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  /**
   * Quita un concepto de una línea.
   *
   * **Si es el último, el servidor responde 409** y dice que lo que se quiere es quitar la
   * línea. Aquí no se duplica esa comprobación: el botón se sigue ofreciendo y el mensaje del
   * servidor explica qué hacer, que es mejor que un botón deshabilitado sin motivo visible.
   */
  protected async quitarConcepto(
    linea: CotizacionLinea,
    concepto: CotizacionLineaTarifa,
  ): Promise<void> {
    if (this.enviando()) {
      return;
    }

    const sigue = await this.confirmacion.pedir({
      titulo: t().cotizacion.quitarConcepto,
      mensaje: t().cotizacion.confirmarQuitarConcepto(concepto.tarifa),
      confirmar: t().cotizacion.quitarConcepto,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    this.api.quitarTarifa(this.id(), linea.id, concepto.id).subscribe({
      next: () => {
        this.enviando.set(false);
        this.detalle.recargar();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  // ------------------------------------------------------------------------- estado --

  protected abrirEstado(): void {
    const primero = this.siguientes()[0];

    if (primero === undefined) {
      return;
    }

    this.errorMutacion.set(null);
    this.formularioEstado.reset({ estado: primero });
    this.panelEstado.set(true);
  }

  protected cerrarEstado(): void {
    this.panelEstado.set(false);
  }

  protected enviarEstado(): void {
    if (this.enviando()) {
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioEstado.getRawValue();

    this.api.cambiarEstado(this.id(), v.estado).subscribe({
      next: () => {
        this.enviando.set(false);
        this.detalle.recargar();
        this.cerrarEstado();
      },
      error: (e: unknown) => {
        // Aquí aterriza el 409 de una transición inválida y el de «no se puede enviar una
        // cotización sin líneas», con el texto del servidor. El panel se queda abierto: el
        // mensaje se lee donde se tomó la decisión.
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  // --------------------------------------------------------------------- conversión --

  protected abrirConversion(): void {
    this.errorMutacion.set(null);
    this.conversion.set(null);

    // **EL PERIODO SE HEREDA de la cotización.** Es lo que se pidió el 2026-09-09, y hasta hoy
    // los dos campos arrancaban vacíos: quien convertía tenía las fechas propuestas a la vista,
    // en la ficha de arriba, y las volvía a teclear.
    //
    // A CAMPO LOCAL, no `slice(0, 16)` sobre el ISO: eso enseñaría la hora de Greenwich en un
    // campo que significa hora de pared. Ver `fecha-hora.ts`, que es el único sitio donde esa
    // conversión está escrita.
    //
    // Siguen siendo campos, y editables: la cotización PROPONE un periodo y la renta lo
    // COMPROMETE —es lo que aparta el calendario—, así que lo acordado puede no ser lo
    // propuesto. Prellenarlo ahorra el teclear; no decide.
    const c = this.cotizacion();

    this.formularioConversion.reset({
      clienteId: '',
      condiciones: '',
      inicio: c?.periodoInicio ? aCampoLocal(c.periodoInicio) : '',
      fin: c?.periodoFin ? aCampoLocal(c.periodoFin) : '',
      deposito: 0,
      anticipo: 0,
    });
    this.panelConversion.set(true);
  }

  /** Si el periodo salió de la cotización o hay que capturarlo. Solo cambia el texto de ayuda. */
  protected readonly periodoHeredado = computed(() => {
    const c = this.cotizacion();

    return c?.periodoInicio != null && c.periodoFin != null;
  });

  protected cerrarConversion(): void {
    this.panelConversion.set(false);
  }

  protected puedeConvertir(): boolean {
    return this.formularioConversion.valid && !this.enviando();
  }

  /**
   * Convierte la cotización en renta. **NO navega solo**: deja el resultado a la vista.
   *
   * Saltar a la renta recién creada parece lo cómodo y sería un error: **los avisos vienen en
   * esta respuesta y en ningún otro sitio**. Dicen qué renglones se pasaron como cargos —y por
   * tanto no apartaron calendario— y qué conceptos sobrantes de una línea con máquina acabaron
   * también como cargos. Si se descartan, nadie se entera.
   */
  protected convertir(): void {
    if (!this.puedeConvertir()) {
      this.formularioConversion.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioConversion.getRawValue();

    this.apiRentas
      .desdeCotizacion(this.id(), {
        clienteId: v.clienteId,
        condiciones: v.condiciones.trim() === '' ? null : v.condiciones.trim(),
        // A INSTANTE, no el texto crudo del campo — ver `fecha-hora.ts`.
        inicio: aInstante(v.inicio) ?? '',
        fin: aInstante(v.fin) ?? '',
        deposito: v.deposito ?? 0,
        anticipo: v.anticipo ?? 0,
      })
      .subscribe({
        next: (resultado) => {
          this.enviando.set(false);
          this.conversion.set(resultado);
        },
        error: (e: unknown) => {
          // Aquí aterriza el 409 de convertir una que no está Aceptada.
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  /** Ya se leyeron los avisos: ahora sí, a la renta. */
  protected irALaRenta(): void {
    const r = this.conversion();

    if (r === null) {
      return;
    }

    this.cerrarConversion();
    void this.ruteador.navigate(['/rentas', r.renta.id]);
  }
}
