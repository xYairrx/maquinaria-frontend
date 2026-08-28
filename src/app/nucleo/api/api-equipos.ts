import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Injector, computed, inject, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaEquipo,
  AltaEquipoTarifa,
  CambioEstadoEquipo,
  DocumentoEquipo,
  Equipo,
  EquipoTarifa,
  TipoArchivoEquipo,
} from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';
import { FabricaDeRecursos } from './recursos-rest';

/** Lo que la pantalla de expediente necesita, ya en señales. */
export interface ExpedienteDeEquipo {
  readonly equipo: Signal<Equipo | null>;
  readonly documentos: Signal<readonly DocumentoEquipo[]>;
  readonly tarifas: Signal<readonly EquipoTarifa[]>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly recargarDocumentos: () => void;
  readonly recargarTarifas: () => void;
  readonly recargarEquipo: () => void;
}

/**
 * El parque: los equipos y su expediente.
 *
 * Cuelga de la raíz de la API —`/api/equipos`— como organización y terceros, así que estrena su
 * propia fábrica. Está aparte de esos dos porque el equipo **es** el activo del negocio: de él
 * cuelgan los documentos, sus precios, los traspasos y el calendario de ocupación.
 */
@Injectable({ providedIn: 'root' })
export class ApiEquipos {
  private readonly http = inject(HttpClient);

  private readonly fabrica = new FabricaDeRecursos(
    inject(HttpClient),
    inject(Injector),
    `${configuracion.urlApi}/api`,
  );

  /**
   * Listado, alta y edición. **`cambiarActivo` no se usa**: el equipo tiene ocho estados y su
   * propio `PATCH .../estado`, y además es de los pocos con `DELETE`.
   */
  readonly equipos = this.fabrica.recurso<Equipo, AltaEquipo>('equipos');

  /**
   * El estado operativo, con su nota.
   *
   * **Puede responder 409**: el servidor exige que el calendario esté libre para moverlo. No es
   * un fallo genérico —es la garantía de no-traslape hablando— y la pantalla lo dice con el
   * texto del servidor.
   */
  cambiarEstadoEquipo(id: string, cambio: CambioEstadoEquipo): Observable<Equipo> {
    return this.fabrica.parcheo<Equipo>(`equipos/${encodeURIComponent(id)}/estado`, cambio, {
      recargar: 'equipos',
    });
  }

  /**
   * Borrado LÓGICO. El equipo no desaparece: deja de listarse.
   *
   * También responde **409** si tiene calendario ocupado, y por la misma razón.
   */
  eliminarEquipo(id: string): Observable<void> {
    return this.fabrica.borrar(`equipos/${encodeURIComponent(id)}`, { recargar: 'equipos' });
  }

  /** Los equipos disponibles, para los desplegables de cotización, renta y traspaso. */
  selectorEquipos(): Signal<readonly Equipo[]> {
    return this.fabrica.selector<Equipo>('equipos');
  }

