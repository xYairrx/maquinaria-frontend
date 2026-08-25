import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * La banderita de un idioma, dibujada.
 *
 * NO SE USA EL EMOJI. Windows no trae banderas de países en su fuente de emoji —es una
 * omisión deliberada de Microsoft, no un fallo— y en su lugar dibuja las dos letras del
 * indicador regional: donde debía verse la bandera de México aparecía «MX».
 *
 * Es un componente y no un dato del idioma para que el resto no tenga que saber dónde
 * viven los archivos ni cómo se dimensionan: quien la usa solo pasa el código.
 *
 * Los archivos están en `public/`, con el nombre tal cual se descargaron de SVG Repo.
 * Renombrarlos a `mx.svg` y `us.svg` dejaría esto más legible, pero son archivos que puso
 * el usuario y no se tocan sin avisar.
 */
const ARCHIVOS: Readonly<Record<string, string>> = {
  'es-MX': 'flag-mx-svgrepo-com.svg',
  // El archivo se llama «us outlying islands», pero los territorios usan la bandera de
  // Estados Unidos, así que el dibujo es el correcto.
  'en-US': 'flag-for-flag-us-outlying-islands-svgrepo-com.svg',
};

@Component({
  selector: 'app-bandera',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bandera.html',
})
export class Bandera {
  /** Código del idioma, el mismo de `IDIOMAS`. */
  readonly codigo = input.required<string>();

  /**
   * El archivo que corresponde. `null` si el idioma no tiene bandera: mejor no pintar
   * nada que dejar el icono roto del navegador.
   */
  protected readonly archivo = computed(() => ARCHIVOS[this.codigo()] ?? null);
}
