import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * Espejo de `movimientos.html`. Sin columna de acciones: la tabla es append-only.
 *
 * TRES FILTROS en la cabecera, no dos: tipo, equipo y ubicacion. La silueta los cuenta.
 */
@Component({
  selector: 'app-movimientos-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class MovimientosEsqueleto {
  protected readonly t = t;

  protected readonly filas = [1, 2, 3, 4, 5, 6, 7, 8];
}
