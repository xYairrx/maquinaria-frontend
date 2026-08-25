import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * El esqueleto del resumen: su silueta mientras llegan los datos.
 *
 * ESTA PLANTILLA ES UN ESPEJO de `dashboard.html`, y esa es su única obligación: si allí
 * cambia el número de tarjetas, el alto de la gráfica o las columnas de la tabla, aquí
 * también. Un esqueleto que ya no coincide con lo que carga es peor que no tener ninguno,
 * porque promete una forma y entrega otra.
 *
 * POR QUÉ UN COMPONENTE Y NO LA RAMA DE UN `@if`: son sesenta líneas de marcado con la
 * misma estructura y ningún dato. Dentro de `dashboard.html` duplicarían su longitud y
 * habría que leer dos rejillas en paralelo para encontrar la de verdad.
 *
 * La duplicación de estructura es el precio, y se paga a sabiendas: la alternativa —pintar
 * la plantilla real con datos de relleno— obliga a que cada `@if`, cada `@for` y cada pipe
 * de la pantalla aguanten datos falsos, y eso ensucia el camino bueno para adornar el malo.
 */
@Component({
  selector: 'app-dashboard-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class DashboardEsqueleto {
  protected readonly t = t;

  /** Las cuatro tarjetas. La última es la destacada, en negro, igual que la de verdad. */
  protected readonly tarjetas = [1, 2, 3, 4];

  /**
   * Los altos de las barras de la gráfica, en porcentaje.
   *
   * Fijos y no aleatorios: `Math.random()` daría barras distintas en cada pasada de
   * detección de cambios —la silueta temblaría— y además la convención del repo prohíbe
   * suponer globales como esa en las plantillas.
   */
  protected readonly barras = [35, 60, 28, 78, 52, 68];

  /** Filas de la tabla y elementos de la lista de avisos. */
  protected readonly filas = [1, 2, 3, 4, 5];
  protected readonly avisos = [1, 2, 3];
}
