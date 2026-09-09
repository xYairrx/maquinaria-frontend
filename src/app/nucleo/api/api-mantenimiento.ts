import { HttpClient, httpResource } from '@angular/common/http';
import {
  Injectable,
  Injector,
  computed,
  inject,
  runInInjectionContext,
  type Signal,
} from '@angular/core';
import type { Observable } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaMantenimiento,
  CambioMantenimiento,
  CancelacionMantenimiento,
  CierreMantenimiento,
  FiltroMantenimientos,
  Mantenimiento,
} from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';
import { FabricaDeRecursos, type Listado } from './recursos-rest';

/** Un trabajo de taller, ya en señales. Para la pantalla de detalle. */
export interface TrabajoDeTaller {
  readonly trabajo: Signal<Mantenimiento | undefined>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly recargar: () => void;
}

/**
 * Los trabajos de taller. Módulo `mantenimiento`.
 *
 * **ABRIR, FINALIZAR Y CANCELAR SON POST a rutas propias**, no un PUT del recurso: cada uno
 * toca tres tablas en el servidor —la fila, el calendario y el movimiento— y son operaciones
 * con nombre, no ediciones. El PUT existe y solo corrige datos del trabajo abierto.
 *
 * **NO HAY BORRAR.** Un trabajo abierto por error se CANCELA, que libera el calendario y
 * devuelve la máquina dejando el rastro.
 */
@Injectable({ providedIn: 'root' })
export class ApiMantenimiento {
  private readonly http = inject(HttpClient);
  private readonly inyector = inject(Injector);

  private readonly base = `${configuracion.urlApi}/api`;

  private readonly fabrica = new FabricaDeRecursos(this.http, this.inyector, this.base);

  private readonly recurso = this.fabrica.recurso<Mantenimiento, CambioMantenimiento>(
    'mantenimiento',
  );

  /** El listado. Sirve a la pantalla del módulo y al historial del expediente de un equipo. */
  listado(filtro: Signal<FiltroMantenimientos>): Listado<Mantenimiento> {
    return this.recurso.listado(filtro);
  }

  /**
   * UN trabajo, para la pantalla de detalle.
   *
   * `undefined` en la URL mientras no haya id: es como se dice «no pidas todavía», y sin eso
   * la pantalla dispara una petición a `/api/mantenimiento/` al arrancar.
   */
  trabajo(id: Signal<string>): TrabajoDeTaller {
    const rec = runInInjectionContext(this.inyector, () =>
      httpResource<Mantenimiento>(() =>
        id() ? `${this.base}/mantenimiento/${encodeURIComponent(id())}` : undefined,
      ),
    );

    return {
      trabajo: computed(() => (rec.hasValue() ? rec.value() : undefined)),
      cargando: rec.isLoading,
      error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
      recargar: () => rec.reload(),
    };
  }

  /**
   * Abre el trabajo: **ocupa el calendario** y, con taller, manda la máquina allá.
   *
   * **Puede responder 409 del calendario** si la máquina tiene una renta confirmada en esas
   * fechas — y ese mensaje dice con qué choca, así que se muestra tal cual.
   */
  abrir(alta: AltaMantenimiento): Observable<Mantenimiento> {
    return this.fabrica.publicar<Mantenimiento>('mantenimiento', alta, {
      recargar: 'mantenimiento',
    });
  }

  editar(id: string, cambio: CambioMantenimiento): Observable<Mantenimiento> {
    return this.recurso.editar(id, cambio);
  }

  /** Abierto ↔ EnProceso. Informativo: no toca el calendario. */
  marcarEnProceso(id: string, enProceso: boolean): Observable<Mantenimiento> {
    return this.fabrica.parcheo<Mantenimiento>(
      `mantenimiento/${encodeURIComponent(id)}/en-proceso`,
      { enProceso },
      { recargar: 'mantenimiento' },
    );
  }

  /**
   * Finaliza: libera el calendario, guarda costo y horómetro y regresa la máquina.
   *
   * **Exige `ubicacionRegresoId` si el trabajo tenía taller**; si falta, 400 con el motivo.
   */
  finalizar(id: string, cierre: CierreMantenimiento): Observable<Mantenimiento> {
    return this.fabrica.publicar<Mantenimiento>(
      `mantenimiento/${encodeURIComponent(id)}/finalizar`,
      cierre,
      { recargar: 'mantenimiento' },
    );
  }

  /** Cancela: el trabajo no se hizo. Libera igual y regresa la máquina si había salido. */
  cancelar(id: string, cancelacion: CancelacionMantenimiento): Observable<Mantenimiento> {
    return this.fabrica.publicar<Mantenimiento>(
      `mantenimiento/${encodeURIComponent(id)}/cancelar`,
      cancelacion,
      { recargar: 'mantenimiento' },
    );
  }
}
