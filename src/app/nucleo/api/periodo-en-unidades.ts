import type { UnidadTarifa } from './contratos';

/** Las horas que dura cada unidad de tiempo. **Un mes son 30 días**, decisión del cliente. */
const HORAS: Readonly<Record<number, number>> = { 1: 1, 2: 24, 3: 24 * 7, 4: 24 * 30 };

/**
 * CUÁNTAS UNIDADES DA DE SÍ UN TRAMO DE TIEMPO.
 *
 * **ES EL ESPEJO DE `PeriodoEnUnidades` DEL SERVIDOR**, y hay que decirlo. Allí vive la versión
 * que decide lo que se cobra, con sus tres decisiones del cliente: **diferencia exacta con
 * decimales** —36 horas son 1.5 días, no 2—, **un mes son 30 días**, y **redondeo al alza en el
 * empate**, no el bancario.
 *
 * Aquí se repite para UN solo caso: enseñar lo que va a costar alargar una renta antes de
 * guardarlo. El periodo completo no hace falta duplicarlo —`RentaDto.UnidadesDelPeriodo` y
 * `CotizacionDto.UnidadesDelPeriodo` lo traen calculado— pero el tramo de una extensión
 * *(fin actual → fin nuevo)* no está en ningún DTO, porque solo existe mientras se teclea.
 *
 * Si los dos se separan, la pantalla dirá un número y se cobrará otro. De ahí que viva aquí, en
 * un solo sitio y con pruebas, en lugar de dentro del `computed` de una pantalla.
 *
 * **Cero cuando el tramo no avanza o la unidad no es de tiempo.** Evento y Kilómetro no se
 * cuentan con fechas: `UnidadTarifa` tiene seis valores y el CHECK `renta_unidad` limita el
 * documento a los cuatro primeros, pero eso lo sabe la base y no el tipo.
 */
export function unidadesEntre(desde: Date, hasta: Date, unidad: UnidadTarifa): number {
  const horasPorUnidad = HORAS[unidad];

  if (horasPorUnidad === undefined || hasta <= desde) {
    return 0;
  }

  const horas = (hasta.getTime() - desde.getTime()) / 3_600_000;

  // **`Math.round` Y NO `toFixed`**: `toFixed` devuelve texto y redondea a la representación
  // binaria más cercana, que para .005 da resultados que no coinciden con el `AwayFromZero` de
  // C#. Multiplicar, redondear y dividir es lo que sí coincide para valores positivos, que son
  // los únicos que llegan aquí — un tramo que no avanza ya salió arriba.
  return Math.round((horas / horasPorUnidad) * 100) / 100;
}
