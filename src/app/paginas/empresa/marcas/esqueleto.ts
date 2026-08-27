import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * El esqueleto de marcas: su silueta mientras llegan los datos.
 *
 * ESPEJO de `marcas.html`, y esa es su única obligación: si allí cambian las columnas de
 * la tabla o los chips del filtro, aquí también. Un esqueleto que ya no coincide con lo
 * que carga es peor que no tener ninguno.
 *
 * Ver `docs/convenciones.md#esqueletos-de-carga`.
 */
@Component({
  selector: 'app-marcas-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class MarcasEsqueleto {
  protected readonly t = t;

  /**
   * Ocho filas. Una lista de largo desconocido no puede coincidir exactamente; ocho es
   * plausible para un catálogo de marcas recién sembrado y llena la pantalla sin fingir
   * una página completa de cincuenta.
   *
   * El formulario NO tiene esqueleto, y no es un olvido: vive dentro de la hoja inferior,
   * que solo existe cuando alguien la abre — y entonces los datos ya están.
   */
  protected readonly filas = [1, 2, 3, 4, 5, 6, 7, 8];
}
