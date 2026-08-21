import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiPlataforma } from '../../nucleo/api-plataforma';
import { mensajeDeError } from '../../nucleo/mensaje-error';
import { SesionPlataformaStore } from '../../nucleo/sesion-plataforma';

@Component({
  selector: 'app-entrar-plataforma',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <header>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Plataforma</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">Superadministración</h1>
        <p class="mt-2 text-sm text-slate-600">
          Acceso de la plataforma. Aquí se dan de alta las empresas.
        </p>
      </header>

      <form [formGroup]="formulario" (ngSubmit)="enviar()" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="correo" class="text-sm font-medium text-slate-700">Correo</label>
          <input
            id="correo"
            type="email"
            formControlName="correo"
            autocomplete="username"
            aria-describedby="ayuda-correo"
            class="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900
                   focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
          <p id="ayuda-correo" class="text-xs text-slate-500">
            Sin empresa: los superadministradores viven en la base central.
          </p>
        </div>

        <div class="flex flex-col gap-1">
          <label for="contrasena" class="text-sm font-medium text-slate-700">Contraseña</label>
          <input
            id="contrasena"
            type="password"
            formControlName="contrasena"
            autocomplete="current-password"
            class="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900
                   focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        @if (error()) {
          <p class="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">{{ error() }}</p>
        }

        <button
          type="submit"
          [disabled]="formulario.invalid || enviando()"
          class="rounded-md bg-slate-900 px-4 py-2 text-white
                 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {{ enviando() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </main>
  `,
})
export class EntrarPlataforma {
  readonly destino = input('');

  private readonly api = inject(ApiPlataforma);
  private readonly router = inject(Router);
  private readonly sesion = inject(SesionPlataformaStore);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', Validators.required],
  });

  protected enviar(): void {
    if (this.formulario.invalid || this.enviando()) {
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { correo, contrasena } = this.formulario.getRawValue();

    this.api.iniciarSesion(correo, contrasena).subscribe({
      next: (sesion) => {
        this.sesion.abrir(sesion);
        void this.router.navigateByUrl(this.destino() || '/plataforma');
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
