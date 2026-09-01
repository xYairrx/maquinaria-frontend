import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * El esqueleto de los tipos de límite: su silueta mientras llegan los datos.
 *
 * ESPEJO de `limites.html`, y esa es su única obligación: si allí cambia el número de
 * columnas, aquí también. Un esqueleto que ya no coincide con lo que carga es peor que no
 * tener ninguno.
 *
 * Ver `docs/convenciones.md#esqueletos-de-carga`.
 */
@Component({
  selector: 'app-limites-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class LimitesEsqueleto {
  protected readonly t = t;

  /** Cuatro filas: son los cuatro tipos que el sistema trae sembrados. */
  protected readonly filas = [1, 2, 3, 4];
}
