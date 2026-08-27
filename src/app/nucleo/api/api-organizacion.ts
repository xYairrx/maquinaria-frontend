import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject, type Signal } from '@angular/core';

import { configuracion } from '../ambiente/configuracion';
import type { AltaUbicacion, Ubicacion } from './contratos';
import { FabricaDeRecursos } from './recursos-rest';

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
   * Las ubicaciones activas, para los desplegables de otras pantallas.
   *
   * Lo van a pedir el alta de trabajador y la de equipo. Ojo con esa última: **no debe
   * ofrecer sucursales**, porque una sucursal no almacena equipo. Ese recorte se hace con
   * `AlmacenaEquipo` del lado del servidor, no filtrando esta lista en memoria.
   */
  selectorUbicaciones(): Signal<readonly Ubicacion[]> {
    return this.fabrica.selector<Ubicacion>('ubicaciones');
  }
}
