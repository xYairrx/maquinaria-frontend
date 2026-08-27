import { HttpClient, httpResource } from '@angular/common/http';
import {
  Injectable,
  Injector,
  computed,
  inject,
  runInInjectionContext,
  type Signal,
} from '@angular/core';
import { type Observable, tap } from 'rxjs';

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
  FiltroListado,
  Marca,
  ModeloEquipo,
  Pagina,
  Puesto,
  Tarifa,
  TipoEquipo,
} from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';

/** Cuánto trae un selector. El techo del servidor es 200 y un catálogo no llega ahí. */
const TAMANO_SELECTOR = 200;

/**
 * Un listado paginado, ya en señales.
 *
 * `httpResource` no sale de este archivo: está marcado `@experimental` en Angular y si su
 * API cambia, cambia un archivo y no dieciocho pantallas. Ver
 * `docs/convenciones.md#datos-httpresource-y-el-recurso-compartido`.
 */
export interface Listado<T> {
  /** Las filas de la página actual. Vacío mientras carga y si falla. **Nunca lanza.** */
  readonly filas: Signal<readonly T[]>;
  /** El conteo COMPLETO que cumple el filtro, no el de esta página. */
  readonly total: Signal<number>;
  readonly paginas: Signal<number>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  /** Vuelve a pedir la página actual. Lo usan las mutaciones. */
  readonly recargar: () => void;
}

/**
 * Las cuatro operaciones que comparten los siete catálogos.
 *
 * SE ABSTRAJERON LAS OPERACIONES, NO LA PANTALLA, y esa línea es la que importa. Los siete
 * se parecen en la FORMA de lo que se les hace —listar paginado, crear, editar, retirar—
 * pero no en sus campos: `AltaMarca` tiene uno, `AltaCategoria` tiene tres,
 * `AltaModeloEquipo` cuelga de dos llaves foráneas y `AltaTarifa` lleva un enum y dos
 * banderas. Un componente genérico de catálogo tendría que reinventar un formulario a
 * partir de metadatos; este tipo genérico solo mueve `TDto` y `TAlta` por cuatro URLs.
 *
 * Y se escribió con SIETE ejemplos delante, no con uno. La advertencia de §10.5 del plan
 * del backend —«no abstraer con un solo ejemplo escrito»— era sobre eso.
 */
export interface Catalogo<TDto, TAlta> {
  /** Conecta una pantalla con SU filtro. Ver la nota de `armarCatalogo`. */
  listado(filtro: Signal<FiltroListado>): Listado<TDto>;
  crear(alta: TAlta): Observable<TDto>;
  editar(id: string, alta: TAlta): Observable<TDto>;
  /** Retirar NO borra: ningún catálogo tiene borrado lógico, así que no hay `DELETE`. */
  cambiarActivo(id: string, activo: boolean): Observable<TDto>;
}

/**
 * Los catálogos de la empresa: los siete de la Fase 1.
 *
 * Tres de ellos alimentan desplegables de otros: un tipo cuelga de una categoría, y un
 * modelo de una marca y de un tipo. Para eso están `selectorMarcas()`,
 * `selectorCategorias()` y `selectorTipos()`, que son recursos compartidos y perezosos.
 */
@Injectable({ providedIn: 'root' })
export class ApiCatalogos {
  private readonly http = inject(HttpClient);
  private readonly inyector = inject(Injector);
  private readonly base = `${configuracion.urlApi}/api/catalogos`;

  /**
   * Cómo recargar el listado montado de cada recurso, y cómo recargar su selector.
   *
   * Son dos mapas y no uno porque tienen ciclos de vida distintos: el del listado se
   * SUSTITUYE cada vez que una pantalla se monta —solo hay una viva por catálogo— mientras
   * que el del selector se registra una vez, con el recurso compartido, y vive lo que viva
   * el servicio. Acumularlos en un conjunto filtraría cierres sobre recursos ya destruidos.
   */
  private readonly recargarListado = new Map<string, () => void>();
  private readonly recargarSelector = new Map<string, () => void>();

  readonly marcas = this.armarCatalogo<Marca, AltaMarca>('marcas');
  readonly categorias = this.armarCatalogo<Categoria, AltaCategoria>('categorias-equipo');
  readonly tipos = this.armarCatalogo<TipoEquipo, AltaTipoEquipo>('tipos-equipo');
  readonly modelos = this.armarCatalogo<ModeloEquipo, AltaModeloEquipo>('modelos-equipo');
  readonly tarifas = this.armarCatalogo<Tarifa, AltaTarifa>('tarifas');
  readonly clausulas = this.armarCatalogo<Clausula, AltaClausula>('clausulas');
  readonly puestos = this.armarCatalogo<Puesto, AltaPuesto>('puestos');

  // --------------------------------------------------------------- selectores --
  //
  // Solo lo ACTIVO, ordenado por nombre: es lo que se ofrece al capturar. Una fila retirada
  // sigue en el catálogo y en los registros que ya la usan, pero no debe poder elegirse de
  // nuevo.

  /** Los desplegables ya creados, por recurso. Ver `selector`. */
  private readonly selectores = new Map<string, Signal<readonly unknown[]>>();

  /** Las marcas activas, para el desplegable de modelos y, más adelante, el de equipos. */
  selectorMarcas(): Signal<readonly Marca[]> {
    return this.selector<Marca>('marcas');
  }

  /** Las categorías activas, para el desplegable de tipos. */
  selectorCategorias(): Signal<readonly Categoria[]> {
    return this.selector<Categoria>('categorias-equipo');
  }

  /** Los tipos activos, para el desplegable de modelos. */
  selectorTipos(): Signal<readonly TipoEquipo[]> {
    return this.selector<TipoEquipo>('tipos-equipo');
  }

