import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { WritableSignal } from '@angular/core';

import { t } from '../nucleo/i18n/i18n';

/** Las tres etiquetas del filtro de estado. Cada pantalla las trae en su género. */
export interface EtiquetasActivo {
  readonly todas: string;
  readonly activas: string;
  readonly retiradas: string;
}

/**
 * La barra de herramientas de una pantalla de módulo: búsqueda, filtros y acción principal,
 * TODO EN UNA FILA y encima de la tabla.
 *
 * POR QUE NO EN LA BARRA SUPERIOR. La búsqueda y el «Nuevo X» vivían arriba, publicados en el
 * servicio `Barra`, y eso los separaba de lo que gobiernan: alguien que estaba mirando la
 * tabla y sus filtros tenía que subir la vista al otro extremo de la pantalla para buscar. Se
 * bajan aquí, junto a los chips que antes andaban sueltos en su propia línea. La barra
 * superior se queda con lo que sí es suyo: el `<h1>`, el contexto y lo del armazón.
 *
 * POR QUE UN `<select>` Y NO CHIPS para el estado. Con tres opciones los chips ya ocupaban una
 * fila entera, y en cuanto una pantalla suma un segundo filtro —Tipos por categoría, Tarifas
 * por unidad— se convierten en dos y tres filas de botones sueltos encima de la tabla. Un
 * desplegable ocupa lo mismo tenga tres opciones o veinte, y pone todos los filtros en la
 * misma línea visual.
 *
 * LOS FILTROS PROPIOS DE CADA PANTALLA SE PROYECTAN, en `[filtros]`. Así esta barra no tiene
 * que conocer ni la categoría de un tipo ni la unidad de una tarifa, y sigue siendo una sola
 * pieza que arreglar cuando el diseño cambie.
 */
@Component({
  selector: 'app-barra-herramientas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './barra-herramientas.html',
})
export class BarraHerramientas {
  /**
   * La señal de búsqueda de la pantalla. **Se pasa, no se copia**: esta barra escribe en ella
   * y la pantalla filtra leyéndola, así que no hay dos estados que sincronizar.
   */
  readonly busqueda = input.required<WritableSignal<string>>();

  readonly marcadorBusqueda = input('');

  /**
   * `undefined` = todas; `true` = solo activas; `false` = solo retiradas.
   *
   * OPCIONAL, y no por comodidad. Casi todas las pantallas de módulo tienen un `activo`
   * booleano y usan este filtro tal cual, pero **Trabajadores no**: su estado es un enum de
   * tres valores —Activo, Inactivo y Baja— y colapsarlo a un booleano esconde justo la
   * distinción que a esa pantalla le importa. Sin señal, el filtro de serie no se dibuja y
   * la pantalla pone el suyo en `[filtros]`.
   */
  readonly soloActivas = input<WritableSignal<boolean | undefined> | null>(null);

  readonly etiquetas = input<EtiquetasActivo | null>(null);

  /** Etiqueta del botón principal. Vacía = la pantalla no tiene acción de alta. */
  readonly accion = input('');

  readonly alPulsarAccion = output<void>();

  protected readonly t = t;

  /**
   * El valor del `<select>` como TEXTO, porque un `<option>` solo puede llevar texto.
   *
   * `undefined` no se puede representar con una cadena vacía sin más: `''` es un valor válido
   * y significaría «ninguna opción elegida», que aquí no existe. Se codifican los tres estados
   * con nombres explícitos y se traducen en `alCambiarEstado`.
   */
  protected readonly valorEstado = computed(() => {
    const senal = this.soloActivas();

    if (senal === null) {
      return 'todas';
    }

    const activas = senal();

    return activas === undefined ? 'todas' : activas ? 'activas' : 'retiradas';
  });

  protected alCambiarEstado(valor: string): void {
    this.soloActivas()?.set(valor === 'todas' ? undefined : valor === 'activas');
  }

  protected alEscribir(valor: string): void {
    this.busqueda().set(valor);
  }
}
