import type { Routes } from '@angular/router';

import { t } from './nucleo/i18n/i18n';

import { guardSesion } from './nucleo/sesion/guard-sesion';

/**
 * La aplicación de una empresa: `<slug>.<dominio>`.
 *
 * El acceso queda FUERA del armazón —no tiene menú— y todo lo demás cuelga de una ruta
 * padre con `children`. Esa forma es lo que hace que agregar una de las 26 pantallas
 * previstas sea una entrada en `children` y una línea en `menuEmpresa()`, sin tocar el
 * armazón ni repetir el menú en cada pantalla.
 *
 * Cada `loadComponent` es un chunk aparte. Con 26 módulos, un bundle único es inviable,
 * así que la regla se aplica desde la primera pantalla y no cuando ya duela.
 */
export const rutasEmpresa: Routes = [
  {
    path: 'invitacion',
    title: () => t().titulos.invitacion,
    loadComponent: () =>
      import('./paginas/empresa/aceptar-invitacion/aceptar-invitacion').then(
        (m) => m.AceptarInvitacion,
      ),
  },
  {
    path: 'entrar',
    title: () => t().titulos.entrar,
    loadComponent: () =>
      import('./paginas/empresa/iniciar-sesion/iniciar-sesion').then((m) => m.IniciarSesion),
  },

  // Las dos pantallas del restablecimiento van aquí, junto a `entrar` e `invitacion` y
  // FUERA del armazón: quien las abre no tiene sesión —por definición, no puede entrar—
  // así que no hay menú que dibujar ni identidad que cargar.
  {
    path: 'recuperar',
    title: () => t().titulos.recuperar,
    loadComponent: () =>
      import('./paginas/empresa/solicitar-restablecimiento/solicitar-restablecimiento').then(
        (m) => m.SolicitarRestablecimiento,
      ),
  },
  {
    path: 'restablecer',
    title: () => t().titulos.restablecer,
    loadComponent: () =>
      import('./paginas/empresa/restablecer-contrasena/restablecer-contrasena').then(
        (m) => m.RestablecerContrasena,
      ),
  },
  {
    path: '',
    canActivate: [guardSesion],
    loadComponent: () =>
      import('./disposicion/disposicion-empresa').then((m) => m.DisposicionEmpresa),
    children: [
      {
        path: 'inicio',
        title: () => t().titulos.inicio,
        loadComponent: () => import('./paginas/empresa/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'marcas',
        title: () => t().titulos.marcas,
        loadComponent: () => import('./paginas/empresa/marcas/marcas').then((m) => m.Marcas),
      },
      {
        path: 'categorias',
        title: () => t().titulos.categorias,
        loadComponent: () =>
          import('./paginas/empresa/categorias/categorias').then((m) => m.Categorias),
      },
      {
        path: 'puestos',
        title: () => t().titulos.puestos,
        loadComponent: () => import('./paginas/empresa/puestos/puestos').then((m) => m.Puestos),
      },
      {
        path: 'tipos',
        title: () => t().titulos.tipos,
        loadComponent: () => import('./paginas/empresa/tipos/tipos').then((m) => m.Tipos),
      },
      {
        path: 'tarifas',
        title: () => t().titulos.tarifas,
        loadComponent: () => import('./paginas/empresa/tarifas/tarifas').then((m) => m.Tarifas),
      },
      {
        path: 'clausulas',
        title: () => t().titulos.clausulas,
        loadComponent: () =>
          import('./paginas/empresa/clausulas/clausulas').then((m) => m.Clausulas),
      },
      {
        path: 'modelos',
        title: () => t().titulos.modelos,
        loadComponent: () => import('./paginas/empresa/modelos/modelos').then((m) => m.Modelos),
      },
      {
        path: 'ubicaciones',
        title: () => t().titulos.ubicaciones,
        loadComponent: () =>
          import('./paginas/empresa/ubicaciones/ubicaciones').then((m) => m.Ubicaciones),
      },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
    ],
  },

  // Cualquier otra cosa al armazón, que decide según haya sesión o no. Mandar aquí a
  // '/entrar' obligaría a quien ya entró a volver a la pantalla de acceso.
  { path: '**', redirectTo: '' },
];
