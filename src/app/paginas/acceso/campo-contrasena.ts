import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ReactiveFormsModule, type FormControl } from '@angular/forms';

/**
 * Campo de contraseña con alternador de visibilidad.
 *
 * Existe como componente y no como marcado repetido porque el alternador tiene más
 * detalle del que parece —el `type` del botón, la etiqueta que cambia, el estado que
 * anunciar— y copiarlo en cada pantalla garantiza que una copia se quede a medias.
 *
 * Recibe el `FormControl` en lugar de usar `formControlName`. Así no depende de estar
 * dentro de un `formGroup` concreto ni hay que reexponer el contenedor con
 * `viewProviders`, y de paso el tipo del control se comprueba en la plantilla que lo usa.
 */
@Component({
  selector: 'app-campo-contrasena',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campo-contrasena.html',
})
export class CampoContrasena {
  readonly control = input.required<FormControl<string>>();

  readonly etiqueta = input('Contraseña');

  /** El `id` del campo. Se separa por si una pantalla llega a tener dos. */
  readonly campoId = input('contrasena');

  /** `current-password` al entrar, `new-password` al definir una nueva. */
  readonly autocompletado = input('current-password');

  /** `id`s del texto de ayuda, si la pantalla lo tiene. */
  readonly descritoPor = input('');

  /**
   * Texto del `placeholder`. Acompaña a la etiqueta, que va en `sr-only`: nunca la
   * sustituye, porque un placeholder desaparece al escribir y no sirve como nombre del
   * campo.
   */
  readonly marcador = input('Tu contraseña');

  /**
   * Si el campo está en error. Se refleja como `aria-invalid`.
   *
   * Existe porque al mover los campos crudos a este componente el atributo se perdía, y
   * con él la única señal que tiene un lector de pantalla de que ESE campo es el del
   * problema: el `role="alert"` anuncia el mensaje, pero no dice a qué campo se refiere.
   */
  readonly invalido = input(false);

  protected readonly visible = signal(false);

  protected readonly tipo = computed(() => (this.visible() ? 'text' : 'password'));

  /**
   * La etiqueta describe LA ACCIÓN, no el estado.
   *
   * El estado ya lo dice `aria-pressed`, y un lector de pantalla anunciaría «Ocultar
   * contraseña, presionado» —contradictorio— si aquí se nombrara el estado también.
   */
  protected readonly etiquetaBoton = computed(() =>
    this.visible() ? 'Ocultar la contraseña' : 'Mostrar la contraseña',
  );

  protected alternar(): void {
    this.visible.update((v) => !v);
  }
}
