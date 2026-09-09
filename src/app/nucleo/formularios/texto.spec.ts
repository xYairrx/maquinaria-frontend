import { describe, expect, it } from 'vitest';

import { codigoDesdeNombre, mismoNombre } from './texto';

/**
 * LO QUE SOSTIENE «ESCRIBIR Y QUE SE CREE SI NO EXISTE».
 *
 * Desde el 2026-09-07 el modelo y la categoría del alta de un equipo son campos de TEXTO con
 * `datalist`, y desde el 2026-09-09 también el concepto de un precio en el expediente: se
 * teclea, el navegador filtra, y si lo escrito no está en el catálogo se crea al guardar.
 *
 * **El riesgo es el duplicado.** «Excavadora», «excavadora» y «Excavadora » son el mismo
 * concepto y tres altas distintas si la comparación es `===`. En dos semanas el catálogo deja
 * de servir para agrupar, que era su único trabajo.
 */
describe('mismoNombre', () => {
  it('ignora mayúsculas, espacios sobrantes y acentos', () => {
    expect(mismoNombre('Excavadora', 'excavadora')).toBe(true);
    expect(mismoNombre('  Excavadora  ', 'excavadora')).toBe(true);

    // El caso que aparece a los dos días: alguien escribe sin acento.
    expect(mismoNombre('Camión', 'camion')).toBe(true);
    expect(mismoNombre('Grúa Torre', 'grua torre')).toBe(true);
  });

  it('no confunde nombres que de verdad son distintos', () => {
    expect(mismoNombre('Excavadora', 'Retroexcavadora')).toBe(false);
    expect(mismoNombre('320D', '320')).toBe(false);

    // Vacío contra vacío es «igual», y da igual: el campo es obligatorio y no llega aquí.
    expect(mismoNombre('Excavadora', '')).toBe(false);
  });
});

describe('codigoDesdeNombre', () => {
  it('deja mayúsculas sin acentos y un guion por tramo', () => {
    expect(codigoDesdeNombre('Renta por día')).toBe('RENTA-POR-DIA');
    expect(codigoDesdeNombre('  Flete   de ida y vuelta ')).toBe('FLETE-DE-IDA-Y-VUELTA');
    expect(codigoDesdeNombre('Operador / ayudante')).toBe('OPERADOR-AYUDANTE');
  });

  it('no deja el código empezando ni acabando en guion', () => {
    expect(codigoDesdeNombre('¡Maniobra!')).toBe('MANIOBRA');
    expect(codigoDesdeNombre('— limpieza —')).toBe('LIMPIEZA');
  });

  it('recorta a lo que cabe en la columna, y sin dejar el guion del corte', () => {
    // 30 es el `maxlength` del campo del catálogo. Un código más largo sería un 400 del
    // servidor por algo que la pantalla ya sabía.
    const largo = codigoDesdeNombre('Renta mensual de excavadora hidráulica sobre orugas');

    expect(largo.length).toBeLessThanOrEqual(30);
    expect(largo.endsWith('-')).toBe(false);
    // Corta a la mitad de una palabra —«HI» de «hidráulica»— y así se queda: partir por
    // guiones daría códigos de largo impredecible, y esto es una sugerencia editable.
    expect(largo).toBe('RENTA-MENSUAL-DE-EXCAVADORA-HI');
  });

  it('devuelve vacío cuando no queda nada utilizable', () => {
    expect(codigoDesdeNombre('   ')).toBe('');
    expect(codigoDesdeNombre('¿?')).toBe('');
  });
});
