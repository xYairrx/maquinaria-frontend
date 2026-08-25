import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * El esqueleto de los planes: su silueta mientras llegan los datos.
 *
 * ESPEJO de `planes.html`, y esa es su unica obligacion: si alli cambia el numero de
 * columnas de la tabla o la rejilla del formulario, aqui tambien. Un esqueleto que ya no
 * coincide con lo que carga es peor que no tener ninguno.
 *
 * Ver `docs/convenciones.md#esqueletos-de-carga`.
 */
@Component({
  selector: 'app-planes-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class PlanesEsqueleto {
  protected readonly t = t;

  /** Dos filas: hoy el catalogo tiene un plan, y dos es un numero plausible. */
  protected readonly filas = [1, 2];

  /**
   * Las pildoras de modulos de cada fila. Seis y no veintiseis: es lo que da altura a la
   * fila, y la silueta tiene que sugerir la forma, no reproducir el censo.
   *
   * El formulario NO tiene esqueleto, y no es un olvido: vive dentro de la hoja inferior,
   * que solo existe cuando alguien la abre — y entonces los datos ya estan.
   */
  protected readonly pildoras = [1, 2, 3, 4, 5, 6];
}
