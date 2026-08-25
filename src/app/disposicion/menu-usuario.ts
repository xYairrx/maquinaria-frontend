import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { t } from '../nucleo/i18n/i18n';

/**
 * El avatar de la barra, y lo que cuelga de él: quién eres y cómo salir.
 *
 * Existe porque al poner el título de la pantalla en la barra, el nombre y el correo se
 * quedaron sin sitio: lo único que decía de quién era la sesión eran dos iniciales. Aquí
 * vuelven, sin gastar ancho de la barra.
 *
 * ARIA DE DIVULGACIÓN, NO DE MENÚ. Se declara `aria-expanded` + `aria-haspopup` y el panel
 * es una lista de botones normales; NO lleva `role="menu"` ni `role="menuitem"`. Un
 * `role="menu"` obliga a navegación con flechas, Home y End, y anunciarlo sin
 * implementarlo es peor que no anunciarlo: el lector de pantalla promete un
 * comportamiento que no está. Con dos elementos, Tab basta.
 *
 * Presentacional: recibe la identidad y emite `salir`. Lo usan las DOS aplicaciones, cuyas
 * sesiones viven en almacenes distintos, y que no conozca ninguno es lo que lo hace
 * reutilizable.
 */
@Component({
  selector: 'app-menu-usuario',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './menu-usuario.html',
  host: {
    // `relative` porque el panel se posiciona contra este elemento.
    class: 'relative shrink-0',
    // Un clic fuera cierra. El de dentro no, y esa comprobación es justo lo que evita que
    // el propio clic del disparador —que también burbujea hasta el documento— lo cierre
    // en el mismo gesto que lo abre.
    '(document:click)': 'cerrarSiEsFuera($event)',
    '(document:keydown.escape)': 'cerrarYDevolverFoco()',
  },
})
export class MenuUsuario {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly disparador = viewChild<ElementRef<HTMLButtonElement>>('disparador');

  protected readonly t = t;

  readonly nombre = input('');
  readonly correo = input('');

  readonly salir = output<void>();

  protected readonly abierto = signal(false);

  /**
   * Las iniciales, como mucho dos.
   *
   * Se sacan de las PALABRAS del nombre: «Yahir Almanza» da «YA». Con una sola palabra
   * queda una letra, que es correcto — inventar la segunda con un apellido que no tenemos
   * sería peor.
   */
  protected readonly iniciales = computed(() =>
    this.nombre()
      .split(/\s+/)
      .filter((parte) => parte !== '')
      .slice(0, 2)
      .map((parte) => parte[0].toUpperCase())
      .join(''),
  );

  protected alternar(): void {
    this.abierto.update((v) => !v);
  }

  protected pulsarSalir(): void {
    this.abierto.set(false);
    this.salir.emit();
  }

  /**
   * Escape cierra y **devuelve el foco al disparador**.
   *
   * Sin esto, cerrar con el foco puesto en «Salir» lo deja en la nada: el elemento
   * enfocado desaparece del documento y el foco cae al `<body>`, así que quien navega con
   * teclado tiene que recorrer la página entera otra vez (WCAG 2.4.3).
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

    // Un clic fuera no devuelve el foco: quien usa el ratón ya está mirando a otra parte,
    // y moverle el foco al avatar sería un salto que no pidió.
    if (destino instanceof Node && !this.elemento.nativeElement.contains(destino)) {
      this.abierto.set(false);
    }
  }
}
