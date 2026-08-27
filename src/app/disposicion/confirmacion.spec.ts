import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Confirmacion } from './confirmacion';

/**
 * El servicio de confirmación.
 *
 * Lo que se prueba aquí es lo que se rompe en silencio: una promesa que nunca se resuelve.
 * Si `responder` no se llama —porque Escape cerró el `<dialog>` sin pasar por el
 * componente, o porque una segunda pregunta pisó a la primera— quien esperaba se queda
 * colgado con su botón bloqueado, sin error en consola y sin nada que ver en pantalla.
 */
describe('Confirmacion', () => {
  let confirmacion: Confirmacion;

  const PREGUNTA = {
    titulo: 'Retirar',
    mensaje: '¿Retirar «Caterpillar»?',
    confirmar: 'Retirar',
    peligro: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    confirmacion = TestBed.inject(Confirmacion);
  });

  it('no hay pregunta abierta al empezar', () => {
    expect(confirmacion.peticion()).toBeNull();
  });

  it('publica la pregunta y la resuelve en true al confirmar', async () => {
    const respuesta = confirmacion.pedir(PREGUNTA);

    expect(confirmacion.peticion()).toEqual(PREGUNTA);

    confirmacion.responder(true);

    await expect(respuesta).resolves.toBe(true);
    // Cerrada: el diálogo no debe quedar con la pregunta anterior dentro.
    expect(confirmacion.peticion()).toBeNull();
  });

  it('resuelve en false al cancelar', async () => {
    const respuesta = confirmacion.pedir(PREGUNTA);

    confirmacion.responder(false);

    await expect(respuesta).resolves.toBe(false);
  });

  /**
   * LA QUE IMPORTA. Escape lo cierra el navegador sin pasar por el componente, así que el
   * `(close)` del `<dialog>` llama a `responder(false)`. Sin ese camino, la promesa queda
   * colgada para siempre.
   */
  it('cerrar sin elegir cuenta como NO', async () => {
    const respuesta = confirmacion.pedir(PREGUNTA);

    // Lo que hace `alCerrarse()` del componente.
    confirmacion.responder(false);

    await expect(respuesta).resolves.toBe(false);
  });

  /**
   * Una segunda pregunta con la primera abierta no debe dejar huérfana a la primera. Pasa
   * si dos filas se pulsan rápido, o si un atajo abre otra confirmación.
   */
  it('una pregunta nueva resuelve la anterior en false', async () => {
    const primera = confirmacion.pedir(PREGUNTA);
    const segunda = confirmacion.pedir({ ...PREGUNTA, titulo: 'Otra' });

    await expect(primera).resolves.toBe(false);
    expect(confirmacion.peticion()?.titulo).toBe('Otra');

    confirmacion.responder(true);
    await expect(segunda).resolves.toBe(true);
  });

  it('responder dos veces no revienta ni resuelve dos veces', async () => {
    const respuesta = confirmacion.pedir(PREGUNTA);

    confirmacion.responder(true);
    // El segundo no tiene a quién responder: el cabo ya se soltó y se limpió.
    confirmacion.responder(false);

    await expect(respuesta).resolves.toBe(true);
  });
});
