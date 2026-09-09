import { HttpClient, httpResource } from '@angular/common/http';
import {
  Injectable,
  Injector,
  computed,
  inject,
  runInInjectionContext,
  type Signal,
} from '@angular/core';

import { configuracion } from '../ambiente/configuracion';
import type {
  FilaClientes,
  FilaMantenimiento,
  FilaMovimientos,
  FilaParque,
  FilaRentas,
  FilaUtilizacion,
  FiltroReporte,
  Tablero,
} from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';
import { aParametros } from './recursos-rest';

/** Un reporte ya en señales. Los seis tienen la misma forma. */
export interface Reporte<T> {
  readonly filas: Signal<readonly T[]>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
}

/** El tablero, en señales. Un solo recurso: los cinco bloques vienen juntos. */
export interface TableroEnVivo {
  readonly datos: Signal<Tablero | undefined>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly recargar: () => void;
}

/**
 * Los seis reportes y el tablero. **Todo de lectura.**
 *
 * **NO PASAN POR `FabricaDeRecursos`**, y no es por capricho: la fábrica arma recursos
 * paginados con alta, edición y retiro sobre `/api/<nombre>`; un reporte no tiene ninguna de
 * las tres, no pagina y devuelve un arreglo pelado. Forzarlo ahí dejaría la fábrica llena de
 * casos especiales por ahorrar tres líneas. Es el mismo criterio por el que la consulta de
 * disponibilidad tampoco pasa.
 *
 * **CADA REPORTE ES UNA FÁBRICA, no un campo**: sus datos dependen del periodo que elige la
 * pantalla y no los comparte nadie, así que no hay nada que deduplicar. Lo que sí se mantiene
 * es que `httpResource` no salga de la capa de API.
 *
 * **UN FILTRO SIN PERIODO NO PIDE NADA.** Los cuatro reportes de periodo devuelven `undefined`
 * como URL mientras falten las fechas, que es como se dice «no pidas todavía»: sin eso, abrir
 * la pantalla con el formulario vacío garantizaría un 400.
 */
@Injectable({ providedIn: 'root' })
export class ApiReportes {
  private readonly http = inject(HttpClient);
  private readonly inyector = inject(Injector);

  private readonly base = `${configuracion.urlApi}/api/reportes`;

  /** El parque de hoy. **No exige periodo**: es una foto. */
  parque(filtro: Signal<FiltroReporte>): Reporte<FilaParque> {
    return this.leer<FilaParque>('parque', filtro, false);
  }

  utilizacion(filtro: Signal<FiltroReporte>): Reporte<FilaUtilizacion> {
    return this.leer<FilaUtilizacion>('utilizacion', filtro, true);
  }

  rentas(filtro: Signal<FiltroReporte>): Reporte<FilaRentas> {
    return this.leer<FilaRentas>('rentas', filtro, true);
  }

  movimientos(filtro: Signal<FiltroReporte>): Reporte<FilaMovimientos> {
    return this.leer<FilaMovimientos>('movimientos', filtro, true);
  }

  mantenimiento(filtro: Signal<FiltroReporte>): Reporte<FilaMantenimiento> {
    return this.leer<FilaMantenimiento>('mantenimiento', filtro, true);
  }

  /** Cuánto renta cada cliente. **No exige periodo**: es una foto de hoy. */
  clientes(filtro: Signal<FiltroReporte>): Reporte<FilaClientes> {
    return this.leer<FilaClientes>('clientes', filtro, false);
  }

  /**
   * El tablero. Un recurso COMPARTIDO y memorizado: el inicio y el tablero podrían leerlo
   * los dos, y entonces hacen una sola petición entre ambos.
   */
  private vivo?: TableroEnVivo;

  tablero(): TableroEnVivo {
    if (this.vivo !== undefined) {
      return this.vivo;
    }

    const rec = runInInjectionContext(this.inyector, () =>
      httpResource<Tablero>(() => `${configuracion.urlApi}/api/tablero`),
    );

    this.vivo = {
      datos: computed(() => (rec.hasValue() ? rec.value() : undefined)),
      cargando: rec.isLoading,
      error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
      recargar: () => rec.reload(),
    };

    return this.vivo;
  }

  /**
   * El molde de los seis. `exigePeriodo` es lo que decide si se pide o se espera.
   *
   * El recurso se crea con `runInInjectionContext` porque estos métodos se llaman desde el
   * campo de un componente —que sí está en contexto— pero también podrían llamarse después;
   * hacerlo explícito evita que mover una línea rompa la pantalla con un error de inyección.
   */
  private leer<T>(ruta: string, filtro: Signal<FiltroReporte>, exigePeriodo: boolean): Reporte<T> {
    const rec = runInInjectionContext(this.inyector, () =>
      httpResource<readonly T[]>(() => {
        const f = filtro();

        if (exigePeriodo && (!f.Desde || !f.Hasta)) {
          return undefined;
        }

        return { url: `${this.base}/${ruta}`, params: aParametros(f) };
      }),
    );

    return {
      filas: computed(() => (rec.hasValue() ? rec.value() : [])),
      cargando: rec.isLoading,
      error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
    };
  }
}
