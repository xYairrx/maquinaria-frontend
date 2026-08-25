import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
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
  protected readonly estado = signal<'cargando' | 'lista' | 'invalida' | 'caido'>('cargando');
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

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

  constructor() {
    // Se consulta la liga en cuanto el input de ruta está disponible: no tiene sentido
    // pedir una contraseña que el servidor va a rechazar.
    effect(() => {
      const empresa = this.empresa;
      const token = this.token();

      // Se limpia antes de volver a preguntar: si la comprobación anterior falló y esta
      // sale bien, el formulario no debe aparecer con la alerta vieja encima.
      this.error.set(null);

      if (empresa === '' || token === '') {
        this.estado.set('invalida');
        this.error.set(t().restablecer.ligaIncompleta);
        return;
      }

      this.api.consultarRestablecimiento(empresa, token).subscribe({
        next: () => this.estado.set('lista'),
        error: (e: unknown) => {
          // 404 para todos los motivos —no existe, ya se usó, caducó— porque el backend
          // no los distingue: decir cuál es le diría a cualquiera con una liga vieja en
          // qué estado está la cuenta. El texto que llega ya viene redactado así.
          //
          // Cualquier otro código es un fallo de transporte y no dice nada de la liga.
          const noSirve = e instanceof HttpErrorResponse && e.status === 404;

          this.error.set(mensajeDeError(e));
          this.estado.set(noSirve ? 'invalida' : 'caido');
        },
      });
    });
  }

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
    this.error.set(null);

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
        this.error.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
