import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { tenantActual } from '../../../nucleo/ambiente/tenant';
import { Api } from '../../../nucleo/api/api';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { MarcoAcceso } from '../../acceso/marco-acceso';

/**
 * Pedir la liga para restablecer la contraseña.
 *
 * ESTA PANTALLA NO PUEDE DELATAR SI UN CORREO EXISTE, y esa es la única regla que
 * gobierna su diseño. El backend responde 202 con un texto único tanto si la cuenta
 * existe como si no, y en tiempo constante; toda esa mecánica se tira a la basura si la
 * interfaz añade un caso propio —«no encontramos ese correo», un aviso distinto, otro
 * tiempo de espera— porque entonces el formulario se vuelve un enumerador de clientes
 * de la empresa.
 *
 * En la práctica eso significa tres cosas:
 *
 * 1. Del 202 solo se toma `mensaje` y se muestra tal cual. NO se reescribe como
 *    «te mandamos un correo»: el texto del servidor es condicional a propósito.
 * 2. No hay ninguna rama que dependa del correo escrito. El estado final es el mismo
 *    objeto para cualquier entrada.
 * 3. Los errores que sí se muestran son de transporte —429, servidor caído— y ninguno
 *    depende de si la cuenta existe.
 *
 * La empresa sale del SUBDOMINIO, igual que en `iniciar-sesion.ts`: no hay campo de empresa.
 */
@Component({
  selector: 'app-solicitar-restablecimiento',
  imports: [ReactiveFormsModule, RouterLink, MarcoAcceso],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitar-restablecimiento.html',
})
export class SolicitarRestablecimiento {
  private readonly api = inject(Api);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly empresa = tenantActual() ?? '';

  /**
   * `enviado` guarda el texto del servidor. Que sea el mensaje y no un booleano es
   * deliberado: obliga a pintar lo que respondió la API en lugar de un texto propio
   * que alguien podría afinar hasta volverlo informativo.
   */
  protected readonly enviado = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly formulario = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
  });

  protected enviar(): void {
    if (this.formulario.invalid || this.enviando()) {
      return;
    }

    this.enviando.set(true);
    this.error.set(null);

    const { correo } = this.formulario.getRawValue();

    this.api.solicitarRestablecimiento(this.empresa, correo).subscribe({
      // Un solo camino de éxito, sin ramas: aquí no se sabe —ni se quiere saber— si la
      // cuenta existía.
      next: (respuesta) => {
        this.enviado.set(respuesta.mensaje);
        this.enviando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(this.textoDeError(e));
        this.enviando.set(false);
      },
    });
  }

  /**
   * El 429 llega sin cuerpo —el limitador solo pone el código— así que `mensajeDeError`
   * devolvería «Error 429.». El límite es de 3 peticiones cada 15 minutos por empresa e
   * IP, y decirlo evita que alguien reintente pensando que se perdió el correo.
   *
   * Es un caso de transporte, no de cuenta: se dispara igual con un correo registrado
   * que con uno inventado, así que no delata nada.
   */
  private textoDeError(e: unknown): string {
    if (e instanceof HttpErrorResponse && e.status === 429) {
      return 'Se pidieron demasiadas ligas desde aquí. Espera 15 minutos e inténtalo de nuevo.';
    }

    return mensajeDeError(e);
  }
}
