import { describe, expect, it } from 'vitest';

import {
  EstadoAprovisionamiento,
  EstadoTenant,
  type EmpresaEnSalud,
} from '../../../nucleo/api/contratos-plataforma';
import { estadoDeEsquema, migracionLegible } from './esquema';

/**
 * Las dos funciones puras de la pantalla de esquemas.
 *
 * La de los TRES estados es la que importa: es la que decide si el caso peligroso —una base
 * que el binario no puede comparar, típicamente porque va POR DELANTE del código
 * desplegado— se ve o se esconde detrás de un «al día». Se prueba sin navegador y sin HTTP
 * porque no toca ninguno de los dos.
 */
const enSalud = (parcial: Partial<EmpresaEnSalud> = {}): EmpresaEnSalud => ({
  id: 'id',
  slug: 'bajio',
  razonSocial: 'Maquinaria del Bajío SA de CV',
  estado: EstadoTenant.Activo,
  aprovisionamiento: EstadoAprovisionamiento.Lista,
  versionAplicada: '20260824232637_EmpresaCatalogosOrganizacion',
  migracionesPendientes: 0,
  desfasada: false,
  versionReconocida: true,
  ...parcial,
});

describe('estadoDeEsquema', () => {
  it('al día cuando el reporte no la marca desfasada', () => {
    expect(estadoDeEsquema(enSalud())).toBe('al-dia');
  });

  it('desfasada cuando el reporte la marca desfasada', () => {
    // La regla de qué es estar atrasado vive en el backend: aquí solo se lee `desfasada`.
    const atras = enSalud({
      versionAplicada: '20260821205930_EmpresaPermisosModulosCompletos',
      migracionesPendientes: 1,
      desfasada: true,
    });

    expect(estadoDeEsquema(atras)).toBe('desfasada');
  });

  it('sin comparar cuando el binario no reconoce su versión, aunque diga desfasada', () => {
    // ESTE ES EL CASO QUE NO SE PUEDE COLAPSAR. Con la versión sin reconocer, `desfasada` no
    // dice nada útil: la base puede ir POR DELANTE del código desplegado. Leerla como un
    // desfase mandaría a correr migraciones que no existen.
    const adelantada = enSalud({
      versionAplicada: '20270101000000_QueEsteBinarioNoConoce',
      migracionesPendientes: 3,
      desfasada: true,
      versionReconocida: false,
    });

    expect(estadoDeEsquema(adelantada)).toBe('sin-comparar');
  });

  it('sin comparar cuando el binario no reconoce su versión y NO dice desfasada', () => {
    // La otra mitad del mismo caso: sin este `versionReconocida` por delante, un
    // `desfasada: false` la pintaría «al día» y el aviso desaparecería del todo. Es
    // exactamente lo que significa esconder el caso peligroso.
    const adelantada = enSalud({
      versionAplicada: '20270101000000_QueEsteBinarioNoConoce',
      migracionesPendientes: 0,
      desfasada: false,
      versionReconocida: false,
    });

    expect(estadoDeEsquema(adelantada)).toBe('sin-comparar');
  });

  it('una base que nunca se migró tampoco se puede comparar', () => {
    // `versionAplicada` nula llega con `versionReconocida: false`. Que nunca se migró lo
    // dice su propia celda; lo que no se puede es afirmar cuántas migraciones le faltan.
    const nueva = enSalud({
      versionAplicada: null,
      migracionesPendientes: 0,
      desfasada: true,
      versionReconocida: false,
      aprovisionamiento: EstadoAprovisionamiento.Fallida,
    });

    expect(estadoDeEsquema(nueva)).toBe('sin-comparar');
  });
});

describe('migracionLegible', () => {
  it('parte la marca de tiempo del nombre sin perder nada', () => {
    // Reagrupar las catorce cifras es reversible, y por eso no hace falta enseñar el
    // identificador crudo al lado: lo que se ve ES el dato exacto, en dos piezas.
    expect(migracionLegible('20260824232637_EmpresaCatalogosOrganizacion')).toEqual({
      fecha: '2026-08-24 23:26:37',
      nombre: 'EmpresaCatalogosOrganizacion',
    });
  });

  it('conserva los guiones bajos del nombre', () => {
    // El corte es en el PRIMER guion bajo: partir por el último dejaría el nombre a medias.
    expect(migracionLegible('20260821205930_Empresa_Permisos').nombre).toBe('Empresa_Permisos');
  });

  it('un identificador sin marca de tiempo se devuelve entero', () => {
    // No debería pasar, pero renombrar una migración a mano es posible, y partirlo mal
    // enseñaría una fecha inventada — que es lo único que no se puede hacer.
    expect(migracionLegible('InitialCreate')).toEqual({ fecha: null, nombre: 'InitialCreate' });
  });

  it('no toca las cifras: no es una fecha con zona, es un identificador', () => {
    // Pasarlo por el locale lo movería de día en México (UTC-6) y el nombre del archivo de
    // migración dejaría de coincidir con lo que se ve en pantalla.
    expect(migracionLegible('20260101000000_AnioNuevo').fecha).toBe('2026-01-01 00:00:00');
  });
});
