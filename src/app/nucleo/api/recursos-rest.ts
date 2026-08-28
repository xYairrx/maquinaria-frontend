import { HttpClient, httpResource } from '@angular/common/http';
import { Injector, computed, runInInjectionContext, type Signal } from '@angular/core';
import { type Observable, tap } from 'rxjs';

import type { FiltroListado, Pagina } from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';

/** Cuánto trae un selector. El techo del servidor es 200 y ninguno de estos llega ahí. */
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
 * Las cuatro operaciones de un recurso con retiro lógico.
 *
 * SE ABSTRAJERON LAS OPERACIONES, NO LA PANTALLA, y esa línea es la que importa. Los recursos
 * que la usan se parecen en la FORMA de lo que se les hace —listar paginado, crear, editar,
 * retirar— pero no en sus campos: `AltaMarca` tiene uno, `AltaModeloEquipo` cuelga de dos
 * llaves foráneas y `AltaUbicacion` lleva un enum y un par de coordenadas. Un componente
 * genérico tendría que reinventar un formulario a partir de metadatos; este tipo genérico
 * solo mueve `TDto` y `TAlta` por cuatro URLs.
 *
 * Y se escribió con SIETE ejemplos delante, no con uno. La advertencia de §10.5 del plan del
 * backend —«no abstraer con un solo ejemplo escrito»— era sobre eso.
 */
export interface RecursoRest<TDto, TAlta> {
  /** Conecta una pantalla con SU filtro. Ver la nota de `recurso`. */
  listado(filtro: Signal<FiltroListado>): Listado<TDto>;
  crear(alta: TAlta): Observable<TDto>;
  editar(id: string, alta: TAlta): Observable<TDto>;
  /** Retirar NO borra: estos recursos no tienen borrado físico, así que no hay `DELETE`. */
  cambiarActivo(id: string, activo: boolean): Observable<TDto>;
}

/**
 * La maquinaria que comparten los servicios de recursos con esta forma.
 *
 * Vive aparte porque la API no está toda bajo el mismo prefijo: los siete catálogos cuelgan
 * de `/api/catalogos`, mientras que ubicaciones y trabajadores cuelgan de la raíz. Copiar
 * este archivo con otra base habría duplicado las tres reglas delicadas de abajo —la fábrica,
 * la guarda de `hasValue()` y la doble recarga— y las copias se separan.
 *
 * Cada servicio construye **su propia** fábrica, así que cada uno tiene sus mapas de recarga
 * y no hay colisión de nombres entre `marcas` y un futuro recurso homónimo de otra base.
 */
export class FabricaDeRecursos {
  /**
   * Cómo recargar el listado montado de cada recurso, y cómo recargar su selector.
   *
   * Son dos mapas y no uno porque tienen ciclos de vida distintos: el del listado se
   * SUSTITUYE cada vez que una pantalla se monta —solo hay una viva por recurso— mientras
   * que el del selector se registra una vez, con el recurso compartido, y vive lo que viva
   * el servicio. Acumularlos en un conjunto filtraría cierres sobre recursos ya destruidos.
   */
  private readonly recargarListado = new Map<string, () => void>();
  private readonly recargarSelector = new Map<string, () => void>();

  /** Los selectores se crean la primera vez que alguien los pide, no al arrancar. */
  private readonly selectores = new Map<string, Signal<readonly unknown[]>>();

  constructor(
    private readonly http: HttpClient,
    private readonly inyector: Injector,
    private readonly base: string,
  ) {}

