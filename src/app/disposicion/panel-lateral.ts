import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

import { t } from '../nucleo/i18n/i18n';

/**
 * Un panel que entra DESDE LA DERECHA, de alto completo. Todo formulario de alta y edición de
 * la aplicación: las pantallas de empresa y, desde el 2026-09-01, también las de plataforma.
 *
 * ES EL ÚNICO PATRÓN, y antes eran dos. `disposicion/hoja.ts` —la hoja inferior arrastrable—
 * se quedaba con el panel de superadministración con el argumento de que ahí los formularios
 * son cortos y no hay una tabla debajo compitiendo por la atención. Las dos mitades del
 * argumento resultaron falsas: el alta de una empresa tiene siete campos y la lista de
 * empresas es justo lo que la hoja tapaba al subir. Un solo patrón para el mismo gesto —abrir
 * un formulario sobre una lista— es además una cosa menos que aprender al cambiar de
 * aplicación.
 *
 * NO ES ARRASTRABLE, y ahí está lo que se perdió a cambio: el gesto de la hoja movía entre
 * varios anclajes, y aquí el panel tiene un solo tamaño, así que un asa no llevaría a ninguna
 * parte. Se cierra con Escape, con el botón de cerrar o pulsando el velo — tres caminos,
 * ninguno exclusivo de un puntero (WCAG 2.1.1).
 *
 * RESPONSIVO SIN QUE LO PIDA CADA PANTALLA: la utilidad `panel-lateral` de `src/styles.css` lo
 * deja a todo el ancho en teléfono y lo para en 32rem desde `sm`. Una pantalla que quiera otro
 * ancho está pidiendo otro componente, no un input más.
 *
 * Sobre el elemento: es un `<dialog>` con `showModal()`. De ahí salen gratis el atrapado de
 * foco, el `aria-modal`, el resto de la página inerte, la capa superior y el cierre con
 * Escape. Lo que el navegador NO da, y hay que escribir, está anotado abajo y en la utilidad
 * `panel-lateral` de `src/styles.css`.
 */
@Component({
  selector: 'app-panel-lateral',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-lateral.html',
})
export class PanelLateral {
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');

  readonly abierto = input(false);

  readonly titulo = input('');

  /** Línea de apoyo bajo el título. Dice qué es lo que se está capturando. */
  readonly apoyo = input('');

  readonly cerrar = output<void>();

  protected readonly t = t;

  constructor() {
    effect(() => {
      const dialogo = this.dialogo()?.nativeElement;

      if (dialogo === undefined) {
        return;
      }

      if (this.abierto() && !dialogo.open) {
        dialogo.showModal();
      } else if (!this.abierto() && dialogo.open) {
        dialogo.close();
      }
    });
  }

  /**
   * Cierra al pulsar el velo.
   *
   * SE COMPRUEBA POR `target`, NO POR COORDENADAS. Es la trampa que la hoja ya pagó: un clic
   * nacido del TECLADO —Enter o espacio sobre un botón de dentro— llega con `clientX` y
   * `clientY` en cero, así que una comprobación geométrica lo lee como «pulsó fuera» y cierra
   * el panel entero al usar cualquier botón con teclado. Con `target` no hay ambigüedad: el
   * velo es el propio `<dialog>`, y lo de dentro son sus hijos.
   */
  protected alPulsarVelo(evento: MouseEvent): void {
    if (evento.target === this.dialogo()?.nativeElement) {
      this.cerrar.emit();
    }
  }

  /**
   * Lo emite el `<dialog>` al cerrarse.
   *
   * NO es opcional: Escape lo cierra el NAVEGADOR sin pasar por aquí, y sin escuchar `close`
   * la señal de quien nos usa se queda diciendo que está abierto —y como su efecto no se
   * reejecuta si nada cambió, el botón deja de abrir el panel para siempre.
   */
  protected alCerrarse(): void {
    if (this.abierto()) {
      this.cerrar.emit();
    }
  }
}
