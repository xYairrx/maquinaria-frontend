import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { mismoNombre } from '../../../nucleo/formularios/texto';

interface ModeloDePrueba {
  readonly id: string;
  readonly nombre: string;
  readonly marca: string;
}

/**
 * La marca acota las SUGERENCIAS del modelo, y solo eso.
 *
 * **Aquí había un efecto que borraba el modelo al cambiar de marca, y se retiró.** Tenía sentido
 * con un `<select>` —un valor fuera de la lista se pinta en blanco— y deja de tenerlo con texto
 * libre: borrar lo que alguien tecleó porque cambió un filtro es perder su trabajo. Si el texto
 * no corresponde a ningún modelo de esa marca, se crea uno.
 */
@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="formulario">
      <input id="marcaTexto" formControlName="marcaTexto" list="lm" />
      <input id="modeloTexto" formControlName="modeloTexto" list="l" />
    </form>
  `,
})
class Anfitrion {
  /** Empieza vacío, igual que un `httpResource` que todavía no respondió. */
  readonly catalogo = signal<readonly ModeloDePrueba[]>([]);

  readonly formulario = new FormGroup({
    marcaTexto: new FormControl('', { nonNullable: true }),
    modeloTexto: new FormControl('', { nonNullable: true }),
  });

  /** El puente: un `FormGroup` no es reactivo. Ver `ubicaciones.spec.ts`. */
  private readonly valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  /** Igual que la pantalla: se acota por el NOMBRE de la marca, porque también es texto. */
  readonly modelos = computed(() => {
    const marca = this.valores().marcaTexto ?? '';

    return marca.trim() === ''
      ? this.catalogo()
      : this.catalogo().filter((m) => mismoNombre(m.marca, marca));
  });
}

const CATALOGO: readonly ModeloDePrueba[] = [
  { id: 'm-cat-320', nombre: '320D', marca: 'Caterpillar' },
  { id: 'm-kom-200', nombre: 'PC200', marca: 'Komatsu' },
];

function montar(): Anfitrion {
  const fijo = TestBed.createComponent(Anfitrion);
  fijo.detectChanges();

  return fijo.componentInstance;
}

describe('las sugerencias de modelo', () => {
  it('se acotan a la marca elegida', () => {
    const anfitrion = montar();
    anfitrion.catalogo.set(CATALOGO);

    expect(anfitrion.modelos()).toHaveLength(2);

    anfitrion.formulario.controls.marcaTexto.setValue('komatsu');

    expect(anfitrion.modelos().map((m) => m.nombre)).toEqual(['PC200']);
  });

  it('NO borran lo que se escribió cuando cambia la marca', () => {
    const anfitrion = montar();
    anfitrion.catalogo.set(CATALOGO);
    anfitrion.formulario.controls.modeloTexto.setValue('Retro 416F');

    anfitrion.formulario.controls.marcaTexto.setValue('komatsu');
    TestBed.tick();

    // Con el `<select>` anterior esto quedaba vacío. Con texto libre, lo tecleado se respeta y
    // acaba creando un modelo nuevo bajo esa marca.
    expect(anfitrion.formulario.controls.modeloTexto.value).toBe('Retro 416F');
  });

  it('tampoco mientras el catálogo viene en camino', () => {
    const anfitrion = montar();

    anfitrion.formulario.controls.modeloTexto.setValue('320D');
    anfitrion.formulario.controls.marcaTexto.setValue('Caterpillar');
    TestBed.tick();

    expect(anfitrion.formulario.controls.modeloTexto.value).toBe('320D');

    anfitrion.catalogo.set(CATALOGO);
    TestBed.tick();

    expect(anfitrion.formulario.controls.modeloTexto.value).toBe('320D');
  });
});
