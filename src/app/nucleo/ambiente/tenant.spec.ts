import { describe, expect, it } from 'vitest';
import { ambitoDelAnfitrion, slugDelAnfitrion } from './tenant';

/**
 * Primera prueba del repo. La función decide qué empresa se le pide a la API, así que
 * un fallo aquí manda al usuario a la empresa equivocada o lo deja sin ninguna.
 *
 * El caso que justifica el archivo es `malo-ejemplo.com`: con un `endsWith` sin el
 * punto del sufijo, pasaría como si fuera una empresa nuestra.
 */
describe('slugDelAnfitrion', () => {
  it.each([
    ['bajio.ejemplo.com', 'bajio'],
    ['demo.ejemplo.com', 'demo'],
    ['maquinaria-norte.ejemplo.com', 'maquinaria-norte'],
    ['BAJIO.EJEMPLO.COM', 'bajio'],
    ['  bajio.ejemplo.com  ', 'bajio'],
    ['bajio.localhost', 'bajio'],
  ])('reconoce la empresa en %s', (anfitrion, esperado) => {
    const base = anfitrion.includes('localhost') ? 'localhost' : 'ejemplo.com';
    expect(slugDelAnfitrion(anfitrion, base)).toBe(esperado);
  });

  it.each([
    ['ejemplo.com'], // el dominio pelado no es una empresa
    ['malo-ejemplo.com'], // EL CASO: termina en -ejemplo.com, no en .ejemplo.com
    ['ejemplo.com.malo.com'], // el dominio real de sufijo
    ['otrodominio.com'],
    ['a.b.ejemplo.com'], // los slugs no llevan puntos
    ['.ejemplo.com'], // etiqueta vacía
    [''],
  ])('no ve empresa en %s', (anfitrion) => {
    expect(slugDelAnfitrion(anfitrion, 'ejemplo.com')).toBeNull();
  });

  it.each([['login'], ['www'], ['app'], ['api'], ['admin'], ['soporte'], ['status']])(
    'trata %s como subdominio reservado, no como empresa',
    (reservado) => {
      expect(slugDelAnfitrion(`${reservado}.ejemplo.com`, 'ejemplo.com')).toBeNull();
    },
  );

  it('sin dominio base no resuelve nada', () => {
    expect(slugDelAnfitrion('bajio.ejemplo.com', '')).toBeNull();
  });
});

describe('ambitoDelAnfitrion', () => {
  const base = 'ejemplo.com';

  it('admin es la superadministración, no una empresa llamada «admin»', () => {
    expect(ambitoDelAnfitrion('admin.ejemplo.com', base)).toEqual({ tipo: 'plataforma' });
  });

  it.each([['bajio'], ['demo'], ['maquinaria-norte']])('%s es una empresa', (slug) => {
    expect(ambitoDelAnfitrion(`${slug}.ejemplo.com`, base)).toEqual({ tipo: 'empresa', slug });
  });

  it.each([
    ['ejemplo.com'], // el dominio pelado
    ['login.ejemplo.com'],
    ['www.ejemplo.com'],
    ['malo-ejemplo.com'], // dominio ajeno: cae al portal, nunca a una empresa
    ['a.b.ejemplo.com'],
  ])('%s cae al portal', (anfitrion) => {
    expect(ambitoDelAnfitrion(anfitrion, base)).toEqual({ tipo: 'portal' });
  });

  it('nunca inventa una empresa por defecto', () => {
    // La regla que importa: si no se sabe a qué empresa se entra, NO se elige una.
    // Igual que el backend, donde pedir el tenant sin resolverlo lanza en vez de caer
    // a la base central.
    const ambito = ambitoDelAnfitrion('cualquier-cosa.otro-dominio.com', base);

    expect(ambito.tipo).toBe('portal');
  });
});
