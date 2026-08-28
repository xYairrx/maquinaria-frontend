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
import { RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiCotizaciones } from '../../../nucleo/api/api-cotizaciones';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import { ApiRentas } from '../../../nucleo/api/api-rentas';
import type {
  CotizacionLinea,
  EstadoRenta,
  RentaConcepto,
  RentaLinea,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { aInstante } from '../../../nucleo/formularios/fecha-hora';
import {
  validadorCantidad,
  validadorImporte,
  validadorRequerido,
} from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';

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

  private readonly detalle = this.api.detalleDe(this.id);

  protected readonly renta = this.detalle.renta;
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
   * Lo que se cotizó POR TIPO y por tanto no pasó a la renta: cada una necesita una máquina.
   *
   * Es el mismo conjunto que la conversión informó en `pendientes`, pero leído de la
   * cotización en lugar de su texto — así se puede precargar el alta con la tarifa, la
   * cantidad y el PRECIO COTIZADO reales.
   *
   * **La lista no se encoge al asignar**, y conviene saber por qué: no existe vínculo entre una
   * línea cotizada y la de renta que la resuelve. Marcarlo por parecido —misma tarifa, misma
   * cantidad, mismo precio— apagaría las DOS si la cotización trae dos renglones idénticos, que
   * es un caso normal. Se prefiere que sobre información a que falte: la tabla de equipos está
   * justo debajo y dice qué se lleva agregado.
   */
  protected readonly cotizadasPorTipo = computed<readonly CotizacionLinea[]>(() =>
    (this.deLaCotizacion.cotizacion()?.lineas ?? []).filter(
      (l) => l.equipoId === null && l.tipoEquipoId !== null,
    ),
  );

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
  protected readonly puedeDevolver = computed(() => this.acciones().includes('devolver'));
  protected readonly puedeExtender = computed(() => this.acciones().includes('extender'));
  protected readonly puedeCerrar = computed(() => this.acciones().includes('cerrar'));
  protected readonly puedeCancelar = computed(() => this.acciones().includes('cancelar'));
  protected readonly sinAcciones = computed(() => this.acciones().length === 0);

  protected readonly enviando = signal(false);
  protected readonly panelLinea = signal(false);
  protected readonly panelConcepto = signal(false);
  protected readonly panelExtension = signal(false);
  protected readonly panelCierre = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.detalle.error());

  protected readonly formularioLinea = this.fb.group({
    equipoId: ['', validadorRequerido],
    tarifaId: ['', validadorRequerido],
    // Numéricos: `validadorCantidad` / `validadorImporte`, NUNCA `validadorRequerido` — ver la
    // trampa en `validadores.ts`.
    cantidad: [1 as number | null, validadorCantidad],
    precioUnitario: [0 as number | null, validadorImporte],
    horasIncluidas: [null as number | null],
  });

  protected readonly formularioConcepto = this.fb.group({
    tarifaId: ['', validadorRequerido],
    trabajadorId: [''],
    descripcion: [''],
    cantidad: [1 as number | null, validadorCantidad],
    precioUnitario: [0 as number | null, validadorImporte],
    costo: [null as number | null],
  });

  protected readonly formularioExtension = this.fb.group({
    finNuevo: ['', validadorRequerido],
    trabajadorId: ['', validadorRequerido],
    motivo: [''],
  });

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
    this.formularioLinea.reset({
      equipoId: '',
      tarifaId: '',
      cantidad: 1,
      precioUnitario: 0,
      horasIncluidas: null,
    });
    this.panelLinea.set(true);
  }

  /**
   * Abre el alta de equipo YA LLENA con lo que se cotizó, y deja solo la máquina por elegir.
   *
   * **Los tres datos salen de la línea cotizada, no del texto de `pendientes`.** Ese texto es una
   * frase —«2 x Excavadora 20 (Tarifa de flete) a 4,200.00»— y precargar desde ahí exigiría
   * parsearla, que además depende del idioma. Aquí se lee la cotización de verdad.
   *
   * Y eso es justo lo que protege el precio: reteclearlo es donde una cifra se desvía de lo que
   * el cliente aceptó.
   */
  protected asignarDesde(cotizada: CotizacionLinea): void {
    this.errorMutacion.set(null);
    this.formularioLinea.reset({
      // Lo único que falta, y es una decisión comercial: qué máquina concreta.
      equipoId: '',
      tarifaId: cotizada.tarifaId,
      cantidad: cotizada.cantidad,
      precioUnitario: cotizada.precioUnitario,
      horasIncluidas: null,
    });
    this.panelLinea.set(true);
  }

  protected cerrarLinea(): void {
    this.panelLinea.set(false);
  }

  protected puedeAgregarLinea(): boolean {
    return this.formularioLinea.valid && !this.enviando();
  }

  protected agregarLinea(): void {
    if (!this.puedeAgregarLinea()) {
      this.formularioLinea.markAllAsTouched();
      return;
    }

    const v = this.formularioLinea.getRawValue();

    this.ejecutar(
      this.api.agregarLinea(this.id(), {
        equipoId: v.equipoId,
        tarifaId: v.tarifaId,
        cantidad: v.cantidad ?? 0,
        precioUnitario: v.precioUnitario ?? 0,
        horasIncluidas: v.horasIncluidas,
        orden: this.lineas().length + 1,
      }),
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

  protected abrirConcepto(): void {
    this.errorMutacion.set(null);
    this.formularioConcepto.reset({
      tarifaId: '',
      trabajadorId: '',
      descripcion: '',
      cantidad: 1,
      precioUnitario: 0,
      costo: null,
    });
    this.panelConcepto.set(true);
  }

  protected cerrarConcepto(): void {
    this.panelConcepto.set(false);
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

    this.ejecutar(
      this.api.agregarConcepto(this.id(), {
        tarifaId: v.tarifaId,
        trabajadorId: v.trabajadorId || null,
        descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
        cantidad: v.cantidad ?? 0,
        precioUnitario: v.precioUnitario ?? 0,
        costo: v.costo,
      }),
      () => this.cerrarConcepto(),
    );
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
    this.formularioExtension.reset({ finNuevo: '', trabajadorId: '', motivo: '' });
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
        trabajadorId: v.trabajadorId,
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