  /**
   * El expediente de UN equipo: sus documentos y sus precios.
   *
   * NO PASA POR `FabricaDeRecursos`, y no por capricho: la fábrica arma recursos paginados de
   * primer nivel —`/api/<recurso>`— y estos cuelgan de un equipo, sin paginar y con un id en
   * medio. Forzarlos ahí dejaría la fábrica llena de casos especiales por un ahorro de tres
   * líneas.
   *
   * Se expone como FÁBRICA y no como campos, por lo mismo que `Api.consultaDeInvitacion`: los
   * datos dependen del id de la pantalla y no los comparte nadie, así que no hay nada que
   * deduplicar. Lo que sí se mantiene es que `httpResource` no salga de la capa de API.
   */
  expedienteDe(equipoId: Signal<string>): ExpedienteDeEquipo {
    const base = `${configuracion.urlApi}/api/equipos`;

    // `undefined` cuando aún no hay id: es como se dice «no pidas todavía». Sin esto, la
    // pantalla dispara dos peticiones al arrancar, una de ellas a `/api/equipos//documentos`.
    const documentos = httpResource<readonly DocumentoEquipo[]>(() =>
      equipoId() ? `${base}/${encodeURIComponent(equipoId())}/documentos` : undefined,
    );

    const tarifas = httpResource<readonly EquipoTarifa[]>(() =>
      equipoId() ? `${base}/${encodeURIComponent(equipoId())}/tarifas` : undefined,
    );

    const equipo = httpResource<Equipo>(() =>
      equipoId() ? `${base}/${encodeURIComponent(equipoId())}` : undefined,
    );

    return {
      equipo: computed(() => (equipo.hasValue() ? equipo.value() : null)),
      documentos: computed(() => (documentos.hasValue() ? documentos.value() : [])),
      tarifas: computed(() => (tarifas.hasValue() ? tarifas.value() : [])),
      cargando: computed(() => equipo.isLoading() || documentos.isLoading() || tarifas.isLoading()),
      error: computed(
        () =>
          mensajeDeErrorDeRecurso(equipo.error()) ??
          mensajeDeErrorDeRecurso(documentos.error()) ??
          mensajeDeErrorDeRecurso(tarifas.error()),
      ),
      recargarDocumentos: () => documentos.reload(),
      recargarTarifas: () => tarifas.reload(),
      recargarEquipo: () => equipo.reload(),
    };
  }

  /**
   * Sube un documento al expediente.
   *
   * VA COMO `multipart/form-data` Y NO COMO JSON: un base64 crece un tercio y obliga a tener el
   * archivo entero en memoria a los dos lados. Se manda un `FormData` **sin fijar
   * `Content-Type`** — el navegador tiene que ponerlo él para incluir el `boundary`, y ponerlo
   * a mano rompe la petición de una forma que no se ve hasta el 400 del servidor.
   */
  subirDocumento(
    equipoId: string,
    archivo: File,
    alta: { readonly tipo: TipoArchivoEquipo; readonly descripcion: string | null },
  ): Observable<DocumentoEquipo> {
    const cuerpo = new FormData();

    cuerpo.append('archivo', archivo, archivo.name);
    cuerpo.append('tipo', String(alta.tipo));

    if (alta.descripcion !== null) {
      cuerpo.append('descripcion', alta.descripcion);
    }

    return this.http.post<DocumentoEquipo>(
      `${configuracion.urlApi}/api/equipos/${encodeURIComponent(equipoId)}/documentos`,
      cuerpo,
    );
  }

  /**
   * Baja el CONTENIDO de un documento.
   *
   * Como `blob` y no con un `<a href>`: la descarga necesita el `Bearer`, y un enlace normal no
   * lo lleva. Quien llama recibe el blob y decide qué hacer con él.
   */
  descargarDocumento(equipoId: string, documentoId: string): Observable<Blob> {
    return this.http.get(
      `${configuracion.urlApi}/api/equipos/${encodeURIComponent(equipoId)}/documentos/${encodeURIComponent(documentoId)}/contenido`,
      { responseType: 'blob' },
    );
  }

  eliminarDocumento(equipoId: string, documentoId: string): Observable<void> {
    return this.http.delete<void>(
      `${configuracion.urlApi}/api/equipos/${encodeURIComponent(equipoId)}/documentos/${encodeURIComponent(documentoId)}`,
    );
  }

  /** Carga un precio. **Puede responder 409**: ya hay uno vigente para esa combinación. */
  crearPrecio(equipoId: string, alta: AltaEquipoTarifa): Observable<EquipoTarifa> {
    return this.http.post<EquipoTarifa>(
      `${configuracion.urlApi}/api/equipos/${encodeURIComponent(equipoId)}/tarifas`,
      alta,
    );
  }

  /** Le pone fecha de fin a un precio vigente. **Es como se cambia un precio**, no editándolo. */
  cerrarPrecio(
    equipoId: string,
    precioId: string,
    vigenciaHasta: string,
  ): Observable<EquipoTarifa> {
    return this.http.patch<EquipoTarifa>(
      `${configuracion.urlApi}/api/equipos/${encodeURIComponent(equipoId)}/tarifas/${encodeURIComponent(precioId)}/cierre`,
      { vigenciaHasta },
    );
  }
}
