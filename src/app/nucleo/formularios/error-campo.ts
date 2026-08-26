import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { AbstractControl } from '@angular/forms';

/**
 * Si el error de un control se tiene que ver YA.
 *
 * Dos condiciones, y la segunda es la que importa: **inválido y tocado**. Enseñarlo con el
 * primer carácter castiga mientras se escribe —«el correo es inválido» cuando apenas va la
 * «a»— y quien lo lee no puede hacer nada todavía.
 *
 * El «o se intentó enviar» está cubierto sin una segunda bandera: al pulsar el botón con el
 * formulario inválido, la pantalla llama `markAllAsTouched()`, así que todos los controles
 * quedan tocados y sus mensajes aparecen de golpe. Es el patrón que ya usaban las pantallas
 * de acceso; lo único que faltaba era que alguien pintara el mensaje.
 *
 * `dirty` NO entra en la condición: un control tocado y vacío —entré, salí, no escribí— es
 * exactamente el caso que hay que señalar.
 *
 * ponytail: no hay bandera de «se intentó enviar», que es lo que haría un `FormGroupDirective`
 * con su `submitted`. Se apoya en que la pantalla llama `markAllAsTouched()` al pulsar con el
 * formulario inválido — dos estados que dicen lo mismo, y uno de ellos ya estaba escrito. Si
 * alguna pantalla envía SIN marcar, sus mensajes no aparecerán al pulsar; entonces se agrega
 * la bandera aquí y no en la pantalla.
 */
export function errorVisible(control: AbstractControl): boolean {
  return control.invalid && control.touched;
}

/**
 * El mensaje de error de UN campo, debajo del campo.
 *
 * Es un componente y no marcado repetido porque lo que se repite es lo que se copia mal: el
 * `role="alert"` —sin el cual un lector de pantalla no anuncia nada al aparecer el mensaje—,
 * el tamaño y el color del texto. Con 26 pantallas por delante, la copia número cuatro se
 * quedaría sin el `role` y nadie lo notaría mirando la pantalla.
 *
 * **Recibe un booleano y no el `FormControl`**, y eso es a propósito. `invalid` y `touched`
 * no son señales, así que un componente `OnPush` que los leyera por su cuenta no se
 * revisaría al perder el foco el campo —el evento ocurre en la vista del PADRE— y el mensaje
 * no aparecería nunca. Con el booleano como `input()`, el cambio entra por la comprobación
 * de bindings del padre, que sí ensucia esta vista. El padre lo calcula con `errorVisible`.
 *
 * Lo que el campo tiene que poner de su lado, y que este componente no puede poner por él:
 * `aria-invalid` en el control y el `id` de este mensaje dentro de su `aria-describedby`,
 * **sin quitar el de la ayuda** — `aria-describedby` admite varios ids separados por espacio,
 * y un campo puede tener ayuda Y error a la vez.
 *
 * El color NO es el único indicio (WCAG 1.4.1): el indicio principal es este texto, que
 * además dice qué se espera. El borde del campo lo refuerza engordando, no solo cambiando
 * de color — ver `campo-formulario` en `src/styles.css`.
 */
@Component({
  selector: 'app-error-campo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './error-campo.html',
  host: {
    /*
     * `empty:hidden` porque el elemento anfitrión existe en el DOM aunque no haya mensaje, y
     * en una columna con `gap` un hijo vacío deja un hueco debajo de cada campo.
     */
    class: 'empty:hidden',
  },
})
export class ErrorCampo {
  /** Lo calcula el padre con `errorVisible`. */
  readonly visible = input.required<boolean>();

  /**
   * El texto, ya resuelto en el idioma activo por quien lo usa.
   *
   * No puede salir de aquí: el mensaje depende del campo, y un `input()` de texto con el
   * texto por defecto se congelaría en el idioma del momento de construcción.
   */
  readonly mensaje = input.required<string>();
}
