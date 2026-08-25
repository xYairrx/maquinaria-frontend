import type { Routes } from '@angular/router';

import { t } from './nucleo/i18n/i18n';

import { guardPlataforma } from './nucleo/sesion/guard-plataforma';

/**
 * La superadministración: `admin.<dominio>`.
 *
 * Ojo a las rutas: el acceso es `/entrar`, igual que en una empresa, porque lo que
 * distingue las dos aplicaciones es el SUBDOMINIO, no el camino. Ya no existe
 * `/plataforma/entrar`: en `admin.<dominio>` todo es plataforma, y en
 * `<slug>.<dominio>` la plataforma no existe en absoluto —ni siquiera como ruta que
 * devuelva 403—.
 */
export const rutasPlataforma: Routes = [
  {
    path: 'entrar',
    title: () => t().titulos.superadministracion,
    loadComponent: () =>
      import('./paginas/plataforma/iniciar-sesion/iniciar-sesion').then(
        (m) => m.IniciarSesionPlataforma,
      ),
  },
  {
    path: '',
    canActivate: [guardPlataforma],
    loadComponent: () =>
      import('./disposicion/disposicion-plataforma').then((m) => m.DisposicionPlataforma),
    children: [
      {
        path: 'dashboard',
        title: () => t().titulos.panel,
        loadComponent: () =>
          import('./paginas/plataforma/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'planes',
        title: () => t().titulos.planes,
        loadComponent: () => import('./paginas/plataforma/planes/planes').then((m) => m.Planes),
      },
      {
        path: 'empresas',
        title: () => t().titulos.empresas,
        loadComponent: () =>
          import('./paginas/plataforma/empresas/empresas').then((m) => m.Empresas),
      },

      // El resumen es la pantalla de entrada del panel: quien acaba de iniciar sesión
      // quiere saber si hay algo que atender antes de ir a la lista completa.
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
