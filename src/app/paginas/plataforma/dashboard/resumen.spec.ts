import { describe, expect, it } from 'vitest';

import {
  EstadoAprovisionamiento,
  EstadoTenant,
  type ResumenEmpresa,
} from '../../../nucleo/api/contratos-plataforma';
import { MESES_GRAFICA, altasPorMes, esquemaReferencia, resumir } from './resumen';

/**
 * Un instante FIJO. `resumir` recibe el reloj por parámetro justo para esto: con
 * `new Date()` las pruebas de la gráfica cambiarían de resultado según el día en que se
 * corran, que es la clase de prueba que falla un lunes y nadie sabe por qué.
 */
const AHORA = new Date('2026-08-25T12:00:00Z');

const empresa = (parcial: Partial<ResumenEmpresa> = {}): ResumenEmpresa => ({
  id: parcial.slug ?? 'id',
  slug: 'bajio',
  razonSocial: 'Maquinaria del Bajío SA de CV',
  rfc: null,
  estado: EstadoTenant.Activo,
  aprovisionamiento: EstadoAprovisionamiento.Lista,
  versionEsquema: '20260824232637_EmpresaCatalogosOrganizacion',
  codigoPlan: 'base',
  modulos: 26,
  creadoEn: '2026-08-01T10:00:00Z',
  ...parcial,
});

describe('esquemaReferencia', () => {
  it('sin empresas listas no hay referencia', () => {
    const enCurso = empresa({ aprovisionamiento: EstadoAprovisionamiento.Creando });

    expect(esquemaReferencia([enCurso])).toBeNull();
  });

  it('toma la migración más avanzada de las bases listas', () => {
    // El orden lexicográfico es el cronológico porque el identificador empieza por su
    // marca de tiempo. Es la suposición que sostiene toda la detección de desfase.
    const atras = empresa({ slug: 'demo', versionEsquema: '20260821205930_EmpresaPermisos' });
    const alDia = empresa({ slug: 'norte', versionEsquema: '20260824232637_EmpresaCatalogos' });

    expect(esquemaReferencia([atras, alDia])).toBe('20260824232637_EmpresaCatalogos');
  });

  it('una base en curso no puede ser la referencia', () => {
    // Si contara, dejaría a todas las demás marcadas como desfasadas.
    const lista = empresa({ slug: 'norte', versionEsquema: '20260821205930_A' });
    const enCurso = empresa({
      slug: 'nueva',
      aprovisionamiento: EstadoAprovisionamiento.Creando,
      versionEsquema: '20269999999999_Z',
    });

    expect(esquemaReferencia([lista, enCurso])).toBe('20260821205930_A');
  });
});

describe('resumir: conteos', () => {
  it('cuenta por estado y por alta en curso', () => {
    const r = resumir(
      [
        empresa({ slug: 'a', estado: EstadoTenant.Activo }),
        empresa({ slug: 'b', estado: EstadoTenant.Activo }),
        empresa({ slug: 'c', estado: EstadoTenant.Prueba }),
        empresa({ slug: 'd', estado: EstadoTenant.Suspendido }),
        empresa({ slug: 'e', aprovisionamiento: EstadoAprovisionamiento.Pendiente }),
        empresa({ slug: 'f', aprovisionamiento: EstadoAprovisionamiento.Creando }),
      ],
      AHORA,
    );

    expect(r.total).toBe(6);
    expect(r.activas).toBe(4);
    expect(r.enPrueba).toBe(1);
    expect(r.enProceso).toBe(2);
  });

  it('sin empresas no revienta', () => {
    const r = resumir([], AHORA);

    expect(r.total).toBe(0);
    expect(r.esquemaReferencia).toBeNull();
    expect(r.atencion).toEqual([]);
    expect(r.recientes).toEqual([]);
  });
});

