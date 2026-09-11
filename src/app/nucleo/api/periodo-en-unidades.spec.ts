import { describe, expect, it } from 'vitest';

import type { UnidadTarifa } from './contratos';
import { unidadesEntre } from './periodo-en-unidades';

/**
 * CUÁNTAS UNIDADES SE COBRAN DE UN TRAMO DE TIEMPO.
 *
 * **Espejo de `PeriodoEnUnidades` del servidor**, que es la única razón por la que se prueba: si
 * los dos se separan, la pantalla enseña lo que va a costar alargar una renta y se cobra otra
 * cosa. La prueba no puede comparar los dos lados —están en repos distintos— pero fija este,
 * para que un cambio aquí sea deliberado.
 *
 * Las tres decisiones del cliente, del 2026-09-09:
 *
 * 1. **Diferencia exacta con decimales.** 36 horas son 1.5 días, no 2. Es lo contrario de
 *    «cualquier fracción cuenta como una unidad entera», que fue la alternativa descartada.
 * 2. **Un mes son 30 días**, y una semana 7. No meses de calendario.
 * 3. **Dos decimales**, redondeando al alza en el empate.
 */
const HORA: UnidadTarifa = 1;
const DIA: UnidadTarifa = 2;
const SEMANA: UnidadTarifa = 3;
const MES: UnidadTarifa = 4;
const EVENTO: UnidadTarifa = 5;

/** Un tramo de `horas` a partir de una fecha fija, para no depender del reloj. */
function tramo(horas: number): [Date, Date] {
  const desde = new Date('2026-09-01T00:00:00Z');

  return [desde, new Date(desde.getTime() + horas * 3_600_000)];
}

describe('unidadesEntre', () => {
  it('cuenta la diferencia EXACTA, con decimales', () => {
    // El caso que fijó la decisión: día y medio es 1.5, no 2.
    expect(unidadesEntre(...tramo(36), DIA)).toBe(1.5);
    expect(unidadesEntre(...tramo(61), DIA)).toBe(2.54);
    expect(unidadesEntre(...tramo(24), DIA)).toBe(1);
  });

  it('un mes son 30 días y una semana 7', () => {
    expect(unidadesEntre(...tramo(24 * 30), MES)).toBe(1);
    expect(unidadesEntre(...tramo(24 * 45), MES)).toBe(1.5);
    expect(unidadesEntre(...tramo(24 * 7), SEMANA)).toBe(1);
    expect(unidadesEntre(...tramo(24 * 10), SEMANA)).toBe(1.43);
  });

  it('las horas se cuentan una a una', () => {
    expect(unidadesEntre(...tramo(5), HORA)).toBe(5);
    expect(unidadesEntre(...tramo(0.5), HORA)).toBe(0.5);
  });

  it('un tramo que no avanza da cero', () => {
    // Es lo que pasa mientras se teclea la fecha nueva: el campo vale menos que el fin actual.
    expect(unidadesEntre(...tramo(0), DIA)).toBe(0);
    expect(unidadesEntre(...tramo(-48), DIA)).toBe(0);
  });

  it('las unidades que no son de tiempo dan cero', () => {
    // Un flete por evento no se cuenta con fechas. El documento no puede llevarlas —el CHECK
    // `renta_unidad` es 1..4— pero el tipo sí.
    expect(unidadesEntre(...tramo(48), EVENTO)).toBe(0);
  });
});
