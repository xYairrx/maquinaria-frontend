import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * Espejo de `clausulas.html`. Si allí cambian las columnas, aquí también: un esqueleto que
 * ya no coincide con lo que carga es peor que no tener ninguno.
 */
@Component({
  selector: 'app-clausulas-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class ClausulasEsqueleto {
  protected readonly t = t;

  /** Ocho filas: plausible para un catálogo recién sembrado y llena la pantalla. */
  protected readonly filas = [1, 2, 3, 4, 5, 6, 7, 8];
}