describe('resumir: avisos', () => {
  it('un alta fallida se avisa', () => {
    const r = resumir([empresa({ aprovisionamiento: EstadoAprovisionamiento.Fallida })], AHORA);

    expect(r.atencion.map((a) => a.motivo)).toEqual(['fallida']);
  });

  it('una empresa lista sin plan se avisa', () => {
    const r = resumir([empresa({ codigoPlan: null })], AHORA);

    expect(r.atencion.map((a) => a.motivo)).toEqual(['sin-suscripcion']);
  });

  it('una cancelada sin plan NO se avisa', () => {
    // No es un problema: es lo esperado de una empresa que se dio de baja.
    const r = resumir([empresa({ codigoPlan: null, estado: EstadoTenant.Cancelado })], AHORA);

    expect(r.atencion).toEqual([]);
  });

  it('una empresa cuyo alta va en curso no se avisa por no tener plan', () => {
    const r = resumir(
      [empresa({ codigoPlan: null, aprovisionamiento: EstadoAprovisionamiento.Creando })],
      AHORA,
    );

    expect(r.atencion).toEqual([]);
  });

  it('detecta la base que va una migración atrás', () => {
    // Es el caso real del 2026-08-25: demo y bajio quedaron atrás de la plantilla.
    const r = resumir(
      [
        empresa({ slug: 'demo', versionEsquema: '20260821205930_EmpresaPermisos' }),
        empresa({ slug: 'norte', versionEsquema: '20260824232637_EmpresaCatalogos' }),
      ],
      AHORA,
    );

    expect(r.atencion).toHaveLength(1);
    expect(r.atencion[0].motivo).toBe('esquema-desfasado');
    expect(r.atencion[0].empresa.slug).toBe('demo');
  });

  it('con todas al día no hay aviso de desfase', () => {
    const r = resumir([empresa({ slug: 'a' }), empresa({ slug: 'b' })], AHORA);

    expect(r.atencion).toEqual([]);
  });

  it('una empresa con dos problemas sale dos veces, y lo grave primero', () => {
    // Cada motivo es una acción distinta, así que se cuentan aparte a propósito.
    const r = resumir(
      [
        empresa({ slug: 'norte', versionEsquema: '20260824232637_Z' }),
        empresa({ slug: 'demo', codigoPlan: null, versionEsquema: '20260821205930_A' }),
        empresa({ slug: 'roto', aprovisionamiento: EstadoAprovisionamiento.Fallida }),
      ],
      AHORA,
    );

    expect(r.atencion.map((a) => a.motivo)).toEqual([
      'fallida',
      'esquema-desfasado',
      'sin-suscripcion',
    ]);
  });
});

describe('resumir: últimas altas', () => {
  it('ordena de la más reciente a la más vieja y corta en cinco', () => {
    const empresas = ['01', '02', '03', '04', '05', '06', '07'].map((d) =>
      empresa({ slug: `e${d}`, creadoEn: `2026-08-${d}T10:00:00Z` }),
    );

    const r = resumir(empresas, AHORA);

    expect(r.recientes).toHaveLength(5);
    expect(r.recientes.map((e) => e.slug)).toEqual(['e07', 'e06', 'e05', 'e04', 'e03']);
  });

  it('no muta la lista que recibe', () => {
    // Llega del servicio, así que ordenarla en el sitio le cambiaría el orden a la
    // pantalla de Empresas si algún día compartieran el arreglo.
    const empresas = [
      empresa({ slug: 'vieja', creadoEn: '2026-01-01T00:00:00Z' }),
      empresa({ slug: 'nueva', creadoEn: '2026-08-01T00:00:00Z' }),
    ];

    resumir(empresas, AHORA);

    expect(empresas.map((e) => e.slug)).toEqual(['vieja', 'nueva']);
  });
});

describe('altasPorMes', () => {
  it('devuelve siempre seis meses, incluidos los vacíos', () => {
    // Una gráfica que solo pinta los meses con altas miente sobre el ritmo: dos barras
    // seguidas pueden estar a medio año de distancia.
    const meses = altasPorMes([], AHORA);

    expect(meses).toHaveLength(MESES_GRAFICA);
    expect(meses.every((m) => m.total === 0)).toBe(true);
  });

  it('va del mes más viejo al más nuevo, y acaba en el mes en curso', () => {
    const meses = altasPorMes([], AHORA);

    expect(meses[0].inicio).toBe('2026-03-01T00:00:00.000Z');
    expect(meses[MESES_GRAFICA - 1].inicio).toBe('2026-08-01T00:00:00.000Z');
  });

  it('cuenta cada alta en su mes', () => {
    const meses = altasPorMes(
      [
        empresa({ slug: 'a', creadoEn: '2026-07-05T10:00:00Z' }),
        empresa({ slug: 'b', creadoEn: '2026-07-28T10:00:00Z' }),
        empresa({ slug: 'c', creadoEn: '2026-08-02T10:00:00Z' }),
      ],
      AHORA,
    );

    expect(meses.map((m) => m.total)).toEqual([0, 0, 0, 0, 2, 1]);
  });

  it('un alta del día 1 cuenta en su mes, no en el anterior', () => {
    // Es el caso que se rompe si el mes se construye en hora local en vez de UTC.
    const meses = altasPorMes([empresa({ creadoEn: '2026-08-01T00:00:00Z' })], AHORA);

    expect(meses[MESES_GRAFICA - 1].total).toBe(1);
    expect(meses[MESES_GRAFICA - 2].total).toBe(0);
  });

  it('lo anterior a la ventana no se cuenta en ningún mes', () => {
    const meses = altasPorMes([empresa({ creadoEn: '2025-01-01T00:00:00Z' })], AHORA);

    expect(meses.reduce((suma, m) => suma + m.total, 0)).toBe(0);
  });
});
