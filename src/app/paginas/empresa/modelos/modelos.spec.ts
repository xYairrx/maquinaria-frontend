import { ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * QUÉ ESCRIBE UN `<input type="number">` EN SU CONTROL.
 *
 * No es una prueba de la pantalla de modelos: es una prueba del `NumberValueAccessor` de
 * Angular, porque de él dependen tres formularios y porque su comportamiento contradice lo
 * que un formulario tipado promete.
 *
 * El fallo real: `horasEntreServicios` estaba declarado como texto y el envío hacía
 * `v.horasEntreServicios.trim()`. Al escribir en el campo, el accessor había puesto un
 * NUMBER debajo, `trim` no existía, y el TypeError saltaba dentro del manejador de envío —
 * después de `enviando.set(true)` y fuera de cualquier `subscribe`—. Resultado: la petición
 * nunca salía y el botón se quedaba en «Guardando…» para siempre, sin aviso de error.
 *
 * TypeScript no lo ve: el control se tipa en la DECLARACIÓN y nadie comprueba el accessor.
 * Es el mismo engaño que `[ngValue]`, por el otro lado.
 */
@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="formulario">
      <input id="horas" type="number" formControlName="horas" />
      <input id="orden" type="number" formControlName="orden" />
    </form>
  `,
})
class Anfitrion {
  readonly formulario = new FormGroup({
    // Opcional: sin `required` que lo tape.
    horas: new FormControl<number | null>(null),
    orden: new FormControl<number | null>(0, Validators.required),
  });
}

describe('input type=number y su control', () => {
  let fijo: ReturnType<typeof TestBed.createComponent<Anfitrion>>;

  const escribir = (id: string, texto: string) => {
    const campo: HTMLInputElement = fijo.nativeElement.querySelector(`#${id}`);
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fijo.detectChanges();
  };

  beforeEach(() => {
    fijo = TestBed.createComponent(Anfitrion);
    fijo.detectChanges();
  });

  it('escribe un NUMBER, no la cadena que se tecleó', () => {
    escribir('horas', '250');

    const valor = fijo.componentInstance.formulario.getRawValue().horas;

    expect(valor).toBe(250);
    expect(typeof valor).toBe('number');
  });

  /** La mitad que rompió: vacío NO es cadena vacía. Por eso `.trim()` reventaba. */
  it('vaciar el campo deja null, nunca la cadena vacía', () => {
    escribir('horas', '250');
    escribir('horas', '');

    const valor = fijo.componentInstance.formulario.getRawValue().horas;

    expect(valor).toBeNull();
    expect(valor).not.toBe('');
  });

  /** El accessor usa `parseFloat`: `step="1"` no impide que llegue un decimal. */
  it('deja pasar decimales aunque el paso sea 1', () => {
    escribir('horas', '250.5');

    expect(fijo.componentInstance.formulario.getRawValue().horas).toBe(250.5);
  });

  /**
   * Por qué los otros dos formularios sobrevivían: `required` rechaza el `null`, así que
   * el formulario queda inválido y nunca se envía. Es una red, no una solución.
   */
  it('required deja inválido el control numérico vacío', () => {
    expect(fijo.componentInstance.formulario.controls.orden.valid).toBe(true);

    escribir('orden', '');

    expect(fijo.componentInstance.formulario.controls.orden.valid).toBe(false);
    expect(fijo.componentInstance.formulario.valid).toBe(false);
  });

  /** `Math.trunc` sobre `number | null` es lo que se manda; se fija la forma exacta. */
  it('lo que se envía es un entero o null', () => {
    const aEnviar = (v: number | null) =>
      v === null || !Number.isFinite(v) ? null : Math.trunc(v);

    expect(aEnviar(250)).toBe(250);
    expect(aEnviar(250.9)).toBe(250);
    expect(aEnviar(null)).toBeNull();
    expect(aEnviar(Number.NaN)).toBeNull();
  });
});
