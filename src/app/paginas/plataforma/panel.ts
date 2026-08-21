import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiPlataforma } from '../../nucleo/api-plataforma';
import {
  EstadoAprovisionamiento,
  EstadoTenant,
  type EmpresaAprovisionada,
  type ResumenEmpresa,
} from '../../nucleo/contratos-plataforma';
import { mensajeDeError } from '../../nucleo/mensaje-error';
import { SesionPlataformaStore } from '../../nucleo/sesion-plataforma';

/** Mismo patrón que el CHECK de la base y que FormatoSlug en el dominio. */
const PATRON_SLUG = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

@Component({
  selector: 'app-panel',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh bg-slate-50">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Plataforma</p>
            <h1 class="text-lg font-semibold text-slate-900">Empresas</h1>
          </div>
          <div class="flex items-center gap-3">
            <p class="text-sm text-slate-600">{{ identidad()?.correo }}</p>
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

      <main class="mx-auto flex max-w-5xl flex-col gap-6 p-4">
        @if (error()) {
          <p class="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{{ error() }}</p>
        }

        @if (reciente(); as r) {
          <section class="rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <h2 class="text-sm font-semibold text-emerald-900">
              {{ r.slug }} aprovisionada
            </h2>
            <p class="mt-1 text-sm text-emerald-800">
              Base <code>{{ r.nombreBd }}</code>, esquema <code>{{ r.versionEsquema }}</code>.
              @if (r.invitacionEnviada) {
                Invitación enviada.
              } @else {
                <strong>La invitación NO se envió</strong> — hay que reenviarla.
              }
            </p>

            @if (r.ligaInvitacion) {
              <p class="mt-2 break-all text-xs text-emerald-800">
                Liga (solo en desarrollo):
                <a [href]="r.ligaInvitacion" class="underline">{{ r.ligaInvitacion }}</a>
              </p>
            }
          </section>
        }

        <section class="rounded-md border border-slate-200 bg-white">
          <h2 class="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
            {{ empresas().length }} empresas
          </h2>

          @if (cargando()) {
            <p class="p-4 text-sm text-slate-600" role="status">Cargando…</p>
          } @else if (empresas().length === 0) {
            <p class="p-4 text-sm text-slate-600">Todavía no hay ninguna.</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th scope="col" class="px-4 py-2">Empresa</th>
                    <th scope="col" class="px-4 py-2">Razón social</th>
                    <th scope="col" class="px-4 py-2">Estado</th>
                    <th scope="col" class="px-4 py-2">Base</th>
                    <th scope="col" class="px-4 py-2">Plan</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of empresas(); track e.id) {
                    <tr class="border-b border-slate-100 last:border-0">
                      <td class="px-4 py-2 font-medium text-slate-900">{{ e.slug }}</td>
                      <td class="px-4 py-2 text-slate-700">{{ e.razonSocial }}</td>
                      <td class="px-4 py-2">{{ nombreEstado(e.estado) }}</td>
                      <td class="px-4 py-2">
                        <span
                          [class.text-emerald-700]="e.aprovisionamiento === lista"
                          [class.text-red-700]="e.aprovisionamiento === fallida"
                          [class.text-amber-700]="enProceso(e)"
                        >
                          {{ nombreAprovisionamiento(e.aprovisionamiento) }}
                        </span>
                      </td>
                      <td class="px-4 py-2 text-slate-700">
                        {{ e.codigoPlan ?? '— sin suscripción' }} ({{ e.modulos }} módulos)
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="rounded-md border border-slate-200 bg-white p-4">
          <h2 class="text-sm font-semibold text-slate-900">Dar de alta una empresa</h2>
          <p class="mt-1 text-xs text-slate-500">
            Crea y migra su base de datos, siembra sus roles y permisos, y manda la
            invitación a su primer administrador.
          </p>

          <form [formGroup]="formulario" (ngSubmit)="enviar()" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1">
              <label for="slug" class="text-sm font-medium text-slate-700">Identificador</label>
              <input
                id="slug"
                formControlName="slug"
                aria-describedby="ayuda-slug"
                class="rounded-md border border-slate-300 px-3 py-2"
              />
              <p id="ayuda-slug" class="text-xs text-slate-500">
                Minúsculas, dígitos y guiones. Es lo que su gente escribirá al entrar.
              </p>
            </div>

            <div class="flex flex-col gap-1">
              <label for="razonSocial" class="text-sm font-medium text-slate-700">
                Razón social
              </label>
              <input
                id="razonSocial"
                formControlName="razonSocial"
                class="rounded-md border border-slate-300 px-3 py-2"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label for="rfc" class="text-sm font-medium text-slate-700">RFC</label>
              <input id="rfc" formControlName="rfc" class="rounded-md border border-slate-300 px-3 py-2" />
            </div>

            <div class="flex flex-col gap-1">
              <label for="telefono" class="text-sm font-medium text-slate-700">Teléfono</label>
              <input
                id="telefono"
                formControlName="telefono"
                class="rounded-md border border-slate-300 px-3 py-2"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label for="nombreAdministrador" class="text-sm font-medium text-slate-700">
                Nombre del administrador
              </label>
              <input
                id="nombreAdministrador"
                formControlName="nombreAdministrador"
                class="rounded-md border border-slate-300 px-3 py-2"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label for="correoAdministrador" class="text-sm font-medium text-slate-700">
                Correo del administrador
              </label>
              <input
                id="correoAdministrador"
                type="email"
                formControlName="correoAdministrador"
                class="rounded-md border border-slate-300 px-3 py-2"
              />
            </div>

            <div class="sm:col-span-2">
              <button
                type="submit"
                [disabled]="formulario.invalid || enviando()"
                class="rounded-md bg-slate-900 px-4 py-2 text-white
                       disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {{ enviando() ? 'Aprovisionando…' : 'Dar de alta' }}
              </button>
              <p class="mt-2 text-xs text-slate-500">
                Tarda unos segundos: crea la base y le corre todas las migraciones.
              </p>
            </div>
          </form>
        </section>
      </main>
    </div>
  `,
})
export class Panel {
  private readonly api = inject(ApiPlataforma);
  private readonly router = inject(Router);
  private readonly sesion = inject(SesionPlataformaStore);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly lista = EstadoAprovisionamiento.Lista;
  protected readonly fallida = EstadoAprovisionamiento.Fallida;

  protected readonly identidad = this.sesion.identidad;
  protected readonly empresas = signal<readonly ResumenEmpresa[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly reciente = signal<EmpresaAprovisionada | null>(null);

  protected readonly formulario = this.fb.group({
    slug: ['', [Validators.required, Validators.pattern(PATRON_SLUG)]],
    razonSocial: ['', Validators.required],
    rfc: [''],
    telefono: [''],
    nombreAdministrador: ['', Validators.required],
    correoAdministrador: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    this.api.miSesion().subscribe({
      next: (id) => this.sesion.establecerIdentidad(id),
      error: (e: unknown) => this.error.set(mensajeDeError(e)),
    });

    this.recargar();
  }

  protected enProceso(e: ResumenEmpresa): boolean {
    return (
      e.aprovisionamiento === EstadoAprovisionamiento.Pendiente ||
      e.aprovisionamiento === EstadoAprovisionamiento.Creando
    );
  }

  protected nombreEstado(estado: EstadoTenant): string {
    switch (estado) {
      case EstadoTenant.Prueba:
        return 'Prueba';
      case EstadoTenant.Activo:
        return 'Activo';
      case EstadoTenant.Suspendido:
        return 'Suspendido';
      case EstadoTenant.Cancelado:
        return 'Cancelado';
    }
  }

  protected nombreAprovisionamiento(estado: EstadoAprovisionamiento): string {
    switch (estado) {
      case EstadoAprovisionamiento.Pendiente:
        return 'Pendiente';
      case EstadoAprovisionamiento.Creando:
        return 'Creando…';
      case EstadoAprovisionamiento.Lista:
        return 'Lista';
      case EstadoAprovisionamiento.Fallida:
        return 'Fallida';
    }
  }

  protected enviar(): void {
    if (this.formulario.invalid || this.enviando()) {
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const v = this.formulario.getRawValue();

    this.api
      .darDeAltaEmpresa({
        slug: v.slug,
        razonSocial: v.razonSocial,
        // Los opcionales van como null y no como cadena vacía: en la base la columna es
        // nullable, y guardar '' significaría "capturado y vacío", que es otra cosa.
        nombreComercial: null,
        rfc: v.rfc === '' ? null : v.rfc,
        telefono: v.telefono === '' ? null : v.telefono,
        correoContacto: null,
        correoAdministrador: v.correoAdministrador,
        nombreAdministrador: v.nombreAdministrador,
        codigoPlan: 'base',
      })
      .subscribe({
        next: (creada) => {
          this.reciente.set(creada);
          this.formulario.reset();
          this.enviando.set(false);
          this.recargar();
        },
        error: (e: unknown) => {
          this.error.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  protected salir(): void {
    this.sesion.cerrar();
    void this.router.navigate(['/plataforma/entrar']);
  }

  private recargar(): void {
    this.cargando.set(true);

    this.api.listarEmpresas().subscribe({
      next: (lista) => {
        this.empresas.set(lista);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }
}
