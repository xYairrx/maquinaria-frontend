import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { Sesion } from './sesion';

/**
 * Deja pasar solo con sesión abierta.
 *
 * Es comodidad de interfaz, NO seguridad: la autorización real la hace la API con el
 * JWT en cada petición. Un guard que se pueda quitar desde las herramientas del
 * navegador no protege nada, y confundir las dos cosas es como se construyen
 * frontends que "validan permisos".
 */
export const guardSesion: CanActivateFn = (_ruta, estado) => {
  if (inject(Sesion).activa()) {
    return true;
  }

  const router = inject(Router);

  return router.createUrlTree(['/entrar'], {
    queryParams: { destino: estado.url },
  });
};
