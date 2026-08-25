import { Injectable, signal, type WritableSignal } from '@angular/core';

/**
 * La barra superior de una pantalla, como DATOS.
 *
 * POR QUÉ UN SERVICIO Y NO PROYECCIÓN DE CONTENIDO: la barra mezcla dos ámbitos. El botón
 * del menú y la identidad son del ARMAZÓN —existen igual en todas las pantallas— y el
 * título, la búsqueda y la acción principal son de la PANTALLA. Con `<ng-content>` no se
 * puede: entre el armazón y la pantalla hay un `<router-outlet>`, y el contenido no cruza
 * un outlet. Publicar un `<ng-template>` en un servicio sí funcionaría, pero es maquinaria
 * para mover marcado; describir la barra como datos deja al armazón dibujándola entera y
 * a la pantalla diciendo solo qué pone.
 *
 * Es el mismo criterio que `opciones-menu.ts`: el menú también es datos y no marcado.
 *
 * Cada pantalla llama a `configurar()` en su constructor. No hace falta limpiar al salir:
 * la siguiente pantalla sobreescribe, y una que no configure nada deja la barra con solo
 * el menú y la identidad, que es un estado válido.
 */

/**
 * La acción principal: el botón amarillo.
 *
 * O navega o hace algo, nunca las dos. `ruta` para lo primero —y entonces es un `<a>`, con
 * lo que se puede abrir en otra pestaña— y `alPulsar` para lo segundo, que es lo que usa la
 * pantalla de planes para abrir su hoja inferior.
 *
 * Se modela con los dos campos opcionales y no con una unión discriminada porque el
 * armazón tiene que preguntar por uno de los dos de todas formas, y una unión obligaría a
 * declarar un `tipo` que no añade nada.
 */
export interface AccionBarra {
  readonly etiqueta: string;
  /** Ruta absoluta dentro del árbol de esta aplicación. Si está, la acción es un enlace. */
  readonly ruta?: string;
  /** Qué hacer al pulsar. Si está, la acción es un botón. */
  readonly alPulsar?: () => void;
}

/**
 * El campo de búsqueda.
 *
 * El `valor` es la señal ESCRIBIBLE de la pantalla, no una copia: la barra escribe ahí y
 * la pantalla filtra leyéndola. Así no hay que sincronizar dos estados ni emitir eventos
 * que la pantalla tenga que volver a guardar.
 */
export interface BusquedaBarra {
  readonly marcador: string;
  readonly valor: WritableSignal<string>;
}

export interface ContenidoBarra {
  /** El `<h1>` de la pantalla. Hay uno y solo uno, y lo pinta la barra. */
  readonly titulo: string;
  /** La línea de contexto bajo el título, con `·` de separador. Vacía si no hay. */
  readonly contexto: string;
  readonly busqueda: BusquedaBarra | null;
  readonly accion: AccionBarra | null;
}

const VACIA: ContenidoBarra = {
  titulo: '',
  contexto: '',
  busqueda: null,
  accion: null,
};

@Injectable({ providedIn: 'root' })
export class Barra {
  private readonly _contenido = signal<ContenidoBarra>(VACIA);

  readonly contenido = this._contenido.asReadonly();

  /** Lo que falte se queda vacío: una pantalla sin búsqueda no la declara. */
  configurar(contenido: Partial<ContenidoBarra>): void {
    this._contenido.set({ ...VACIA, ...contenido });
  }
}