  /**
   * Arma las cuatro operaciones de un recurso.
   *
   * El listado ES UNA FÁBRICA y no un campo, y la diferencia no es de estilo: el recurso se
   * crea dentro, cerrando sobre la señal del filtro, así que su primera ejecución ya la lee
   * y queda suscrito. Con el recurso como campo del servicio y el filtro asignado después,
   * la primera ejecución no lee ninguna señal y **el recurso queda inerte para siempre** —
   * ese fallo ya pasó, y `api-catalogos.spec.ts` lo tiene clavado.
   */
  recurso<TDto, TAlta>(nombre: string): RecursoRest<TDto, TAlta> {
    const url = `${this.base}/${nombre}`;

    // Tras una mutación se recargan las DOS lecturas del recurso: la tabla que se está
    // viendo y el selector que lo ofrece en otras pantallas. Sin lo segundo, crear una marca
    // no la haría aparecer en el desplegable de modelos hasta recargar la página.
    const conRecarga = <T>(peticion: Observable<T>): Observable<T> =>
      peticion.pipe(
        tap(() => {
          this.recargarListado.get(nombre)?.();
          this.recargarSelector.get(nombre)?.();
        }),
      );

    return {
      listado: (filtro: Signal<FiltroListado>): Listado<TDto> => {
        const rec = httpResource<Pagina<TDto>>(() => ({
          url,
          params: aParametros(filtro()),
        }));

        this.recargarListado.set(nombre, () => rec.reload());

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
        conRecarga(this.http.patch<TDto>(`${url}/${encodeURIComponent(id)}/activo`, { activo })),
    };
  }

  /**
   * Un PATCH que NO es una de las cuatro operaciones, pero que muta y por tanto tiene que
   * recargar lo mismo que ellas.
   *
   * EXISTE PARA NO GENERALIZAR `cambiarActivo`. El primer caso es el estado de un trabajador:
   * tres valores en vez de un booleano, y con una fecha obligatoria cuando es Baja. Meter eso
   * en `RecursoRest` le cargaría a las ocho pantallas que hoy solo apagan y encienden un caso
   * que ninguna tiene, y la advertencia de §10.5 del plan del backend —no abstraer con un solo
   * ejemplo escrito— aplica igual aquí.
   *
   * Lo que sí se comparte es la PLOMERÍA: los dos mapas de recarga son privados, así que sin
   * este método cada servicio reimplementaría la doble recarga, y las copias se separan.
   *
   * @param ruta Relativa a la base, con el id ya codificado. Ej: `trabajadores/<id>/estado`.
   * @param recargar Nombre del recurso cuyo listado y selector hay que recargar.
   */
  parcheo<T>(
    ruta: string,
    cuerpo: unknown,
    opciones: { readonly recargar: string },
  ): Observable<T> {
    return this.http.patch<T>(`${this.base}/${ruta}`, cuerpo).pipe(
      tap(() => {
        this.recargarListado.get(opciones.recargar)?.();
        this.recargarSelector.get(opciones.recargar)?.();
      }),
    );
  }

  /**
   * Un POST a una SUBRUTA del recurso, que también muta y también tiene que recargar.
   *
   * El hermano de `parcheo`, y por la misma razón: los dos mapas de recarga son privados.
   * El primer caso es la línea de una cotización —`POST cotizaciones/<id>/lineas`—, que no es
   * el alta del recurso sino el alta de algo DENTRO de él, y que cambia el total del documento
   * y por tanto lo que muestra el listado.
   *
   * No confundir con `RecursoRest.crear`: ese da de alta el recurso en su colección y devuelve
   * el recurso. Este devuelve la COSA CREADA DENTRO, que suele ser de otro tipo.
   *
   * @param ruta Relativa a la base, con el id ya codificado. Ej: `cotizaciones/<id>/lineas`.
   * @param recargar Nombre del recurso cuyo listado y selector hay que recargar.
   */
  publicar<T>(
    ruta: string,
    cuerpo: unknown,
    opciones: { readonly recargar: string },
  ): Observable<T> {
    return this.http.post<T>(`${this.base}/${ruta}`, cuerpo).pipe(
      tap(() => {
        this.recargarListado.get(opciones.recargar)?.();
        this.recargarSelector.get(opciones.recargar)?.();
      }),
    );
  }

  /**
   * El borrado LOGICO de un recurso que si lo tiene.
   *
   * NO ESTA EN `RecursoRest` A PROPOSITO. De las entidades de esta fase solo `equipo`,
   * `archivo` y `tenant` tienen borrado logico; el resto se retiran con `PATCH .../activo` o
   * `.../estado` y **no tienen DELETE**. Ponerlo en la interfaz comun ofreceria a diecisiete
   * pantallas una operacion que su endpoint no expone.
   *
   * Devuelve `void`: el servidor contesta 204 sin cuerpo. Y puede contestar **409** —el equipo
   * tiene calendario ocupado—, que la pantalla debe explicar en lugar de convertirlo en un
   * «error al guardar» generico.
   */
  borrar(ruta: string, opciones: { readonly recargar: string }): Observable<void> {
    return this.http.delete<void>(`${this.base}/${ruta}`).pipe(
      tap(() => {
        this.recargarListado.get(opciones.recargar)?.();
        this.recargarSelector.get(opciones.recargar)?.();
      }),
    );
  }
  /**
   * La lista de lo ACTIVO de un recurso, para poblar un desplegable.
   *
   * PEREZOSO A PROPÓSITO. Un `httpResource` se crea en contexto de inyección, así que como
   * campo del servicio se crearía —y pediría— al inyectarlo, aunque la pantalla no use ese
   * desplegable. Creándolo aquí, la petición sale la primera vez que alguien lo pide, y
   * `runInInjectionContext` es lo que lo permite fuera del constructor.
   *
   * Es COMPARTIDO: dos pantallas que pidan las marcas activas hacen UNA petición entre las
   * dos, porque el servicio es `providedIn: 'root'` y la señal queda memorizada.
   */
  selector<TDto>(nombre: string): Signal<readonly TDto[]> {
    const guardado = this.selectores.get(nombre);

    if (guardado !== undefined) {
      return guardado as Signal<readonly TDto[]>;
    }

    const senal = runInInjectionContext(this.inyector, () => this.armarSelector<TDto>(nombre));

    this.selectores.set(nombre, senal as Signal<readonly unknown[]>);

    return senal;
  }

  /**
   * Un selector RECORTADO por un filtro extra del servidor.
   *
   * `selector()` trae todo lo activo, que es lo que quieren casi todos los desplegables. Este
   * existe para los que NO: el destino de un traspaso solo admite ubicaciones que almacenan
   * —una sucursal cotiza, no guarda maquinas— y ese recorte lo hace el SERVIDOR con
   * `AlmacenaEquipo`, no un `filter` en memoria sobre la lista completa.
   *
   * La clave de memorizacion incluye los parametros, o dos desplegables del mismo recurso con
   * filtros distintos se pisarian el uno al otro.
   */
  selectorFiltrado<TDto>(
    nombre: string,
    extra: Record<string, string | number | boolean>,
  ): Signal<readonly TDto[]> {
    const clave = `${nombre}?${JSON.stringify(extra)}`;
    const guardado = this.selectores.get(clave);

    if (guardado !== undefined) {
      return guardado as Signal<readonly TDto[]>;
    }

    const senal = runInInjectionContext(this.inyector, () => {
      const rec = httpResource<Pagina<TDto>>(() => ({
        url: `${this.base}/${nombre}`,
        params: { Activo: true, Tamano: TAMANO_SELECTOR, Orden: 'nombre', ...extra },
      }));

      this.recargarSelector.set(clave, () => rec.reload());

      return computed(() => (rec.hasValue() ? rec.value().filas : []));
    });

    this.selectores.set(clave, senal as Signal<readonly unknown[]>);

    return senal;
  }
  /**
   * Se pide de una sola vez con el techo del servidor. Paginar un desplegable sería peor
   * experiencia que el problema que resuelve, y ninguno de estos recursos llega a 200.
   */
  private armarSelector<TDto>(nombre: string): Signal<readonly TDto[]> {
    const rec = httpResource<Pagina<TDto>>(() => ({
      url: `${this.base}/${nombre}`,
      params: { Activo: true, Tamano: TAMANO_SELECTOR, Orden: 'nombre' },
    }));

    this.recargarSelector.set(nombre, () => rec.reload());

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