  /**
   * El desplegable de un catálogo: compartido y **perezoso**.
   *
   * COMPARTIDO porque no depende de parámetros de pantalla y lo leen varias: dos pantallas
   * que pidan las marcas activas hacen UNA petición entre las dos. Ese es el criterio de
   * `convenciones.md` para un recurso de servicio.
   *
   * PEREZOSO porque solo dos de las siete pantallas de catálogo usan un desplegable —tipos
   * necesita categorías, y modelos necesita marcas y tipos—. Creándolos como campos, entrar
   * a Marcas o a Puestos disparaba tres peticiones que esa pantalla no mira.
   *
   * SE CREA EN EL INYECTOR DEL SERVICIO, no en el de la pantalla que lo pide primero. Es la
   * parte que no se ve: un `httpResource` creado en el contexto de un componente **muere con
   * él**, así que el segundo que lo pidiera heredaría un recurso destruido. Como el servicio
   * es `providedIn: 'root'`, su inyector vive lo que la aplicación.
   */
  private selector<TDto>(recurso: string): Signal<readonly TDto[]> {
    const guardado = this.selectores.get(recurso);

    if (guardado !== undefined) {
      return guardado as Signal<readonly TDto[]>;
    }

    const senal = runInInjectionContext(this.inyector, () => this.armarSelector<TDto>(recurso));

    this.selectores.set(recurso, senal as Signal<readonly unknown[]>);

    return senal;
  }

  /**
   * Arma las cuatro operaciones de un catálogo sobre su recurso.
   *
   * El listado ES UNA FÁBRICA y no un campo, y la diferencia no es de estilo: el recurso se
   * crea dentro, cerrando sobre la señal del filtro, así que su primera ejecución ya la lee
   * y queda suscrito. Con el recurso como campo del servicio y el filtro asignado después,
   * la primera ejecución no lee ninguna señal y **el recurso queda inerte para siempre** —
   * ese fallo ya pasó, y `api-catalogos.spec.ts` lo tiene clavado.
   */
  private armarCatalogo<TDto, TAlta>(recurso: string): Catalogo<TDto, TAlta> {
    const url = `${this.base}/${recurso}`;

    // Tras una mutación se recargan las DOS lecturas del recurso: la tabla que se está
    // viendo y el selector que lo ofrece en otras pantallas. Sin lo segundo, crear una marca
    // no la haría aparecer en el desplegable de modelos hasta recargar la página.
    const conRecarga = <T>(peticion: Observable<T>): Observable<T> =>
      peticion.pipe(
        tap(() => {
          this.recargarListado.get(recurso)?.();
          this.recargarSelector.get(recurso)?.();
        }),
      );

    return {
      listado: (filtro: Signal<FiltroListado>): Listado<TDto> => {
        const rec = httpResource<Pagina<TDto>>(() => ({
          url,
          params: aParametros(filtro()),
        }));

        this.recargarListado.set(recurso, () => rec.reload());

        return {
          // `hasValue()` y no `value()` directo: leer `value()` con el recurso en estado de
          // error LANZA un `ResourceValueError`, y las pantallas leen estas señales dentro
          // de efectos sin guarda. Hay prueba de regresión del caso equivalente en
          // `api-plataforma.spec.ts`: no lo «simplifiques».
          filas: computed(() => (rec.hasValue() ? rec.value().filas : [])),
          total: computed(() => (rec.hasValue() ? rec.value().total : 0)),
          paginas: computed(() => (rec.hasValue() ? rec.value().paginas : 0)),
          cargando: rec.isLoading,
          error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
          recargar: () => rec.reload(),
        };
      },

      crear: (alta: TAlta) => conRecarga(this.http.post<TDto>(url, alta)),

      editar: (id: string, alta: TAlta) =>
        conRecarga(this.http.put<TDto>(`${url}/${encodeURIComponent(id)}`, alta)),

      cambiarActivo: (id: string, activo: boolean) =>
        conRecarga(
          this.http.patch<TDto>(`${url}/${encodeURIComponent(id)}/activo`, { activo }),
        ),
    };
  }

  /**
   * La lista de lo ACTIVO de un catálogo, para poblar un desplegable.
   *
   * Es un recurso COMPARTIDO —campo del servicio, no fábrica— y aquí sí corresponde: no
   * depende de parámetros de pantalla y lo leen varias. Dos pantallas que pidan las marcas
   * activas hacen UNA petición entre las dos.
   *
   * Se pide de una sola vez con el techo del servidor. Paginar un desplegable sería peor
   * experiencia que el problema que resuelve, y ningún catálogo de estos llega a 200.
   */
  private armarSelector<TDto>(recurso: string): Signal<readonly TDto[]> {
    const rec = httpResource<Pagina<TDto>>(() => ({
      url: `${this.base}/${recurso}`,
      params: { Activo: true, Tamano: TAMANO_SELECTOR, Orden: 'nombre' },
    }));

    this.recargarSelector.set(recurso, () => rec.reload());

    return computed(() => (rec.hasValue() ? rec.value().filas : []));
  }
}

/**
 * El filtro, a parámetros de consulta.
 *
 * Se omite lo que no tiene valor en lugar de mandarlo vacío, y eso importa en `Activo`:
 * `?Activo=` no es lo mismo que no mandarlo. Ausente significa «activos e inactivos»;
 * presente en `false` significa «solo los retirados».
 *
 * `false` SÍ se manda: la comparación es contra `undefined`, `null` y cadena vacía, nunca
 * contra falsy. Un `if (valor)` habría tirado el filtro de retiradas.
 */
export function aParametros(filtro: FiltroListado): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {};

  for (const [clave, valor] of Object.entries(filtro)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      params[clave] = valor as string | number | boolean;
    }
  }

  return params;
}
