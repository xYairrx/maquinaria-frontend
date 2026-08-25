import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Hoja } from './hoja';

/**
 * El gesto de la hoja inferior, y en concreto su ASIMETRÍA.
 *
 * Se prueba porque aquí hubo un fallo visible: el arrastre se aplicaba entero como
 * `translate`, y la hoja está clavada al fondo con `inset: auto 0 0`, así que arrastrar
 * hacia arriba la DESPEGABA del borde inferior dejando ver el velo debajo —con el pie y su
 * acción principal subiendo con ella—. Al soltar volvía a su sitio de golpe.
 *
 * La regla que fija esta prueba: **subir es crecer, bajar es desplazarse.** El
 * `translate` nunca es negativo, en ningún recorrido, porque un `translate` negativo ES el
 * fallo. Si alguien vuelve a mandar el arrastre completo al `translate`, esto falla.
 *
 * `abierta` se queda en `false` a propósito: así el efecto no llama a `showModal()`, que
 * jsdom no implementa igual que un navegador. Lo que se prueba es la aritmética del gesto,
 * y esa no depende de que el diálogo esté abierto.
 */
describe('Hoja: el arrastre', () => {
  let hoja: Hoja;

  beforeEach(() => {
    hoja = TestBed.createComponent(Hoja).componentInstance;
  });

  /** El recorrido del dedo, en px. Negativo hacia arriba, como lo da un `pointermove`. */
  const arrastrar = (px: number): void => hoja['arrastre'].set(px);

  const translate = (): number => hoja['desplazamiento']();
  const tope = (): string => hoja['topeAltura']();

  it('en reposo no desplaza y el tope es el anclaje', () => {
    expect(translate()).toBe(0);
    expect(tope()).toBe('min(98dvh, calc(50dvh + 0px))');
  });

  it('hacia ARRIBA crece y NO desplaza', () => {
    arrastrar(-200);

    // Lo que rompía la pantalla. Cero, no -200.
    expect(translate()).toBe(0);
    expect(tope()).toBe('min(98dvh, calc(50dvh + 200px))');
  });

  it('hacia ABAJO desplaza y NO crece', () => {
    arrastrar(150);

    expect(translate()).toBe(150);
    expect(tope()).toBe('min(98dvh, calc(50dvh + 0px))');
  });

  it('un arrastre enorme hacia arriba lo frena el min() del CSS, no un tope en JS', () => {
    arrastrar(-9000);

    // El `min` mezcla `dvh` con `px`: solo el navegador sabe cuánto mide un `dvh` ahora
    // mismo, así que el freno se expresa y no se calcula.
    expect(tope()).toBe('min(98dvh, calc(50dvh + 9000px))');
    expect(translate()).toBe(0);
  });

  it('en el anclaje más alto, tirar hacia arriba se ignora', () => {
    // Se coloca en el último anclaje de los dos por defecto.
    hoja['indice'].set(1);
    hoja['arrastrando'].set(true);
    hoja['inicioY'] = 500;

    // `moverArrastre` solo lee `clientY` y `timeStamp`.
    hoja['moverArrastre']({ clientY: 300, timeStamp: 100 } as PointerEvent);

    // Ni desplaza ni crece: por encima del anclaje más alto no hay nada que descubrir, y
    // fingir movimiento levantando la hoja del fondo era el mismo fallo en pequeño.
    expect(translate()).toBe(0);
    expect(tope()).toBe('min(98dvh, calc(70dvh + 0px))');
  });

  it('en el anclaje más alto, tirar hacia ABAJO sí desplaza', () => {
    hoja['indice'].set(1);
    hoja['arrastrando'].set(true);
    hoja['inicioY'] = 300;

    hoja['moverArrastre']({ clientY: 460, timeStamp: 100 } as PointerEvent);

    expect(translate()).toBe(160);
  });
});
