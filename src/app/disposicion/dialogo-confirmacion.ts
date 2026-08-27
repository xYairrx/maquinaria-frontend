import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';

import { t } from '../nucleo/i18n/i18n';
import { Confirmacion } from './confirmacion';

/**
 * El diálogo que sustituye a `confirm()`.
 *
 * Va montado UNA VEZ en cada armazón, igual que la barra: las pantallas no lo dibujan, solo
 * llaman a `Confirmacion.pedir()`. Dieciocho pantallas con su propio diálogo serían
 * dieciocho copias del mismo marcado.
 *
 * SOBRE EL ELEMENTO: es un `<dialog>` con `showModal()`. De ahí salen gratis el atrapado de
 * foco, `aria-modal`, el resto de la página inerte, la capa superior y el cierre con
 * Escape. Reimplementar eso a mano son tres escuchas de documento y una comprobación de
 * contención, que es justo lo que este proyecto ya decidió no hacer en `hoja.ts`.
 *
 * Lo que el navegador NO da, y por eso está escrito aquí, son las mismas tres cosas que ya
 * costaron un fallo en la hoja:
 *
 * 1. **El clic en el velo no cierra.** Un `<dialog>` modal cierra con Escape pero ignora su
 *    propio velo.
 * 2. **`(close)` no es opcional.** Escape lo cierra el NAVEGADOR sin pasar por aquí, y sin
 *    escucharlo la promesa se queda colgada para siempre: quien esperaba la respuesta nunca
 *    la recibe.
 * 3. **`display: none` del cerrado hay que reponerlo** si se pisa el `display`. Está en la
 *    utilidad `dialogo-confirmacion` de `styles.css`.
 */
@Component({
  selector: 'app-dialogo-confirmacion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dialogo-confirmacion.html',
})
export class DialogoConfirmacion {
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly confirmacion = inject(Confirmacion);

  protected readonly t = t;
  protected readonly peticion = this.confirmacion.peticion;

  constructor() {
    effect(() => {
      const dialogo = this.dialogo()?.nativeElement;

      if (dialogo === undefined) {
        return;
      }

      if (this.peticion() !== null && !dialogo.open) {
        dialogo.showModal();
      } else if (this.peticion() === null && dialogo.open) {
        dialogo.close();
      }
    });
  }

  protected responder(respuesta: boolean): void {
    this.confirmacion.responder(respuesta);
  }

  /**
   * Cierra si el clic cayó en el VELO.
   *
   * SE COMPRUEBA POR `target`, NO POR COORDENADAS. Un `click` nacido del TECLADO —Enter o
   * Espacio sobre un botón— llega con `clientX` y `clientY` en cero, así que una
   * comprobación geométrica lee ese cero como «por encima del diálogo» y **pulsar cualquier
   * botón de dentro con el teclado cancelaría la acción**. Es el fallo que ya se pagó en
   * `hoja.ts`; aquí sería peor, porque cancelaría justo lo que la persona acaba de
   * confirmar.
   */
  protected alPulsar(evento: MouseEvent): void {
    const dialogo = this.dialogo()?.nativeElement;

    if (dialogo !== undefined && evento.target === dialogo) {
      this.responder(false);
    }
  }

  /**
   * Lo emite el `<dialog>` al cerrarse, y **cerrar sin elegir es NO**.
   *
   * Escape lo cierra el navegador sin pasar por `responder`, así que sin esto la promesa se
   * queda sin resolver: la pantalla que esperaba nunca continúa y su botón se queda
   * bloqueado. Que el desenlace por omisión sea `false` no es arbitrario — es lo seguro:
   * quien huye de un diálogo destructivo no quiere ejecutarlo.
   */
  protected alCerrarse(): void {
    if (this.peticion() !== null) {
      this.responder(false);
    }
  }
}
