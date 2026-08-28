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
      {
        path: 'trabajadores',
        title: () => t().titulos.trabajadores,
        loadComponent: () =>
          import('./paginas/empresa/trabajadores/trabajadores').then((m) => m.Trabajadores),
      },
      {
        path: 'proveedores',
        title: () => t().titulos.proveedores,
        loadComponent: () =>
          import('./paginas/empresa/proveedores/proveedores').then((m) => m.Proveedores),
      },
      {
        path: 'clientes',
        title: () => t().titulos.clientes,
        loadComponent: () => import('./paginas/empresa/clientes/clientes').then((m) => m.Clientes),
      },
      {
        path: 'equipos',
        title: () => t().titulos.equipos,
        loadComponent: () => import('./paginas/empresa/equipos/equipos').then((m) => m.Equipos),
      },
      {
        // Detalle, no entrada de menu: se llega pulsando el codigo en la lista. El id entra
        // por `withComponentInputBinding` como el `input()` del componente.
        path: 'equipos/:id',
        title: () => t().titulos.expediente,
        loadComponent: () =>
          import('./paginas/empresa/expediente/expediente').then((m) => m.Expediente),
      },
      {
        path: 'traspasos',
        title: () => t().titulos.traspasos,
        loadComponent: () =>
          import('./paginas/empresa/traspasos/traspasos').then((m) => m.Traspasos),
      },
      {
        path: 'disponibilidad',
        title: () => t().titulos.disponibilidad,
        loadComponent: () =>
          import('./paginas/empresa/disponibilidad/disponibilidad').then((m) => m.Disponibilidad),
      },
      {
        path: 'cotizaciones',
        title: () => t().titulos.cotizaciones,
        loadComponent: () =>
          import('./paginas/empresa/cotizaciones/cotizaciones').then((m) => m.Cotizaciones),
      },
      {
        // El detalle va DESPUES del listado y con el mismo prefijo, igual que
        // `equipos/:id`: es donde viven las lineas y la maquina de estados. El listado no
        // las trae —el DTO del listado devuelve `Array.Empty`—, asi que esta pantalla
        // pide la cotizacion completa por su id.
        path: 'cotizaciones/:id',
        title: () => t().titulos.cotizacion,
        loadComponent: () =>
          import('./paginas/empresa/cotizacion/cotizacion').then((m) => m.CotizacionDetalle),
      },
      {
        path: 'rentas',
        title: () => t().titulos.rentas,
        loadComponent: () => import('./paginas/empresa/rentas/rentas').then((m) => m.Rentas),
      },
      {
        // El detalle es donde vive TODO lo que mueve el calendario: confirmar, extender,
        // cerrar y cancelar. El listado no ofrece ninguna de esas cuatro a proposito — son
        // irreversibles o casi, y se toman mirando los equipos de la renta, no una fila.
        path: 'rentas/:id',
        title: () => t().titulos.renta,
        loadComponent: () => import('./paginas/empresa/renta/renta').then((m) => m.RentaDetalle),
      },
      {
        path: 'contratos',
        title: () => t().titulos.contratos,
        loadComponent: () =>
          import('./paginas/empresa/contratos/contratos').then((m) => m.Contratos),
      },
      {
        path: 'contratos/:id',
        title: () => t().titulos.contrato,
        loadComponent: () =>
          import('./paginas/empresa/contrato/contrato').then((m) => m.ContratoDetalle),
      },
      {
        path: 'ordenes-compra',
        title: () => t().titulos.compras,
        loadComponent: () => import('./paginas/empresa/compras/compras').then((m) => m.Compras),
      },
      {
        path: 'ordenes-compra/:id',
        title: () => t().titulos.ordenCompra,
        loadComponent: () =>
          import('./paginas/empresa/orden-compra/orden-compra').then((m) => m.OrdenCompraDetalle),
      },
      {
        path: 'ordenes-venta',
        title: () => t().titulos.ventas,
        loadComponent: () => import('./paginas/empresa/ventas/ventas').then((m) => m.Ventas),
      },
      {
        path: 'ordenes-venta/:id',
        title: () => t().titulos.ordenVenta,
        loadComponent: () =>
          import('./paginas/empresa/orden-venta/orden-venta').then((m) => m.OrdenVentaDetalle),
      },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
    ],
  },

  // Cualquier otra cosa al armazón, que decide según haya sesión o no. Mandar aquí a
  // '/entrar' obligaría a quien ya entró a volver a la pantalla de acceso.
  { path: '**', redirectTo: '' },
];
