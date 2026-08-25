import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { Api } from '../nucleo/api/api';
import { puedeVerModulo } from '../nucleo/sesion/acceso';
import { Sesion } from '../nucleo/sesion/sesion';
import { menuEmpresa } from './opciones-menu';
import { MenuLateral } from './menu-lateral';
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
  imports: [RouterOutlet, MenuLateral],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './disposicion-empresa.html',
})
export class DisposicionEmpresa {
  /** El nombre y la descripción del producto, en un solo sitio. */
  protected readonly sitio = sitio;
  protected readonly t = t;

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

  protected salir(): void {
    this.sesion.cerrar();
    void this.router.navigate(['/entrar']);
  }
}
