import { beforeEach, describe, expect, it } from 'vitest';

import { elegirIdioma, idioma, idiomaGuardado, nombreModulo, t } from './i18n';
import { TEXTOS, type CodigoIdioma } from './textos';

/**
 * La paridad de claves entre los dos idiomas la garantiza TypeScript —`EN_US` se declara
 * con el tipo que sale de `ES_MX`—, así que aquí no se comprueba: no compilaría.
 *
 * Lo que sí puede romperse en silencio es lo que el tipo no ve: una traducción dejada en
 * blanco, una función que ignora su argumento, o la preferencia que no se recuerda.
 */

/** Recorre el diccionario y devuelve cada hoja resuelta, con su ruta. */
function hojas(valor: unknown, ruta = ''): readonly [string, string][] {
  if (typeof valor === 'string') {
    return [[ruta, valor]];
  }

  // Las funciones son textos con un dato dentro. Se llaman con valores reconocibles
  // para poder exigir después que aparezcan en el resultado.
  if (typeof valor === 'function') {
    const argumentos = Array.from({ length: valor.length }, (_, i) => (i === 0 ? 7 : `dato${i}`));

    return [[ruta, String((valor as (...a: unknown[]) => string)(...argumentos))]];
  }

  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([clave, hijo]) =>
      hojas(hijo, ruta === '' ? clave : `${ruta}.${clave}`),
    );
  }

  return [];
}

const CODIGOS = Object.keys(TEXTOS) as CodigoIdioma[];

describe('diccionario de textos', () => {
  for (const codigo of CODIGOS) {
    it(`${codigo} no tiene ningún texto vacío`, () => {
      const vacias = hojas(TEXTOS[codigo])
        .filter(([, texto]) => texto.trim() === '')
        .map(([ruta]) => ruta);

      expect(vacias).toEqual([]);
    });

    it(`${codigo} interpola el dato en los textos con argumentos`, () => {
      // Una plantilla que se olvida del `${n}` compila igual y miente en pantalla:
      // «Al menos caracteres». Si el 7 no sale, el dato se perdió.
      const perdidos = hojas(TEXTOS[codigo])
        .filter(([ruta, texto]) => ruta.endsWith('largoMinimo') && !texto.includes('7'))
        .map(([ruta]) => ruta);

      expect(perdidos).toEqual([]);
    });
  }
});

describe('elegirIdioma', () => {
  beforeEach(() => {
    localStorage.clear();
    elegirIdioma('es-MX');
  });

  it('cambia los textos que se sirven', () => {
    expect(t().comun.salir).toBe('Salir');

    elegirIdioma('en-US');

    expect(idioma()).toBe('en-US');
    expect(t().comun.salir).toBe('Sign out');
  });

  it('recuerda la elección y la anuncia en <html lang>', () => {
    elegirIdioma('en-US');

    expect(localStorage.getItem('maquinaria.idioma')).toBe('en-US');
    expect(document.documentElement.lang).toBe('en-US');
  });
});

describe('idiomaGuardado', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/entrar');
  });

  it('sin nada guardado y sin URL, es español', () => {
    expect(idiomaGuardado()).toBe('es-MX');
  });

  it('el de la URL gana al guardado', () => {
    // Es el traspaso del portal al subdominio de la empresa: `localStorage` es por
    // origen, así que en el subdominio lo único que hay es la URL.
    localStorage.setItem('maquinaria.idioma', 'es-MX');
    window.history.replaceState(null, '', '/entrar?idioma=en-US');

    expect(idiomaGuardado()).toBe('en-US');
  });

  it('un idioma inventado en la URL se ignora', () => {
    window.history.replaceState(null, '', '/entrar?idioma=klingon');

    expect(idiomaGuardado()).toBe('es-MX');
  });
});

describe('nombreModulo', () => {
  // El idioma es estado de módulo, compartido entre bloques: sin esto, este describe
  // heredaría el `en-US` que dejó el anterior.
  beforeEach(() => elegirIdioma('es-MX'));

  it('traduce las claves que conoce', () => {
    expect(nombreModulo('ordenes-trabajo')).toBe('Órdenes de trabajo');

    elegirIdioma('en-US');

    expect(nombreModulo('ordenes-trabajo')).toBe('Work orders');
  });

  it('una clave desconocida se muestra tal cual', () => {
    // Pasa si el backend agrega un módulo antes que el frontend. Mejor la clave cruda
    // que un hueco.
    expect(nombreModulo('modulo-que-no-existe')).toBe('modulo-que-no-existe');
  });
});
