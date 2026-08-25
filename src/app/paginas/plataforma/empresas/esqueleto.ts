import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * El esqueleto de la lista de empresas: su silueta mientras llega la peticion.
 *
 * ESPEJO de la tabla de `empresas.html`, y esa es su unica obligacion: si alli cambian las
 * columnas, el relleno de las celdas o el fondo de la cabecera, aqui tambien. Un esqueleto
 * que ya no coincide con lo que carga es peor que no tener ninguno, porque promete una
 * forma y entrega otra.
 *
 * SU ALCANCE ES SOLO LA TABLA, no la pantalla entera: en `empresas.html` el
 * `@if (cargando())` vive DENTRO de la seccion, debajo del `<h2>` del conteo, y el
 * formulario de alta que va despues se pinta siempre. Un esqueleto de pantalla completa
 * taparia dos bloques que ya estan en su sitio.
 *
 * Ver `docs/convenciones.md#esqueletos-de-carga`.
 */
@Component({
  selector: 'app-empresas-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
})
export class EmpresasEsqueleto {
  protected readonly t = t;

  /**
   * Cuatro filas. El largo real no se sabe hasta que llegan los datos, asi que se elige un
   * numero plausible y se acepta la diferencia: fingir precision ahi no se puede.
   */
  protected readonly filas = [1, 2, 3, 4];
}
