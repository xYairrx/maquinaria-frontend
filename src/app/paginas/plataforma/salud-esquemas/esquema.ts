import type { EmpresaEnSalud } from '../../../nucleo/api/contratos-plataforma';

/**
 * Cómo se lee el esquema de una empresa: su estado y su identificador de migración.
 *
 * Son funciones PURAS y viven aparte de la pantalla para poder probarlas sin navegador, y
 * porque las lee también el dashboard: la regla de los tres estados está escrita UNA vez.
 * Si se copiara, las dos copias acabarían discrepando justo en el caso raro.
 */

/**
 * Los TRES estados en que puede estar el esquema de una empresa.
 *
 * `sin-comparar` no es un «desfasada» suave ni un «al día» con dudas: es que **no se pudo
 * comparar**. Colapsarlo a dos estados esconde el caso peligroso —una base POR DELANTE del
 * código desplegado— porque se pinta igual que una base al día.
 */
export type EstadoEsquema = 'al-dia' | 'desfasada' | 'sin-comparar';

/**
 * El estado de esquema de una empresa, **tal como lo decide el backend**.
 *
 * No se recalcula nada: `desfasada` la manda el reporte y aquí solo se elige cuál de los
 * tres estados aplica. La regla de qué es estar atrasado vive en el backend a propósito.
 *
 * `versionReconocida: false` gana sobre todo lo demás, y ese es el único juicio que hace
 * esta función: con la versión sin reconocer —nula, o una migración que el binario no
 * conoce— `desfasada` y `migracionesPendientes` no dicen nada útil, así que pintarlos
 * sería afirmar un dato que nadie calculó. `versionAplicada: null` cae aquí también: no se
 * puede comparar contra nada, y que «nunca se migró» ya lo dice su propia celda.
 */
export function estadoDeEsquema(empresa: EmpresaEnSalud): EstadoEsquema {
  if (!empresa.versionReconocida) {
    return 'sin-comparar';
  }

  return empresa.desfasada ? 'desfasada' : 'al-dia';
}

/** Un identificador de migración, partido en fecha y nombre. */
export interface MigracionLegible {
  /** `2026-08-24 23:26:37`, o `null` si el identificador no lleva marca de tiempo. */
  readonly fecha: string | null;
  readonly nombre: string;
}

/** `20260824232637_EmpresaCatalogos` → las 14 cifras de la marca de tiempo y el nombre. */
const FORMATO = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_(.+)$/;

/**
 * Parte `20260824232637_EmpresaCatalogosOrganizacion` en `2026-08-24 23:26:37` y
 * `EmpresaCatalogosOrganizacion`.
 *
 * NO SE PIERDE NI UN CARÁCTER, y por eso no hace falta ningún globo con el valor crudo al
 * lado: reagrupar las catorce cifras en fecha y hora es reversible, y el nombre va tal
 * cual. Un identificador de 43 caracteres en una celda de tabla no se lee; en dos líneas,
 * sí.
 *
 * Y NO se formatea con `DatePipe`: esas cifras no son un instante en una zona horaria, son
 * parte de un identificador. Pasarlas por el locale las movería de día en México (UTC-6) y
 * el nombre del archivo de migración dejaría de coincidir con lo que se ve en pantalla.
 *
 * Un identificador que no lleve la marca de tiempo —no debería pasar, pero renombrar
 * migraciones a mano es posible— se devuelve entero como nombre en lugar de partirse mal.
 */
export function migracionLegible(identificador: string): MigracionLegible {
  const partes = FORMATO.exec(identificador);

  if (partes === null) {
    return { fecha: null, nombre: identificador };
  }

  const [, anio, mes, dia, hora, minuto, segundo, nombre] = partes;

  return { fecha: `${anio}-${mes}-${dia} ${hora}:${minuto}:${segundo}`, nombre };
}
