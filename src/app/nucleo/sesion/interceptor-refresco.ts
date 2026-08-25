import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import { RUTAS_DE_PLATAFORMA } from './interceptor-token';
import { RefrescoSesion } from './refresco-sesion';
import { Sesion } from './sesion';

/**
 * Un 401 de la API de EMPRESA refresca el token y reintenta la petición.
 *
 * Va SEPARADO de `interceptorToken`, y no es un `if` más dentro de él:
 *
 * - Poner el `Authorization` correcto es cosa de las DOS sesiones y ahí está bien
 *   compartido. Refrescar es cosa de UNA: el backend no tiene `sesion_refresh` para la
 *   plataforma —sigue siendo una decisión de esquema pendiente—, así que un 401 de
 *   `/api/plataforma/**` no tiene con qué refrescarse y se propaga tal cual.
 * - Y son dos momentos distintos del ciclo: uno toca la petición al salir, el otro la
 *   respuesta al volver. Mezclarlos obligaría a leer un archivo con dos vidas.
 *
 * SE REGISTRA ANTES de `interceptorToken` en `app.config.ts`, y de eso depende el
 * reintento: `siguiente` es el resto de la cadena, así que la petición que se reintenta
 * vuelve a pasar por el interceptor del token y sale con el `Bearer` NUEVO sin que aquí
 * haya que tocar ninguna cabecera.
 *
 * NO PUEDE HABER BUCLE, y las dos mitades están cerradas por construcción:
 *
 * 1. La petición de refresco sale por el `HttpBackend` (ver `Api.refrescarSesion`), así
 *    que no pasa por esta cadena y su propio 401 no pide otro refresco.
 * 2. El reintento se lanza DENTRO del `catchError`, y un `catchError` no atrapa lo que
 *    devuelve su propio manejador: si el reintento vuelve a dar 401, ese 401 sale a la
 *    pantalla.
 */
export const interceptorRefresco: HttpInterceptorFn = (peticion, siguiente) => {
  const esDeNuestraApi = peticion.url.startsWith(configuracion.urlApi);

  if (!esDeNuestraApi || peticion.url.includes(RUTAS_DE_PLATAFORMA)) {
    return siguiente(peticion);
  }

  // `inject` solo funciona en el cuerpo del interceptor, nunca dentro del `catchError`:
  // ahí ya no hay contexto de inyección.
  const sesion = inject(Sesion);
  const refresco = inject(RefrescoSesion);

  return siguiente(peticion).pipe(
    catchError((error: unknown) => {
      // Sin sesión abierta un 401 no es un token caducado: es el login contestando que
      // las credenciales no sirven, o una liga que ya no vale. Refrescar ahí sería pedir
      // un canje sin nada que canjear.
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !sesion.activa()) {
        return throwError(() => error);
      }

      // El 429 del limitador (10/min por slug+IP) cae aquí arriba y se propaga: NO es un
      // token caducado, y tratarlo como tal quemaría un refresco por cada rechazo.
      return refresco.refrescar().pipe(switchMap(() => siguiente(peticion)));
    }),
  );
};
