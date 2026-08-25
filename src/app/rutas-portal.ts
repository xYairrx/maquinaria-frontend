import type { Routes } from '@angular/router';

/**
 * La puerta de entrada: el dominio pelado y `login.<dominio>`.
 *
 * Una sola pantalla, sin sesión y sin armazón: aquí todavía no se sabe a qué empresa se
 * entra, así que no hay menú que dibujar ni identidad que cargar.
 */
export const rutasPortal: Routes = [
  {
    path: 'entrar',
    title: 'Entrar a tu empresa',
    loadComponent: () =>
      import('./paginas/portal/seleccionar-empresa/seleccionar-empresa').then(
        (m) => m.SeleccionarEmpresa,
      ),
  },
  { path: '**', redirectTo: 'entrar' },
];
