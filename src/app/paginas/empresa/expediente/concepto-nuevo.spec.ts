import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { codigoDesdeNombre, mismoNombre } from '../../../nucleo/formularios/texto';

/**
 * EL ORDEN EN QUE CORREN EL VALUE ACCESSOR Y UN `(input)` DEL MISMO ELEMENTO.
 *
 * No es una prueba de la pantalla del expediente: es una prueba del enlace de Angular, porque de
 * él depende que el código del concepto nuevo se sugiera.
 *
 * El panel de precios tiene un `<input formControlName="conceptoTexto" (input)="…">`. Los DOS
 * escuchan el mismo evento: el `DefaultValueAccessor` de la directiva, que escribe el valor en
 * el control, y el manejador de la plantilla, que lee `conceptoNuevo()` —un `computed` sobre
 * `valueChanges`— para decidir si sugiere un código.
 *
 * **Si el manejador corriera primero, la señal tendría el valor ANTERIOR** y el código se
 * sugeriría con un carácter de menos, o no se sugeriría en la primera letra. No hay nada en el
 * código que lo garantice: se comprueba.
 *
 * Es la sexta trampa de formularios reactivos de este repo y la primera que se prueba **antes**
 * de que muerda.
 */
@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="formulario">
      <input
        class="concepto"
        formControlName="conceptoTexto"
        (input)="alEscribir()"
        list="conceptos"
      />
      <input class="codigo" formControlName="codigoNuevo" />
    </form>
  `,
})
class Anfitrion {
  /** Lo que ya hay en el catálogo. Uno solo basta para probar las dos ramas. */
  readonly catalogo = signal([{ id: 't1', nombre: 'Flete' }]);

  readonly formulario = new FormGroup({
    conceptoTexto: new FormControl('', { nonNullable: true }),
    codigoNuevo: new FormControl('', { nonNullable: true }),
  });

  private readonly valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  readonly conceptoNuevo = computed(() => {
    const texto = this.valores().conceptoTexto ?? '';

    return texto.trim() !== '' && !this.catalogo().some((x) => mismoNombre(x.nombre, texto));
  });

  /** Lo mismo que `alEscribirConcepto()` en la pantalla. */
  alEscribir(): void {
    if (!this.conceptoNuevo() || this.formulario.controls.codigoNuevo.value !== '') {
      return;
    }

    this.formulario.controls.codigoNuevo.setValue(
      codigoDesdeNombre(this.formulario.controls.conceptoTexto.value),
    );
  }
}

/** Teclea `texto` de golpe y dispara el `input`, como haría el navegador. */
function teclear(campo: HTMLInputElement, texto: string): void {
  campo.value = texto;
  campo.dispatchEvent(new Event('input'));
}

describe('el código del concepto nuevo se sugiere al escribir', () => {
  function montar() {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      concepto: raiz.querySelector<HTMLInputElement>('.concepto')!,
      codigo: raiz.querySelector<HTMLInputElement>('.codigo')!,
    };
  }

  it('ve el valor RECIÉN escrito, no el anterior', () => {
    const { fixture, concepto, codigo } = montar();

    teclear(concepto, 'Maniobra de descarga');
    fixture.detectChanges();

    // Si el manejador corriera antes del value accessor, aquí habría '' o un texto corto.
    expect(codigo.value).toBe('MANIOBRA-DE-DESCARGA');
  });

  it('no sugiere nada cuando lo escrito YA está en el catálogo', () => {
    const { fixture, concepto, codigo } = montar();

    // Sin acentos ni mayúsculas: `mismoNombre` lo reconoce igual.
    teclear(concepto, 'flete');
    fixture.detectChanges();

    expect(codigo.value).toBe('');
  });

  it('no pisa un código escrito a mano', () => {
    const { fixture, concepto, codigo } = montar();

    teclear(codigo, 'MAN');
    teclear(concepto, 'Maniobra de descarga');
    fixture.detectChanges();

    expect(codigo.value).toBe('MAN');
  });
});
