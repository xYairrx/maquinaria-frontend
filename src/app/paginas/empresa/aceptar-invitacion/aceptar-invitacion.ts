import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { Api } from '../../../nucleo/api/api';
import { t } from '../../../nucleo/i18n/i18n';
import type { InvitacionVigente } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { tenantActual } from '../../../nucleo/ambiente/tenant';
import { CampoContrasena } from '../../acceso/campo-contrasena';

/** Mínimo que exige la API. Repetirlo aquí evita un viaje para decir lo obvio. */
const LARGO_MINIMO = 12;

@Component({
  selector: 'app-aceptar-invitacion',
  imports: [CampoContrasena, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './aceptar-invitacion.html',
})
export class AceptarInvitacion {
  /**
   * Vienen del query string por `withComponentInputBinding()`. La liga que manda el
   * correo trae el slug prellenado a propósito: así nadie tiene que recordarlo la
   * primera vez.
   */
  /**
   * La empresa sale del SUBDOMINIO, no de la liga.
   *
   * La liga de invitacion apunta a `bajio.<dominio>/invitacion?token=...`: el slug ya
   * viene en el host, asi que no hace falta repetirlo en la cadena de consulta.
   */
  protected readonly empresa = tenantActual() ?? '';

  readonly token = input('');

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
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
      const empresa = this.empresa;
      const token = this.token();

      if (empresa === '' || token === '') {
        this.estado.set('invalida');
        this.error.set(t().invitacion.ligaIncompleta);
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

    this.api.aceptarInvitacion(this.empresa, this.token(), contrasena).subscribe({
      // No se inicia sesión automáticamente: que la persona escriba sus credenciales
      // una vez confirma que las recuerda, y de paso ejercita el login de verdad.
      next: () =>
        void this.router.navigate(['/entrar'], {
          queryParams: { activada: '1' },
        }),
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
