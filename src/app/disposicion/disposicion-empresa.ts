import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { Api } from '../nucleo/api/api';
import { puedeVerModulo } from '../nucleo/sesion/acceso';
import { Sesion } from '../nucleo/sesion/sesion';
import { menuEmpresa } from './opciones-menu';
import { Barra } from './barra';
import { DialogoConfirmacion } from './dialogo-confirmacion';
import { MenuLateral } from './menu-lateral';
import { MenuUsuario } from './menu-usuario';
import { sitio } from '../nucleo/ambiente/sitio';
import { t } from '../nucleo/i18n/i18n';

/**
 * El armazón de la aplicación de una empresa: menú lateral fijo y el contenido de la
 * ruta hija en `<main>`.
 *
 * Es una ruta PADRE con `children`, no un componente que cada pantalla incruste. Así el
 * menú no se vuelve a construir al navegar, la sesión se carga una sola vez, y una
 * pantalla nueva es una entrada en `children` sin tocar nada más.
 */
@Component({
  selector: 'app-disposicion-empresa',
  imports: [RouterLink, RouterOutlet, DialogoConfirmacion, MenuLateral, MenuUsuario],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Escape cierra el cajon, como cualquier capa modal (WCAG 2.1.2). Va en `host` y
  // no con @HostListener, que la convencion del repo prohibe.
  host: { '(document:keydown.escape)': 'cerrarMenu()' },
  templateUrl: './disposicion-empresa.html',
})
export class DisposicionEmpresa {
  /** El nombre y la descripción del producto, en un solo sitio. */
  protected readonly sitio = sitio;
  protected readonly t = t;

  /** Lo que la pantalla publica en la barra: título, contexto, búsqueda y acción. */
  protected readonly barra = inject(Barra).contenido;

  private readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  private readonly identidad = this.sesion.identidad;

  protected readonly nombre = computed(() => this.identidad()?.nombre ?? '');
  protected readonly correo = computed(() => this.identidad()?.correo ?? '');
  protected readonly razonSocial = computed(() => this.identidad()?.razonSocial ?? '');

  /**
   * El menú que este usuario puede ver.
   *
   * Se filtra por la intersección permisos ∩ módulos del plan, y los grupos que se
   * quedan sin ninguna opción desaparecen: un encabezado suelto sobre nada es ruido.
   */
  protected readonly menu = computed(() => {
    const yo = this.identidad();

    return menuEmpresa()
      .map((grupo) => ({
        ...grupo,
        opciones: grupo.opciones.filter((opcion) => puedeVerModulo(yo, opcion.modulo)),
      }))
      .filter((grupo) => grupo.opciones.length > 0);
  });

  constructor() {
    // La identidad no viene en el token: trae los permisos y los módulos del plan, que
    // es lo que decide el menú. Se pide una vez aquí y no en cada pantalla.
    if (this.sesion.activa() && this.identidad() === null) {
      this.api
        .miSesion()
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (identidad) => this.sesion.establecerIdentidad(identidad),
          // Un fallo aquí deja el menú vacío pero no rompe la pantalla. El 401 lo
          // resuelve el guard en la siguiente navegación.
          error: () => undefined,
        });
    }
  }

  /**
   * El cajón del menú. Solo tiene efecto por debajo de `lg`, donde el menú no cabe al
   * lado del contenido; desde `lg` el menú está siempre y este estado se ignora.
   *
   * Vive en el armazón y no en `MenuLateral` porque el botón que lo abre está en la
   * cabecera, que es del armazón, y el velo tapa toda la pantalla.
   */
  protected readonly menuAbierto = signal(false);

  protected alternarMenu(): void {
    this.menuAbierto.update((v) => !v);
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  protected salir(): void {
    this.sesion.cerrar();
    void this.router.navigate(['/entrar']);
  }
}
