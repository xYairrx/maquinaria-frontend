import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { Api } from '../../nucleo/api';
import { mensajeDeError } from '../../nucleo/mensaje-error';
import { Sesion } from '../../nucleo/sesion';

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
  template: `
    <div class="min-h-dvh bg-slate-50">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
          <div>
            <h1 class="text-lg font-semibold text-slate-900">
              {{ identidad()?.razonSocial ?? '…' }}
            </h1>
            <p class="text-xs text-slate-500">{{ identidad()?.empresa }}</p>
          </div>

          <div class="flex items-center gap-3">
            <div class="text-right">
              <p class="text-sm font-medium text-slate-900">{{ identidad()?.nombre }}</p>
              <p class="text-xs text-slate-500">{{ identidad()?.correo }}</p>
            </div>
            <button
              type="button"
              (click)="salir()"
              class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700
                     hover:bg-slate-50"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-5xl p-4">
        @if (error()) {
          <p class="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{{ error() }}</p>
        }

        @if (identidad(); as id) {
          <section class="mb-6 rounded-md border border-slate-200 bg-white p-4">
            <h2 class="text-sm font-semibold text-slate-900">Tu acceso</h2>

            <dl class="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt class="text-slate-500">Autorización</dt>
                <dd class="font-medium text-slate-900">
                  {{ id.accesoTotal ? 'Acceso total (rol de sistema)' : id.permisos.length + ' permisos' }}
                </dd>
              </div>
              <div>
                <dt class="text-slate-500">Módulos contratados</dt>
                <dd class="font-medium text-slate-900">{{ id.modulos.length }} de 26</dd>
              </div>
              <div>
                <dt class="text-slate-500">Implementados</dt>
                <dd class="font-medium text-slate-900">{{ implementados() }}</dd>
              </div>
            </dl>

            @if (id.accesoTotal) {
              <p class="mt-3 text-xs text-slate-500">
                Tu rol salta la verificación de permisos. No se puede editar ni borrar, y no
                se asigna desde la interfaz.
              </p>
            }
          </section>

          <h2 class="mb-3 text-sm font-semibold text-slate-900">Módulos</h2>

          <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            @for (modulo of modulos(); track modulo.clave) {
              <li
                class="rounded-md border bg-white p-3"
                [class.border-slate-200]="modulo.listo"
                [class.border-dashed]="!modulo.listo"
                [class.border-slate-300]="!modulo.listo"
                [class.opacity-60]="!modulo.listo"
              >
                <p class="text-sm font-medium text-slate-900">{{ modulo.nombre }}</p>
                <p class="text-xs text-slate-500">
                  {{ modulo.listo ? 'Disponible' : 'Por construir' }}
                </p>
              </li>
            }
          </ul>
        } @else if (!error()) {
          <p class="text-sm text-slate-600" role="status">Cargando tu sesión…</p>
        }
      </main>
    </div>
  `,
})
export class Inicio {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly sesion = inject(Sesion);

  protected readonly identidad = this.sesion.identidad;
  protected readonly error = signal<string | null>(null);

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

  protected readonly implementados = computed(
    () => this.modulos().filter((m) => m.listo).length,
  );

  constructor() {
    this.api.miSesion().subscribe({
      next: (id) => this.sesion.establecerIdentidad(id),
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });
  }

  protected salir(): void {
    this.sesion.cerrar();
    void this.router.navigate(['/entrar']);
  }
}
