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
 * Un panel que entra DESDE LA DERECHA, de alto completo. El formulario de alta y edición de
 * las pantallas de empresa.
 *
 * POR QUE NO LA HOJA INFERIOR. `disposicion/hoja.ts` nació para el panel de
 * superadministración —formularios cortos, sin una tabla debajo compitiendo por la atención— y
 * ahí se queda. En una pantalla de empresa el formulario convive con una tabla ancha: una hoja
 * que sube tapa justo las filas que se estaban mirando, mientras que un panel lateral las deja
 * a la vista. Son dos patrones para dos sitios, no uno que sustituye al otro.
 *
 * Y NO ES ARRASTRABLE, a diferencia de la hoja. El gesto de arrastre existe en la hoja porque
 * tiene varios anclajes entre los que moverse; aquí el panel tiene un solo tamaño, así que un
 * asa no llevaría a ninguna parte. Se cierra con Escape, con el botón de cerrar o pulsando el
 * velo — tres caminos, ninguno exclusivo de un puntero (WCAG 2.1.1).
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
