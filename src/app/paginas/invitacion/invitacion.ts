import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { Api } from '../../nucleo/api';
import type { InvitacionVigente } from '../../nucleo/contratos';
import { mensajeDeError } from '../../nucleo/mensaje-error';

/** Mínimo que exige la API. Repetirlo aquí evita un viaje para decir lo obvio. */
const LARGO_MINIMO = 12;

@Component({
  selector: 'app-invitacion',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <header>
        <h1 class="text-2xl font-semibold text-slate-900">Define tu contraseña</h1>

        @if (invitacion(); as inv) {
          <p class="mt-2 text-sm text-slate-600">
            Estás activando el acceso de <strong>{{ inv.nombre }}</strong>
            ({{ inv.correo }}) a <strong>{{ inv.empresa }}</strong>.
          </p>
        }
      </header>

      @switch (estado()) {
        @case ('cargando') {
          <p class="text-sm text-slate-600" role="status">Verificando la liga…</p>
        }

        @case ('invalida') {
          <div class="rounded-md border border-red-200 bg-red-50 p-4" role="alert">
            <p class="text-sm text-red-800">{{ error() }}</p>
            <p class="mt-2 text-sm text-red-700">
              Pide una invitación nueva a quien administra el sistema.
            </p>
          </div>
        }

        @case ('lista') {
          <form [formGroup]="formulario" (ngSubmit)="enviar()" class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <label for="contrasena" class="text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <input
                id="contrasena"
                type="password"
                formControlName="contrasena"
                autocomplete="new-password"
                [attr.aria-invalid]="contrasenaCorta()"
                aria-describedby="ayuda-contrasena"
                class="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900
                       focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
              <p id="ayuda-contrasena" class="text-xs text-slate-500">
                Al menos {{ largoMinimo }} caracteres. No se exigen mayúsculas ni símbolos:
                lo que cuenta es la longitud.
              </p>
            </div>

            <div class="flex flex-col gap-1">
              <label for="confirmacion" class="text-sm font-medium text-slate-700">
                Repítela
              </label>
              <input
                id="confirmacion"
                type="password"
                formControlName="confirmacion"
                autocomplete="new-password"
                [attr.aria-invalid]="noCoinciden()"
                class="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900
                       focus:outline-none focus:ring-2 focus:ring-slate-900/20"
              />
              @if (noCoinciden()) {
                <p class="text-xs text-red-700" role="alert">Las dos contraseñas no coinciden.</p>
              }
            </div>

            @if (error()) {
              <p class="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
                {{ error() }}
              </p>
            }

            <button
              type="submit"
              [disabled]="!puedeEnviar()"
              class="rounded-md bg-slate-900 px-4 py-2 text-white
                     disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {{ enviando() ? 'Activando…' : 'Activar mi cuenta' }}
            </button>
          </form>
        }
      }
    </main>
  `,
})
export class Invitacion {
  /**
   * Vienen del query string por `withComponentInputBinding()`. La liga que manda el
   * correo trae el slug prellenado a propósito: así nadie tiene que recordarlo la
   * primera vez.
   */
  readonly empresa = input('');
  readonly token = input('');

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly largoMinimo = LARGO_MINIMO;

  protected readonly estado = signal<'cargando' | 'lista' | 'invalida'>('cargando');
  protected readonly invitacion = signal<InvitacionVigente | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = this.fb.group({
    contrasena: ['', [Validators.required, Validators.minLength(LARGO_MINIMO)]],
    confirmacion: ['', Validators.required],
  });

  constructor() {
    // Se consulta la liga en cuanto los inputs de ruta están disponibles. La API dice
    // a quién va dirigida sin exigir sesión, que es lo que permite pintar la pantalla.
    effect(() => {
      const empresa = this.empresa();
      const token = this.token();

      if (empresa === '' || token === '') {
        this.estado.set('invalida');
        this.error.set('La liga está incompleta.');
        return;
      }

      this.api.consultarInvitacion(empresa, token).subscribe({
        next: (inv) => {
          this.invitacion.set(inv);
          this.estado.set('lista');
        },
        error: (e: unknown) => {
          this.error.set(mensajeDeError(e));
          this.estado.set('invalida');
        },
      });
    });
  }

  protected contrasenaCorta(): boolean {
    const control = this.formulario.controls.contrasena;

    return control.touched && control.invalid;
  }

  protected noCoinciden(): boolean {
    const { contrasena, confirmacion } = this.formulario.getRawValue();

    return confirmacion !== '' && contrasena !== confirmacion;
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.noCoinciden() && !this.enviando();
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { contrasena } = this.formulario.getRawValue();

    this.api.aceptarInvitacion(this.empresa(), this.token(), contrasena).subscribe({
      // No se inicia sesión automáticamente: que la persona escriba sus credenciales
      // una vez confirma que las recuerda, y de paso ejercita el login de verdad.
      next: () =>
        void this.router.navigate(['/entrar'], {
          queryParams: { empresa: this.empresa(), activada: '1' },
        }),
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
