import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { configuracion } from './configuracion';
import { Sesion } from './sesion';
import { SesionPlataformaStore } from './sesion-plataforma';

const RUTAS_DE_PLATAFORMA = '/api/plataforma';

/**
 * Agrega el `Authorization` correcto según a QUÉ ámbito va la petición.
 *
 * Dos comprobaciones, y las dos importan:
 *
 * 1. Solo se manda el token a NUESTRA API. Sin eso, cualquier petición a un tercero
 *    —un mapa, un CDN— saldría con el token del usuario en la cabecera.
 * 2. Se elige entre el token de plataforma y el de empresa por la RUTA. El backend
 *    firma los dos con la misma llave y los distingue por audiencia y por el claim
 *    `ambito`; mandar el equivocado da un 403 desconcertante. Elegir aquí evita
 *    reproducir ese error en cada llamada.
 */
export const interceptorToken: HttpInterceptorFn = (peticion, siguiente) => {
  if (!peticion.url.startsWith(configuracion.urlApi)) {
    return siguiente(peticion);
  }

  const esDePlataforma = peticion.url.includes(RUTAS_DE_PLATAFORMA);

  const token = esDePlataforma
    ? inject(SesionPlataformaStore).token()
    : inject(Sesion).token();

  if (token === null) {
    return siguiente(peticion);
  }

  return siguiente(peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
