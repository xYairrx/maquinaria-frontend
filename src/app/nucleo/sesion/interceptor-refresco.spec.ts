import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import type { SesionEmpresa } from '../api/contratos';
import { interceptorRefresco } from './interceptor-refresco';
import { interceptorToken } from './interceptor-token';
import { Sesion } from './sesion';
import { configuracion } from '../ambiente/configuracion';

/**
 * El interceptor de refresco.
 *
 * LA PRUEBA QUE MÁS IMPORTA ES «dos peticiones concurrentes producen UN SOLO refresco».
 * El token de refresco rota sin ventana de gracia, así que dos canjes del mismo token los
 * lee el backend como reuso de token robado y **revoca toda la cadena de sesiones**: un
 * refresco sin serializar no degrada la experiencia, echa a la calle a quien estaba
 * trabajando. Lo demás de aquí es la red alrededor de eso.
 */

const API = configuracion.urlApi;
const MI_SESION = `${API}/api/mi/sesion`;
const OTRA = `${API}/api/empresas/bajio/algo`;
const REFRESCO = `${API}/api/empresas/bajio/sesion/refresco`;
const DE_PLATAFORMA = `${API}/api/plataforma/empresas`;

const SESION_NUEVA: SesionEmpresa = {
  token: 'nuevo',
  expiraEn: '2026-08-25T18:45:12.3456789Z',
  tokenRefresco: 'r2',
  nombre: 'Ana Admin',
  correo: 'ana@bajio.mx',
  empresa: 'bajio',
  accesoTotal: false,
  permisos: ['equipos.consultar', 'equipos.editar'],
};

/** El único 401 del endpoint de refresco: seis motivos, un solo `ProblemDetails`. */
const SESION_NO_VALIDA = { title: 'Sesion no valida', status: 401 };

const CADUCADO = { status: 401, statusText: 'Unauthorized' };

interface Montaje {
  readonly cliente: HttpClient;
  readonly http: HttpTestingController;
  readonly sesion: Sesion;
  /** Cada `navigate` del router, para contar que solo hay uno. */
  readonly navegaciones: readonly unknown[][];
}

function montar(conSesion = true): Montaje {
  localStorage.clear();

  if (conSesion) {
    localStorage.setItem('maquinaria.token', 'viejo');
    localStorage.setItem('maquinaria.refresco', 'r1');
    localStorage.setItem('maquinaria.empresa', 'bajio');
  }

  const navegaciones: unknown[][] = [];

  TestBed.configureTestingModule({
    providers: [
      // El MISMO orden que `app.config.ts`: el de refresco por fuera, para que su
      // reintento vuelva a pasar por el del token y salga con el `Bearer` nuevo.
      provideHttpClient(withInterceptors([interceptorRefresco, interceptorToken])),
      provideHttpClientTesting(),
      {
        provide: Router,
        useValue: {
          navigate: (...argumentos: unknown[]) => {
            navegaciones.push(argumentos);

            return Promise.resolve(true);
          },
        },
      },
    ],
  });

  return {
    cliente: TestBed.inject(HttpClient),
    http: TestBed.inject(HttpTestingController),
    sesion: TestBed.inject(Sesion),
    navegaciones,
  };
}

/** Una lectura cualquiera, con lo que devolvió y lo que falló. */
function pedir(cliente: HttpClient, url: string) {
  const resultado: { cuerpo: unknown; fallo: unknown } = { cuerpo: null, fallo: null };

  cliente.get(url).subscribe({
    next: (r) => (resultado.cuerpo = r),
    error: (e: unknown) => (resultado.fallo = e),
  });

  return resultado;
}

