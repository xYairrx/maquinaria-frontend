import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject, type Signal } from '@angular/core';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaTrabajador,
  AltaUbicacion,
  CambioEstadoTrabajador,
  Trabajador,
  Ubicacion,
} from './contratos';
import { FabricaDeRecursos } from './recursos-rest';
import type { Observable } from 'rxjs';

/**
 * Ubicaciones y trabajadores: la estructura física y humana de la empresa.
 *
 * SEPARADO DE `ApiCatalogos` POR LA URL, no por capricho: estos cuelgan de la raíz de la API
 * —`/api/ubicaciones`— y no de `/api/catalogos`. La forma de las operaciones es idéntica, así
 * que la maquinaria se comparte desde `recursos-rest.ts`; lo único propio es la base.
 *
 * Los permisos también son otros: ubicaciones exige `sucursales.*` —así se llama el módulo en
 * el backend, aunque la pantalla se llame Ubicaciones— y trabajadores exige `usuarios.*`.
 */
@Injectable({ providedIn: 'root' })
export class ApiOrganizacion {
  private readonly fabrica = new FabricaDeRecursos(
    inject(HttpClient),
    inject(Injector),
    `${configuracion.urlApi}/api`,
  );

  readonly ubicaciones = this.fabrica.recurso<Ubicacion, AltaUbicacion>('ubicaciones');

  /**
   * Trabajadores: las personas. Permisos de `usuarios`.
   *
   * La fabrica le da listado, alta y edicion, que tienen la misma forma que en cualquier
   * catalogo. **`cambiarActivo` no se usa aqui**: su lugar lo toma `cambiarEstadoTrabajador`.
   */
  readonly trabajadores = this.fabrica.recurso<Trabajador, AltaTrabajador>('trabajadores');

  /**
   * El estado de un trabajador, que NO es un booleano.
   *
   * `fechaBaja` es OBLIGATORIA si el estado es Baja y PROHIBIDA en cualquier otro: es
   * literalmente el CHECK `trabajador_baja_coherente` de la base. La pantalla lo resuelve
   * antes de enviar para que salga como aviso bajo el campo y no como error del servidor.
   */
  cambiarEstadoTrabajador(id: string, cambio: CambioEstadoTrabajador): Observable<Trabajador> {
    return this.fabrica.parcheo<Trabajador>(
      `trabajadores/${encodeURIComponent(id)}/estado`,
      cambio,
      { recargar: 'trabajadores' },
    );
  }

  /**
   * Las ubicaciones activas, para los desplegables de otras pantallas.
   *
   * Lo van a pedir el alta de trabajador y la de equipo. Ojo con esa última: **no debe
   * ofrecer sucursales**, porque una sucursal no almacena equipo. Ese recorte se hace con
   * `AlmacenaEquipo` del lado del servidor, no filtrando esta lista en memoria.
   */
  selectorUbicaciones(): Signal<readonly Ubicacion[]> {
    return this.fabrica.selector<Ubicacion>('ubicaciones');
  }

  /**
   * Los trabajadores activos, para los desplegables de otras pantallas.
   *
   * Lo pide el traspaso —quien mueve la maquina— y lo pedira la orden de trabajo del taller.
   */
  selectorTrabajadores(): Signal<readonly Trabajador[]> {
    return this.fabrica.selector<Trabajador>('trabajadores');
  }

  /**
   * Solo las ubicaciones que ALMACENAN equipo: bodegas y patios.
   *
   * Es el desplegable correcto para el destino de un traspaso y para el alta de equipo. Una
   * sucursal administra y cotiza; no guarda maquinas, y un TRIGGER de la base rechaza el
   * traspaso hacia ella. Ofrecerla en la lista seria invitar a un error garantizado.
   *
   * `almacenaEquipo` es una COLUMNA GENERADA del tipo de ubicacion, no un campo que alguien
   * capture, asi que el servidor siempre sabe la respuesta.
   */
  selectorAlmacenes(): Signal<readonly Ubicacion[]> {
    return this.fabrica.selectorFiltrado<Ubicacion>('ubicaciones', { AlmacenaEquipo: true });
  }

  /**
   * El complemento de `selectorAlmacenes`: solo las ubicaciones ADMINISTRATIVAS —sucursal y
   * patio—, que son las únicas desde las que sale una cotización.
   *
   * Un patio está en las DOS listas a propósito: guarda máquinas *y* administra. Lo que no
   * puede aparecer aquí es la bodega, y no por gusto: el trigger
   * `cotizacion_exigir_administrativa` rechaza el alta, así que ofrecerla sería ofrecer un
   * error garantizado.
   *
   * `EsAdministrativa` ya existía en `FiltroUbicaciones` del servidor esperando a esta
   * pantalla, igual que `AlmacenaEquipo` esperaba a la de traspasos.
   */
  selectorAdministrativas(): Signal<readonly Ubicacion[]> {
    return this.fabrica.selectorFiltrado<Ubicacion>('ubicaciones', { EsAdministrativa: true });
  }
}
