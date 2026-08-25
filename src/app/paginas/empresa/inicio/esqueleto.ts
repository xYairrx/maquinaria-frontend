import { ChangeDetectionStrategy, Component } from '@angular/core';

import { t } from '../../../nucleo/i18n/i18n';

/**
 * El esqueleto del inicio de empresa: su silueta mientras carga la identidad.
 *
 * ESPEJO de `inicio.html`, y esa es su unica obligacion: si alli cambia la rejilla de «Tu
 * acceso» o la de los modulos, aqui tambien. Un esqueleto que ya no coincide con lo que
 * carga es peor que no tener ninguno, porque promete una forma y entrega otra.
 *
 * La identidad la pide `DisposicionEmpresa`, la ruta padre, asi que esto es lo que se ve
 * en la primera navegacion de cada sesion — no un parpadeo: hay una peticion de red por
 * medio.
 *
 * Ver `docs/convenciones.md#esqueletos-de-carga`.
 */
@Component({
  selector: 'app-inicio-esqueleto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './esqueleto.html',
  host: {
    // El anfitrion de `inicio.html` es un `<div>` normal y no un contenedor flex, asi que
    // este elemento personalizado seria `display: inline` por omision. `block` es lo que
    // hace que la seccion de dentro ocupe el ancho igual que la de verdad.
    class: 'block',
  },
})
export class InicioEsqueleto {
  protected readonly t = t;

  /** Los tres datos de «Tu acceso»: autorizacion, modulos contratados e implementados. */
  protected readonly datos = [1, 2, 3];

  /**
   * Seis tarjetas de modulo.
   *
   * El largo real es cuantos modulos trae el plan de esta empresa, y no se sabe hasta que
   * llega la identidad: puede ser uno o los veintiseis. Se elige un numero plausible —dos
   * filas completas desde `lg`— y se acepta la diferencia; fingir precision ahi no se
   * puede.
   */
  protected readonly modulos = [1, 2, 3, 4, 5, 6];
}
