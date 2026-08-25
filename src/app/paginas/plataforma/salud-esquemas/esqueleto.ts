import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * El esqueleto de la salud de esquemas: su silueta mientras llega el reporte.
 *
 * ESPEJO de `salud-esquemas.html`, y esa es su única obligación: si allí cambian las
 * tarjetas de arriba, las columnas de la tabla o la leyenda del pie, aquí también. Un
 * esqueleto que ya no coincide con lo que carga es peor que no tener ninguno, porque
 * promete una forma y entrega otra.
 *
 * Ver `docs/convenciones.md#esqueletos-de-carga`.
 */
@Component({
  selector: 'app-salud-esquemas-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class SaludEsquemasEsqueleto {
  protected readonly t = t;

  /**
   * Tres filas. El largo real no se sabe hasta que llega el reporte —hoy son dos empresas—
   * así que se elige un número plausible y se acepta la diferencia: fingir precisión ahí no
   * se puede.
   */
  protected readonly filas = [1, 2, 3];

  /** Las tres definiciones de la leyenda, que son fijas y sí coinciden exacto. */
  protected readonly leyendas = [1, 2, 3];
}
