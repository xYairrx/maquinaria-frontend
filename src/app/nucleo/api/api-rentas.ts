import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Injector, computed, inject, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaExtension,
  ConversionARenta,
  ConversionDeCotizacion,
  AltaRenta,
  AltaRentaConcepto,
  AltaRentaLinea,
  CierreDeRenta,
  ExtensionRenta,
  Renta,
  RentaConcepto,
  RentaLinea,
} from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';
import { FabricaDeRecursos } from './recursos-rest';

/** El detalle de UNA renta, con sus líneas, sus conceptos y sus extensiones. */
export interface DetalleDeRenta {
  readonly renta: Signal<Renta | null>;
  readonly extensiones: Signal<readonly ExtensionRenta[]>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly recargar: () => void;
}

/**
 * Rentas: la operación real, y el criterio de salida de la Fase 1.
 *
 * **LOS CUATRO PASOS QUE MUEVEN EL CALENDARIO NO SON UN CAMBIO DE ESTADO.** Confirmar, extender,
 * cerrar y cancelar tienen endpoint propio porque cada uno hace más que cambiar una columna:
 *
 * - **Confirmar** inserta una fila de `ocupacion_equipo` **por línea**, en una transacción. Si el
 *   `EXCLUDE` rechaza una sola, se deshace entera: no existe una renta a medio confirmar con tres
 *   equipos apartados y el cuarto tomado por otro cliente.
 * - **Extender** mueve el fin de la renta y el de sus ocupaciones. El `EXCLUDE` revalida solo:
 *   alargar hasta el 30 cuando otro cliente ya tiene el equipo desde el 25 lo rechaza el motor.
 * - **Cerrar** y **cancelar** liberan el calendario marcando las ocupaciones `activo = false`.
 *   **Liberar no es borrar**: el `EXCLUDE` es parcial —`WHERE activo`— así que el periodo queda
 *   libre sin perder el histórico de qué máquina estuvo dónde.
 *
 * El `PATCH .../estado` cubre solo los dos pasos que no tocan nada —Confirmada → Activa y
 * Activa → Devuelta— y el controlador **rechaza los otros con un 400**.
 *
 * Todos ellos devuelven la renta ya actualizada, así que quien llama no tiene que releerla; lo
 * que sí tiene que refrescar es el DETALLE, que no vive en el mapa de la fábrica.
 */
@Injectable({ providedIn: 'root' })
export class ApiRentas {
  private readonly http = inject(HttpClient);

  private readonly fabrica = new FabricaDeRecursos(
    this.http,
    inject(Injector),
    `${configuracion.urlApi}/api`,
  );

  /** Listado, alta y edición. La edición **solo aplica en Borrador**: el servidor lo exige. */
  readonly rentas = this.fabrica.recurso<Renta, AltaRenta>('rentas');

  /**
   * Las rentas, para el desplegable del alta de contrato.
   *
   * **NO se puede recortar a «las que no tienen contrato»**: ese filtro no existe en el
   * servidor, y calcularlo aquí exigiría traerse los contratos y cruzarlos — con la lista
   * paginada a 200, el cruce sería silenciosamente incompleto en cuanto la empresa pase de
   * ese número. Se ofrecen todas y el 409 del `UNIQUE contrato_renta_unica` explica cuál ya
   * tiene: «La renta REN-2026-00001 ya tiene contrato.»
   *
   * Es la misma regla de las pantallas vacías: no afirmar sobre lo que no se consultó.
   */
  selectorRentas(): Signal<readonly Renta[]> {
    return this.fabrica.selector<Renta>('rentas');
  }

  detalleDe(id: Signal<string>): DetalleDeRenta {
    const base = () =>
      id() ? `${configuracion.urlApi}/api/rentas/${encodeURIComponent(id())}` : undefined;

    const renta = httpResource<Renta>(base);

    // Las extensiones van en su propio endpoint y no dentro del DTO: son historial, no estado, y
    // la mayoría de las rentas no tiene ninguna.
    const extensiones = httpResource<readonly ExtensionRenta[]>(() => {
      const u = base();

      return u === undefined ? undefined : `${u}/extensiones`;
    });

    return {
      renta: computed(() => (renta.hasValue() ? renta.value() : null)),
      extensiones: computed(() => (extensiones.hasValue() ? extensiones.value() : [])),
      cargando: computed(() => renta.isLoading() || extensiones.isLoading()),
      error: computed(
        () =>
          mensajeDeErrorDeRecurso(renta.error()) ?? mensajeDeErrorDeRecurso(extensiones.error()),
      ),
      recargar: () => {
        renta.reload();
        extensiones.reload();
      },
    };
  }

