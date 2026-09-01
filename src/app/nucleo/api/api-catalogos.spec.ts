import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ApiCatalogos, aParametros } from './api-catalogos';
import type { FiltroListado } from './contratos';
import { configuracion } from '../ambiente/configuracion';

/**
 * El listado de marcas.
 *
 * ESTO EXISTE POR UN BUG QUE YA PASÓ. El recurso vivía como CAMPO del servicio y su URL
 * leía una propiedad normal que la pantalla asignaba al montarse. En su primera ejecución
 * esa propiedad era `undefined`, la función salía antes de leer ninguna señal, y el recurso
 * quedaba sin dependencias registradas: no volvía a ejecutarse nunca. La lista solo
 * aparecía tras crear una marca —esa mutación hace `reload()` explícito— y **ni la búsqueda
 * ni los chips de filtro hacían nada**.
 *
 * Compilaba, no daba error en consola y en pantalla parecía correcto mientras hubiera una
 * sola marca. Exactamente la clase de fallo que solo caza una prueba.
 *
 * Lo que se fija aquí: que cambiar el filtro DISPARE una petición nueva con los parámetros
 * correctos, y que `Activo: false` viaje en lugar de perderse por ser falsy.
 */
const URL = `${configuracion.urlApi}/api/catalogos/marcas`;

/** Una página vacía, que es lo que la API contesta cuando el filtro no encuentra nada. */
const VACIA = { filas: [], numero: 1, tamano: 50, total: 0, paginas: 0 };

function pagina(filas: readonly unknown[]) {
  return { filas, numero: 1, tamano: 50, total: filas.length, paginas: 1 };
}

/**
 * Deja correr lo pendiente: los recursos lanzan su petición en una microtarea, así que un
 * `TestBed.tick()` a secas se ejecuta antes de que exista la petición que comprobar.
 */
async function asentar() {
  TestBed.tick();
  await Promise.resolve();
  TestBed.tick();
  await Promise.resolve();
}

describe('ApiCatalogos — listado de marcas', () => {
  let api: ApiCatalogos;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    api = TestBed.inject(ApiCatalogos);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la primera página en cuanto se monta', async () => {
    const filtro = signal<FiltroListado>({ Numero: 1, Tamano: 50, Orden: 'nombre' });
    const listado = TestBed.runInInjectionContext(() => api.marcas.listado(filtro));

    await asentar();

    const peticion = http.expectOne((r) => r.url === URL);
    expect(peticion.request.params.get('Numero')).toBe('1');
    expect(peticion.request.params.get('Orden')).toBe('nombre');

    peticion.flush(pagina([{ id: 'a', nombre: 'Caterpillar', activo: true, modelos: 0 }]));
    await asentar();

    expect(listado.filas()).toHaveLength(1);
    expect(listado.total()).toBe(1);
  });

  /** LA PRUEBA QUE IMPORTA: es la que fallaba antes del arreglo. */
  it('vuelve a pedir cuando cambia el texto de búsqueda', async () => {
    const filtro = signal<FiltroListado>({ Numero: 1, Tamano: 50 });
    TestBed.runInInjectionContext(() => api.marcas.listado(filtro));

    await asentar();
    http.expectOne((r) => r.url === URL).flush(VACIA);
    await asentar();

    filtro.set({ Texto: 'cat', Numero: 1, Tamano: 50 });
    await asentar();

    const segunda = http.expectOne((r) => r.url === URL);
    expect(segunda.request.params.get('Texto')).toBe('cat');
    segunda.flush(VACIA);
  });

  it('vuelve a pedir cuando cambia el filtro de activas', async () => {
    const filtro = signal<FiltroListado>({ Numero: 1, Tamano: 50 });
    TestBed.runInInjectionContext(() => api.marcas.listado(filtro));

    await asentar();
    http.expectOne((r) => r.url === URL).flush(VACIA);
    await asentar();

    filtro.set({ Activo: false, Numero: 1, Tamano: 50 });
    await asentar();

    const segunda = http.expectOne((r) => r.url === URL);
    // `false` tiene que VIAJAR. Es el filtro de «solo retiradas»; con un `if (valor)` en
    // lugar de la comparación contra undefined, se perdía y la pantalla mostraba todas.
    expect(segunda.request.params.get('Activo')).toBe('false');
    segunda.flush(VACIA);
  });

  it('crear una marca recarga el listado sin que la pantalla lo pida', async () => {
    const filtro = signal<FiltroListado>({ Numero: 1, Tamano: 50 });
    TestBed.runInInjectionContext(() => api.marcas.listado(filtro));

    await asentar();
    http.expectOne((r) => r.url === URL).flush(VACIA);
    await asentar();

    api.marcas.crear({ nombre: 'Komatsu' }).subscribe();
    await asentar();

    http
      .expectOne((r) => r.method === 'POST' && r.url === URL)
      .flush({
        id: 'b',
        nombre: 'Komatsu',
        activo: true,
        modelos: 0,
      });
    await asentar();

    // El `tap` del servicio: nadie pidió esta segunda lectura desde la pantalla.
    http.expectOne((r) => r.method === 'GET' && r.url === URL).flush(VACIA);
  });
});

describe('aParametros', () => {
  it('omite lo que no tiene valor y conserva el false', () => {
    expect(aParametros({ Texto: undefined, Activo: false, Numero: 2 })).toEqual({
      Activo: false,
      Numero: 2,
    });
  });

  it('omite la cadena vacía, que no es un filtro', () => {
    expect(aParametros({ Texto: '', Numero: 1 })).toEqual({ Numero: 1 });
  });
});
