import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { mensajeDeError } from './mensaje-error';

/**
 * La traducción de un error HTTP a algo mostrable.
 *
 * Lo que se fija aquí es el ORDEN de preferencia, que es lo que se rompe en silencio: un
 * `ValidationProblemDetails` trae su información útil en `errors` y su `title` es el
 * genérico «One or more validation errors occurred». Mostrando el título, la pantalla dice
 * una frase que no nombra el campo ni el motivo — y encima en inglés con la interfaz en
 * español.
 *
 * Costó una depuración real: el `<select>` de unidad mandaba la cadena «1» donde el enum
 * espera un entero, el servidor lo decía en `errors.unidad`, y la pantalla mostraba el
 * título genérico.
 */
describe('mensajeDeError', () => {
  const respuesta = (status: number, body: unknown) =>
    new HttpErrorResponse({ status, error: body, url: 'http://localhost:5123/api/x' });

  it('prefiere los errores por campo de un ValidationProblemDetails', () => {
    const e = respuesta(400, {
      title: 'One or more validation errors occurred.',
      status: 400,
      errors: { unidad: ["The value '1' is not valid."] },
    });

    expect(mensajeDeError(e)).toBe("unidad: The value '1' is not valid.");
  });

  it('junta varios campos en una línea', () => {
    const e = respuesta(400, {
      title: 'One or more validation errors occurred.',
      errors: { codigo: ['Requerido.'], nombre: ['Requerido.', 'Muy largo.'] },
    });

    expect(mensajeDeError(e)).toBe('codigo: Requerido. · nombre: Requerido. · nombre: Muy largo.');
  });

  it('un error sin nombre de campo se muestra sin prefijo', () => {
    const e = respuesta(400, { errors: { '': ['El cuerpo no es JSON válido.'] } });

    expect(mensajeDeError(e)).toBe('El cuerpo no es JSON válido.');
  });

  /** Un rechazo de negocio NO trae `errors`: su texto está en `detail`, ya redactado. */
  it('usa el detail cuando no hay errores por campo', () => {
    const e = respuesta(409, {
      title: 'Conflicto',
      detail: 'Ya existe una marca con ese nombre.',
    });

    expect(mensajeDeError(e)).toBe('Ya existe una marca con ese nombre.');
  });

  it('cae al title cuando no hay ni errors ni detail', () => {
    expect(mensajeDeError(respuesta(403, { title: 'Prohibido' }))).toBe('Prohibido');
  });

  /** `errors` vacío no debe ganarle al `detail`: no aporta nada que mostrar. */
  it('un errors vacío no gana al detail', () => {
    const e = respuesta(400, { errors: {}, detail: 'El slug está reservado.' });

    expect(mensajeDeError(e)).toBe('El slug está reservado.');
  });

  it('el status 0 es «no se pudo contactar al servidor», no un código', () => {
    // Sin servidor no hay cuerpo que leer; es un fallo de red, no una respuesta.
    expect(mensajeDeError(respuesta(0, null))).toContain('servidor');
  });

  it('lo que no es un error HTTP cae en el inesperado', () => {
    expect(mensajeDeError(new Error('boom'))).toBeTruthy();
    expect(mensajeDeError('cadena suelta')).toBeTruthy();
  });
});
