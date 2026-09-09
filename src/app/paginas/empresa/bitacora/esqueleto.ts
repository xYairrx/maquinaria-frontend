import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/** Espejo de `bitacora.html`. Cinco filtros en la cabecera y siete columnas. */
@Component({
  selector: 'app-bitacora-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class BitacoraEsqueleto {
  protected readonly t = t;

  protected readonly filas = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
}
