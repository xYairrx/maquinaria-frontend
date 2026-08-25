import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ApiPlataforma } from './api-plataforma';

/**
 * El recurso compartido de empresas.
 *
 * Se prueba porque es la pieza que sostiene dos pantallas y porque `httpResource` está
 * marcado `@experimental` en Angular: si su comportamiento cambia en una versión menor,
 * esto lo dice antes de que se note en producción.
 *
 * Lo que se fija aquí son las tres cosas que se pueden romper en silencio: que sin sesión
 * NO se pida nada, que el `ProblemDetails` del servidor sobreviva hasta la pantalla, y que
 * dar de alta una empresa recargue la lista sin que nadie lo pida.
 */
const LLAVE = 'maquinaria.plataforma.token';
const URL = 'http://localhost:5123/api/plataforma/empresas';
const URL_PLANES = 'http://localhost:5123/api/plataforma/planes';
const URL_MODULOS = 'http://localhost:5123/api/plataforma/modulos';

/**
 * Con sesion, el servicio dispara TRES recursos a la vez: empresas, planes y modulos. Los
 * dos ultimos se despachan aqui para que `verify()` siga significando «no quedo nada
 * inesperado» en lugar de «no quedo nada».
 *
 * Que sean tres peticiones al abrir el panel es deliberado: las tres se comparten entre
 * pantallas y se cachean para el resto de la sesion, asi que el coste es una vez.
 */
function despacharCatalogo(http: HttpTestingController) {
  http.expectOne(URL_PLANES).flush([]);
  http.expectOne(URL_MODULOS).flush([]);
}

/**
 * Deja correr lo pendiente: los recursos lanzan su peticion en una microtarea, asi que
 * `TestBed.tick()` a secas se ejecuta antes de que exista la peticion que comprobar.
 */
async function asentar() {
  TestBed.tick();
  await Promise.resolve();
  TestBed.tick();
}

function crear() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });

  return {
    api: TestBed.inject(ApiPlataforma),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('ApiPlataforma: el recurso de empresas', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('sin sesion NO pide nada', async () => {
    // Es lo que evita que la pantalla de acceso —que inyecta este mismo servicio para
    // iniciar sesion— dispare un GET sin token y se coma un 401 antes de que nadie entre.
    const { api, http } = crear();

    await asentar();

    expect(api.empresas()).toEqual([]);
    expect(api.planes()).toEqual([]);
    expect(api.modulos()).toEqual([]);
    http.expectNone(URL);
    http.expectNone(URL_PLANES);
    http.expectNone(URL_MODULOS);
  });

  it('con sesion pide una vez y entrega la lista', async () => {
    localStorage.setItem(LLAVE, 'token-de-prueba');
    const { api, http } = crear();

    await asentar();

    http.expectOne(URL).flush([{ slug: 'bajio' }]);
    despacharCatalogo(http);
    await asentar();

    expect(api.empresas()).toHaveLength(1);
    expect(api.empresasCargando()).toBe(false);
    expect(api.empresasError()).toBeNull();
    http.verify();
  });

  it('conserva el texto del ProblemDetails que manda el servidor', async () => {
    // El caso que motiva `desenvolver`: si el error llegara en una forma que
    // `mensajeDeError` no reconoce, TODOS los fallos se verian como «Ocurrio un error
    // inesperado» y se perderia el texto que el servidor redacto a proposito.
    localStorage.setItem(LLAVE, 'token-de-prueba');
    const { api, http } = crear();

    await asentar();

    http
      .expectOne(URL)
      .flush(
        { detail: 'No tienes permiso para ver las empresas.' },
        { status: 403, statusText: 'Forbidden' },
      );
    await asentar();

    expect(api.empresasError()).toBe('No tienes permiso para ver las empresas.');
    // GUARDIA DE REGRESION, y no es teorica: leer `recursoEmpresas.value()` con el recurso
    // en error LANZA un `ResourceValueError`. Las dos pantallas leen esta señal dentro de un
    // `effect` sin condicion, asi que exponer `.value` directo hacia fuera hacia que un
    // fallo de la peticion reventara el efecto en vez de pintar el aviso. Esta linea es la
    // que lo caza si alguien "simplifica" el `computed` de `ApiPlataforma`.
    expect(api.empresas()).toEqual([]);
  });

  it('dar de alta una empresa recarga la lista sola', async () => {
    // Sin esto, cada sitio que de de alta una empresa tendria que acordarse de recargar, y
    // el que se olvide deja al dashboard con datos viejos.
    localStorage.setItem(LLAVE, 'token-de-prueba');
    const { api, http } = crear();

    await asentar();
    http.expectOne(URL).flush([]);
    despacharCatalogo(http);
    await asentar();

    api
      .darDeAltaEmpresa({
        slug: 'norte',
        razonSocial: 'Rentas del Norte',
        nombreComercial: null,
        rfc: null,
        telefono: null,
        correoContacto: null,
        correoAdministrador: 'admin@norte.mx',
        nombreAdministrador: 'Admin',
        codigoPlan: 'base',
      })
      .subscribe();

    http.expectOne((r) => r.method === 'POST' && r.url === URL).flush({ slug: 'norte' });
    await asentar();

    // La segunda peticion es la recarga que dispara el `tap` del alta.
    http.expectOne(URL).flush([{ slug: 'norte' }]);
    await asentar();

    expect(api.empresas()).toHaveLength(1);
    http.verify();
  });
});

