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
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiOrdenes } from '../../../nucleo/api/api-ordenes';
import type {
  DocumentoVenta,
  EstadoOrden,
  // Renombrado por lo mismo que en `orden-compra.ts`: el DTO choca con la clase.
  OrdenVentaDetalle as LineaDeVenta,
  TipoArchivoVenta,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorImporte, validadorRequerido } from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';

const BORRADOR: EstadoOrden = 1;
const AUTORIZADA: EstadoOrden = 2;
const CANCELADA: EstadoOrden = 4;

/** Ver `MONEDA` en `cotizaciones.ts`: la Fase 1 no lleva divisa por documento. */
const MONEDA = 'MXN';

/** Idéntica a la de compras: el ciclo del documento es el mismo. Ver `orden-compra.ts`. */
export const ACCIONES: Readonly<Record<number, readonly string[]>> = {
  [BORRADOR]: ['autorizar', 'cancelar'],
  [AUTORIZADA]: ['finalizar', 'cancelar'],
};

/**
 * El detalle de una orden de venta: sus líneas y el Proceso que saca las máquinas del parque.
 *
 * **FINALIZAR LES CIERRA EL CALENDARIO**, y eso es lo que la conecta con la garantía que sostiene
 * la fase: sin cerrarlo, una máquina vendida seguiría apareciendo libre y alguien la rentaría.
 * Por eso la confirmación lo dice con todas sus letras antes de pulsar.
 *
 * **Adaptación anotada del servidor:** el alcance describe cerrarlo con `motivo = Venta`;
 * `MotivoOcupacion` no tiene ese valor y el CHECK de la base es `BETWEEN 1 AND 6`. Se cierra con
 * `Bloqueo` y una nota que dice de qué venta salió. El efecto sobre la disponibilidad es
 * idéntico; lo que se pierde es distinguir «vendido» de «bloqueado» leyendo solo el motivo — así
 * que en la pantalla de Disponibilidad un equipo vendido aparece como bloqueado.
 *
 * **Es la imagen espejo de la compra**, y por eso este detalle es más simple: allá finalizar pide
 * datos de cada línea —el código interno con el que la máquina entra al catálogo— y aquí no pide
 * nada, porque los equipos ya existen y están en las líneas.
 */
