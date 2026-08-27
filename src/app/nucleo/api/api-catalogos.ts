import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject, type Signal } from '@angular/core';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaCategoria,
  AltaClausula,
  AltaMarca,
  AltaModeloEquipo,
  AltaPuesto,
  AltaTarifa,
  AltaTipoEquipo,
  Categoria,
  Clausula,
  Marca,
  ModeloEquipo,
  Puesto,
  Tarifa,
  TipoEquipo,
} from './contratos';
import { FabricaDeRecursos } from './recursos-rest';

export type { Listado, RecursoRest } from './recursos-rest';
export { aParametros } from './recursos-rest';

/**
 * Los catálogos de la empresa: los siete de la Fase 1, todos bajo `/api/catalogos`.
 *
 * La maquinaria —el listado como fábrica, la guarda de `hasValue()`, la doble recarga tras
 * una mutación— vive en `recursos-rest.ts`, porque ubicaciones y trabajadores tienen la misma
 * forma pero cuelgan de otra base. Aquí solo queda QUÉ recursos hay y cuáles alimentan un
 * desplegable de otra pantalla.
 *
 * Tres de ellos hacen eso último: un tipo cuelga de una categoría, y un modelo de una marca
 * y de un tipo. Para eso están `selectorMarcas()`, `selectorCategorias()` y `selectorTipos()`,
 * que son recursos compartidos y perezosos.
 */
@Injectable({ providedIn: 'root' })
export class ApiCatalogos {
  private readonly fabrica = new FabricaDeRecursos(
    inject(HttpClient),
    inject(Injector),
    `${configuracion.urlApi}/api/catalogos`,
  );

  readonly marcas = this.fabrica.recurso<Marca, AltaMarca>('marcas');
  readonly categorias = this.fabrica.recurso<Categoria, AltaCategoria>('categorias-equipo');
  readonly tipos = this.fabrica.recurso<TipoEquipo, AltaTipoEquipo>('tipos-equipo');
  readonly modelos = this.fabrica.recurso<ModeloEquipo, AltaModeloEquipo>('modelos-equipo');
  readonly tarifas = this.fabrica.recurso<Tarifa, AltaTarifa>('tarifas');
  readonly clausulas = this.fabrica.recurso<Clausula, AltaClausula>('clausulas');
  readonly puestos = this.fabrica.recurso<Puesto, AltaPuesto>('puestos');

  /**
   * Los tres que alimentan desplegables de otras pantallas.
   *
   * Son métodos y no campos para que la petición salga cuando alguien los pide, no al
   * inyectar el servicio: la pantalla de marcas no debe pedir las categorías. El detalle de
   * por qué eso necesita `runInInjectionContext` está en `FabricaDeRecursos.selector`.
   */
  selectorMarcas(): Signal<readonly Marca[]> {
    return this.fabrica.selector<Marca>('marcas');
  }

  selectorCategorias(): Signal<readonly Categoria[]> {
    return this.fabrica.selector<Categoria>('categorias-equipo');
  }

  selectorTipos(): Signal<readonly TipoEquipo[]> {
    return this.fabrica.selector<TipoEquipo>('tipos-equipo');
  }
}
