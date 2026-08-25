import type { Routes } from '@angular/router';

import { t } from './nucleo/i18n/i18n';

/**
 * La puerta de entrada: el dominio pelado y `login.<dominio>`.
 *
 * Una sola pantalla, sin sesión y sin armazón: aquí todavía no se sabe a qué empresa se
 * entra, así que no hay menú que dibujar ni identidad que cargar.
 */
export const rutasPortal: Routes = [
  {
    path: 'entrar',
    title: () => t().titulos.portal,
    loadComponent: () =>
      import('./paginas/portal/seleccionar-empresa/seleccionar-empresa').then(
        (m) => m.SeleccionarEmpresa,
      ),
  },
  { path: '**', redirectTo: 'entrar' },
];
