/**
 * Comparar texto que una persona escribió.
 *
 * Vive en el núcleo porque **ya lo necesitan dos pantallas**: el alta de equipo, donde marca,
 * modelo y categoría se escriben y se crean si no están, y el expediente, donde el concepto de
 * un precio se escribe igual. Nació en `equipos.ts` el 2026-09-07 y se mudó aquí el 2026-09-09
 * en cuanto tuvo un segundo consumidor: un ayudante importado de una página a otra convierte a
 * esa página en librería sin que nadie lo haya decidido.
 */

/**
 * Si dos nombres son EL MISMO a ojos de quien los escribe: sin espacios de sobra, sin
 * distinguir mayúsculas y sin acentos.
 *
 * Los acentos se van con `NFD` + quitar diacríticos, no con una tabla de reemplazos: así
 * también caen la diéresis y la tilde de la ñ, que una tabla de cinco vocales dejaría fuera.
 *
 * **NO normaliza de más.** «320D» y «320» son distintos, y «Grúa torre» y «Grúa-torre» también:
 * borrar puntuación haría que dos catálogos legítimamente distintos se pisaran, que es peor que
 * pedir que se escriban igual.
 */
export function mismoNombre(a: string, b: string): boolean {
  const limpio = (x: string) =>
    x
      .trim()
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  return limpio(a) === limpio(b);
}

/** Lo que cabe en `tarifa.codigo`: el mismo `maxlength` que el campo del catálogo. */
const LARGO_CODIGO = 30;

/**
 * Un código a partir de un nombre escrito: «Renta por día» → `RENTA-POR-DIA`.
 *
 * **ES UNA SUGERENCIA, no el valor definitivo.** El campo queda editable, porque el código es
 * lo que la gente teclea para buscar y quien crea el concepto sabe mejor que esta función si
 * su casa lo llama `RENTA-DIA` o `RD`. Lo que evita es la fricción de teclear dos veces casi lo
 * mismo para dar de alta un concepto desde el expediente de una máquina.
 *
 * Mayúsculas sin acentos y un guion por cada tramo de lo que no sea letra o número. Se recorta
 * a lo que cabe en la columna: un código truncado por el servidor sería un 400 por algo que la
 * pantalla ya sabía.
 */
export function codigoDesdeNombre(nombre: string): string {
  return nombre
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LARGO_CODIGO)
    .replace(/-+$/, '');
}