describe('ApiPlataforma: el catalogo de planes', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    localStorage.setItem(LLAVE, 'token-de-prueba');
  });

  afterEach(() => localStorage.clear());

  /** Despacha los tres recursos y devuelve el servicio listo, con los planes dados. */
  async function conPlanes(http: HttpTestingController, planes: unknown[]) {
    await asentar();
    http.expectOne(URL).flush([]);
    http.expectOne(URL_PLANES).flush(planes);
    http.expectOne(URL_MODULOS).flush([{ clave: 'equipos', numero: 2, orden: 1 }]);
    await asentar();
  }

  it('planesActivos deja fuera los retirados', async () => {
    // Es lo que alimenta el selector del alta de empresa: ofrecer un plan retirado seria
    // ofrecer algo que `AprovisionarEmpresa` va a rechazar.
    const { api, http } = crear();

    await conPlanes(http, [
      { codigo: 'base', activo: true, modulos: [] },
      { codigo: 'viejo', activo: false, modulos: [] },
    ]);

    expect(api.planes()).toHaveLength(2);
    expect(api.planesActivos().map((p) => p.codigo)).toEqual(['base']);
  });

  it('crear un plan recarga el catalogo solo', async () => {
    // Sin esto, la pantalla de planes y el selector del alta se quedarian con datos viejos
    // y cada sitio que cree un plan tendria que acordarse de recargar.
    const { api, http } = crear();

    await conPlanes(http, []);

    api
      .crearPlan({
        codigo: 'profesional',
        nombre: 'Plan profesional',
        descripcion: null,
        precioMensual: 4800,
        moneda: 'MXN',
        orden: 10,
        modulos: ['equipos'],
      })
      .subscribe();

    http.expectOne((r) => r.method === 'POST' && r.url === URL_PLANES).flush({});
    await asentar();

    // La segunda peticion a /planes es la recarga que dispara el `tap`.
    http
      .expectOne(URL_PLANES)
      .flush([{ codigo: 'profesional', activo: true, modulos: ['equipos'] }]);
    await asentar();

    expect(api.planes()).toHaveLength(1);
    http.verify();
  });

  it('retirar un plan recarga el catalogo y va por PATCH', async () => {
    const { api, http } = crear();

    await conPlanes(http, [{ codigo: 'base', activo: true, modulos: [] }]);

    api.cambiarActivoDePlan('base', false).subscribe();

    const patch = http.expectOne(
      (r) => r.method === 'PATCH' && r.url === `${URL_PLANES}/base/activo`,
    );

    expect(patch.request.body).toEqual({ activo: false });
    patch.flush({});
    await asentar();

    http.expectOne(URL_PLANES).flush([{ codigo: 'base', activo: false, modulos: [] }]);
    await asentar();

    expect(api.planesActivos()).toEqual([]);
    http.verify();
  });

  it('sin sesion el catalogo no se pide', async () => {
    localStorage.clear();
    const { api, http } = crear();

    await asentar();

    expect(api.planes()).toEqual([]);
    expect(api.modulos()).toEqual([]);
    http.expectNone(URL_PLANES);
    http.expectNone(URL_MODULOS);
  });
});
