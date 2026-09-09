import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';

/**
 * QUÉ PASA CUANDO SE REEMPLAZAN LOS GRUPOS DE UN `FormArray` Y EL `@for` RASTREA POR ÍNDICE.
 *
 * No es una prueba de la pantalla de cotizaciones: es una prueba del enlace de Angular, porque
 * de él depende que el prellenado de precios se VEA.
 *
 * El fallo, y su síntoma exacto: `ponerPrecios` hace `clear()` y empuja grupos NUEVOS. Con
 * `track $index`, Angular reutiliza los nodos del DOM —el índice no cambió— y **`formGroupName`
 * no se vuelve a enlazar**: sus directivas siguen apuntando a los grupos DESCARTADOS. Así que el
 * arreglo tiene los valores buenos y los campos de la pantalla siguen mostrando los viejos.
 *
 * Se veía en el panel como algo incoherente que costaba de creer: la nota «Por defecto $2,000.00
 * / Hora» —que se lee del arreglo— aparecía debajo de un desplegable que decía «Sin definir», y
 * la cantidad y el precio seguían en 1 y 0. El dato estaba bien; la vista no.
 *
 * Con `track fila` —identidad del grupo— reemplazarlo destruye y recrea el nodo, las directivas
 * se enlazan al grupo nuevo y el valor se pinta.
 *
 * LOS DOS ANFITRIONES VAN SEPARADOS, igual que en `selector-estado.spec.ts`: el roto es el que
 * se quiere medir y no conviene que comparta pasada de detección con el bueno.
 */
function fila(precio: number) {
  return new FormGroup({ precioUnitario: new FormControl(precio) });
}

@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="formulario">
      <div formArrayName="conceptos">
        @for (f of filas(); track $index) {
          <div [formGroupName]="$index">
            <input class="precio" formControlName="precioUnitario" />
          </div>
        }
      </div>
    </form>
  `,
})
class AnfitrionPorIndice {
  readonly formulario = new FormGroup({ conceptos: new FormArray([fila(0)]) });
  readonly version = signal(0);

  readonly filas = signal<readonly FormGroup<{ precioUnitario: FormControl<number | null> }>[]>([
    ...this.formulario.controls.conceptos.controls,
  ]);

  /** Lo que hace `ponerPrecios`: vaciar y empujar grupos nuevos, ya con su valor. */
  reemplazar(precio: number): void {
    const conceptos = this.formulario.controls.conceptos;

    conceptos.clear();
    conceptos.push(fila(precio));

    this.filas.set([...conceptos.controls]);
  }
}

@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="formulario">
      <div formArrayName="conceptos">
        @for (f of filas(); track f) {
          <div [formGroupName]="$index">
            <input class="precio" formControlName="precioUnitario" />
          </div>
        }
      </div>
    </form>
  `,
})
class AnfitrionPorIdentidad {
  readonly formulario = new FormGroup({ conceptos: new FormArray([fila(0)]) });

  readonly filas = signal<readonly FormGroup<{ precioUnitario: FormControl<number | null> }>[]>([
    ...this.formulario.controls.conceptos.controls,
  ]);

  reemplazar(precio: number): void {
    const conceptos = this.formulario.controls.conceptos;

    conceptos.clear();
    conceptos.push(fila(precio));

    this.filas.set([...conceptos.controls]);
  }
}

function precioEnPantalla(fixture: { nativeElement: HTMLElement }): string {
  return (fixture.nativeElement.querySelector('.precio') as HTMLInputElement).value;
}

describe('reemplazar los grupos de un FormArray', () => {
  it('EL FALLO: con track $index, el campo sigue mostrando el valor viejo', () => {
    const fixture = TestBed.createComponent(AnfitrionPorIndice);
    fixture.detectChanges();

    expect(precioEnPantalla(fixture)).toBe('0');

    fixture.componentInstance.reemplazar(2000);
    fixture.detectChanges();

    // El arreglo SÍ tiene el valor nuevo...
    expect(
      fixture.componentInstance.formulario.controls.conceptos.controls[0].controls.precioUnitario
        .value,
    ).toBe(2000);

    // ...y la pantalla sigue mostrando el viejo. Ese era el síntoma.
    expect(precioEnPantalla(fixture)).toBe('0');
  });

  it('con track por identidad del grupo, el campo se repinta', () => {
    const fixture = TestBed.createComponent(AnfitrionPorIdentidad);
    fixture.detectChanges();

    expect(precioEnPantalla(fixture)).toBe('0');

    fixture.componentInstance.reemplazar(2000);
    fixture.detectChanges();

    expect(precioEnPantalla(fixture)).toBe('2000');
  });
});
