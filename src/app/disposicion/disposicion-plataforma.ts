import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

import { ApiPlataforma } from '../nucleo/api/api-plataforma';
import { SesionPlataformaStore } from '../nucleo/sesion/sesion-plataforma';
import { menuPlataforma } from './opciones-menu';
import { Barra } from './barra';
import { MenuLateral } from './menu-lateral';
import { MenuUsuario } from './menu-usuario';
import { sitio } from '../nucleo/ambiente/sitio';
import { t } from '../nucleo/i18n/i18n';

/**
 * El armazón de la superadministración.
 *
 * Gemelo del de empresa pero NO el mismo componente, y es deliberado: su menú no se
 * filtra por módulos —el superadministrador no pertenece a ninguna empresa ni contrata
 * ningún plan—, su sesión vive en otra llave y su token es de otra audiencia. Unificar
 * los dos armazones con banderas los volvería un nudo de condicionales, y sería
 * deshacer en el cliente la separación que el backend mantiene a propósito.
 *
 * Lo que sí comparten es el `MenuLateral`, que es presentacional.
 */
@Component({
  selector: 'app-disposicion-plataforma',
  imports: [RouterLink, RouterOutlet, MenuLateral, MenuUsuario],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Escape cierra el cajon, como cualquier capa modal (WCAG 2.1.2). Va en `host` y
  // no con @HostListener, que la convencion del repo prohibe.
  host: { '(document:keydown.escape)': 'cerrarMenu()' },
  templateUrl: './disposicion-plataforma.html',
})
export class DisposicionPlataforma {
  /** El nombre y la descripción del producto, en un solo sitio. */
  protected readonly sitio = sitio;
  protected readonly t = t;

  /** Lo que la pantalla publica en la barra: título, contexto, búsqueda y acción. */
  protected readonly barra = inject(Barra).contenido;

  private readonly sesion = inject(SesionPlataformaStore);
  private readonly api = inject(ApiPlataforma);
  private readonly router = inject(Router);

  protected readonly menu = computed(() => menuPlataforma());

  protected readonly nombre = computed(() => this.sesion.identidad()?.nombre ?? '');
  protected readonly correo = computed(() => this.sesion.identidad()?.correo ?? '');

  constructor() {
    if (this.sesion.activa() && this.sesion.identidad() === null) {
      this.api
        .miSesion()
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (identidad) => this.sesion.establecerIdentidad(identidad),
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
