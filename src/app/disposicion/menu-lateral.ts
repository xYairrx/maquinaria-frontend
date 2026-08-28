import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map } from 'rxjs';

import { t } from '../nucleo/i18n/i18n';
import { alPulsarGrupo, grupoEstaAbierto, idDePanel } from './opciones-menu';
import type { EleccionDeMenu, GrupoMenu } from './opciones-menu';

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
  private readonly router = inject(Router);

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

  /**
   * Lo que la persona ha elegido abrir. **Un título, no un conjunto.**
   *
   * Que sea uno solo es lo que hace el acordeón EXCLUSIVO por construcción: no hay código
   * que cierre a los demás, porque no caben dos. Con un mapa de abiertos habría que
   * acordarse de cerrar el resto en cada sitio que abra uno.
   *
   * `undefined` es «no ha tocado nada» y entonces manda la ruta; `null` es «cerró el que
   * había». Ver `EleccionDeMenu`.
   */
  private readonly eleccion = signal<EleccionDeMenu>(undefined);

  /**
   * La URL activa, COMO SEÑAL.
   *
   * `router.url` es una propiedad normal, así que un `computed` que la leyera no registraría
   * dependencia y se quedaría con el valor del primer render — la trampa que este repo ya
   * pagó dos veces. El puente es el flujo de eventos del router.
   */
  private readonly urlActiva = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Si un grupo está abierto: lo que decidió el usuario, y si no ha decidido, si la ruta
   * activa vive dentro.
   *
   * Abrirlo por la ruta importa al ENTRAR y al recargar: sin esto, quien recarga estando en
   * `/tarifas` ve todos los grupos cerrados y ninguna pista de dónde está.
   */
  protected grupoAbierto(grupo: GrupoMenu): boolean {
    return grupoEstaAbierto(grupo, this.urlActiva(), this.eleccion());
  }

  protected alternarGrupo(grupo: GrupoMenu): void {
    this.eleccion.set(alPulsarGrupo(grupo, this.urlActiva(), this.eleccion()));
  }

  /**
   * El `id` del panel de un grupo, para el `aria-controls` de su disparador.
   *
   * Sale del título, que es texto traducido, así que se normaliza a algo que sirva como `id`:
   * un `id` con espacios o acentos rompe la referencia.
   */
  protected panelDe(grupo: GrupoMenu): string {
    return idDePanel(grupo.titulo);
  }
}
