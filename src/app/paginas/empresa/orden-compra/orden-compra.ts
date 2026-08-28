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
import { ApiOrdenes } from '../../../nucleo/api/api-ordenes';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import type {
  EstadoOrden,
  // Renombrado: el DTO y la CLASE de esta pantalla se llaman igual, y la ruta ya referencia la
  // clase. Dentro del componente «línea de compra» además se lee mejor.
  OrdenCompraDetalle as LineaDeCompra,
  RegistroDeEquipo,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import {
  validadorCantidad,
  validadorImporte,
  validadorRequerido,
} from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';

const BORRADOR: EstadoOrden = 1;
const AUTORIZADA: EstadoOrden = 2;
const CANCELADA: EstadoOrden = 4;

/** Ver `MONEDA` en `cotizaciones.ts`: la Fase 1 no lleva divisa por documento. */
const MONEDA = 'MXN';

/**
 * QUÉ SE PUEDE HACER DESDE CADA ESTADO.
 *
 * Espejo de `Transiciones` en `ServicioOrdenesCompraEf`, **con una diferencia que la tabla del
 * servidor no expresa**: allá `Autorizada → Finalizada` es una transición válida, pero el
 * servicio la rechaza con **400** en cuanto la ve —«usa el endpoint de finalizacion»— porque
 * finalizar registra equipos y eso es un Proceso, no un cambio de columna.
 *
 * Por eso aquí `finalizar` es una acción propia y no un estado del desplegable: representa el
 * endpoint, no la transición.
 *
 * Finalizada y Cancelada son terminales: ausentes del mapa.
 */
export const ACCIONES: Readonly<Record<number, readonly string[]>> = {
  [BORRADOR]: ['autorizar', 'cancelar'],
  [AUTORIZADA]: ['finalizar', 'cancelar'],
};

/**
 * El detalle de una orden de compra: sus líneas y el Proceso que da de alta las máquinas.
 *
 * **FINALIZAR ES EL PUNTO POR DONDE ENTRA MAQUINARIA AL PARQUE**, y es todo o nada. Cada línea
 * sin equipo necesita su código interno y su tipo; si falta uno, el servidor no da de alta
 * ninguna y la orden se queda como estaba. El panel pide los datos de todas las líneas de golpe
 * justamente por eso: pedirlos de una en una sugeriría que se van registrando por separado.
 *
 * **El código interno se pide AQUÍ y no al capturar la línea.** Es una decisión de inventario,
 * no de compra: cuando se cotiza la máquina todavía no se sabe con qué número entra al parque.
 *
 * **Una línea es UNA máquina.** La cantidad tiene que ser 1 si va a registrar equipo, porque
 * `orden_compra_detalle` tiene un solo `equipoId` con índice único. Tres excavadoras iguales son
 * tres líneas — que además es lo correcto, porque cada una tiene su número de serie.
 */
@Component({
  selector: 'app-orden-compra',
  imports: [CurrencyPipe, DatePipe, ErrorCampo, PanelLateral, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orden-compra.html',
})
export class OrdenCompraDetalle {
  private readonly api = inject(ApiOrdenes);
  private readonly catalogos = inject(ApiCatalogos);
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

  protected readonly modelos = this.catalogos.selectorModelos();
  protected readonly tipos = this.catalogos.selectorTipos();

  /** Solo las que ALMACENAN equipo: una máquina nueva entra a una bodega o a un patio. */
  protected readonly almacenes = this.organizacion.selectorAlmacenes();

  private readonly detalle = this.api.detalleDeCompra(this.id);

  protected readonly orden = this.detalle.orden;
  protected readonly cargando = this.detalle.cargando;

  protected readonly lineas = computed<readonly LineaDeCompra[]>(
    () => this.orden()?.detalles ?? [],
  );

  protected readonly esBorrador = computed(() => this.orden()?.estado === BORRADOR);

  private readonly acciones = computed<readonly string[]>(() => {
    const estado = this.orden()?.estado;

    return estado === undefined ? [] : (ACCIONES[estado] ?? []);
  });

  protected readonly puedeAutorizar = computed(() => this.acciones().includes('autorizar'));
  protected readonly puedeFinalizar = computed(() => this.acciones().includes('finalizar'));
  protected readonly puedeCancelar = computed(() => this.acciones().includes('cancelar'));
  protected readonly sinAcciones = computed(() => this.acciones().length === 0);

  protected readonly enviando = signal(false);
  protected readonly panelLinea = signal(false);
  protected readonly panelFinalizar = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.detalle.error());

  protected readonly formularioLinea = this.fb.group({
    modeloEquipoId: ['', validadorRequerido],
    numeroSerie: [''],
    anio: [null as number | null],
    cantidad: [1 as number | null, validadorCantidad],
    costoUnitario: [0 as number | null, validadorImporte],
  });

  /**
   * Lo que cada línea necesita para volverse un equipo, FUERA del `FormGroup`.
   *
   * Es un mapa `detalleId → { codigoInterno, tipoEquipoId, ubicacionId }` de tamaño variable — una
   * entrada por línea de la orden—, así que un `FormGroup` fijo no sirve. Se indexa por el id de
   * la LÍNEA porque eso es lo que `RegistroDeEquipo.DetalleId` espera; aquí sí es la línea y no el
   * equipo, al revés que los horómetros de una renta.
   */
  protected readonly registros = signal<
    Readonly<Record<string, { codigoInterno: string; tipoEquipoId: string; ubicacionId: string }>>
  >({});

  /** Si ya se intentó finalizar. Los avisos no salen antes de que alguien pueda hacer algo. */
  protected readonly intentoFinalizar = signal(false);

  /** Faltan datos si alguna línea sin equipo no tiene código o tipo. */
  protected readonly registrosIncompletos = computed(() => {
    const r = this.registros();

    return this.lineas()
      .filter((l) => l.equipoId === null)
      .some((l) => {
        const dato = r[l.id];

        return dato === undefined || dato.codigoInterno.trim() === '' || dato.tipoEquipoId === '';
      });
  });

  constructor() {
    effect(() => {
      const o = this.orden();

      this.barra.configurar({
        titulo: t().compras.tituloDetalle,
        contexto: o ? t().compras.contextoFolio(o.folio) : '',
        busqueda: null,
        accion: null,
      });
    });
  }

  protected nombreEstado(estado: EstadoOrden): string {
    return t().ordenes.estados[estado] ?? String(estado);
  }

  protected registroDe(lineaId: string, campo: 'codigoInterno' | 'tipoEquipoId' | 'ubicacionId') {
    return this.registros()[lineaId]?.[campo] ?? '';
  }

  protected escribirRegistro(
    lineaId: string,
    campo: 'codigoInterno' | 'tipoEquipoId' | 'ubicacionId',
    valor: string,
  ): void {
    this.registros.update((actual) => {
      // El orden importa: los valores por omisión primero, encima lo ya capturado, y el campo
      // que se acaba de escribir al final. Escribirlo como un literal con el spread en medio
      // hace que TypeScript avise de que las claves iniciales se pisan — tenía razón.
      const previo = actual[lineaId] ?? {
        codigoInterno: '',
        tipoEquipoId: '',
        ubicacionId: '',
      };

      return { ...actual, [lineaId]: { ...previo, [campo]: valor } };
    });
  }

  // -------------------------------------------------------------------- líneas --

  protected abrirLinea(): void {
    this.errorMutacion.set(null);
    this.formularioLinea.reset({
      modeloEquipoId: '',
      numeroSerie: '',
      anio: null,
      cantidad: 1,
      costoUnitario: 0,
    });
    this.panelLinea.set(true);
  }

  protected cerrarLinea(): void {
    this.panelLinea.set(false);
  }

  protected puedeAgregar(): boolean {
    return this.formularioLinea.valid && !this.enviando();
  }

  protected agregar(): void {
    if (!this.puedeAgregar()) {
      this.formularioLinea.markAllAsTouched();
      return;
    }

    const v = this.formularioLinea.getRawValue();

    this.ejecutar(
      this.api.agregarLineaCompra(this.id(), {
        modeloEquipoId: v.modeloEquipoId,
        numeroSerie: v.numeroSerie.trim() === '' ? null : v.numeroSerie.trim(),
        // `Math.trunc` porque el accesor numérico entrega decimales aunque el `step` sea 1, y
        // el servidor los declara `int`: un 2026.5 daría un 400 de enlace de modelo.
        anio: v.anio === null ? null : Math.trunc(v.anio),
        cantidad: Math.trunc(v.cantidad ?? 1),
        costoUnitario: v.costoUnitario ?? 0,
        orden: this.lineas().length + 1,
      }),
      () => this.cerrarLinea(),
    );
  }

  protected async quitar(linea: LineaDeCompra): Promise<void> {
    if (this.enviando()) {
      return;
    }

    const sigue = await this.confirmacion.pedir({
      titulo: t().ordenes.quitar,
      mensaje: t().compras.confirmarQuitar(`${linea.marca} ${linea.modelo}`),
      confirmar: t().ordenes.quitar,
      peligro: true,
    });

    if (sigue) {
      this.ejecutar(this.api.quitarLineaCompra(this.id(), linea.id));
    }
  }

  // ------------------------------------------------------------------ el ciclo --

  protected async autorizar(): Promise<void> {
    const o = this.orden();

    if (o === null || this.enviando()) {
      return;
    }

    const sigue = await this.confirmacion.pedir({
      titulo: t().ordenes.autorizarTitulo,
      mensaje: t().ordenes.autorizarMensaje(o.folio),
      confirmar: t().ordenes.autorizar,
      peligro: false,
    });

    if (sigue) {
      this.ejecutar(this.api.cambiarEstadoCompra(this.id(), AUTORIZADA));
    }
  }

  protected async cancelar(): Promise<void> {
    const o = this.orden();

    if (o === null || this.enviando()) {
      return;
    }

    const sigue = await this.confirmacion.pedir({
      titulo: t().ordenes.cancelarTitulo,
      mensaje: t().ordenes.cancelarMensaje(o.folio),
      confirmar: t().ordenes.cancelar,
      peligro: true,
    });

    if (sigue) {
      this.ejecutar(this.api.cambiarEstadoCompra(this.id(), CANCELADA));
    }
  }

  protected abrirFinalizar(): void {
    this.errorMutacion.set(null);
    this.intentoFinalizar.set(false);
    this.registros.set({});
    this.panelFinalizar.set(true);
  }

  protected cerrarFinalizar(): void {
    this.panelFinalizar.set(false);
  }

  protected finalizar(): void {
    if (this.enviando()) {
      return;
    }

    // Aquí es donde el aviso pasa a verse: la persona ya intentó. Igual que en el expediente,
    // los campos viven fuera del formulario reactivo y no tienen `touched`.
    this.intentoFinalizar.set(true);

    if (this.registrosIncompletos()) {
      return;
    }

    const r = this.registros();

    const equipos = this.lineas()
      .filter((l) => l.equipoId === null)
      .map(
        (l) =>
          ({
            detalleId: l.id,
            codigoInterno: r[l.id].codigoInterno.trim().toUpperCase(),
            tipoEquipoId: r[l.id].tipoEquipoId,
            // Vacía va NULA: el servidor la admite sin ubicación asignada.
            ubicacionId: r[l.id].ubicacionId || null,
          }) satisfies RegistroDeEquipo,
      );

    this.ejecutar(this.api.finalizarCompra(this.id(), equipos), () => this.cerrarFinalizar());
  }

  /**
   * El envoltorio de las cinco mutaciones. El detalle lo refresca quien lo montó.
   *
   * Aquí aterrizan el 409 de autorizar sin líneas, el de tocar líneas fuera de Borrador, y los
   * del Proceso: un código interno repetido, un tipo que no existe, una línea que ya registró su
   * equipo. Todos con el texto del servidor, que es el único que sabe cuál de ellos fue.
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
