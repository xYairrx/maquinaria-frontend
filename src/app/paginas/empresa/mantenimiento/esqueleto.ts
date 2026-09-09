import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * Espejo de `mantenimiento.html`: tres chips y dos desplegables en la cabecera, siete
 * columnas y una segunda línea en la del equipo.
 */
@Component({
  selector: 'app-mantenimiento-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class MantenimientoEsqueleto {
  protected readonly t = t;

  protected readonly filas = [1, 2, 3, 4, 5, 6];
}