@Component({
  selector: 'app-orden-venta',
  imports: [CurrencyPipe, DatePipe, ErrorCampo, PanelLateral, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orden-venta.html',
})
export class OrdenVentaDetalle {
  private readonly api = inject(ApiOrdenes);
  private readonly equipos = inject(ApiEquipos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly locale = idioma;
  protected readonly moneda = MONEDA;
  protected readonly mal = errorVisible;

  /** Puede llegar `undefined` pese al tipo — ver `expediente.ts`. */
  readonly id = input('');

  /**
   * Los que se pueden vender: **todos**.
   *
   * **AQUÍ HABÍA UN RECORTE Y SE FUE EL 2026-09-09 con `equipo.proposito`.** Una máquina
   * marcada `Renta` no se podía vender —el servidor la rechazaba con «cambia su propósito antes
   * de venderla»— y ofrecerla habría sido ofrecer un rechazo. Retirada la columna, cualquier
   * equipo se puede rentar y cualquiera se puede vender; **lo único que sigue impidiéndolo es
   * su estado**, y de eso se encarga el servidor al agregar la línea.
   */
  protected readonly equiposDisponibles = this.equipos.selectorEquipos();

  private readonly detalle = this.api.detalleDeVenta(this.id);

  protected readonly orden = this.detalle.orden;
  protected readonly cargando = this.detalle.cargando;

  protected readonly lineas = computed<readonly LineaDeVenta[]>(() => this.orden()?.detalles ?? []);

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

  // ---------------------------------------------- el papel de la venta --

  /**
   * Los adjuntos vienen DENTRO del detalle de la orden, no en un recurso propio: son pocos por
   * venta y la pantalla ya pide la orden entera. Un segundo recurso sería una petición más y
   * dos cosas que recordar recargar.
   */
  protected readonly documentos = computed(() => this.orden()?.archivos ?? []);

  protected readonly tiposArchivo: readonly TipoArchivoVenta[] = [1, 2, 3, 4, 5];

  protected readonly panelDocumento = signal(false);
  protected readonly tipoDocumento = signal<TipoArchivoVenta>(1);
  protected readonly descripcionDocumento = signal('');

  /**
   * El archivo elegido, fuera de todo formulario reactivo: un `<input type="file">` no tiene
   * accesor de Angular y un control guardaría la ruta falsa del navegador, no el `File`.
   */
  protected readonly archivo = signal<File | null>(null);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.detalle.error());

  protected readonly formularioLinea = this.fb.group({
    equipoId: ['', validadorRequerido],
    precioUnitario: [0 as number | null, validadorImporte],
  });

  constructor() {
    effect(() => {
      const o = this.orden();

      this.barra.configurar({
        titulo: t().ventas.tituloDetalle,
        contexto: o ? t().ventas.contextoFolio(o.folio) : '',
        busqueda: null,
        accion: null,
      });
    });
  }

  protected nombreEstado(estado: EstadoOrden): string {
    return t().ordenes.estados[estado] ?? String(estado);
  }

  protected abrirLinea(): void {
    this.errorMutacion.set(null);
    this.formularioLinea.reset({ equipoId: '', precioUnitario: 0 });
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
      this.api.agregarLineaVenta(this.id(), {
        equipoId: v.equipoId,
        precioUnitario: v.precioUnitario ?? 0,
        orden: this.lineas().length + 1,
      }),
      () => this.cerrarLinea(),
    );
  }

  protected async quitar(linea: LineaDeVenta): Promise<void> {
    if (this.enviando()) {
      return;
    }

    const sigue = await this.confirmacion.pedir({
      titulo: t().ordenes.quitar,
      mensaje: t().ventas.confirmarQuitar(linea.codigoInterno),
      confirmar: t().ordenes.quitar,
      peligro: true,
    });

    if (sigue) {
      this.ejecutar(this.api.quitarLineaVenta(this.id(), linea.id));
    }
  }

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
      this.ejecutar(this.api.cambiarEstadoVenta(this.id(), AUTORIZADA));
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
      this.ejecutar(this.api.cambiarEstadoVenta(this.id(), CANCELADA));
    }
  }

  /**
   * Finalizar. **Es lo más irreversible de la pantalla**: los equipos salen del parque y su
   * calendario se cierra, así que la confirmación lo dice completo en vez de preguntar «¿seguro?».
   */
  protected async finalizar(): Promise<void> {
    const o = this.orden();

    if (o === null || this.enviando()) {
      return;
    }

    const sigue = await this.confirmacion.pedir({
      titulo: t().ventas.finalizarTitulo,
      mensaje: t().ventas.finalizarMensaje(o.folio),
      confirmar: t().ventas.finalizar,
      peligro: true,
    });

    if (sigue) {
      this.ejecutar(this.api.finalizarVenta(this.id()));
    }
  }

  private ejecutar(peticion: Observable<unknown>, alTerminar?: () => void): void {
    this.enviando.set(true);
    this.errorMutacion.set(null);

    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.detalle.recargar();
        // El listado de ÓRDENES lo recarga el servicio. Los de EQUIPOS y DISPONIBILIDAD no —
        // viven en otros servicios y no en el mapa de esta fábrica—, así que un equipo recién
        // vendido sigue viéndose libre ahí hasta que esas pantallas se vuelvan a pedir. No se
        // fuerza desde aquí: encadenar recargas entre servicios es cómo se empieza a construir
        // un caché a mano, que es justo lo que el repo dejó anotado para no hacer todavía.
        alTerminar?.();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
  // ---------------------------------------------- el papel de la venta --

  protected urlDocumento(documentoId: string): string {
    return this.api.urlDocumentoVenta(this.id(), documentoId);
  }

  protected abrirDocumento(): void {
    this.errorMutacion.set(null);
    this.tipoDocumento.set(1);
    this.descripcionDocumento.set('');
    this.archivo.set(null);
    this.panelDocumento.set(true);
  }

  protected cerrarDocumento(): void {
    this.panelDocumento.set(false);
  }

  protected elegirTipoDocumento(valor: string): void {
    this.tipoDocumento.set(Number(valor) as TipoArchivoVenta);
  }

  protected elegirArchivo(entrada: EventTarget | null): void {
    const archivos = (entrada as HTMLInputElement | null)?.files;

    this.archivo.set(archivos && archivos.length > 0 ? archivos[0] : null);
  }

  protected subirDocumento(): void {
    const elegido = this.archivo();

    if (elegido === null || this.enviando()) {
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const descripcion = this.descripcionDocumento().trim();

    this.api
      .subirDocumentoVenta(
        this.id(),
        elegido,
        this.tipoDocumento(),
        descripcion === '' ? null : descripcion,
      )
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.cerrarDocumento();
          // Los adjuntos viajan dentro del detalle, así que hay que volver a pedirlo: la
          // fábrica no sabe de esta ruta y no lo recarga sola.
          this.detalle.recargar();
        },
        error: (e: unknown) => {
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  /**
   * Borra un adjunto. **Pregunta antes**, y el mensaje dice lo que se pierde: en una venta
   * cerrada el contrato es el respaldo de que la máquina cambió de dueño.
   */
  protected async borrarDocumento(documento: DocumentoVenta): Promise<void> {
    const sigue = await this.confirmacion.pedir({
      titulo: t().ventas.borrarDocumento,
      mensaje: t().ventas.confirmarBorrarDocumento(documento.nombreOriginal),
      confirmar: t().ventas.borrarDocumento,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    this.errorMutacion.set(null);

    this.api.eliminarDocumentoVenta(this.id(), documento.id).subscribe({
      next: () => this.detalle.recargar(),
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
