import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Injector, computed, inject, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaOrdenCompra,
  AltaOrdenCompraDetalle,
  AltaOrdenVenta,
  AltaOrdenVentaDetalle,
  EstadoOrden,
  OrdenCompra,
  OrdenCompraDetalle,
  OrdenVenta,
  OrdenVentaDetalle,
  RegistroDeEquipo,
} from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';
import { FabricaDeRecursos } from './recursos-rest';

/** El detalle de UNA orden, con sus líneas. Sirve para las dos, compra y venta. */
export interface DetalleDeOrden<T> {
  readonly orden: Signal<T | null>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly recargar: () => void;
}

/**
 * Órdenes de compra y de venta.
 *
 * **UN SOLO SERVICIO PARA LAS DOS**, y no por ahorrar líneas: comparten el enum de estado, el
 * filtro —`ContraparteId` es el proveedor en compras y el cliente en ventas— y la forma exacta de
 * los cinco endpoints. Separarlas daría dos archivos que habría que cambiar a la vez cada vez.
 *
 * **FINALIZAR NO ES UN CAMBIO DE ESTADO** en ninguna de las dos, y es lo que las hace interesantes:
 *
 * - En **compras** registra cada línea como un equipo del catálogo. Es el punto por donde entra
 *   maquinaria al parque, y es **todo o nada**: media orden finalizada dejaría tres máquinas dadas
 *   de alta, la cuarta no, y la orden en un estado que no dice cuál falta.
 * - En **ventas** saca los equipos del parque y **les cierra el calendario**. Sin eso, una máquina
 *   vendida seguiría apareciendo libre y alguien la rentaría — es la pieza que conecta la venta
 *   con la garantía de no-traslape.
 *
 * Por eso `PATCH .../estado` con `Finalizada` responde **400**, no 409: el servicio lo rechaza
 * antes de mirar nada más, con «usa el endpoint de finalizacion».
 */
@Injectable({ providedIn: 'root' })
export class ApiOrdenes {
  private readonly http = inject(HttpClient);

  private readonly fabrica = new FabricaDeRecursos(
    this.http,
    inject(Injector),
    `${configuracion.urlApi}/api`,
  );

  readonly compras = this.fabrica.recurso<OrdenCompra, AltaOrdenCompra>('ordenes-compra');
  readonly ventas = this.fabrica.recurso<OrdenVenta, AltaOrdenVenta>('ordenes-venta');

  detalleDeCompra(id: Signal<string>): DetalleDeOrden<OrdenCompra> {
    return this.detalle<OrdenCompra>('ordenes-compra', id);
  }

  detalleDeVenta(id: Signal<string>): DetalleDeOrden<OrdenVenta> {
    return this.detalle<OrdenVenta>('ordenes-venta', id);
  }

  private detalle<T>(recurso: string, id: Signal<string>): DetalleDeOrden<T> {
    const rec = httpResource<T>(() =>
      id() ? `${configuracion.urlApi}/api/${recurso}/${encodeURIComponent(id())}` : undefined,
    );

    return {
      orden: computed(() => (rec.hasValue() ? rec.value() : null)),
      cargando: rec.isLoading,
      error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
      recargar: () => rec.reload(),
    };
  }

  // ------------------------------------------------------------------- compras --

  /** Agrega una línea. **Solo en Borrador**: después la orden ya está comprometida. */
  agregarLineaCompra(id: string, alta: AltaOrdenCompraDetalle): Observable<OrdenCompraDetalle> {
    return this.fabrica.publicar<OrdenCompraDetalle>(
      `ordenes-compra/${encodeURIComponent(id)}/detalles`,
      alta,
      { recargar: 'ordenes-compra' },
    );
  }

  quitarLineaCompra(id: string, detalleId: string): Observable<void> {
    return this.fabrica.borrar(
      `ordenes-compra/${encodeURIComponent(id)}/detalles/${encodeURIComponent(detalleId)}`,
      { recargar: 'ordenes-compra' },
    );
  }

  /** Autorizar o cancelar. **Finalizada aquí da 400**: tiene endpoint propio. */
  cambiarEstadoCompra(id: string, estado: EstadoOrden): Observable<OrdenCompra> {
    return this.fabrica.parcheo<OrdenCompra>(
      `ordenes-compra/${encodeURIComponent(id)}/estado`,
      { estado },
      { recargar: 'ordenes-compra' },
    );
  }

  /**
   * Finaliza y **da de alta las máquinas**.
   *
   * Cada línea sin equipo necesita su registro con código interno y tipo. Si falta uno, **no se
   * finaliza nada**: el Proceso es todo o nada.
   */
  finalizarCompra(id: string, equipos: readonly RegistroDeEquipo[]): Observable<OrdenCompra> {
    return this.fabrica.publicar<OrdenCompra>(
      `ordenes-compra/${encodeURIComponent(id)}/finalizacion`,
      { equipos },
      { recargar: 'ordenes-compra' },
    );
  }

  // -------------------------------------------------------------------- ventas --

  agregarLineaVenta(id: string, alta: AltaOrdenVentaDetalle): Observable<OrdenVentaDetalle> {
    return this.fabrica.publicar<OrdenVentaDetalle>(
      `ordenes-venta/${encodeURIComponent(id)}/detalles`,
      alta,
      { recargar: 'ordenes-venta' },
    );
  }

  quitarLineaVenta(id: string, detalleId: string): Observable<void> {
    return this.fabrica.borrar(
      `ordenes-venta/${encodeURIComponent(id)}/detalles/${encodeURIComponent(detalleId)}`,
      { recargar: 'ordenes-venta' },
    );
  }

  cambiarEstadoVenta(id: string, estado: EstadoOrden): Observable<OrdenVenta> {
    return this.fabrica.parcheo<OrdenVenta>(
      `ordenes-venta/${encodeURIComponent(id)}/estado`,
      { estado },
      { recargar: 'ordenes-venta' },
    );
  }

  /**
   * Finaliza la venta: **saca los equipos del parque y les cierra el calendario**.
   *
   * No lleva cuerpo: los equipos ya están en las líneas. Lo que sí hace falta es recargar también
   * el listado de EQUIPOS y el de disponibilidad, porque las máquinas vendidas dejan de estar
   * libres — pero esos recursos viven en otros servicios y no en este mapa, así que lo hace la
   * pantalla. Está dicho también en `orden-venta.ts`.
   */
  finalizarVenta(id: string): Observable<OrdenVenta> {
    return this.fabrica.publicar<OrdenVenta>(
      `ordenes-venta/${encodeURIComponent(id)}/finalizacion`,
      {},
      { recargar: 'ordenes-venta' },
    );
  }
}
