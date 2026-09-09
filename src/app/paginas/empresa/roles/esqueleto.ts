import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * Espejo de `roles.html`: tarjetas en dos columnas desde `lg`, no filas de tabla.
 *
 * Cuatro tarjetas porque cuatro son los roles de la semilla del MVP, que es lo que trae una
 * empresa recién aprovisionada.
 */
@Component({
  selector: 'app-roles-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class RolesEsqueleto {
  protected readonly t = t;

  protected readonly tarjetas = [1, 2, 3, 4];
}
