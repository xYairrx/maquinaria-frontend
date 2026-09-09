import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * Espejo de `motivos-movimiento.html`. Si allí cambian las columnas, aquí también: un esqueleto que
 * ya no coincide con lo que carga es peor que no tener ninguno.
 */
@Component({
  selector: 'app-motivos-movimiento-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class MotivosMovimientoEsqueleto {
  protected readonly t = t;

  /**
   * NUEVE, que son exactamente los que hay.
   *
   * En los demás esqueletos el número es una estimación —una lista de largo desconocido no se
   * puede espejar— pero este catálogo está cerrado desde el 2026-09-08 y su tamaño se sabe.
   */
  protected readonly filas = [1, 2, 3, 4, 5, 6, 7, 8, 9];
}
