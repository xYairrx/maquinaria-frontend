import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { SesionPlataformaStore } from './sesion-plataforma';

/**
 * Comodidad de interfaz, no seguridad: la autorización real la hace la API con la
 * policy de ámbito en cada petición.
 */
export const guardPlataforma: CanActivateFn = (_ruta, estado) => {
  if (inject(SesionPlataformaStore).activa()) {
    return true;
  }

  return inject(Router).createUrlTree(['/entrar'], {
    queryParams: { destino: estado.url },
  });
};
