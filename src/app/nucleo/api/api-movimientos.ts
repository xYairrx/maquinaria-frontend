import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import type { AltaMovimiento, EvidenciaSubida, FiltroMovimientos, Movimiento } from './contratos';
import { FabricaDeRecursos, type Listado } from './recursos-rest';

/**
 * El historial físico de las máquinas. Módulo `movimientos`, nuevo del MVP.
 *
 * **SOLO LECTURA Y ALTA, y aquí no es una decisión de diseño de este archivo: la tabla es
 * *append-only* y un trigger de la base rechaza el UPDATE.** Por eso se usa la fábrica para el
 * listado y un POST suelto para el alta, en lugar de un `RecursoRest` entero cuyas
 * operaciones de editar y retirar no existirían del otro lado. Mismo motivo por el que los
 * traspasos —a los que sustituye— estaban así.
 *
 * **UN SOLO RECURSO SIRVE A DOS PANTALLAS**: el módulo de Movimientos sin filtros y el
 * historial dentro del expediente con `EquipoId`. Es la misma ruta con distinto filtro, así
 * que comparten caché y recarga; añadir un segundo recurso para el expediente duplicaría la
 * petición y luego habría que acordarse de recargar los dos.
 */
@Injectable({ providedIn: 'root' })
export class ApiMovimientos {
  private readonly http = inject(HttpClient);

  private readonly fabrica = new FabricaDeRecursos(
    this.http,
    inject(Injector),
    `${configuracion.urlApi}/api`,
  );

  /**
   * La fábrica da el listado paginado. `crear`, `editar` y `cambiarActivo` NO se exponen:
   * `editar` respondería con la excepción del trigger y los otros dos no existen en la API.
   */
  private readonly recurso = this.fabrica.recurso<Movimiento, AltaMovimiento>('movimientos');

  /** El historial, filtrable. El filtro es una señal: sin eso el recurso no vuelve a pedir. */
  listado(filtro: Signal<FiltroMovimientos>): Listado<Movimiento> {
    return this.recurso.listado(filtro);
  }

  /**
   * Registra un movimiento y **mueve la ubicación del equipo**, en una transacción del
   * servidor.
   *
   * Rechazos que hay que esperar, todos con su mensaje: un tipo que no se captura a mano
   * (400), un equipo sin ubicación al que se le pide moverse (409), una obra cerrada (409),
   * el destino igual al origen (400), y fechar en otro día sin `movimientos.autorizar` (400).
   *
   * Recarga el listado sola —lo hace la fábrica—, así que la pantalla no tiene que acordarse.
   */
  registrar(alta: AltaMovimiento): Observable<Movimiento> {
    return this.recurso.crear(alta);
  }

  /**
   * Sube la evidencia y devuelve su id, para meterlo en el alta.
   *
   * **VA ANTES DEL MOVIMIENTO Y NO DESPUÉS**, y no es una elección de este archivo: la tabla
   * es *append-only* y el trigger rechaza el UPDATE, así que la fila se escribe con su
   * evidencia dentro o sin ella para siempre. No existe —ni puede existir— un
   * `POST /movimientos/{id}/evidencia`.
   *
   * `FormData` y no JSON: un base64 crece un tercio y obliga a tener el archivo entero en
   * memoria de los dos lados. **Sin `Content-Type` a mano**: el navegador tiene que ponerlo
   * él para incluir el `boundary`, y fijarlo aquí rompería el multipart.
   *
   * NO RECARGA NADA: no ha cambiado ningún listado todavía. La recarga la hace `registrar`.
   */
  subirEvidencia(archivo: File): Observable<EvidenciaSubida> {
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo);

    return this.http.post<EvidenciaSubida>(
      `${configuracion.urlApi}/api/movimientos/evidencias`,
      cuerpo,
    );
  }

  /** La URL de descarga de la evidencia de un movimiento. La compone quien la pinta. */
  urlEvidencia(movimientoId: string): string {
    return `${configuracion.urlApi}/api/movimientos/${encodeURIComponent(movimientoId)}/evidencia`;
  }
}
