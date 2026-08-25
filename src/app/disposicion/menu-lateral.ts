import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { t } from '../nucleo/i18n/i18n';
import type { GrupoMenu } from './opciones-menu';

/**
 * El menú lateral. Presentacional puro: recibe los grupos ya filtrados y no sabe nada
 * de sesiones ni de permisos.
 *
 * Lo usan las DOS aplicaciones —empresa y superadministración— con datos distintos.
 * Que no conozca al usuario es lo que lo hace reutilizable: quien decide qué se ve es
 * la disposición que lo contiene.
 */
@Component({
  selector: 'app-menu-lateral',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './menu-lateral.html',
})
export class MenuLateral {
  /** Grupos YA filtrados por quien lo usa. */
  readonly grupos = input.required<readonly GrupoMenu[]>();

  /** Nombre del producto, al lado del cuadrado amarillo de identidad. */
  readonly producto = input.required<string>();

  /**
   * Línea descriptiva bajo el nombre del producto. Se muestra en mayúsculas pequeñas,
   * así que debe ser una etiqueta corta —la razón social de la empresa, el ámbito de la
   * aplicación—, no un dato largo como un correo.
   *
   * Las mayúsculas las pone la clase `uppercase`, no el dato: el valor original se
   * conserva para lectores de pantalla y para cuando el mismo texto se use en otro sitio.
   */
  readonly descripcion = input<string>('');

  /**
   * Distingue este `<nav>` de cualquier otro de la página. Con un solo landmark de
   * navegación bastaría «Principal», pero nombrarlo por producto evita ambigüedad si
   * mañana hay un menú secundario.
   */
  readonly etiquetaNavegacion = input<string>('');

  /**
   * Si el cajón está abierto. Solo importa **por debajo de `lg`**: desde ahí el menú es
   * una columna fija y las clases `lg:` ganan sobre este estado.
   *
   * Cerrado no basta con sacarlo de pantalla con un `translate`: seguiría en el orden de
   * tabulación y quien navega con teclado caería en un menú invisible. De ahí el
   * `invisible` —`visibility: hidden` sí saca del foco— revertido con `lg:visible`.
   */
  readonly abierto = input(false);

  /**
   * Vacío es «la de por defecto», no «sin etiqueta»: un `<nav>` sin nombre accesible es
   * justo lo que este input existe para evitar. El texto no puede ser el valor por
   * defecto del input porque se congelaría en el idioma del momento de construir.
   */
  protected readonly etiquetaFinal = computed(
    () => this.etiquetaNavegacion() || t().menu.navegacionPrincipal,
  );
}
