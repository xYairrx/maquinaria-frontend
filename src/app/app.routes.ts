import type { Routes } from '@angular/router';

import { guardPlataforma } from './nucleo/guard-plataforma';
import { guardSesion } from './nucleo/guard-sesion';

/**
 * Carga diferida por ruta de feature. Con 26 módulos previstos, un bundle único es
 * inviable, así que la regla se aplica desde la primera pantalla y no cuando ya duela.
 *
 * Dos árboles separados a propósito: `/plataforma/**` es el panel de superadministración
 * y el resto es la aplicación de las empresas. Son dos poblaciones distintas, con dos
 * ámbitos de JWT distintos, y cada una tiene su propio guard.
 */
export const routes: Routes = [
  // ------------------------------------------------------------ plataforma --
  {
    path: 'plataforma/entrar',
    title: 'Superadministración',
    loadComponent: () =>
      import('./paginas/plataforma/entrar-plataforma').then((m) => m.EntrarPlataforma),
  },
  {
    path: 'plataforma',
    title: 'Empresas',
    canActivate: [guardPlataforma],
    loadComponent: () => import('./paginas/plataforma/panel').then((m) => m.Panel),
  },

  // --------------------------------------------------------------- empresa --
  {
    path: 'invitacion',
    title: 'Define tu contraseña',
    loadComponent: () => import('./paginas/invitacion/invitacion').then((m) => m.Invitacion),
  },
  {
    path: 'entrar',
    title: 'Entrar',
    loadComponent: () => import('./paginas/entrar/entrar').then((m) => m.Entrar),
  },
  {
    path: 'inicio',
    title: 'Inicio',
    canActivate: [guardSesion],
    loadComponent: () => import('./paginas/inicio/inicio').then((m) => m.Inicio),
  },

  { path: '', pathMatch: 'full', redirectTo: 'inicio' },
  { path: '**', redirectTo: 'inicio' },
];
