import { describe, expect, it } from 'vitest';

import type { EstadoContrato } from '../../../nucleo/api/contratos';
import { SIGUIENTES } from './contrato';

const BORRADOR: EstadoContrato = 1;
const AUTORIZADO: EstadoContrato = 2;
const FIRMADO: EstadoContrato = 3;
const TERMINADO: EstadoContrato = 4;

/**
 * LA TABLA DE TRANSICIONES DEL CONTRATO, Y POR QUÉ ESTA VEZ IMPORTA MÁS.
 *
 * En Cotizaciones y en Rentas la tabla copiada solo evita ofrecer lo que el servidor rechaza.
 * Aquí, además, **documenta un defecto que estuvo vivo**: el trigger `contrato_inmutable` se
 * creó con una función que siempre lanzaba, así que rechazaba cualquier `UPDATE` fuera de
 * Borrador —incluido el que solo mueve `estado`—. Firmado y Terminado eran inalcanzables y
 * `firmadoEn` no podía tener valor nunca, mientras estas tres filas decían lo contrario.
 *
 * Se corrigió con la migración `EmpresaContratoAvanzaEstado` el 2026-08-28. Lo que fija este
 * archivo es que la tabla **no se recorte** a la única transición que funcionaba entonces: si
 * alguien la deja en `{ 1: [2] }` para «que no falle», estará volviendo a esconder el problema
 * en lugar de arreglarlo.
 *
 * Las cuatro filas del ciclo se probaron contra la base real —Borrador → Autorizado → Firmado →
 * Terminado— después de la migración.
 */
describe('las transiciones del contrato', () => {
  it('desde Borrador solo se autoriza: no se salta a Firmado', () => {
    expect(SIGUIENTES[BORRADOR]).toEqual([AUTORIZADO]);
    expect(SIGUIENTES[BORRADOR]).not.toContain(FIRMADO);
  });

  it('desde Autorizado se firma o se termina — las dos, no solo una', () => {
    // Es la fila que el trigger hacia imposible. Si vuelve a quedar vacia o recortada, el
    // defecto volvio.
    expect(SIGUIENTES[AUTORIZADO]).toEqual([FIRMADO, TERMINADO]);
  });

  it('desde Firmado ya solo queda terminar, y no se vuelve atrás', () => {
    expect(SIGUIENTES[FIRMADO]).toEqual([TERMINADO]);
    expect(SIGUIENTES[FIRMADO]).not.toContain(AUTORIZADO);
  });

  it('Terminado está ausente: es terminal, y su ausencia apaga el botón', () => {
    expect(SIGUIENTES[TERMINADO]).toBeUndefined();
  });

  it('no hay Cancelado en ninguna fila: el enum migrado no lo tiene', () => {
    // El alcance describe cancelar un contrato autorizado y hacer uno nuevo; eso exige un
    // quinto valor que el CHECK `BETWEEN 1 AND 4` no acepta hoy. Ofrecerlo daria un 400.
    for (const hacia of Object.values(SIGUIENTES)) {
      for (const estado of hacia) {
        expect(estado).toBeLessThanOrEqual(4);
      }
    }
  });

  it('ningún estado se transiciona a sí mismo', () => {
    for (const [desde, hacia] of Object.entries(SIGUIENTES)) {
      expect(hacia).not.toContain(Number(desde));
    }
  });
});
