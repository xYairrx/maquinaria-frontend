import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Api } from '../../../nucleo/api/api';
import { t } from '../../../nucleo/i18n/i18n';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { Sesion } from '../../../nucleo/sesion/sesion';
import { tenantActual } from '../../../nucleo/ambiente/tenant';
import { CampoContrasena } from '../../acceso/campo-contrasena';
import { MarcoAcceso } from '../../acceso/marco-acceso';

@Component({
  selector: 'app-iniciar-sesion',
  imports: [CampoContrasena, ReactiveFormsModule, RouterLink, MarcoAcceso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './iniciar-sesion.html',
})
export class IniciarSesion {
  readonly activada = input('');

  /**
   * Se llega con `?restablecida=1` desde `/restablecer`.
   *
   * Es un aviso APARTE de `activada` y no el mismo: activar una cuenta por invitación y
   * restablecer una contraseña acaban en la misma pantalla, pero lo que hay que decir
   * es distinto —el restablecimiento acaba de cerrar las demás sesiones— y un texto que
   * sirva para los dos casos terminaría sin decir ninguno de los dos.
   */
  readonly restablecida = input('');

  /**
   * Se llega con `?expirada=1` desde el interceptor de refresco, cuando el canje del
   * token de refresco falla y no hay reintento posible.
   *
   * Aviso APARTE de los otros dos por la misma razon que ellos entre si: aqui nadie
   * activo ni cambio nada, simplemente se le acabo la sesion a media tarea. Sin este
   * texto la persona vuelve al acceso sin explicacion y lo lee como que algo se rompio.
   */
  readonly expirada = input('');

  readonly destino = input('');

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly sesion = inject(Sesion);
  private readonly fb = inject(NonNullableFormBuilder);

  /**
   * La empresa sale del SUBDOMINIO, no de un campo.
   *
   * Ya no hay tercer campo que rellenar ni identificador que recordar: quien abre
   * `bajio.<dominio>` está entrando a `bajio`. La arquitectura sigue exigiendo saber la
   * empresa antes de validar nada —cada una tiene su propia base de datos—, pero ahora
   * lo dice la URL.
   *
   * Esta ruta solo existe en un subdominio de empresa, así que aquí nunca es null: en
   * el dominio pelado y en `login.<dominio>` se registra otro árbol de rutas, donde
   * `/entrar` es la pantalla que pregunta a qué empresa se entra.
   */
  protected readonly empresa = tenantActual() ?? '';

  protected readonly t = t;

  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', Validators.required],
  });

  protected enviar(): void {
    if (this.enviando()) {
      return;
    }

    // Un formulario invalido no se ignora en silencio: se marca para que el
    // navegador muestre los campos en falta y se dice que pasa. Antes el clic
    // no producia ningun efecto visible.
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set(t().comun.faltanCredenciales);
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { correo, contrasena } = this.formulario.getRawValue();

    this.api.iniciarSesion(this.empresa, correo, contrasena).subscribe({
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
