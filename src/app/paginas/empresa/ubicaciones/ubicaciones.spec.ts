import { Component, computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';

/**
 * UN `computed` QUE LEE UN FORMULARIO NO SE ENTERA DE NADA.
 *
 * Esta es la segunda vez que un primitivo reactivo lee estado que no es una señal y queda
 * inerte. La primera fue `httpResource` en Marcas —la búsqueda no filtraba— y la segunda,
 * aquí: la guarda de «media coordenada no ubica nada» evaluaba una vez y nunca más, así que
 * el aviso jamás aparecía y el botón nunca se bloqueaba.
 *
 * No falla, no avisa y no lo ve el compilador. Solo se nota usando la pantalla, y por eso
 * queda fijado aquí: el puente entre un `FormGroup` y las señales es `valueChanges`.
 */
@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="formulario">
      <input id="latitud" type="number" formControlName="latitud" />
      <input id="longitud" type="number" formControlName="longitud" />
    </form>
  `,
})
class Anfitrion {
  readonly formulario = new FormGroup({
    latitud: new FormControl<number | null>(null),
    longitud: new FormControl<number | null>(null),
  });

  /** Lo correcto: el valor pasa por `valueChanges`, que sí emite. */
  private readonly valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  readonly incompleta = computed(() => {
    const { latitud, longitud } = this.valores();

    return (latitud == null) !== (longitud == null);
  });

  /** Lo que estaba escrito antes. Se conserva para demostrar que NO reacciona. */
  readonly incompletaCongelada = computed(() => {
    const { latitud, longitud } = this.formulario.getRawValue();

    return (latitud === null) !== (longitud === null);
  });
}

describe('la guarda de coordenadas', () => {
  const montar = () => {
    const fijo = TestBed.createComponent(Anfitrion);
    fijo.detectChanges();

    const escribir = (id: string, texto: string) => {
      const campo: HTMLInputElement = fijo.nativeElement.querySelector(`#${id}`);
      campo.value = texto;
      campo.dispatchEvent(new Event('input'));
      fijo.detectChanges();
    };

    return { fijo, escribir };
  };

  it('con las dos vacías no se reclama nada', () => {
    const { fijo } = montar();

    expect(fijo.componentInstance.incompleta()).toBe(false);
  });

  it('con solo la latitud, reclama', () => {
    const { fijo, escribir } = montar();

    escribir('latitud', '21.12');

    expect(fijo.componentInstance.incompleta()).toBe(true);
  });

  it('con solo la longitud, reclama', () => {
    const { fijo, escribir } = montar();

    escribir('longitud', '-101.68');

    expect(fijo.componentInstance.incompleta()).toBe(true);
  });

  it('con las dos puestas, deja de reclamar', () => {
    const { fijo, escribir } = montar();

    escribir('latitud', '21.12');
    escribir('longitud', '-101.68');

    expect(fijo.componentInstance.incompleta()).toBe(false);
  });

  /** Vaciar una de las dos vuelve a dejar el par a medias. */
  it('borrar una de las dos vuelve a reclamar', () => {
    const { fijo, escribir } = montar();

    escribir('latitud', '21.12');
    escribir('longitud', '-101.68');
    escribir('latitud', '');

    expect(fijo.componentInstance.incompleta()).toBe(true);
  });

  /**
   * LA PRUEBA QUE EXPLICA POR QUÉ EXISTE ESTE ARCHIVO. Con `getRawValue()` dentro del
   * `computed`, el valor cambia en el formulario y la señal sigue diciendo `false`: no
   * registró ninguna dependencia, así que Angular no tiene motivo para recalcularla.
   */
  it('leer getRawValue() dentro de un computed lo deja congelado', () => {
    const { fijo, escribir } = montar();

    // Se lee una vez para que quede memorizada con las dos vacías.
    expect(fijo.componentInstance.incompletaCongelada()).toBe(false);

    escribir('latitud', '21.12');

    // El formulario SÍ cambió...
    expect(fijo.componentInstance.formulario.getRawValue().latitud).toBe(21.12);
    // ...y la versión que lo lee sin señales no se entera.
    expect(fijo.componentInstance.incompletaCongelada()).toBe(false);
    // La que pasa por `valueChanges`, sí.
    expect(fijo.componentInstance.incompleta()).toBe(true);
  });
});
