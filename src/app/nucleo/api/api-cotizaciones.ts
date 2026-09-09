import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Injector, computed, inject, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaCotizacion,
  AltaCotizacionLinea,
  AltaCotizacionLineaTarifa,
  Cotizacion,
  CotizacionLinea,
  CotizacionLineaTarifa,
  EstadoCotizacion,
} from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';
import { FabricaDeRecursos } from './recursos-rest';

/** El detalle de UNA cotización, con sus líneas. */
export interface DetalleDeCotizacion {
  readonly cotizacion: Signal<Cotizacion | null>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly recargar: () => void;
}

/**
 * Cotizaciones: la propuesta comercial.
 *
 * El LISTADO usa la fábrica —es paginado y con filtros, como cualquier otro—, pero **el detalle
 * no**: cuelga de un id, no se comparte con nadie y trae las líneas dentro. Es el mismo reparto
 * que en el expediente del equipo.
 *
 * Las líneas se agregan y se quitan **una por una**, con su propio endpoint. No hay «guardar la
 * cotización con sus líneas»: cada línea es una operación, y el servidor recalcula el subtotal.
 *
 * **DESDE EL 2026-09-08 HAY DOS NIVELES.** Una línea lleva N conceptos cobrables, y cada uno se
 * añade y se quita por separado — pero la línea NACE con los suyos, en una sola petición: una
 * línea sin ningún concepto no cobra nada y el servidor la rechaza.
 */
@Injectable({ providedIn: 'root' })
export class ApiCotizaciones {
  private readonly http = inject(HttpClient);

  private readonly fabrica = new FabricaDeRecursos(
    this.http,
    inject(Injector),
    `${configuracion.urlApi}/api`,
  );

  /** Listado, alta y edición. La edición **solo aplica en Borrador**: el servidor lo exige. */
  readonly cotizaciones = this.fabrica.recurso<Cotizacion, AltaCotizacion>('cotizaciones');

  detalleDe(id: Signal<string>): DetalleDeCotizacion {
    const rec = httpResource<Cotizacion>(() =>
      id() ? `${configuracion.urlApi}/api/cotizaciones/${encodeURIComponent(id())}` : undefined,
    );

    return {
      cotizacion: computed(() => (rec.hasValue() ? rec.value() : null)),
      cargando: rec.isLoading,
      error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
      recargar: () => rec.reload(),
    };
  }

  /**
   * Mueve el estado.
   *
   * **Las transiciones inválidas responden 409**, y esa es la garantía: la máquina de estados
   * vive en el servidor, no en la pantalla. La pantalla ofrece solo las válidas para no invitar
   * al error, pero quien manda es el 409.
   */
  cambiarEstado(id: string, estado: EstadoCotizacion): Observable<Cotizacion> {
    return this.fabrica.parcheo<Cotizacion>(
      `cotizaciones/${encodeURIComponent(id)}/estado`,
      { estado },
      { recargar: 'cotizaciones' },
    );
  }

  /**
   * Agrega una línea. **El importe lo calcula el servidor**: cantidad por precio.
   *
   * Recarga el LISTADO además de devolver la línea, porque el subtotal y el total del
   * documento cambian y son dos de las columnas de la tabla de cotizaciones. Lo que no puede
   * recargar desde aquí es el detalle: ese recurso lo crea `detalleDe` por pantalla y no está
   * en el mapa de la fábrica, así que lo refresca quien lo pidió.
   */
  agregarLinea(id: string, alta: AltaCotizacionLinea): Observable<CotizacionLinea> {
    return this.fabrica.publicar<CotizacionLinea>(
      `cotizaciones/${encodeURIComponent(id)}/lineas`,
      alta,
      { recargar: 'cotizaciones' },
    );
  }

  /** Quita una línea. Mismo trato que el alta: el total cambia, así que el listado se recarga. */
  quitarLinea(id: string, lineaId: string): Observable<void> {
    return this.fabrica.borrar(
      `cotizaciones/${encodeURIComponent(id)}/lineas/${encodeURIComponent(lineaId)}`,
      { recargar: 'cotizaciones' },
    );
  }

  /**
   * Añade un concepto a una línea que YA existe.
   *
   * **El mismo concepto dos veces en la misma línea responde 409**: sumaría dos veces y nadie lo
   * vería al revisar el total. Para corregir la cantidad o el precio hay que quitarlo y volver a
   * ponerlo — no hay endpoint de edición, y no es un olvido: un concepto es un renglón de la
   * propuesta, no un campo.
   */
  agregarTarifa(
    id: string,
    lineaId: string,
    alta: AltaCotizacionLineaTarifa,
  ): Observable<CotizacionLineaTarifa> {
    return this.fabrica.publicar<CotizacionLineaTarifa>(
      `cotizaciones/${encodeURIComponent(id)}/lineas/${encodeURIComponent(lineaId)}/tarifas`,
      alta,
      { recargar: 'cotizaciones' },
    );
  }

  /**
   * Quita un concepto de una línea.
   *
   * **Sacar el último responde 409** y dice que lo que se quiere es quitar la línea: un renglón
   * de importe cero que no dice qué se cobra no le sirve a nadie.
   */
  quitarTarifa(id: string, lineaId: string, tarifaLineaId: string): Observable<void> {
    return this.fabrica.borrar(
      `cotizaciones/${encodeURIComponent(id)}/lineas/${encodeURIComponent(lineaId)}` +
        `/tarifas/${encodeURIComponent(tarifaLineaId)}`,
      { recargar: 'cotizaciones' },
    );
  }
}
