import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * Espejo de `rentas.html`. Si allí cambian las columnas, aquí también: un esqueleto que ya no
 * coincide con lo que carga es peor que no tener ninguno.
 */
@Component({
  selector: 'app-rentas-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class RentasEsqueleto {
  protected readonly t = t;

  /** Ocho filas: plausible para un mes de operación y llena la pantalla. */
  protected readonly filas = [1, 2, 3, 4, 5, 6, 7, 8];
}
