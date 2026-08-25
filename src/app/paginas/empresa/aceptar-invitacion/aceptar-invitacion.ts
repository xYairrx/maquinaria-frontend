import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
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

  /**
   * OJO CON EL TIPO: dice `string` y en tiempo de ejecucion puede ser `undefined`.
   *
   * `withComponentInputBinding` asigna `undefined` cuando el parametro no esta en la URL, y
   * eso PISA el valor por defecto del `input`. De ahi que las comprobaciones de este archivo
   * usen falsy y no `=== ''`: con la comparacion estricta se pedia la liga `undefined` y el
   * servidor contestaba 404, asi que una liga que faltaba se veia como una liga caducada.
   */
  readonly token = input('');

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly largoMinimo = LARGO_MINIMO;

  /**
   * La liga se consulta sola: el recurso pide en cuanto hay empresa y token, y vuelve a
   * pedir si el token cambia. Antes esto era un `effect` con un `subscribe` dentro y tres
   * señales que había que mover a mano en cada rama.
   */
  private readonly liga = this.api.consultaDeInvitacion(this.empresa, this.token);

  protected readonly invitacion = this.liga.valor;
  protected readonly enviando = signal(false);

  /** El error del ALTA. El de la liga lo trae la consulta. */
  private readonly errorAceptar = signal<string | null>(null);

  /** Con el del alta por delante: es el que acaba de provocar la persona. */
  protected readonly error = computed(
    () => this.errorAceptar() ?? this.ligaIncompleta() ?? this.liga.error(),
  );

  /**
   * La liga sin empresa o sin token no llega a pedirse —el recurso se queda inactivo— así
   * que este caso lo dice la pantalla, no la API.
   */
  private readonly ligaIncompleta = computed(() =>
    !this.empresa || !this.token() ? t().invitacion.ligaIncompleta : null,
  );

  protected readonly estado = computed<'cargando' | 'lista' | 'invalida'>(() => {
    if (this.ligaIncompleta() !== null || this.liga.error() !== null) {
      return 'invalida';
    }

    return this.liga.resuelta() ? 'lista' : 'cargando';
  });

  protected readonly formulario = this.fb.group({
    contrasena: ['', [Validators.required, Validators.minLength(LARGO_MINIMO)]],
    confirmacion: ['', Validators.required],
  });

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
    this.errorAceptar.set(null);

    const { contrasena } = this.formulario.getRawValue();

    this.api.aceptarInvitacion(this.empresa, this.token(), contrasena).subscribe({
      // No se inicia sesión automáticamente: que la persona escriba sus credenciales
      // una vez confirma que las recuerda, y de paso ejercita el login de verdad.
      next: () =>
        void this.router.navigate(['/entrar'], {
          queryParams: { activada: '1' },
        }),
      error: (e: unknown) => {
        this.errorAceptar.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
