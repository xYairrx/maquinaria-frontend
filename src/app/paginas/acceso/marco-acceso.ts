import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { sitio } from '../../nucleo/ambiente/sitio';
import { SelectorIdioma } from './selector-idioma';

/**
 * El marco de dos columnas de las pantallas de acceso.
 *
 * Existe porque las tres pantallas sin sesión —entrar a una empresa, entrar a la
 * plataforma y el portal— repiten exactamente la misma estructura, y serán cuatro
 * cuando llegue el restablecimiento de contraseña. Lo único que cambia entre ellas es
 * el título, la línea de apoyo y el formulario; todo lo demás (la identidad, las
 * proporciones, el panel de marca y su desaparición por debajo de `lg`) es idéntico y
 * no debería copiarse cuatro veces.
 *
 * El formulario se proyecta con `<ng-content>`: el marco no sabe nada de campos,
 * validaciones ni API, y cada pantalla conserva su propio formulario reactivo.
 */
@Component({
  selector: 'app-marco-acceso',
  imports: [SelectorIdioma],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marco-acceso.html',
})
export class MarcoAcceso {
  /** El nombre y la descripción del producto, en un solo sitio. */
  protected readonly sitio = sitio;

  /** Título de la pantalla. Es el `<h1>`: hay uno y solo uno por pantalla. */
  readonly titulo = input.required<string>();

  /** La línea de apoyo bajo el título: qué es esta pantalla, en una frase. */
  readonly apoyo = input('');

  /**
   * Cola destacada de esa línea de apoyo.
   *
   * Existe por un caso concreto: «Entrando a **Bajío**». El nombre de la empresa sale
   * del subdominio y ya no se escribe, así que es lo único que distingue una pantalla
   * de acceso de otra; resaltarlo es lo que hace que quien llega desde una liga vieja
   * note que está en la empresa equivocada. Se pasa aparte —y no como marcado— porque
   * el HTML de un componente vive en su plantilla, nunca en un `input`.
   */
  readonly apoyoDestacado = input('');
}
