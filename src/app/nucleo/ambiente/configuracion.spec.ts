import { describe, expect, it } from 'vitest';
import { AMBIENTES, ambientePara } from './configuracion';

/**
 * El caso que justifica el archivo es `malo-maqvia.com`: un dominio ajeno que termina
 * parecido al nuestro no puede caer en producción. Y cuando vuelva a haber más de un
 * ambiente, estas pruebas son las que vigilan el orden de la lista.
 */
describe('ambientePara', () => {
  it.each([
    ['localhost', 'localhost'],
    ['bajio.localhost', 'localhost'],
    ['maqvia.com', 'maqvia.com'],
    ['bajio.maqvia.com', 'maqvia.com'],
    ['BAJIO.MAQVIA.COM', 'maqvia.com'],
    // Dominio ajeno que termina parecido: cae en local, no en producción.
    ['malo-maqvia.com', 'localhost'],
  ])('%s pertenece al ambiente %s', (anfitrion, dominioBase) => {
    expect(ambientePara(anfitrion).dominioBase).toBe(dominioBase);
  });
});

/**
 * `urlApi` se concatena con `/api/...` en cada servicio, así que una barra final produce
 * `//api/...` y un 404 del backend. Ya pasó una vez al pegar la URL de Railway desde el
 * dashboard, que la copia con barra.
 */
describe('AMBIENTES', () => {
  it.each(AMBIENTES.map((a) => [a.dominioBase, a.urlApi]))(
    '%s tiene una urlApi sin barra final',
    (_dominioBase, urlApi) => {
      expect(urlApi.endsWith('/')).toBe(false);
    },
  );
});