describe('interceptorRefresco', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('un 401 refresca y reintenta con el token nuevo', () => {
    const { cliente, http, navegaciones } = montar();
    const lectura = pedir(cliente, MI_SESION);

    const primera = http.expectOne(MI_SESION);
    expect(primera.request.headers.get('Authorization')).toBe('Bearer viejo');
    primera.flush(SESION_NO_VALIDA, CADUCADO);

    const refresco = http.expectOne(REFRESCO);
    expect(refresco.request.method).toBe('POST');
    expect(refresco.request.body).toEqual({ tokenRefresco: 'r1' });
    refresco.flush(SESION_NUEVA);

    const reintento = http.expectOne(MI_SESION);
    expect(reintento.request.headers.get('Authorization')).toBe('Bearer nuevo');
    reintento.flush({ correo: 'ana@bajio.mx' });

    expect(lectura.cuerpo).toEqual({ correo: 'ana@bajio.mx' });
    expect(lectura.fallo).toBeNull();
    expect(navegaciones).toEqual([]);
    http.verify();
  });

  it('guarda el token de refresco ROTADO de la respuesta', () => {
    // Si no se guardara, el siguiente refresco iría con el token ya revocado y el
    // backend lo leería como reuso: cerraría la sesión en lugar de renovarla.
    const { cliente, http, sesion } = montar();
    pedir(cliente, MI_SESION);

    http.expectOne(MI_SESION).flush(SESION_NO_VALIDA, CADUCADO);
    http.expectOne(REFRESCO).flush(SESION_NUEVA);
    http.expectOne(MI_SESION).flush({});

    expect(localStorage.getItem('maquinaria.refresco')).toBe('r2');
    expect(sesion.token()).toBe('nuevo');
    http.verify();
  });

  it('dos peticiones concurrentes que dan 401 producen UN SOLO refresco', () => {
    const { cliente, http } = montar();
    const una = pedir(cliente, MI_SESION);
    const otra = pedir(cliente, OTRA);

    // Las dos salieron con el token viejo y las dos caducan.
    http.expectOne(MI_SESION).flush(SESION_NO_VALIDA, CADUCADO);
    http.expectOne(OTRA).flush(SESION_NO_VALIDA, CADUCADO);

    // ESTO es lo que se está probando: un canje, no dos.
    const refrescos = http.match(REFRESCO);
    expect(refrescos.length).toBe(1);
    refrescos[0].flush(SESION_NUEVA);

    // Y las dos peticiones se reintentan con el token nuevo, no solo la primera.
    const reintentos = http.match((r) => r.url === MI_SESION || r.url === OTRA);
    expect(reintentos.length).toBe(2);
    expect(reintentos.map((r) => r.request.headers.get('Authorization'))).toEqual([
      'Bearer nuevo',
      'Bearer nuevo',
    ]);

    reintentos[0].flush({ quien: 'mi' });
    reintentos[1].flush({ quien: 'otra' });

    expect(una.cuerpo).toEqual({ quien: 'mi' });
    expect(otra.cuerpo).toEqual({ quien: 'otra' });
    http.verify();
  });

  it('un 401 del propio refresco limpia la sesión y navega al acceso UNA vez', () => {
    const { cliente, http, sesion, navegaciones } = montar();
    const una = pedir(cliente, MI_SESION);
    const otra = pedir(cliente, OTRA);

    http.expectOne(MI_SESION).flush(SESION_NO_VALIDA, CADUCADO);
    http.expectOne(OTRA).flush(SESION_NO_VALIDA, CADUCADO);

    http.expectOne(REFRESCO).flush(SESION_NO_VALIDA, CADUCADO);

    // Una sola navegación aunque hubiera dos peticiones esperando.
    expect(navegaciones.length).toBe(1);
    expect(navegaciones[0][0]).toEqual(['/entrar']);

    expect(sesion.activa()).toBe(false);
    expect(localStorage.getItem('maquinaria.token')).toBeNull();
    expect(localStorage.getItem('maquinaria.refresco')).toBeNull();

    // Las dos fallan de verdad: nada se queda esperando una respuesta que no va a venir.
    expect(una.fallo).toBeInstanceOf(HttpErrorResponse);
    expect(otra.fallo).toBeInstanceOf(HttpErrorResponse);

    // Y no se reintentó nada: sin token no hay nada que reintentar.
    http.verify();
  });

  it('la petición de refresco NO lleva Bearer', () => {
    // El token de acceso ya caducó —por eso se está refrescando— y el endpoint es
    // anónimo. Sale por el `HttpBackend`, fuera de la cadena de interceptores.
    const { cliente, http } = montar();
    pedir(cliente, MI_SESION);

    http.expectOne(MI_SESION).flush(SESION_NO_VALIDA, CADUCADO);

    const refresco = http.expectOne(REFRESCO);
    expect(refresco.request.headers.has('Authorization')).toBe(false);

    refresco.flush(SESION_NUEVA);
    http.expectOne(MI_SESION).flush({});
    http.verify();
  });

  it('un 429 no se confunde con un 401', () => {
    // El limitador del backend es 10/min por slug+IP. Tratarlo como un token caducado
    // quemaría un refresco por cada rechazo y cerraría la sesión por exceso de tráfico.
    const { cliente, http, sesion, navegaciones } = montar();
    const lectura = pedir(cliente, MI_SESION);

    http.expectOne(MI_SESION).flush(null, { status: 429, statusText: 'Too Many Requests' });

    expect((lectura.fallo as HttpErrorResponse).status).toBe(429);
    expect(sesion.activa()).toBe(true);
    expect(navegaciones).toEqual([]);
    http.verify();
  });

  it('un reintento que vuelve a dar 401 no se reintenta otra vez', () => {
    const { cliente, http } = montar();
    const lectura = pedir(cliente, MI_SESION);

    http.expectOne(MI_SESION).flush(SESION_NO_VALIDA, CADUCADO);
    http.expectOne(REFRESCO).flush(SESION_NUEVA);

    // El token es nuevo y aun así el servidor dice 401: no es cosa del token, y volver
    // a refrescar sería un bucle con una petición de por medio.
    http.expectOne(MI_SESION).flush(SESION_NO_VALIDA, CADUCADO);

    expect((lectura.fallo as HttpErrorResponse).status).toBe(401);
    http.verify();
  });

  it('sin sesión abierta un 401 se propaga tal cual', () => {
    // Es el login contestando que las credenciales no sirven. No hay nada que canjear, y
    // un refresco aquí borraría el mensaje del servidor con una navegación.
    const { cliente, http, navegaciones } = montar(false);
    const lectura = pedir(cliente, MI_SESION);

    http.expectOne(MI_SESION).flush(SESION_NO_VALIDA, CADUCADO);

    expect((lectura.fallo as HttpErrorResponse).status).toBe(401);
    expect(navegaciones).toEqual([]);
    http.verify();
  });

  it('un 401 de la API de plataforma no dispara ningún refresco', () => {
    // El backend NO tiene `sesion_refresh` para plataforma: no hay con qué refrescar, y
    // canjear el token de refresco de una empresa contra el ámbito equivocado sería peor.
    const { cliente, http, navegaciones } = montar();
    const lectura = pedir(cliente, DE_PLATAFORMA);

    http.expectOne(DE_PLATAFORMA).flush(SESION_NO_VALIDA, CADUCADO);

    expect((lectura.fallo as HttpErrorResponse).status).toBe(401);
    expect(navegaciones).toEqual([]);
    http.verify();
  });

  it('con token de acceso pero sin token de refresco cierra la sesión', () => {
    const { cliente, http, sesion, navegaciones } = montar();
    localStorage.removeItem('maquinaria.refresco');

    const lectura = pedir(cliente, MI_SESION);

    http.expectOne(MI_SESION).flush(SESION_NO_VALIDA, CADUCADO);

    expect(lectura.fallo).toBeInstanceOf(Error);
    expect(sesion.activa()).toBe(false);
    expect(navegaciones.length).toBe(1);
    http.verify();
  });

  it('un 401 seguido de otro más tarde refresca DOS veces, con el token rotado', () => {
    // El refresco en vuelo se libera al terminar: el segundo 401 ya no puede colgarse de
    // un canje que acabó, y el suyo va con el token NUEVO. No es reuso.
    const { cliente, http } = montar();

    pedir(cliente, MI_SESION);
    http.expectOne(MI_SESION).flush(SESION_NO_VALIDA, CADUCADO);
    http.expectOne(REFRESCO).flush(SESION_NUEVA);
    http.expectOne(MI_SESION).flush({});

    pedir(cliente, OTRA);
    http.expectOne(OTRA).flush(SESION_NO_VALIDA, CADUCADO);

    const segundo = http.expectOne(REFRESCO);
    expect(segundo.request.body).toEqual({ tokenRefresco: 'r2' });
    segundo.flush({ ...SESION_NUEVA, token: 'nuevo2', tokenRefresco: 'r3' });

    const reintento = http.expectOne(OTRA);
    expect(reintento.request.headers.get('Authorization')).toBe('Bearer nuevo2');
    reintento.flush({});

    http.verify();
  });
});
