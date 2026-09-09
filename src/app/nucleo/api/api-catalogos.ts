import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject, type Signal } from '@angular/core';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaMotivoMovimiento,
  FiltroListado,
  AltaCategoria,
  AltaClausula,
  AltaMarca,
  AltaModeloEquipo,
  AltaPuesto,
  AltaTarifa,
  AltaTipoTarifa,
  Categoria,
  Clausula,
  Marca,
  ModeloEquipo,
  MotivoMovimiento,
  Puesto,
  Tarifa,
  TipoTarifa,
} from './contratos';
import { FabricaDeRecursos, type Listado } from './recursos-rest';

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
 * Dos de ellos hacen eso último: un modelo cuelga de una marca y sugiere una categoría. Para
 * eso están `selectorMarcas()` y `selectorCategorias()`, recursos compartidos y perezosos.
 *
 * **Hubo un tercero, `selectorTipos()`, y se retiró el 2026-09-07 con la tabla `tipo_equipo`.**
 * El tipo era un nivel entre categoría y equipo que dejó de aportar cuando la categoría pasó a
 * ser columna del equipo; todo lo que lo usaba pasó a usar la categoría.
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
  readonly modelos = this.fabrica.recurso<ModeloEquipo, AltaModeloEquipo>('modelos-equipo');
  readonly tarifas = this.fabrica.recurso<Tarifa, AltaTarifa>('tarifas');
  readonly clausulas = this.fabrica.recurso<Clausula, AltaClausula>('clausulas');
  readonly puestos = this.fabrica.recurso<Puesto, AltaPuesto>('puestos');

  readonly tiposTarifa = this.fabrica.recurso<TipoTarifa, AltaTipoTarifa>('tipos-tarifa');

  /**
   * Los motivos de movimiento. Recurso completo, **pero las tres escrituras solo las acepta el
   * servidor si el token trae `acceso_total`**: son `[SoloAdministrador]`.
   *
   * Este servicio NO comprueba nada — la autorización es de la API. Quien decide si se dibuja
   * el botón es la pantalla, leyendo `identidad().accesoTotal`, y por el motivo de siempre: no
   * ofrecer acciones que el servidor va a rechazar.
   *
   * **Y hay una regla que la base impone y este recurso no puede evitar**: el `codigo` de los
   * nueve motivos de la semilla no se cambia y esas filas no se borran, porque es lo que
   * resuelven los movimientos automáticos. El nombre y la descripción sí. Un intento llega
   * como 409 con el motivo escrito.
   */
  readonly motivosMovimiento = this.fabrica.recurso<MotivoMovimiento, AltaMotivoMovimiento>(
    'motivos-movimiento',
  );

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

  /**
   * Los modelos activos, para el alta de equipo.
   *
   * De un modelo salen la MARCA y el TIPO ya resueltos en el DTO del equipo, asi que el
   * formulario no tiene que pedir la marca por separado.
   */
  selectorModelos(): Signal<readonly ModeloEquipo[]> {
    return this.fabrica.selector<ModeloEquipo>('modelos-equipo');
  }

  /** Los conceptos cobrables activos, para cargar un precio en el expediente de un equipo. */
  selectorTarifas(): Signal<readonly Tarifa[]> {
    return this.fabrica.selector<Tarifa>('tarifas');
  }

  /**
   * Los puestos activos, para el desplegable del alta de trabajador.
   *
   * Vive aqui y no en `ApiOrganizacion` porque su URL es `/api/catalogos/puestos`: el puesto
   * es un catalogo, aunque la pantalla que lo consume sea de organizacion.
   */
  selectorPuestos(): Signal<readonly Puesto[]> {
    return this.fabrica.selector<Puesto>('puestos');
  }

  /**
   * Los tres tipos activos que alimentan un desplegable de otra pantalla: el tipo de una
   * tarifa, de un cliente y de un proveedor.
   *
   * Son metodos por lo mismo que los demas selectores: la peticion sale cuando alguien los
   * pide, no al inyectar el servicio.
   */
  selectorTiposTarifa(): Signal<readonly TipoTarifa[]> {
    return this.fabrica.selector<TipoTarifa>('tipos-tarifa');
  }

  /**
   * Los motivos ACTIVOS, para el formulario de un movimiento — donde el motivo es
   * obligatorio.
   *
   * Solo activos: un motivo retirado sigue existiendo porque los movimientos viejos lo
   * referencian para siempre —la tabla es *append-only*—, pero ofrecerlo en un movimiento
   * nuevo sería ofrecer justo lo que se decidió dejar de usar.
   */
  selectorMotivosMovimiento(): Signal<readonly MotivoMovimiento[]> {
    return this.fabrica.selector<MotivoMovimiento>('motivos-movimiento');
  }

  /**
   * Las cláusulas ACTIVAS del catálogo, para elegir cuáles copia un contrato nuevo.
   *
   * Se ordenan por `orden` en el servidor —es el campo que dice en qué secuencia van dentro
   * del documento—, no alfabéticamente: una cláusula de penalización no va después de una de
   * «Anexos» solo porque la P siga a la A.
   */
  selectorClausulas(): Signal<readonly Clausula[]> {
    return this.fabrica.selectorFiltrado<Clausula>('clausulas', { Orden: 'orden' });
  }
}
