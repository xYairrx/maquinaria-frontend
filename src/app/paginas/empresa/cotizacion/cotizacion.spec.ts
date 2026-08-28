import { describe, expect, it } from 'vitest';

import type { EstadoCotizacion } from '../../../nucleo/api/contratos';
import { SIGUIENTES } from './cotizacion';

const BORRADOR: EstadoCotizacion = 1;
const ENVIADA: EstadoCotizacion = 2;
const EN_REVISION: EstadoCotizacion = 3;
const ACEPTADA: EstadoCotizacion = 4;
const RECHAZADA: EstadoCotizacion = 5;
const VENCIDA: EstadoCotizacion = 6;
const CANCELADA: EstadoCotizacion = 7;

/** Los tres estados de los que ya no se sale. Ausentes de la tabla, no con lista vacía. */
const TERMINALES: readonly EstadoCotizacion[] = [RECHAZADA, VENCIDA, CANCELADA];

/**
 * LA TABLA DE TRANSICIONES ES UNA COPIA, Y UNA COPIA SE SEPARA.
 *
 * `SIGUIENTES` refleja `Transiciones` de `ServicioCotizacionesEf`. **No es la garantía**: quien
 * rechaza una transición inválida es el servidor, con un 409 cuyo texto la pantalla muestra tal
 * cual. Existe para no OFRECER lo que se va a rechazar.
 *
 * Lo que se fija aquí es la FORMA de la tabla, que es donde una copia se rompe en silencio:
 *
 * 1. **Un estado terminal no aparece.** Si alguien le pusiera `[]` para «ser explícito», el
 *    botón de cambiar estado seguiría dibujándose —`siguientes().length > 0` es la condición—
 *    y abriría un panel con un desplegable vacío.
 * 2. **Nadie se transiciona a sí mismo.** El servidor trata eso como idempotente y contesta
 *    200 sin cambiar nada; ofrecerlo sería una opción que no hace nada.
 * 3. **Borrador NO llega a Aceptada.** Es el atajo que parece razonable y que el motor prohíbe:
 *    una cotización se acepta después de enviarse, no antes. Si esta prueba se cae, es que
 *    alguien «simplificó» la tabla.
 *
 * Si el servidor cambia SU tabla y esta se queda vieja, ninguna prueba lo ve —no hay forma de
 * leer C# desde aquí—. El síntoma es benigno en un sentido, se ofrece de menos, y visible en el
 * otro: aparece el 409 con su explicación.
 */
describe('la tabla de transiciones de la cotización', () => {
  it('no incluye los estados terminales, ni siquiera con lista vacía', () => {
    for (const terminal of TERMINALES) {
      expect(SIGUIENTES[terminal]).toBeUndefined();
    }
  });

  it('no ofrece pasar un estado a sí mismo', () => {
    for (const [desde, hacia] of Object.entries(SIGUIENTES)) {
      expect(hacia).not.toContain(Number(desde));
    }
  });

  it('solo ofrece estados que existen en el enum', () => {
    for (const hacia of Object.values(SIGUIENTES)) {
      for (const estado of hacia) {
        expect(estado).toBeGreaterThanOrEqual(1);
        expect(estado).toBeLessThanOrEqual(7);
      }
    }
  });

  it('desde Borrador solo se envía o se cancela: NO se acepta de golpe', () => {
    expect(SIGUIENTES[BORRADOR]).toEqual([ENVIADA, CANCELADA]);
    expect(SIGUIENTES[BORRADOR]).not.toContain(ACEPTADA);
  });

  it('desde Enviada se llega a los cinco que el servidor permite', () => {
    expect(SIGUIENTES[ENVIADA]).toEqual([EN_REVISION, ACEPTADA, RECHAZADA, VENCIDA, CANCELADA]);
  });

  it('En revisión ya no vuelve a Enviada', () => {
    expect(SIGUIENTES[EN_REVISION]).not.toContain(ENVIADA);
  });

  it('Aceptada NO es terminal: de ahí sale la renta, y se puede cancelar', () => {
    expect(SIGUIENTES[ACEPTADA]).toEqual([CANCELADA]);
  });
});
