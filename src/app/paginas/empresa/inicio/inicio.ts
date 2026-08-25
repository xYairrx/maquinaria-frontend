import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { Sesion } from '../../../nucleo/sesion/sesion';

/** Nombres para mostrar de los módulos. El backend manda la clave. */
const NOMBRES: Readonly<Record<string, string>> = {
  dashboard: 'Dashboard',
  equipos: 'Equipos',
  disponibilidad: 'Disponibilidad',
  clientes: 'Clientes',
  cotizaciones: 'Cotizaciones',
  contratos: 'Contratos',
  rentas: 'Rentas',
  logistica: 'Logística y fletes',
  'inspeccion-salida': 'Inspección de salida',
  'inspeccion-devolucion': 'Inspección de devolución',
  evidencias: 'Evidencias',
  horometros: 'Horómetros',
  mantenimiento: 'Mantenimiento',
  'ordenes-trabajo': 'Órdenes de trabajo',
  'proximo-servicio': 'Próximo servicio',
  refacciones: 'Refacciones',
  compras: 'Compras',
  proveedores: 'Proveedores',
  pagos: 'Pagos y cobranza',
  facturacion: 'Facturación',
  sucursales: 'Sucursales y patios',
  usuarios: 'Usuarios y permisos',
  notificaciones: 'Notificaciones',
  reportes: 'Reportes',
  qr: 'QR de equipos',
  subrenta: 'Subrentas',
};

/** Lo que ya se puede construir. El resto se muestra apagado. */
const IMPLEMENTADOS = new Set(['usuarios']);

@Component({
  selector: 'app-inicio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inicio.html',
})
export class Inicio {
  // La identidad la carga DisposicionEmpresa, la ruta padre, una sola vez por sesión.
  // Pedirla también aquí duplicaba la petición en cada navegación al inicio.
  protected readonly identidad = inject(Sesion).identidad;

  /**
   * Se ordenan por nombre y se marca lo que ya existe.
   *
   * La lista viene de los MÓDULOS CONTRATADOS que devuelve la API, no de una constante
   * del front: si el plan de la empresa no incluye logística, aquí no aparece.
   */
  protected readonly modulos = computed(() =>
    (this.identidad()?.modulos ?? [])
      .map((clave) => ({
        clave,
        nombre: NOMBRES[clave] ?? clave,
        listo: IMPLEMENTADOS.has(clave),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  );

  protected readonly implementados = computed(() => this.modulos().filter((m) => m.listo).length);
}
