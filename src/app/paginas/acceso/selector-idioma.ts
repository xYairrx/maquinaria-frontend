import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { IDIOMAS, elegirIdioma, idioma, t, type Idioma } from '../../nucleo/i18n/i18n';
import { Bandera } from './bandera';

/**
 * Selector de idioma de las pantallas de acceso.
 *
 * Ya traduce: `elegir()` cambia el idioma de toda la aplicación y lo recuerda entre
 * visitas. El estado NO vive aquí —vive en `nucleo/i18n/i18n.ts`— porque el idioma no es
 * de este componente: el menú lateral, los errores de la API y `<html lang>` leen el
 * mismo.
 *
 * La lista tampoco está escrita aquí, por lo mismo: un ajuste de perfil necesitará los
 * mismos idiomas sin pasar por este desplegable.
 */
@Component({
  selector: 'app-selector-idioma',
  imports: [Bandera],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './selector-idioma.html',
})
export class SelectorIdioma {
  protected readonly t = t;
  protected readonly idiomas = IDIOMAS;
  protected readonly codigoActual = idioma;

  protected readonly abierto = signal(false);

  protected readonly actual = computed(
    () => this.idiomas.find((i) => i.codigo === this.codigoActual()) ?? this.idiomas[0],
  );

  protected alternar(): void {
    this.abierto.update((v) => !v);
  }

  protected elegir(codigo: Idioma['codigo']): void {
    elegirIdioma(codigo);
    this.abierto.set(false);
  }
}
