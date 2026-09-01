import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';

/**
 * CÓMO SE PRESELECCIONA UN `<select>` QUE NO ESTÁ EN UN FORMULARIO REACTIVO.
 *
 * No es una prueba de la pantalla de empresas: es una prueba del orden en que Angular
 * aplica los enlaces, porque de él depende que el selector de situación comercial enseñe
 * el estado de SU fila y no el de la primera opción.
 *
 * El fallo que estuvo a punto de irse: `[value]` sobre el `<select>`. El enlace del
 * elemento padre se aplica ANTES de que el `@for` haya creado ni una `<option>`, así que
 * `select.value = 3` se pierde en un elemento sin opciones y el navegador cae en la
 * primera. Medido abajo: queda en `"1"`.
 *
 * El síntoma habría sido exactamente el que originó este trabajo —cada empresa enseñando
 * «Prueba» sin importar su estado real— pero esta vez mintiendo la vista sobre un dato
 * correcto, que es peor: el estado sí habría cambiado en la base.
 *
 * Es la misma familia que `[ngValue]` y que el `<input type="number">`: el tipo compila,
 * nadie avisa, y solo se ve usando la pantalla.
 *
 * LOS DOS ANFITRIONES VAN SEPARADOS y no en uno con dos selectores. Juntos, la segunda
 * pasada de detección de cambios revienta con NG0100 por culpa del roto —su `[value]`
 * cambia entre pasadas— y el error tapa lo que se quiere medir.
 */
@Component({
  template: `
    <select id="sel" [value]="estado">
      @for (o of opciones; track o) {
        <option [value]="o">{{ o }}</option>
      }
    </select>
  `,
})
class AnfitrionRoto {
  readonly opciones = [1, 2, 3, 4];
  readonly estado = 3;
}

@Component({
  template: `
    <select id="sel">
      @for (o of opciones; track o) {
        <option [value]="o" [selected]="o === estado()">{{ o }}</option>
      }
    </select>
  `,
})
class AnfitrionCorrecto {
  readonly opciones = [1, 2, 3, 4];

  /**
   * SEÑAL y no un campo normal, porque así es como llega el dato en la pantalla real: la
   * fila sale de `empresas()`. Con un campo normal, cambiarlo entre dos `detectChanges()`
   * dispara el NG0100 de la doble pasada de desarrollo, que es un artefacto del arnés y
   * no algo que pueda pasar en la aplicación.
   */
  readonly estado = signal(3);
}

const valorDe = (fijo: { nativeElement: HTMLElement }): string =>
  fijo.nativeElement.querySelector<HTMLSelectElement>('#sel')!.value;

describe('preseleccionar un select fuera de un formulario', () => {
  /** LA FORMA CORRECTA. No depende del orden: cada opción decide por sí misma. */
  it('[selected] en la opcion SI preselecciona la que toca', () => {
    const fijo = TestBed.createComponent(AnfitrionCorrecto);
    fijo.detectChanges();

    expect(valorDe(fijo)).toBe('3');
  });

  /**
   * LA FORMA QUE NO FUNCIONA, fijada a propósito. Si algún día Angular cambiara el orden
   * de aplicación, esta prueba falla y se podrá simplificar la plantilla; mientras falle,
   * nadie la «arregla» volviendo a `[value]`.
   */
  it('[value] en el select se PIERDE y cae en la primera opcion', () => {
    const fijo = TestBed.createComponent(AnfitrionRoto);
    fijo.detectChanges();

    expect(valorDe(fijo)).toBe('1');
  });

  /**
   * Y sigue el dato cuando cambia: es lo que pasa al recargarse la lista después de un
   * PATCH correcto. Sin esto, la fila se quedaría enseñando el estado viejo.
   */
  it('el selector sigue al dato cuando cambia', () => {
    const fijo = TestBed.createComponent(AnfitrionCorrecto);
    fijo.detectChanges();

    fijo.componentInstance.estado.set(4);
    fijo.detectChanges();

    expect(valorDe(fijo)).toBe('4');
  });
});
