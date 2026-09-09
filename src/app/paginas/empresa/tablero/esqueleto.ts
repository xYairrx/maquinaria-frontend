import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * Espejo de `tablero.html`: cinco secciones de tarjetas.
 *
 * Los conteos por bloque son LITERALES —6, 4, 3, 4, 2— y no un numero al azar: la silueta
 * tiene que coincidir con lo que llega, o la pantalla salta al cargar.
 */
@Component({
  selector: 'app-tablero-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class TableroEsqueleto {
  protected readonly t = t;

  protected readonly bloques = [
    { clave: 'parque', tarjetas: [1, 2, 3, 4, 5, 6] },
    { clave: 'operacion', tarjetas: [1, 2, 3, 4] },
    { clave: 'comercial', tarjetas: [1, 2, 3] },
    { clave: 'taller', tarjetas: [1, 2, 3, 4] },
    { clave: 'movimientos', tarjetas: [1, 2] },
  ];
}
