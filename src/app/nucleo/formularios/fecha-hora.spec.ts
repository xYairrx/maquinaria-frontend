import { describe, expect, it } from 'vitest';

import { aCampoLocal, aInstante } from './fecha-hora';

/**
 * LA FRONTERA ENTRE LA HORA DE PARED Y EL INSTANTE.
 *
 * Un `<input type="datetime-local">` entrega hora de pared local —`2026-09-01T08:00`, sin zona—
 * y la columna `timestamptz` guarda un instante. Cruzar mal esa frontera **no da un error**: da
 * un dato corrido las horas del huso, y el `EXCLUDE` del calendario compara instantes
 * equivocados. Eso es lo que estas pruebas impiden.
 *
 * **Están escritas sin fijar un huso concreto** porque el de la máquina que corre las pruebas no
 * se controla. Lo que se comprueba es la RELACIÓN: que ida y vuelta cierren, y que el resultado
 * corresponda al instante que el navegador dice que es esa hora local — no una cadena literal,
 * que solo valdría en un huso.
 */
describe('aInstante', () => {
  it('devuelve un instante en UTC, con la Z que Npgsql exige', () => {
    const iso = aInstante('2026-09-01T08:00');

    expect(iso).not.toBeNull();
    expect(iso).toMatch(/Z$/);
  });

  it('convierte según la zona LOCAL, no pegando una Z al texto', () => {
    // El atajo que usan Traspasos y el alta de precio —`${texto}Z`— es correcto ahí porque el
    // campo es `date` y la hora da igual. Aquí sería un corrimiento del tamaño del huso.
    const local = '2026-09-01T08:00';
    const esperado = new Date(local).toISOString();

    expect(aInstante(local)).toBe(esperado);
  });

  it('el campo vacío es null, no una fecha inventada', () => {
    expect(aInstante('')).toBeNull();
    expect(aInstante('   ')).toBeNull();
  });

  it('un texto que no es fecha da null en vez de lanzar', () => {
    // `new Date('cualquier cosa')` no lanza: devuelve una fecha invalida, y `toISOString()`
    // sobre ella SI lanza. Sin la guarda, un `reset()` mal escrito reventaria el envio.
    expect(aInstante('no soy una fecha')).toBeNull();
  });
});

describe('aCampoLocal', () => {
  it('el camino de vuelta cierra: instante → campo → el mismo instante', () => {
    const original = new Date('2026-09-01T14:30:00.000Z').toISOString();

    expect(aInstante(aCampoLocal(original))).toBe(original);
  });

  it('devuelve el formato exacto que el campo acepta, sin segundos', () => {
    expect(aCampoLocal('2026-09-01T14:30:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('usa los componentes LOCALES, no un recorte del texto UTC', () => {
    // `iso.slice(0, 16)` era la version anterior y ese es justo el defecto: enseña la hora UTC
    // en un campo que significa hora local. Solo coinciden si la maquina esta en UTC.
    const iso = '2026-09-01T14:30:00.000Z';
    const fecha = new Date(iso);
    const dos = (n: number) => String(n).padStart(2, '0');

    expect(aCampoLocal(iso)).toBe(
      `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
        `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`,
    );
  });

  it('un instante ilegible da cadena vacía: el campo se queda en blanco', () => {
    expect(aCampoLocal('vaya dato')).toBe('');
  });
});
