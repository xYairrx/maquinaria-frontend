import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * Espejo de `usuarios.html`. Cinco columnas, la primera con dos líneas —nombre y correo—,
 * que es lo que hace que la fila real sea más alta que la de un catálogo.
 */
@Component({
  selector: 'app-usuarios-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class UsuariosEsqueleto {
  protected readonly t = t;

  protected readonly filas = [1, 2, 3, 4, 5, 6];
}