  /**
   * Convierte una cotización **Aceptada** en una renta en Borrador.
   *
   * Copia los precios CONGELADOS y no los vuelve a leer del catálogo: si entre la cotización y la
   * renta alguien cargó un precio nuevo, se cobra lo cotizado. Eso es lo que hace que el número
   * que el cliente recuerda y el que el sistema factura sean el mismo.
   *
   * Devuelve además `pendientes`: las líneas cotizadas por TIPO de equipo, que no pasan a la
   * renta porque cada línea necesita una máquina concreta para generar calendario.
   */
  desdeCotizacion(
    cotizacionId: string,
    datos: ConversionARenta,
  ): Observable<ConversionDeCotizacion> {
    return this.fabrica.publicar<ConversionDeCotizacion>(
      `rentas/desde-cotizacion/${encodeURIComponent(cotizacionId)}`,
      datos,
      { recargar: 'rentas' },
    );
  }

  /** Confirma y OCUPA el calendario. Un 409 aquí suele ser el `EXCLUDE`: el equipo ya está dado. */
  confirmar(id: string): Observable<Renta> {
    return this.fabrica.publicar<Renta>(
      `rentas/${encodeURIComponent(id)}/confirmacion`,
      {},
      {
        recargar: 'rentas',
      },
    );
  }

  /** Alarga la renta. El 409 es el `EXCLUDE`: en ese periodo el equipo ya no está libre. */
  extender(id: string, alta: AltaExtension): Observable<ExtensionRenta> {
    return this.fabrica.publicar<ExtensionRenta>(
      `rentas/${encodeURIComponent(id)}/extensiones`,
      alta,
      { recargar: 'rentas' },
    );
  }

  /** Cierra: registra horómetros de devolución, pasa a Cerrada y libera el calendario. */
  cerrar(id: string, cierre: CierreDeRenta): Observable<Renta> {
    return this.fabrica.publicar<Renta>(`rentas/${encodeURIComponent(id)}/cierre`, cierre, {
      recargar: 'rentas',
    });
  }

  /** Cancela una renta que todavía no arrancó. Una Activa NO se cancela: se devuelve y se cierra. */
  cancelar(id: string): Observable<Renta> {
    return this.fabrica.publicar<Renta>(
      `rentas/${encodeURIComponent(id)}/cancelacion`,
      {},
      {
        recargar: 'rentas',
      },
    );
  }

  /**
   * Los dos únicos pasos que NO mueven el calendario: Confirmada → Activa —el equipo salió— y
   * Activa → Devuelta —regresó—. Mandar aquí cualquier otro responde **400**, no 409.
   */
  cambiarEstado(id: string, estado: number): Observable<Renta> {
    return this.fabrica.parcheo<Renta>(
      `rentas/${encodeURIComponent(id)}/estado`,
      { estado },
      { recargar: 'rentas' },
    );
  }

  /** Agrega una línea. **Solo en Borrador**: después tiene calendario detrás. */
  agregarLinea(id: string, alta: AltaRentaLinea): Observable<RentaLinea> {
    return this.fabrica.publicar<RentaLinea>(`rentas/${encodeURIComponent(id)}/lineas`, alta, {
      recargar: 'rentas',
    });
  }

  quitarLinea(id: string, lineaId: string): Observable<void> {
    return this.fabrica.borrar(
      `rentas/${encodeURIComponent(id)}/lineas/${encodeURIComponent(lineaId)}`,
      { recargar: 'rentas' },
    );
  }

  /**
   * Agrega un concepto. **En cualquier estado salvo Cerrada y Cancelada**, al contrario que las
   * líneas: un concepto no lleva equipo, así que no toca el calendario, y cobrar un flete extra
   * con la máquina ya en la obra es lo normal.
   */
  agregarConcepto(id: string, alta: AltaRentaConcepto): Observable<RentaConcepto> {
    return this.fabrica.publicar<RentaConcepto>(
      `rentas/${encodeURIComponent(id)}/conceptos`,
      alta,
      { recargar: 'rentas' },
    );
  }

  quitarConcepto(id: string, conceptoId: string): Observable<void> {
    return this.fabrica.borrar(
      `rentas/${encodeURIComponent(id)}/conceptos/${encodeURIComponent(conceptoId)}`,
      { recargar: 'rentas' },
    );
  }
}
