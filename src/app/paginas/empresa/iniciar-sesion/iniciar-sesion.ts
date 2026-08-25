import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { Api } from '../../nucleo/api';
import { mensajeDeError } from '../../nucleo/mensaje-error';
import { Sesion } from '../../nucleo/sesion';

@Component({
  selector: 'app-entrar',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <header>
        <h1 class="text-2xl font-semibold text-slate-900">Entrar</h1>
        <p class="mt-2 text-sm text-slate-600">
          Sistema integral de operación y rentabilidad de activos.
        </p>
      </header>

      @if (activada() === '1') {
        <p class="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
          Tu cuenta quedó activada. Entra con tu correo y tu contraseña nueva.
        </p>
      }

      <form [formGroup]="formulario" (ngSubmit)="enviar()" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label for="empresa" class="text-sm font-medium text-slate-700">Empresa</label>
          <input
            id="empresa"
            formControlName="empresa"
            autocomplete="organization"
            aria-describedby="ayuda-empresa"
            class="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900
                   focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
          <p id="ayuda-empresa" class="text-xs text-slate-500">
            El identificador que te dieron. Se recuerda para la próxima vez.
          </p>
        </div>

        <div class="flex flex-col gap-1">
          <label for="correo" class="text-sm font-medium text-slate-700">Correo</label>
          <input
            id="correo"
            type="email"
            formControlName="correo"
            autocomplete="username"
            class="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900
                   focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
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
export class Entrar {
  readonly empresa = input('');
  readonly activada = input('');
  readonly destino = input('');

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly sesion = inject(Sesion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = this.fb.group({
    empresa: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', Validators.required],
  });

  constructor() {
    // El prellenado va en un effect y NO en el inicializador del formulario.
    //
    // Los inicializadores de campo corren durante la construcción, y el router asigna
    // los input() DESPUÉS. Ponerlo arriba dejaba el campo vacío aunque la URL trajera
    // ?empresa=bajio — justo la fricción que se quería resolver, roto en silencio.
    //
    // Se comprueba `pristine` para no pisar nunca lo que la persona ya escribió.
    effect(() => {
      const sugerida = this.empresa() || this.sesion.empresaRecordada();
      const control = this.formulario.controls.empresa;

      if (sugerida !== '' && control.pristine) {
        control.setValue(sugerida);
      }
    });
  }

  protected enviar(): void {
    if (this.formulario.invalid || this.enviando()) {
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { empresa, correo, contrasena } = this.formulario.getRawValue();

    this.api.iniciarSesion(empresa, correo, contrasena).subscribe({
      next: (sesion) => {
        this.sesion.abrir(sesion);
        void this.router.navigateByUrl(this.destino() || '/inicio');
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
