import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * La ilustración del panel de marca de las pantallas de acceso.
 *
 * VA EN LÍNEA Y NO COMO `<img src="…">`, y esa es la única razón de que exista este
 * componente: una imagen referenciada es una caja opaca para el CSS, así que no puede
 * heredar ningún token. En línea, cada forma lleva su clase `fill-*` y la ilustración
 * sigue la paleta si algún día cambia, sin volver a exportar nada.
 *
 * Está aparte de `MarcoAcceso` para que el marco siga siendo legible: son doscientas
 * líneas de trazado que nadie necesita leer para entender la estructura de la pantalla.
 *
 * Origen: SVG Repo. Los colores originales —naranjas y grises— se sustituyeron uno a uno
 * por el token que corresponde a su papel en el dibujo, no por parecido de tono.
 *
 * Es decoración: el contenedor de `MarcoAcceso` ya lleva `aria-hidden`, así que aquí no
 * hay nada que anunciar ni que enfocar.
 */
@Component({
  selector: 'app-ilustracion-acceso',
  changeDetection: ChangeDetectionStrategy.OnPush,

  // El tamaño va en el ANFITRIÓN, no solo en el <svg>. Dentro de un flex con
  // `items-center` los hijos se ajustan a su contenido, así que el `w-full` del svg se
  // resolvía contra un ancho que todavía no estaba definido y el elemento se quedaba en
  // su tamaño intrínseco. Va en el objeto `host` porque `AGENTS.md` prohíbe
  // `@HostBinding`.
  host: { class: 'block w-full max-w-[380px]' },
  templateUrl: './ilustracion-acceso.html',
})
export class IlustracionAcceso {}
