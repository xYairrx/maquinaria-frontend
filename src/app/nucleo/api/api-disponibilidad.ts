import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Injector, computed, inject, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaBloqueo,
  EquipoDisponible,
  FiltroDisponibilidad,
  Ocupacion,
  Pagina,
} from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';
import { FabricaDeRecursos, aParametros } from './recursos-rest';

/** El calendario de UN equipo, ya en señales. */
export interface CalendarioDeEquipo {
  readonly ocupaciones: Signal<readonly Ocupacion[]>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly recargar: () => void;
}

/**
 * Disponibilidad y bloqueos: las dos caras de `ocupacion_equipo`.
 *
 * **La consulta de disponibilidad NO es un listado de registros**, y por eso no pasa por
 * `FabricaDeRecursos`: es una PREGUNTA con un periodo obligatorio —«qué hay libre entre estas
 * dos fechas»— que el servidor rechaza con un 400 si le falta. Un recurso paginado normal se
 * pide sin parámetros y devuelve algo; este no.
 *
 * **Los traspasos ya no están aquí**: son movimientos de tipo 3 y viven en `ApiMovimientos`.
 * Este servicio quedó con el calendario, que es su otra mitad.
 */
@Injectable({ providedIn: 'root' })
export class ApiDisponibilidad {
  private readonly http = inject(HttpClient);
  private readonly inyector = inject(Injector);

  private readonly fabrica = new FabricaDeRecursos(
    this.http,
    this.inyector,
    `${configuracion.urlApi}/api`,
  );

  /**
   * Los equipos libres en un periodo.
   *
   * `undefined` mientras falten las fechas: es como se dice «no pidas todavía», y evita el 400
   * garantizado que saldría al abrir la pantalla con el formulario vacío.
   */
  disponibles(filtro: Signal<FiltroDisponibilidad>): {
    readonly filas: Signal<readonly EquipoDisponible[]>;
    readonly total: Signal<number>;
    readonly cargando: Signal<boolean>;
    readonly error: Signal<string | null>;
  } {
    const rec = httpResource<Pagina<EquipoDisponible>>(() => {
      const f = filtro();

      return f.Desde && f.Hasta
        ? { url: `${configuracion.urlApi}/api/disponibilidad`, params: aParametros(f) }
        : undefined;
    });

    return {
      filas: computed(() => (rec.hasValue() ? rec.value().filas : [])),
      total: computed(() => (rec.hasValue() ? rec.value().total : 0)),
      cargando: rec.isLoading,
      error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
    };
  }

  /** El calendario de un equipo, incluidas las ocupaciones ya liberadas. */
  calendarioDe(equipoId: Signal<string>): CalendarioDeEquipo {
    const rec = httpResource<readonly Ocupacion[]>(() =>
      equipoId()
        ? `${configuracion.urlApi}/api/disponibilidad/equipos/${encodeURIComponent(equipoId())}`
        : undefined,
    );

    return {
      ocupaciones: computed(() => (rec.hasValue() ? rec.value() : [])),
      cargando: rec.isLoading,
      error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
      recargar: () => rec.reload(),
    };
  }

  /** Ocupa el calendario a mano. **Puede responder 409**: choca con el `EXCLUDE`. */
  crearBloqueo(alta: AltaBloqueo): Observable<Ocupacion> {
    return this.http.post<Ocupacion>(`${configuracion.urlApi}/api/disponibilidad/bloqueos`, alta);
  }

  /** Libera un bloqueo manual. **No borra la fila**: la marca inactiva. */
  liberarBloqueo(id: string): Observable<void> {
    return this.http.delete<void>(
      `${configuracion.urlApi}/api/disponibilidad/bloqueos/${encodeURIComponent(id)}`,
    );
  }

  // LOS TRASPASOS SE FUERON A `ApiMovimientos`. Un traspaso es un movimiento de tipo 3, y
  // mantener las dos entradas daría dos formas de mover una máquina: una que deja rastro en
  // el historial y otra que no. La tabla `transferencia_equipo` se borra en el backend.
}
