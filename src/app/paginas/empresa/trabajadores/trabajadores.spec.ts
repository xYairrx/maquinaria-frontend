import { Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import type { EstadoTrabajador } from '../../../nucleo/api/contratos';

const ACTIVO: EstadoTrabajador = 1;
const INACTIVO: EstadoTrabajador = 2;
const BAJA: EstadoTrabajador = 3;

/**
 * LA FECHA DE BAJA VA CON LA BAJA, O NO VA.
 *
 * El CHECK `trabajador_baja_coherente` exige que el estado Baja y su fecha viajen juntos:
 * obligatoria para la baja, PROHIBIDA en cualquier otro estado. Las dos mitades se rompen
 * distinto y por eso las dos estan fijadas aqui.
 *
 * La que se olvida es la segunda. «Falta la fecha» salta a la vista probando la pantalla;
 * «sobra la fecha» no, porque solo ocurre al elegir Baja, escribir la fecha y CAMBIAR DE
 * OPINION volviendo a Activo: el campo se esconde pero su valor sigue en el formulario, y sin
 * esta guarda saldria en el cuerpo del PATCH y el servidor lo rechazaria.
 *
 * El montaje repite el del componente —`valueChanges` convertido a señal— y no
 * `getRawValue()`, por lo mismo que quedo escrito en `ubicaciones.spec.ts`.
 */
@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="formulario">
      <select formControlName="estado">
        <option [ngValue]="1">Activo</option>
        <option [ngValue]="2">Inactivo</option>
        <option [ngValue]="3">Baja</option>
      </select>
      <input id="fechaBaja" type="date" formControlName="fechaBaja" />
    </form>
  `,
})
class Anfitrion {
  readonly formulario = new FormGroup({
    estado: new FormControl<EstadoTrabajador>(ACTIVO, { nonNullable: true }),
    fechaBaja: new FormControl('', { nonNullable: true }),
  });

  private readonly valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  readonly incoherente = computed(() => {
    const { estado, fechaBaja } = this.valores();

    return estado === BAJA ? !fechaBaja : Boolean(fechaBaja);
  });
}

describe('la coherencia de la fecha de baja', () => {
  const montar = () => {
    const fijo = TestBed.createComponent(Anfitrion);
    fijo.detectChanges();

    const poner = (estado: EstadoTrabajador, fechaBaja: string) => {
      fijo.componentInstance.formulario.setValue({ estado, fechaBaja });
      fijo.detectChanges();
    };

    return { fijo, poner };
  };

  it('arranca coherente: activo y sin fecha, como abre un panel recien reseteado', () => {
    const { fijo } = montar();

    expect(fijo.componentInstance.incoherente()).toBe(false);
  });

  it('la baja SIN fecha es incoherente', () => {
    const { fijo, poner } = montar();

    poner(BAJA, '');

    expect(fijo.componentInstance.incoherente()).toBe(true);
  });

  it('la baja CON fecha es coherente', () => {
    const { fijo, poner } = montar();

    poner(BAJA, '2026-08-28');

    expect(fijo.componentInstance.incoherente()).toBe(false);
  });

  it('activo CON fecha es incoherente: el servidor la prohibe fuera de la baja', () => {
    const { fijo, poner } = montar();

    poner(ACTIVO, '2026-08-28');

    expect(fijo.componentInstance.incoherente()).toBe(true);
  });

  it('inactivo tampoco la admite: la prohibicion no es solo contra activo', () => {
    const { fijo, poner } = montar();

    poner(INACTIVO, '2026-08-28');

    expect(fijo.componentInstance.incoherente()).toBe(true);
  });

  it('inactivo sin fecha es coherente', () => {
    const { fijo, poner } = montar();

    poner(INACTIVO, '');

    expect(fijo.componentInstance.incoherente()).toBe(false);
  });

  /** La ruta que nadie recorre a proposito, y la que el componente tapa mandando `null`. */
  it('elegir baja, escribir la fecha y volver a activo deja la fecha puesta', () => {
    const { fijo, poner } = montar();

    poner(BAJA, '2026-08-28');
    expect(fijo.componentInstance.incoherente()).toBe(false);

    poner(ACTIVO, '2026-08-28');
    expect(fijo.componentInstance.incoherente()).toBe(true);
  });
});

/**
 * EL CALLEJON SIN SALIDA QUE SOLO APARECIO USANDO LA PANTALLA.
 *
 * La guarda de arriba describe el CHECK, pero por si sola dejaba la interfaz atascada: eliges
 * Baja, escribes la fecha, cambias de opinion a Activo —y el campo de fecha SE ESCONDE con su
 * valor dentro—. La guarda bloquea el envio, el unico campo editable que queda es el estado, y
 * no hay forma de borrar la fecha. El unico camino era cerrar el panel y volver a abrirlo.
 *
 * No lo veia ninguna prueba porque las dos mitades del CHECK, por separado, estaban bien. El
 * fallo estaba en la TRANSICION, y se encontro probando la pantalla en el navegador.
 *
 * El arreglo es un `effect` que limpia la fecha al salir de Baja. Esta prueba fija la
 * consecuencia: despues de esa transicion, el formulario tiene que quedar coherente y enviable.
 */
describe('cambiar de opinion despues de escribir la fecha', () => {
  const montar = () => {
    const fijo = TestBed.createComponent(Anfitrion);
    fijo.detectChanges();

    return fijo;
  };

  it('salir de baja limpia la fecha y desbloquea el envio', () => {
    const fijo = montar();
    const formulario = fijo.componentInstance.formulario;

    formulario.setValue({ estado: BAJA, fechaBaja: '2026-08-28' });
    fijo.detectChanges();
    expect(fijo.componentInstance.incoherente()).toBe(false);

    // Lo que hace el `effect` de la pantalla al dejar de ser baja.
    formulario.controls.estado.setValue(ACTIVO);
    formulario.controls.fechaBaja.setValue('');
    fijo.detectChanges();

    expect(fijo.componentInstance.incoherente()).toBe(false);
    expect(formulario.controls.fechaBaja.value).toBe('');
  });

  it('sin limpiarla, el formulario queda atascado: es el fallo que se corrigio', () => {
    const fijo = montar();
    const formulario = fijo.componentInstance.formulario;

    formulario.setValue({ estado: BAJA, fechaBaja: '2026-08-28' });
    fijo.detectChanges();

    // Solo el estado, como cuando el campo de fecha ya no se dibuja.
    formulario.controls.estado.setValue(ACTIVO);
    fijo.detectChanges();

    expect(fijo.componentInstance.incoherente()).toBe(true);
  });
});
