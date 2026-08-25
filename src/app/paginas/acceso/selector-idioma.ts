import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { IDIOMAS, elegirIdioma, idioma, t, type Idioma } from '../../nucleo/i18n/i18n';
import { Bandera } from './bandera';

/**
 * Selector de idioma de las pantallas de acceso.
 *
 * Ya traduce: `elegir()` cambia el idioma de toda la aplicación y lo recuerda entre
 * visitas. El estado NO vive aquí —vive en `nucleo/i18n/i18n.ts`— porque el idioma no es
 * de este componente: el menú lateral, los errores de la API y `<html lang>` leen el
 * mismo.
 *
 * La lista tampoco está escrita aquí, por lo mismo: un ajuste de perfil necesitará los
 * mismos idiomas sin pasar por este desplegable.
 *
 * ARIA DE DIVULGACIÓN, NO DE LISTBOX. Se declara `aria-haspopup` + `aria-expanded` y el
 * panel es una lista de botones normales; NO lleva `role="listbox"` ni `role="option"`.
 * Antes sí los llevaba, y era una promesa vacía: un `listbox` obliga a mover la selección
 * con las flechas —más Home y End—, y anunciar el papel sin implementar su contrato de
 * teclado es peor que no anunciarlo, porque el lector de pantalla promete un
 * comportamiento que no está. Con dos idiomas, Tab basta.
 *
 * Es el mismo patrón que `disposicion/menu-usuario`, y a propósito: eran los dos
 * desplegables del repo resueltos de dos maneras distintas. Cuál es el idioma activo sigue
 * anunciándose, ahora con `aria-current` en su botón, que no promete nada de teclado.
 *
 * Lo obligatorio de un desplegable, sea cual sea el ARIA, y que antes faltaba entero:
 * Escape cierra y DEVUELVE EL FOCO al disparador, y un clic fuera cierra sin moverlo.
 */
@Component({
  selector: 'app-selector-idioma',
  imports: [Bandera],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './selector-idioma.html',
  host: {
    // Un clic fuera cierra. El de dentro no, y esa comprobación por contención es justo lo
    // que evita que el propio clic del disparador —que también burbujea hasta el
    // documento— lo cierre en el mismo gesto que lo abre.
    '(document:click)': 'cerrarSiEsFuera($event)',
    '(document:keydown.escape)': 'cerrarYDevolverFoco()',
  },
})
export class SelectorIdioma {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly disparador = viewChild<ElementRef<HTMLButtonElement>>('disparador');

  protected readonly t = t;
  protected readonly idiomas = IDIOMAS;
  protected readonly codigoActual = idioma;

  protected readonly abierto = signal(false);

  protected readonly actual = computed(
    () => this.idiomas.find((i) => i.codigo === this.codigoActual()) ?? this.idiomas[0],
  );

  protected alternar(): void {
    this.abierto.update((v) => !v);
  }

  protected elegir(codigo: Idioma['codigo']): void {
    elegirIdioma(codigo);
    this.abierto.set(false);

    // El botón que se pulsó desaparece con el panel, así que sin esto el foco cae al
    // `<body>` y hay que recorrer la pantalla de acceso entera para volver (WCAG 2.4.3).
    this.disparador()?.nativeElement.focus();
  }

  /**
   * Escape cierra y **devuelve el foco al disparador**.
   *
   * Sin lo segundo, cerrar con el foco puesto en una de las opciones lo deja en la nada: el
   * elemento enfocado desaparece del documento y el foco cae al `<body>`.
   */
  protected cerrarYDevolverFoco(): void {
    if (!this.abierto()) {
      return;
    }

    this.abierto.set(false);
    this.disparador()?.nativeElement.focus();
  }

  // `protected` y no `private`: lo invoca un `host listener`, que se compila como parte de
  // la plantilla y no puede llegar a un miembro privado.
  protected cerrarSiEsFuera(evento: Event): void {
    if (!this.abierto()) {
      return;
    }

    const destino = evento.target;

    // Un clic fuera no devuelve el foco: quien usa el ratón ya está mirando a otra parte, y
    // moverle el foco al selector sería un salto que no pidió.
    if (destino instanceof Node && !this.elemento.nativeElement.contains(destino)) {
      this.abierto.set(false);
    }
  }
}
