import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { Bandera } from './bandera';

/**
 * Selector de idioma de las pantallas de acceso.
 *
 * OJO: ELEGIR UN IDIOMA TODAVÍA NO TRADUCE NADA. El proyecto no tiene i18n —ni librería
 * ni un solo texto traducido— y el inglés está en la lista porque así se pidió, para
 * dejar la interfaz montada antes de conectarla.
 *
 * Cuando se conecte, lo que falta es que `elegir()` avise a la librería que se elija y
 * que el idioma se recuerde entre visitas. La lista y el estado ya están.
 */
interface Idioma {
  readonly codigo: string;
  /** Lo que se enseña plegado: dos letras. */
  readonly corto: string;
  /** El nombre en su propio idioma, como manda la convención de los selectores. */
  readonly nombre: string;
}

const IDIOMAS: readonly Idioma[] = [
  { codigo: 'es-MX', corto: 'ES', nombre: 'Español' },
  { codigo: 'en-US', corto: 'EN', nombre: 'English' },
];

@Component({
  selector: 'app-selector-idioma',
  imports: [Bandera],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './selector-idioma.html',
})
export class SelectorIdioma {
  protected readonly idiomas = IDIOMAS;

  protected readonly abierto = signal(false);
  protected readonly codigoActual = signal(IDIOMAS[0].codigo);

  protected readonly actual = computed(
    () => this.idiomas.find((i) => i.codigo === this.codigoActual()) ?? this.idiomas[0],
  );

  protected alternar(): void {
    this.abierto.update((v) => !v);
  }

  protected elegir(codigo: string): void {
    // De momento solo cambia lo que muestra el propio selector. Aquí es donde habrá que
    // avisar a la librería de i18n y guardar la preferencia.
    this.codigoActual.set(codigo);
    this.abierto.set(false);
  }
}
