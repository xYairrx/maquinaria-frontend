import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { tenantActual } from '../../../nucleo/ambiente/tenant';
import { Api } from '../../../nucleo/api/api';
import { t } from '../../../nucleo/i18n/i18n';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { CampoContrasena } from '../../acceso/campo-contrasena';
import { MarcoAcceso } from '../../acceso/marco-acceso';

/** Mínimo que exige la API (`PoliticaContrasena.LargoMinimo`). Repetirlo aquí evita un
 * viaje para decir lo obvio; el que cuenta sigue siendo el del servidor. */
const LARGO_MINIMO = 12;

/** Tope del backend. Cortar aquí evita mandar 4 KB para que rebote. */
const LARGO_MAXIMO = 256;

/**
 * Definir la contraseña nueva desde la liga del correo.
 *
 * Misma forma que `aceptar-invitacion.ts` —token en la URL, validar, pedir contraseña,
 * confirmar— porque es el mismo problema. Las dos diferencias son de fondo:
 *
 * - La consulta devuelve 204 vacío, no los datos de la cuenta. El backend no dice a
 *   quién pertenece la liga a propósito: una liga adivinada no debe convertirse en una
 *   fuente de correos. Así que esta pantalla no puede saludar por el nombre, y no lo
 *   inventa.
 * - Al restablecer se revocan las demás sesiones abiertas. Eso se avisa ANTES de
 *   guardar, no después: quien tenga la sesión abierta en otro dispositivo merece
 *   saber que va a cerrarse.
 */
@Component({
  selector: 'app-restablecer-contrasena',
  imports: [CampoContrasena, ReactiveFormsModule, RouterLink, MarcoAcceso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './restablecer-contrasena.html',
})
export class RestablecerContrasena {
  /**
   * Viene del query string por `withComponentInputBinding()`.
   *
   * La empresa NO viaja en la liga: sale del subdominio, igual que en `iniciar-sesion.ts`. La
   * liga del correo apunta a `bajio.<dominio>/restablecer?token=…`.
   */
  /**
   * OJO CON EL TIPO: dice `string` y en tiempo de ejecucion puede ser `undefined`.
   *
   * `withComponentInputBinding` asigna `undefined` cuando el parametro no esta en la URL, y
   * eso PISA el valor por defecto del `input`. De ahi que las comprobaciones de este archivo
   * usen falsy y no `=== ''`: con la comparacion estricta se pedia la liga `undefined` y el
   * servidor contestaba 404, asi que una liga que faltaba se veia como una liga caducada.
   */
  readonly token = input('');

  protected readonly empresa = tenantActual() ?? '';

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly largoMinimo = LARGO_MINIMO;

  /**
   * `invalida` y `caido` son estados DISTINTOS a propósito.
   *
   * Solo el 404 significa que la liga no sirve; un servidor apagado o una red caída no
   * dicen nada de la liga, y titular «la liga ya no sirve» ahí manda a pedir otra —que
   * tampoco va a llegar— en vez de a reintentar dentro de un rato.
   */
  /**
   * La liga se consulta sola: el recurso pide en cuanto hay empresa y token, y vuelve a
   * pedir si el token cambia. Antes era un `effect` con un `subscribe` dentro.
   */
  private readonly liga = this.api.consultaDeRestablecimiento(this.empresa, this.token);

  protected readonly enviando = signal(false);

  /** El error de GUARDAR. El de la liga lo trae la consulta. */
  private readonly errorGuardar = signal<string | null>(null);

  protected readonly error = computed(
    () => this.errorGuardar() ?? this.ligaIncompleta() ?? this.liga.error(),
  );

  /**
   * Sin empresa o sin token el recurso no llega a pedir nada —se queda inactivo—, así que
   * este caso lo dice la pantalla y no la API.
   */
  private readonly ligaIncompleta = computed(() =>
    !this.empresa || !this.token() ? t().restablecer.ligaIncompleta : null,
  );

  /**
   * `invalida` y `caido` son estados DISTINTOS, y ahora el que los separa es `noSirve`.
   *
   * Solo el 404 significa que la liga no sirve; un servidor apagado o una red caída no
   * dicen nada de la liga, y titular «la liga ya no sirve» ahí manda a pedir otra —que
   * tampoco va a llegar— en vez de a reintentar dentro de un rato.
   */
  protected readonly estado = computed<'cargando' | 'lista' | 'invalida' | 'caido'>(() => {
    if (this.ligaIncompleta() !== null) {
      return 'invalida';
    }

    if (this.liga.error() !== null) {
      return this.liga.noSirve() ? 'invalida' : 'caido';
    }

    return this.liga.resuelta() ? 'lista' : 'cargando';
  });

  /**
   * El `<h1>` lo pone el marco, así que el título cambia con el estado en lugar de
   * añadir un encabezado por rama: una pantalla, un solo `<h1>`.
   */
  protected readonly titulo = computed(() =>
    this.estado() === 'invalida' ? t().restablecer.tituloInvalida : t().restablecer.titulo,
  );

  protected readonly apoyo = computed(() =>
    this.estado() === 'lista' || this.estado() === 'cargando' ? t().restablecer.apoyo : '',
  );

  /** La empresa se resalta solo cuando acompaña a esa línea de apoyo. */
  protected readonly apoyoDestacado = computed(() => (this.apoyo() === '' ? '' : this.empresa));

  protected readonly formulario = this.fb.group({
    contrasena: [
      '',
      [Validators.required, Validators.minLength(LARGO_MINIMO), Validators.maxLength(LARGO_MAXIMO)],
    ],
    confirmacion: ['', Validators.required],
  });

  protected contrasenaInvalida(): boolean {
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
    this.errorGuardar.set(null);

    const { contrasena } = this.formulario.getRawValue();

    this.api.restablecerContrasena(this.empresa, this.token(), contrasena).subscribe({
      // No se inicia sesión automáticamente, igual que al aceptar una invitación: el
      // backend acaba de revocar todas las sesiones de esa cuenta, así que entrar a mano
      // con la contraseña nueva es exactamente lo que toca.
      next: () =>
        void this.router.navigate(['/entrar'], {
          queryParams: { restablecida: '1' },
        }),
      error: (e: unknown) => {
        this.errorGuardar.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
