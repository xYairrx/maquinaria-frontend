import { describe, expect, it } from 'vitest';

import type { Equipo, UnidadTarifa } from './contratos';
import { costoDelEquipoPorUnidad } from './costo-de-equipo';

/**
 * QUÉ COSTO SE LE APLICA A UNA MÁQUINA SEGÚN LA UNIDAD DEL DOCUMENTO.
 *
 * **Esta función es el espejo de un `switch` del servidor**, que es la única razón por la que se
 * prueba: si los dos se separan, la pantalla enseña un número y se guarda otro. La prueba no
 * puede comparar los dos lados —están en repos distintos— pero sí fija este, para que un cambio
 * aquí sea deliberado.
 *
 * Lo que se fija:
 *
 * 1. **Cada unidad de tiempo toma SU columna**, y no la de al lado. Es un `switch` de cuatro
 *    ramas: el error natural es un copiar-pegar que deje dos ramas devolviendo lo mismo, y eso
 *    no lo ve nadie leyéndolo.
 * 2. **Evento y Kilómetro dan `null`, no cero.** Un flete por evento no tiene «costo de
 *    máquina»; cero es una máquina a la que no se le cargó el de esa unidad. La pantalla enseña
 *    dos mensajes distintos según cuál sea.
 * 3. **Una columna vacía se pasa tal cual** —`null`— sin convertirla en cero: el aviso «esta
 *    máquina no tiene costo por semana» depende de distinguirlas.
 */
function equipo(parte: Partial<Equipo>): Equipo {
  return {
    tarifaHora: 100,
    tarifaDia: 2000,
    tarifaSemana: 12000,
    tarifaMes: 45000,
    ...parte,
  } as Equipo;
}

const HORA: UnidadTarifa = 1;
const DIA: UnidadTarifa = 2;
const SEMANA: UnidadTarifa = 3;
const MES: UnidadTarifa = 4;
const EVENTO: UnidadTarifa = 5;
const KILOMETRO: UnidadTarifa = 6;

describe('costoDelEquipoPorUnidad', () => {
  it('cada unidad de tiempo toma su propia columna', () => {
    const maquina = equipo({});

    expect(costoDelEquipoPorUnidad(maquina, HORA)).toBe(100);
    expect(costoDelEquipoPorUnidad(maquina, DIA)).toBe(2000);
    expect(costoDelEquipoPorUnidad(maquina, SEMANA)).toBe(12000);
    expect(costoDelEquipoPorUnidad(maquina, MES)).toBe(45000);
  });

  it('las unidades que no son de tiempo dan null, no cero', () => {
    // Un flete por evento no tiene «costo de máquina». El documento no puede llevarlas —el
    // CHECK `renta_unidad` es 1..4— pero el tipo sí, y devolver cero diría otra cosa.
    expect(costoDelEquipoPorUnidad(equipo({}), EVENTO)).toBeNull();
    expect(costoDelEquipoPorUnidad(equipo({}), KILOMETRO)).toBeNull();
  });

  it('una columna vacía se pasa tal cual y no se vuelve cero', () => {
    // De esto depende el aviso «esta máquina no tiene costo cargado por semana».
    expect(costoDelEquipoPorUnidad(equipo({ tarifaSemana: null }), SEMANA)).toBeNull();
    expect(costoDelEquipoPorUnidad(equipo({ tarifaDia: 0 }), DIA)).toBe(0);
  });
});
