import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { ApiPlataforma } from '../nucleo/api/api-plataforma';
import { SesionPlataformaStore } from '../nucleo/sesion/sesion-plataforma';
import { MENU_PLATAFORMA } from './opciones-menu';
import { MenuLateral } from './menu-lateral';
import { sitio } from '../nucleo/ambiente/sitio';

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
  imports: [RouterOutlet, MenuLateral],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './disposicion-plataforma.html',
})
export class DisposicionPlataforma {
  /** El nombre y la descripción del producto, en un solo sitio. */
  protected readonly sitio = sitio;

  private readonly sesion = inject(SesionPlataformaStore);
  private readonly api = inject(ApiPlataforma);
  private readonly router = inject(Router);

  protected readonly menu = MENU_PLATAFORMA;

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

  protected salir(): void {
    this.sesion.cerrar();
    void this.router.navigate(['/entrar']);
  }
}
