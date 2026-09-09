import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { validadorCantidad, validadorImporte } from '../../../nucleo/formularios/validadores';

/**
 * POR QUÉ EXISTE ESTA PRUEBA: el prellenado de precios dejaba de ocurrir.
 *
 * El panel de línea rellena sus conceptos con los precios de la máquina **solo si el usuario no
 * ha escrito nada**, y esa pregunta se le hace a `FormArray.pristine`. `abrirLinea` rehacía el
 * arreglo con `clear()` + `push()` creyendo que eso lo devolvía a su estado inicial.
 *
 * **No lo devuelve.** `markAsDirty` propaga HACIA ARRIBA —del control a su grupo y de su grupo
 * al arreglo— y ni `clear()` ni `push()` tocan ese `_pristine` del padre. Así que en cuanto
 * alguien tecleaba una cifra, el arreglo quedaba sucio **para toda la vida del componente**: la
 * primera línea se prellenaba y ninguna más. El síntoma no se parecía a la causa — «la tarifa me
 * la pide en vez de traerla» — y por eso merece una prueba y no solo un arreglo.
 *
 * Lo que fija: que rehacer las filas NO limpia el arreglo, y que hay que decirlo explícitamente.
 */
function filaDeConcepto(): FormGroup<{
  tarifaId: FormControl<string>;
  cantidad: FormControl<number | null>;
  precioUnitario: FormControl<number | null>;
}> {
  return new FormGroup({
    // Los MISMOS validadores que el panel, y `tarifaId` SIN obligatoriedad: es lo que hace
    // que la fila vacía del final no apague el botón de guardar.
    tarifaId: new FormControl('', { nonNullable: true }),
    cantidad: new FormControl<number | null>(1, validadorCantidad),
    precioUnitario: new FormControl<number | null>(0, validadorImporte),
  });
}

describe('el estado «sin tocar» de las filas de concepto', () => {
  it('un arreglo recién construido está limpio, así que el prellenado ocurre', () => {
    const conceptos = new FormArray([filaDeConcepto()]);

    expect(conceptos.pristine).toBe(true);
  });

  it('escribir en una fila ensucia el ARREGLO, no solo la fila', () => {
    const conceptos = new FormArray([filaDeConcepto()]);

    conceptos.controls[0].controls.precioUnitario.markAsDirty();

    expect(conceptos.pristine).toBe(false);
  });

  /** EL FALLO, tal cual estaba. */
  it('rehacer las filas con clear() y push() NO devuelve el arreglo a limpio', () => {
    const conceptos = new FormArray([filaDeConcepto()]);

    conceptos.controls[0].controls.precioUnitario.markAsDirty();

    conceptos.clear();
    conceptos.push(filaDeConcepto());

    // La fila es nueva y está limpia...
    expect(conceptos.controls[0].pristine).toBe(true);

    // ...pero el arreglo sigue sucio, y es a él a quien se le pregunta.
    expect(conceptos.pristine).toBe(false);
  });

  it('y solo `markAsPristine` en el arreglo lo arregla: es lo que hace `abrirLinea`', () => {
    const conceptos = new FormArray([filaDeConcepto()]);

    conceptos.controls[0].controls.precioUnitario.markAsDirty();
    conceptos.clear();
    conceptos.push(filaDeConcepto());
    conceptos.markAsPristine();

    expect(conceptos.pristine).toBe(true);
  });

  /**
   * Y la otra mitad: `markAsPristine` en el arreglo tiene que dejar limpias también sus filas,
   * porque el efecto pregunta por el arreglo pero `ponerPrecios` escribe en las filas.
   */
  it('markAsPristine baja a las filas', () => {
    const conceptos = new FormArray([filaDeConcepto(), filaDeConcepto()]);

    conceptos.controls[1].controls.cantidad.markAsDirty();
    conceptos.markAsPristine();

    expect(conceptos.controls[1].pristine).toBe(true);
    expect(conceptos.controls[1].controls.cantidad.pristine).toBe(true);
  });
});

/**
 * La otra mitad del arreglo: la fila vacía del final tiene que ser VÁLIDA, o el formulario
 * queda inválido y el botón de guardar se apaga por una fila que el usuario no puso.
 *
 * Por eso `tarifaId` perdió su `validadorRequerido`, y por eso «al menos un concepto» se
 * comprueba aparte —en `puedeAgregar`— y no con la validación del formulario.
 */
describe('la fila vacía para agregar más', () => {
  it('una fila en blanco es válida: cantidad 1 y precio 0 lo son', () => {
    const fila = filaDeConcepto();

    expect(fila.valid).toBe(true);
    expect(fila.controls.tarifaId.value).toBe('');
  });

  it('un arreglo con una fila llena y una vacía es válido', () => {
    const llena = filaDeConcepto();
    llena.setValue({ tarifaId: 'una-tarifa', cantidad: 2, precioUnitario: 500 });

    const conceptos = new FormArray([llena, filaDeConcepto()]);

    expect(conceptos.valid).toBe(true);
  });

  it('pero una cantidad en cero SÍ invalida, aunque la fila no tenga tarifa', () => {
    const fila = filaDeConcepto();
    fila.controls.cantidad.setValue(0);

    // No es un caso raro: quien vacía la cantidad de la fila vacía deja un dato imposible, y
    // el servidor lo rechazaría con «la cantidad tiene que ser mayor que cero».
    expect(fila.valid).toBe(false);
  });

  it('las filas sin tarifa son las que se descartan al enviar', () => {
    const llena = filaDeConcepto();
    llena.setValue({ tarifaId: 'una-tarifa', cantidad: 1, precioUnitario: 500 });

    const conceptos = new FormArray([llena, filaDeConcepto(), filaDeConcepto()]);

    const conTarifa = conceptos.controls.filter((f) => f.controls.tarifaId.value !== '');

    expect(conTarifa).toHaveLength(1);
  });
});
