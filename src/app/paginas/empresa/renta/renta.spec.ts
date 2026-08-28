import { describe, expect, it } from 'vitest';

import type { EstadoRenta } from '../../../nucleo/api/contratos';
import { ACCIONES } from './renta';

const BORRADOR: EstadoRenta = 1;
const CONFIRMADA: EstadoRenta = 2;
const ACTIVA: EstadoRenta = 5;
const DEVUELTA: EstadoRenta = 8;
const CERRADA: EstadoRenta = 9;
const CANCELADA: EstadoRenta = 10;

/** Los cuatro que el `PATCH .../estado` rechaza con 400 porque tienen endpoint propio. */
const CON_PROCESO_PROPIO = ['confirmar', 'cerrar', 'cancelar', 'extender'];

/**
 * QUÉ SE PUEDE HACER DESDE CADA ESTADO DE UNA RENTA.
 *
 * `ACCIONES` es el espejo de TRES cosas del servidor a la vez —la tabla `Transiciones`, las
 * guardas de cada Proceso y el filtro del controlador—, y por eso se equivoca fácil. Lo que
 * fija este archivo son las reglas de negocio que no se pueden deducir leyendo la pantalla:
 *
 * 1. **Una renta Activa NO se cancela.** La máquina está en la obra; cancelar diría que nunca
 *    salió. Se devuelve y se cierra, que es lo que de verdad pasó. Es el error que un
 *    «pues Cancelar debería estar siempre» introduciría sin que nada se rompiera visiblemente.
 * 2. **Un Borrador no se cierra.** Cerrar libera calendario, y un borrador nunca lo ocupó.
 * 3. **Solo se extiende lo que ya tiene calendario**: Confirmada y Activa, nada más.
 * 4. **Los estados terminales están AUSENTES**, no con lista vacía: la barra de acciones se
 *    apaga por `length === 0`, y un `[]` explícito daría lo mismo hoy pero invita a agregarle
 *    una acción «solo para ese caso».
 */
describe('las acciones disponibles por estado de renta', () => {
  it('Borrador: se confirma o se cancela, nunca se cierra', () => {
    expect(ACCIONES[BORRADOR]).toEqual(['confirmar', 'cancelar']);
    expect(ACCIONES[BORRADOR]).not.toContain('cerrar');
  });

  it('Confirmada: sale a la obra, se alarga o se cancela antes de salir', () => {
    expect(ACCIONES[CONFIRMADA]).toEqual(['activar', 'extender', 'cancelar']);
  });

  it('Activa: NO se cancela — se devuelve y se cierra', () => {
    expect(ACCIONES[ACTIVA]).not.toContain('cancelar');
    expect(ACCIONES[ACTIVA]).toEqual(['devolver', 'extender', 'cerrar']);
  });

  it('Devuelta: ya solo queda cerrar', () => {
    expect(ACCIONES[DEVUELTA]).toEqual(['cerrar']);
  });

  it('Cerrada y Cancelada no aparecen: son terminales', () => {
    expect(ACCIONES[CERRADA]).toBeUndefined();
    expect(ACCIONES[CANCELADA]).toBeUndefined();
  });

  it('solo se extiende lo que ya ocupa calendario', () => {
    const extienden = Object.entries(ACCIONES)
      .filter(([, acciones]) => acciones.includes('extender'))
      .map(([estado]) => Number(estado));

    expect(extienden).toEqual([CONFIRMADA, ACTIVA]);
  });

  it('no ofrece ninguna acción que no exista en el servidor', () => {
    const conocidas = [...CON_PROCESO_PROPIO, 'activar', 'devolver'];

    for (const acciones of Object.values(ACCIONES)) {
      for (const accion of acciones) {
        expect(conocidas).toContain(accion);
      }
    }
  });
});
