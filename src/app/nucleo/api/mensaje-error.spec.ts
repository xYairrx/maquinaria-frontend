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

  /**
   * LA TRADUCCIÓN POR CÓDIGO, que es la excepción a «no reescribas el texto del servidor».
   *
   * Lo que se traduce no es su texto sino un CÓDIGO estable que él emite para esto. La
   * regla existía porque reescribir a ojo los mensajes de login podía deshacer su
   * uniformidad; un código no puede, porque no distingue más de lo que el servidor decidió.
   */
  it('traduce el mensaje cuando el codigo es conocido, aunque venga detail', () => {
    const e = respuesta(403, {
      title: 'Servicio suspendido',
      // El servidor lo manda en español; la interfaz de la prueba está en español, así que
      // lo que importa aquí es que gane el diccionario, no el detail.
      detail: 'ESTE TEXTO NO DEBE GANAR.',
      codigo: 'servicio_suspendido',
    });

    expect(mensajeDeError(e)).not.toBe('ESTE TEXTO NO DEBE GANAR.');
    expect(mensajeDeError(e)).toContain('suspendido');
  });

  /**
   * DE ESTO DEPENDE QUE ESTO NO ROMPA NADA. Un código que el frontend no conozca —uno
   * nuevo del servidor, o un despliegue desparejo— tiene que caer al `detail` de siempre,
   * no dejar la pantalla muda.
   */
  it('un codigo DESCONOCIDO cae al detail del servidor', () => {
    const e = respuesta(400, {
      detail: 'Lo que diga el servidor.',
      codigo: 'algo_que_todavia_no_traducimos',
    });

    expect(mensajeDeError(e)).toBe('Lo que diga el servidor.');
  });

  it('el 429 arma la frase con los segundos que manda el servidor', () => {
    const e = respuesta(429, {
      title: 'Demasiados intentos',
      detail: 'Se hicieron demasiados intentos seguidos. Vuelve a intentarlo en 47 segundos.',
      codigo: 'demasiados_intentos',
      segundos: 47,
    });

    expect(mensajeDeError(e)).toContain('47');
  });

  /** Sin `segundos` —un servidor viejo— se dice sin número, nunca «undefined». */
  it('el 429 sin segundos no ensena undefined', () => {
    const e = respuesta(429, { codigo: 'demasiados_intentos' });

    expect(mensajeDeError(e)).not.toContain('undefined');
    expect(mensajeDeError(e).length).toBeGreaterThan(0);
  });

  it('el no_encontrado nombra la entidad que manda el servidor', () => {
    const e = respuesta(404, {
      detail: 'La marca no existe.',
      codigo: 'no_encontrado',
      entidad: 'marca',
    });

    expect(mensajeDeError(e)).toContain('marca');
  });

  /**
   * Una entidad que el diccionario no conoce —una nueva del servidor— NO puede acabar
   * enseñando su clave cruda a media frase.
   */
  it('una entidad desconocida cae en el generico, no en la clave cruda', () => {
    const e = respuesta(404, { codigo: 'no_encontrado', entidad: 'algo_nuevo' });

    expect(mensajeDeError(e)).not.toContain('algo_nuevo');
    expect(mensajeDeError(e).length).toBeGreaterThan(0);
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
