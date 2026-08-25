import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Api, type ConsultaDeLiga } from './api';

/**
 * Las dos consultas de liga.
 *
 * Lo que se fija aquí es la distinción que gobierna el diseño de la pantalla de
 * restablecimiento: **un 404 significa que la liga no sirve; cualquier otro fallo no dice
 * nada de la liga**. Confundirlos manda a pedir otra liga a quien solo tenía la red caída, o
 * peor, deja pidiendo una contraseña contra una liga muerta.
 *
 * También se fija que un token vacío no dispare ninguna petición, y que leer el valor con la
 * consulta en error no lance.
 */
const BASE = 'http://localhost:5123/api/empresas';

/**
 * Deja correr lo pendiente: los recursos lanzan su petición en una microtarea, así que
 * `TestBed.tick()` a secas se ejecuta antes de que exista la petición que comprobar.
 */
async function asentar() {
  TestBed.tick();
  await Promise.resolve();
  TestBed.tick();
}

function crear() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });

  return {
    api: TestBed.inject(Api),
    http: TestBed.inject(HttpTestingController),
  };
}

/** `httpResource` necesita contexto de inyección, igual que en un componente. */
function enContexto<T>(fabrica: () => ConsultaDeLiga<T>): ConsultaDeLiga<T> {
  return TestBed.runInInjectionContext(fabrica);
}

describe('Api: consulta de invitación', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('sin token no pide nada', async () => {
    const { api, http } = crear();
    const liga = enContexto(() => api.consultaDeInvitacion('bajio', signal('')));

    await asentar();

    expect(liga.valor()).toBeUndefined();
    expect(liga.cargando()).toBe(false);
    expect(liga.resuelta()).toBe(false);
    http.verify();
  });

  it('un token undefined tampoco pide nada', async () => {
    // El caso real: `withComponentInputBinding` pone `undefined` cuando el parámetro no
    // está en la URL, PISANDO el valor por defecto del `input`. Con `token() === ''` se
    // colaba una petición a `.../invitaciones/undefined`, el servidor contestaba 404 y una
    // liga que faltaba se veía como una liga caducada.
    const { api, http } = crear();
    const liga = enContexto(() =>
      api.consultaDeInvitacion('bajio', signal(undefined as unknown as string)),
    );

    await asentar();

    expect(liga.resuelta()).toBe(false);
    expect(liga.error()).toBeNull();
    http.verify();
  });

  it('sin empresa no pide nada', async () => {
    const { api, http } = crear();
    enContexto(() => api.consultaDeInvitacion('', signal('abc')));

    await asentar();

    http.verify();
  });

  it('con token entrega a quién va dirigida', async () => {
    const { api, http } = crear();
    const liga = enContexto(() => api.consultaDeInvitacion('bajio', signal('abc')));

    await asentar();

    http
      .expectOne(`${BASE}/bajio/invitaciones/abc`)
      .flush({ correo: 'a@b.mx', nombre: 'Ana', empresa: 'Bajío SA' });
    await asentar();

    expect(liga.resuelta()).toBe(true);
    expect(liga.valor()?.nombre).toBe('Ana');
    expect(liga.error()).toBeNull();
  });

  it('vuelve a pedir si cambia el token', async () => {
    // La liga llega por la URL, así que el token puede cambiar sin recrear la pantalla.
    const { api, http } = crear();
    const token = signal('primero');
    const liga = enContexto(() => api.consultaDeInvitacion('bajio', token));

    await asentar();
    http.expectOne(`${BASE}/bajio/invitaciones/primero`).flush({
      correo: 'a@b.mx',
      nombre: 'Ana',
      empresa: 'Bajío SA',
    });
    await asentar();

    token.set('segundo');
    await asentar();

    http.expectOne(`${BASE}/bajio/invitaciones/segundo`).flush({
      correo: 'c@d.mx',
      nombre: 'Beto',
      empresa: 'Bajío SA',
    });
    await asentar();

    expect(liga.valor()?.nombre).toBe('Beto');
    http.verify();
  });
});

describe('Api: consulta de restablecimiento', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('un 204 deja la consulta resuelta y sin valor', async () => {
    // El backend NO dice de quién es la liga a propósito: una liga adivinada no debe
    // convertirse en una fuente de correos. Por eso se mira `resuelta` y no `valor`.
    const { api, http } = crear();
    const liga = enContexto(() => api.consultaDeRestablecimiento('bajio', signal('t')));

    await asentar();
    http
      .expectOne(`${BASE}/bajio/restablecimientos/t`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await asentar();

    expect(liga.resuelta()).toBe(true);
    expect(liga.noSirve()).toBe(false);
    expect(liga.error()).toBeNull();
  });

  it('un 404 marca que la liga no sirve', async () => {
    const { api, http } = crear();
    const liga = enContexto(() => api.consultaDeRestablecimiento('bajio', signal('vieja')));

    await asentar();
    http
      .expectOne(`${BASE}/bajio/restablecimientos/vieja`)
      .flush(
        { detail: 'La liga no es válida o ya se usó.' },
        { status: 404, statusText: 'Not Found' },
      );
    await asentar();

    expect(liga.noSirve()).toBe(true);
    expect(liga.error()).toBe('La liga no es válida o ya se usó.');
    expect(liga.resuelta()).toBe(false);
  });

  it('un 500 NO marca que la liga no sirve', async () => {
    // Es la distinción que sostiene la pantalla: con un fallo de transporte se reintenta,
    // no se manda a pedir otra liga que tampoco va a llegar.
    const { api, http } = crear();
    const liga = enContexto(() => api.consultaDeRestablecimiento('bajio', signal('t')));

    await asentar();
    http
      .expectOne(`${BASE}/bajio/restablecimientos/t`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    await asentar();

    expect(liga.noSirve()).toBe(false);
    expect(liga.error()).not.toBeNull();
  });

  it('el servidor caído tampoco marca que la liga no sirve', async () => {
    const { api, http } = crear();
    const liga = enContexto(() => api.consultaDeRestablecimiento('bajio', signal('t')));

    await asentar();
    http
      .expectOne(`${BASE}/bajio/restablecimientos/t`)
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await asentar();

    expect(liga.noSirve()).toBe(false);
    // Leer el valor con la consulta en error NO debe lanzar: `value()` de un recurso sí lo
    // hace, y de ahí el `hasValue()` de la fábrica.
    expect(liga.valor()).toBeUndefined();
  });
});
