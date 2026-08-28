import { describe, expect, it } from 'vitest';

import {
  alPulsarGrupo,
  contieneLaRuta,
  grupoEstaAbierto,
  idDePanel,
  type GrupoMenu,
} from './opciones-menu';

const CATALOGOS: GrupoMenu = {
  titulo: 'Catálogos',
  icono: 'M0 0',
  opciones: [
    { titulo: 'Marcas', ruta: '/marcas', modulo: 'equipos' },
    { titulo: 'Tipos', ruta: '/tipos', modulo: 'equipos' },
  ],
};

const ORGANIZACION: GrupoMenu = {
  titulo: 'Organización',
  icono: 'M0 0',
  opciones: [{ titulo: 'Puestos', ruta: '/puestos', modulo: 'usuarios' }],
};

/** Nadie ha tocado el menú todavía: manda la ruta activa. */
const SIN_ELEGIR = undefined;

describe('qué ruta cae dentro de un grupo', () => {
  it('la ruta exacta', () => {
    expect(contieneLaRuta(CATALOGOS, '/marcas')).toBe(true);
  });

  it('una ruta hija', () => {
    expect(contieneLaRuta(CATALOGOS, '/marcas/8f3c')).toBe(true);
  });

  it('la misma ruta con parametros detras', () => {
    expect(contieneLaRuta(CATALOGOS, '/marcas?pagina=2')).toBe(true);
  });

  it('la misma ruta con fragmento detras', () => {
    expect(contieneLaRuta(CATALOGOS, '/marcas#tabla')).toBe(true);
  });

  /**
   * EL CASO POR EL QUE ESTA FUNCION EXISTE.
   *
   * Con un `startsWith` pelado, `/tipos` daria por buena `/tipos-de-cambio` y abriria el grupo
   * equivocado. El separador tiene que entrar en la comparacion.
   */
  it('NO una ruta que solo empieza igual', () => {
    expect(contieneLaRuta(CATALOGOS, '/tipos-de-cambio')).toBe(false);
  });

  it('no una ruta de otro grupo', () => {
    expect(contieneLaRuta(CATALOGOS, '/puestos')).toBe(false);
  });
});

/**
 * EL ACORDEON ES EXCLUSIVO POR CONSTRUCCION, no por vigilancia.
 *
 * El estado es UN titulo, no un conjunto, asi que dos grupos abiertos a la vez no son un
 * caso que haya que evitar: son un estado que no se puede representar. Estas pruebas fijan
 * las tres consecuencias que si se pueden equivocar.
 */
describe('cuando un grupo se pinta abierto', () => {
  it('sin elegir nada, lo abre la ruta activa', () => {
    expect(grupoEstaAbierto(CATALOGOS, '/marcas', SIN_ELEGIR)).toBe(true);
  });

  it('sin elegir nada, queda cerrado si la ruta esta fuera', () => {
    expect(grupoEstaAbierto(CATALOGOS, '/inicio', SIN_ELEGIR)).toBe(false);
  });

  it('abrir uno cierra al otro, aunque la ruta activa viva en el otro', () => {
    const eleccion = alPulsarGrupo(ORGANIZACION, '/marcas', SIN_ELEGIR);

    expect(grupoEstaAbierto(ORGANIZACION, '/marcas', eleccion)).toBe(true);
    expect(grupoEstaAbierto(CATALOGOS, '/marcas', eleccion)).toBe(false);
  });

  /**
   * POR QUE `null` NO ES `undefined`. Cerrando a `undefined`, la ruta volveria a mandar y el
   * grupo se reabriria en el acto: pulsar no haria nada visible.
   */
  it('cerrar el grupo donde estas lo deja cerrado, no lo reabre la ruta', () => {
    const eleccion = alPulsarGrupo(CATALOGOS, '/marcas', SIN_ELEGIR);

    expect(eleccion).toBeNull();
    expect(grupoEstaAbierto(CATALOGOS, '/marcas', eleccion)).toBe(false);
  });

  it('pulsar dos veces el mismo grupo lo abre y lo cierra', () => {
    const abierto = alPulsarGrupo(ORGANIZACION, '/inicio', SIN_ELEGIR);
    const cerrado = alPulsarGrupo(ORGANIZACION, '/inicio', abierto);

    expect(grupoEstaAbierto(ORGANIZACION, '/inicio', abierto)).toBe(true);
    expect(grupoEstaAbierto(ORGANIZACION, '/inicio', cerrado)).toBe(false);
  });

  it('recargar dentro de un grupo lo encuentra abierto: sin esto no hay pista de donde estas', () => {
    expect(grupoEstaAbierto(CATALOGOS, '/tipos', SIN_ELEGIR)).toBe(true);
  });
});

/**
 * El `id` sale de un titulo TRADUCIDO, asi que lleva acentos en español y puede llevar
 * espacios en cualquier idioma. Un `id` con eso dentro deja el `aria-controls` del disparador
 * apuntando a nada, y el lector de pantalla pierde la relacion entre el boton y su panel.
 */
describe('el id del panel de un grupo', () => {
  it('quita los acentos', () => {
    expect(idDePanel('Catálogos')).toBe('menu-grupo-catalogos');
  });

  it('quita la ñ y los acentos juntos', () => {
    expect(idDePanel('Organización')).toBe('menu-grupo-organizacion');
  });

  it('convierte los espacios en guiones', () => {
    expect(idDePanel('Ordenes de compra')).toBe('menu-grupo-ordenes-de-compra');
  });

  it('no deja guiones sueltos en los extremos', () => {
    expect(idDePanel('¿Compras?')).toBe('menu-grupo-compras');
  });

  it('sirve como selector de verdad', () => {
    expect(() => document.querySelector(`#${idDePanel('Organización')}`)).not.toThrow();
  });
});
