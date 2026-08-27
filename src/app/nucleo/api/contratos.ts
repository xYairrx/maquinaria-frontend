/**
 * Los tipos de la API, con nombres del dominio.
 *
 * ESTE ES EL ARCHIVO QUE SE MANEJA A MANO. Los de abajo, los de sesión, siguen escritos
 * aquí; los de negocio se RE-EXPORTAN de `generado.ts`, que produce `npm run api:sync`
 * desde `/openapi/v1.json` y **no se edita nunca**.
 *
 * Por qué la capa intermedia y no importar el generado desde cada pantalla:
 *
 * - Los nombres del generado son los del servidor —`MarcaDto`, `PaginaOfMarcaDto`— y
 *   arrastran su sufijo técnico a veintiocho pantallas.
 * - Si el backend renombra un DTO, **rompe aquí y en un solo sitio**, no repartido.
 * - `generado.ts` son ~9,100 líneas de máquina. Que nadie tenga que abrirlo es el punto.
 *
 * Los de sesión se quedan a mano por ahora; pasarlos al generado es lo que cierra el
 * pendiente 18. Ver `docs/plan-fase1-front.md` §6.
 */

import type { components } from './generado';

// ------------------------------------------------------------------ listados --

/**
 * Lo que acepta TODO listado de la API. Se enlaza con `[FromQuery]`, así que los nombres
 * llevan mayúscula inicial: son los de la cadena de consulta, no los de C#.
 *
 * `Activo` nulo NO es lo mismo que `false`: nulo trae activos e inactivos.
 *
 * `Tamano` tiene techo de 200 en el servidor, y no es preferencia de interfaz sino su
 * defensa: sin él, `?Tamano=1000000` trae la tabla entera. La pantalla no ofrece
 * «mostrar todos».
 */
export interface FiltroListado {
  readonly Texto?: string;
  readonly Activo?: boolean;
  readonly IncluirEliminados?: boolean;
  /** Base 1, como lo cuenta la gente. */
  readonly Numero?: number;
  readonly Tamano?: number;
  readonly Orden?: string;
  readonly Descendente?: boolean;
}

/**
 * Los filtros propios de cada módulo.
 *
 * El backend los declara heredando de `Filtro` —`FiltroTarifas`, `FiltroTiposEquipo`…— y
 * aquí se reproduce esa herencia en lugar de meter todos los campos en `FiltroListado`.
 * Con un tipo único, la pantalla de marcas aceptaría `AplicaRenta` sin que nada la corrija.
 *
 * Los nombres van con mayúscula inicial porque son los de la cadena de consulta, igual que
 * en `FiltroListado`.
 */
export interface FiltroTarifas extends FiltroListado {
  readonly AplicaRenta?: boolean;
  readonly AplicaVenta?: boolean;
  readonly Unidad?: UnidadTarifa;
}

export interface FiltroTiposEquipo extends FiltroListado {
  readonly CategoriaEquipoId?: string;
}

export interface FiltroModelosEquipo extends FiltroListado {
  readonly MarcaId?: string;
  readonly TipoEquipoId?: string;
}

export interface FiltroClausulas extends FiltroListado {
  readonly Obligatoria?: boolean;
}

/**
 * Una página de resultados.
 *
 * `total` es el conteo COMPLETO de las filas que cumplen el filtro, no las de esta
 * página: es lo que permite pintar «51-100 de 3,842». Cuesta un `COUNT` extra en el
 * servidor y se paga a propósito.
 *
 * Una página vacía es un **200 con `filas: []`**, nunca un 404.
 */
export interface Pagina<T> {
  readonly filas: readonly T[];
  readonly numero: number;
  readonly tamano: number;
  readonly total: number;
  readonly paginas: number;
}

// ------------------------------------------------------------------ catalogos --

/** Una marca de maquinaria: Caterpillar, Komatsu, JCB. */
export type Marca = components['schemas']['MarcaDto'];

/**
 * El alta de una marca. UN SOLO CAMPO: su identidad *es* el nombre, con `UNIQUE` encima.
 *
 * Sale opcional del generado —`{ nombre?: string }`— porque el DTO del servidor es un
 * `readonly record struct` y .NET no marca requeridos sus miembros. El formulario lo
 * exige de todos modos, y el servidor también.
 */
