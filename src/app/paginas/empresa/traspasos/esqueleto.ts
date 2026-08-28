import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/** Espejo de `traspasos.html`. Sin columna de acciones: un traspaso no se edita ni se borra. */
@Component({
  selector: 'app-traspasos-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class TraspasosEsqueleto {
  protected readonly t = t;

  protected readonly filas = [1, 2, 3, 4, 5, 6, 7, 8];
}
