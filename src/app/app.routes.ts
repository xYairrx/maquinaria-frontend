import type { Routes } from '@angular/router';

import { ambitoActual } from './nucleo/ambiente/tenant';
import { rutasEmpresa } from './rutas-empresa';
import { rutasPlataforma } from './rutas-plataforma';
import { rutasPortal } from './rutas-portal';

/**
 * Qué árbol de rutas se registra, según el subdominio.
 *
 * | Anfitrión                | Aplicación           |
 * |--------------------------|----------------------|
 * | `admin.<dominio>`        | Superadministración  |
 * | `<slug>.<dominio>`       | La empresa `<slug>`  |
 * | `<dominio>`, `login.…`   | Portal de entrada    |
 *
 * POR QUÉ SE ELIGE EL ÁRBOL Y NO SE REGISTRAN LOS TRES: en `bajio.<dominio>` las rutas
 * de plataforma sencillamente NO EXISTEN. No hay un `/plataforma` que devuelva 403 ni
 * un guard que las tape; no están. Es la misma idea que el aislamiento por base de
 * datos del backend: lo que no existe no se puede alcanzar por descuido.
 *
 * Se resuelve UNA VEZ al arrancar, no por navegación, porque el anfitrión no cambia sin
 * recargar la página. Cambiar de empresa es cambiar de origen.
 */
export function rutasDelAnfitrion(): Routes {
  const ambito = ambitoActual();

  switch (ambito.tipo) {
    case 'plataforma':
      return rutasPlataforma;

    case 'empresa':
      return rutasEmpresa;

    case 'portal':
      return rutasPortal;
  }
}