export type AltaMarca = components['schemas']['AltaMarca'];

/** El cuerpo del `PATCH .../activo`. Lo comparten los siete catálogos. */
export type CambioDeActivo = components['schemas']['CambioDeActivoCatalogo'];

/** Categoría de equipo: excavación, carga, compactación. De ella cuelgan los tipos. */
export type Categoria = components['schemas']['CategoriaEquipoDto'];
export type AltaCategoria = components['schemas']['AltaCategoriaEquipo'];

/** Tipo de equipo: excavadora, retroexcavadora. Cuelga de una categoría. */
export type TipoEquipo = components['schemas']['TipoEquipoDto'];
export type AltaTipoEquipo = components['schemas']['AltaTipoEquipo'];

/** Modelo: el 320D de Caterpillar. Cuelga de una marca y, opcionalmente, de un tipo. */
export type ModeloEquipo = components['schemas']['ModeloEquipoDto'];
export type AltaModeloEquipo = components['schemas']['AltaModeloEquipo'];

/**
 * Un concepto cobrable: renta por día, flete, limpieza.
 *
 * `unidad` llega como número. Los nombres de cada valor están en el `@description` del tipo
 * generado, que los toma del enum de C#: 1 Hora · 2 Día · 3 Semana · 4 Mes · 5 Evento ·
 * 6 Kilómetro.
 */
export type Tarifa = components['schemas']['TarifaDto'];
export type AltaTarifa = components['schemas']['AltaTarifa'];
export type UnidadTarifa = components['schemas']['UnidadTarifa'];

/** Cláusula de contrato, del catálogo que se engancha a cada contrato. */
export type Clausula = components['schemas']['ClausulaDto'];
export type AltaClausula = components['schemas']['AltaClausula'];

/** Puesto de trabajo. De él cuelgan los trabajadores. */
export type Puesto = components['schemas']['PuestoDto'];
export type AltaPuesto = components['schemas']['AltaPuesto'];

// -------------------------------------------------------------------- sesion --

export interface InvitacionVigente {
  readonly correo: string;
  readonly nombre: string;
  /** Razón social, para mostrar a qué empresa se está entrando. */
  readonly empresa: string;
}

/**
 * La respuesta 202 de pedir un restablecimiento.
 *
 * `mensaje` es SIEMPRE el mismo texto, exista o no la cuenta: el backend lo construye
 * una sola vez para que las dos respuestas sean idénticas byte a byte. La pantalla lo
 * muestra tal cual y no lo interpreta; si lo tradujera a «te mandamos el correo», el
 * formulario pasaría a decir qué correos están registrados.
 */
export interface RestablecimientoSolicitado {
  readonly mensaje: string;
}

/** Lo que devuelve definir la contraseña nueva. */
export interface RestablecimientoAplicado {
  readonly correo: string;
  /** El slug. */
  readonly empresa: string;
}

export interface SesionEmpresa {
  readonly token: string;
  readonly expiraEn: string;
  readonly tokenRefresco: string;
  readonly nombre: string;
  readonly correo: string;
  /** El slug. */
  readonly empresa: string;
  readonly accesoTotal: boolean;
  readonly permisos: readonly string[];
}

export interface IdentidadEmpresa {
  readonly correo: string;
  readonly nombre: string;
  readonly empresa: string;
  readonly razonSocial: string;
  readonly accesoTotal: boolean;
  readonly permisos: readonly string[];
  /** Módulos que incluye el plan contratado. La interfaz oculta lo que no está. */
  readonly modulos: readonly string[];
}

/** Lo que devuelve la API en cualquier error, por `AddProblemDetails`. */
export interface DetalleProblema {
  /**
   * Los errores por campo de un `ValidationProblemDetails`. Solo vienen en los 400 que
   * genera el enlace de modelo de ASP.NET; los rechazos de negocio traen `detail`.
   */
  readonly errors?: Readonly<Record<string, readonly string[]>>;
  readonly title?: string;
  readonly detail?: string;
  readonly status?: number;
}
