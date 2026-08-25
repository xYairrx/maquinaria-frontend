import type { Routes } from '@angular/router';

import { guardSesion } from './nucleo/sesion/guard-sesion';

/**
 * La aplicación de una empresa: `<slug>.<dominio>`.
 *
 * El acceso queda FUERA del armazón —no tiene menú— y todo lo demás cuelga de una ruta
 * padre con `children`. Esa forma es lo que hace que agregar una de las 26 pantallas
 * previstas sea una entrada en `children` y una línea en `MENU_EMPRESA`, sin tocar el
 * armazón ni repetir el menú en cada pantalla.
 *
 * Cada `loadComponent` es un chunk aparte. Con 26 módulos, un bundle único es inviable,
 * así que la regla se aplica desde la primera pantalla y no cuando ya duela.
 */
export const rutasEmpresa: Routes = [
  {
    path: 'invitacion',
    title: 'Define tu contraseña',
    loadComponent: () =>
      import('./paginas/empresa/aceptar-invitacion/aceptar-invitacion').then(
        (m) => m.AceptarInvitacion,
      ),
  },
  {
    path: 'entrar',
    title: 'Entrar',
    loadComponent: () =>
      import('./paginas/empresa/iniciar-sesion/iniciar-sesion').then((m) => m.IniciarSesion),
  },

  // Las dos pantallas del restablecimiento van aquí, junto a `entrar` e `invitacion` y
  // FUERA del armazón: quien las abre no tiene sesión —por definición, no puede entrar—
  // así que no hay menú que dibujar ni identidad que cargar.
  {
    path: 'recuperar',
    title: 'Recuperar tu contraseña',
    loadComponent: () =>
      import('./paginas/empresa/solicitar-restablecimiento/solicitar-restablecimiento').then(
        (m) => m.SolicitarRestablecimiento,
      ),
  },
  {
    path: 'restablecer',
    title: 'Tu contraseña nueva',
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
        title: 'Inicio',
        loadComponent: () => import('./paginas/empresa/inicio/inicio').then((m) => m.Inicio),
      },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
    ],
  },

  // Cualquier otra cosa al armazón, que decide según haya sesión o no. Mandar aquí a
  // '/entrar' obligaría a quien ya entró a volver a la pantalla de acceso.
  { path: '**', redirectTo: '' },
];
