import { describe, expect, it } from 'vitest';

import {
  EstadoAprovisionamiento,
  EstadoTenant,
  type EmpresaEnSalud,
  type ResumenEmpresa,
  type SaludEsquemas,
} from '../../../nucleo/api/contratos-plataforma';
import { MESES_GRAFICA, altasPorMes, resumir } from './resumen';

/**
 * Un instante FIJO. `resumir` recibe el reloj por parámetro justo para esto: con
 * `new Date()` las pruebas de la gráfica cambiarían de resultado según el día en que se
 * corran, que es la clase de prueba que falla un lunes y nadie sabe por qué.
 */
const AHORA = new Date('2026-08-25T12:00:00Z');

/** La migración del binario que responde. Es la referencia, y no sale de la lista. */
const DISPONIBLE = '20260824232637_EmpresaCatalogosOrganizacion';

const empresa = (parcial: Partial<ResumenEmpresa> = {}): ResumenEmpresa => ({
  // El id sale del slug, y ahora importa: el reporte de esquemas se cruza POR ID.
  id: parcial.slug ?? 'bajio',
  slug: 'bajio',
  razonSocial: 'Maquinaria del Bajío SA de CV',
  rfc: null,
  estado: EstadoTenant.Activo,
  aprovisionamiento: EstadoAprovisionamiento.Lista,
  versionEsquema: '20260824232637_EmpresaCatalogosOrganizacion',
  codigoPlan: 'base',
  modulos: 26,
  creadoEn: '2026-08-01T10:00:00Z',
  // No lo lee ninguna de estas pruebas: el resumen no mira la invitacion. Esta para que el
  // tipo cuadre, y el dia que el dashboard avise de invitaciones sin enviar, se pasa por
  // `parcial`.
  invitacionEnviada: true,
  ...parcial,
});

/**
 * SE BORRÓ `describe('esquemaReferencia')`, con sus tres casos, y no por estorbar.
 *
 * Esa función deducía la referencia de desfase tomando la migración más avanzada DE LA
 * LISTA, y tenía un fallo que sus pruebas no podían ver porque describían exactamente ese
 * comportamiento: **si todas las empresas van una migración atrás, la más avanzada es una de
 * ellas y no hay desfase que reportar**. Es el estado en el que suele estar el sistema. La
 * referencia de verdad —la migración del binario que responde— la manda ahora
 * `GET /salud/esquemas`, así que la función se fue con sus pruebas. El caso que probaban de
 * verdad, que una base en curso no cuente, ya no aplica: el reporte no lo deduce, lo dice.
 *
 * Lo que ocupa su sitio es «con TODAS una migración atrás las avisa a todas», más abajo, que
 * es el caso que la deducción no podía ver.
 */

/** Una empresa del reporte de esquemas. Al día por omisión. */
const enSalud = (parcial: Partial<EmpresaEnSalud> = {}): EmpresaEnSalud => ({
  id: parcial.slug ?? parcial.id ?? 'bajio',
  slug: 'bajio',
  razonSocial: 'Maquinaria del Bajío SA de CV',
  estado: EstadoTenant.Activo,
  aprovisionamiento: EstadoAprovisionamiento.Lista,
  versionAplicada: DISPONIBLE,
  migracionesPendientes: 0,
  desfasada: false,
  versionReconocida: true,
  ...parcial,
});

/** El reporte. `desfasadas` lo manda el backend, así que aquí se pasa tal cual. */
const reporte = (
  empresas: readonly EmpresaEnSalud[],
  parcial: Partial<SaludEsquemas> = {},
): SaludEsquemas => ({
  versionDisponible: DISPONIBLE,
  totalEmpresas: empresas.length,
  desfasadas: empresas.filter((e) => e.desfasada).length,
  empresas,
  ...parcial,
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
    expect(r.versionDisponible).toBeNull();
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

  it('avisa la base que el REPORTE marca desfasada', () => {
    // Antes este caso se deducía comparando versiones aquí. Ahora la marca el backend y
    // este lado solo la pinta: `versionEsquema` de la lista ni se mira.
    const r = resumir(
      [empresa({ slug: 'demo' }), empresa({ slug: 'norte' })],
      AHORA,
      reporte([
        enSalud({ slug: 'demo', desfasada: true, migracionesPendientes: 1 }),
        enSalud({ slug: 'norte' }),
      ]),
    );

    expect(r.atencion).toHaveLength(1);
    expect(r.atencion[0].motivo).toBe('esquema-desfasado');
    expect(r.atencion[0].empresa.slug).toBe('demo');
  });

  it('con TODAS las bases una migración atrás las avisa a todas', () => {
    // ES EL FALLO QUE MOTIVÓ EL ENDPOINT, y el estado real del sistema el 2026-08-25: con
    // la referencia deducida de la lista, la más avanzada era una de las atrasadas y el
    // panel reportaba cero desfase. Con la del binario, las dos salen.
    const r = resumir(
      [empresa({ slug: 'demo' }), empresa({ slug: 'bajio' })],
      AHORA,
      reporte([
        enSalud({ slug: 'demo', desfasada: true, migracionesPendientes: 1 }),
        enSalud({ slug: 'bajio', desfasada: true, migracionesPendientes: 1 }),
      ]),
    );

    expect(r.atencion.map((a) => a.motivo)).toEqual(['esquema-desfasado', 'esquema-desfasado']);
  });

  it('una versión que no se pudo comparar es su propio aviso, no un desfase', () => {
    // El caso peligroso: la base va POR DELANTE del código desplegado. Con `desfasada` en
    // false, colapsarlo a dos estados lo dejaría sin aviso ninguno.
    const r = resumir(
      [empresa({ slug: 'adelantada' })],
      AHORA,
      reporte([
        enSalud({
          slug: 'adelantada',
          versionAplicada: '20270101000000_QueEsteBinarioNoConoce',
          versionReconocida: false,
          desfasada: false,
        }),
      ]),
    );

    expect(r.atencion.map((a) => a.motivo)).toEqual(['esquema-sin-comparar']);
  });

  it('con todas al día no hay aviso de esquema', () => {
    const r = resumir(
      [empresa({ slug: 'a' }), empresa({ slug: 'b' })],
      AHORA,
      reporte([enSalud({ slug: 'a' }), enSalud({ slug: 'b' })]),
    );

    expect(r.atencion).toEqual([]);
  });

  it('sin reporte no se afirma nada del esquema', () => {
    // Callarse es lo correcto: sin la referencia del binario este lado no tiene con qué
    // comparar, y deducirla de la lista es justo lo que mentía.
    const r = resumir([empresa({ slug: 'a' }), empresa({ slug: 'b' })], AHORA);

    expect(r.atencion).toEqual([]);
    expect(r.versionDisponible).toBeNull();
  });

  it('una empresa que no viene en el reporte no genera aviso de esquema', () => {
    // Se acaba de dar de alta y el reporte es de antes. Inventarle un estado sería peor.
    const r = resumir([empresa({ slug: 'nueva' })], AHORA, reporte([]));

    expect(r.atencion).toEqual([]);
  });

  it('la versión disponible sale del reporte, no de las empresas', () => {
    const r = resumir([empresa({ slug: 'a' })], AHORA, reporte([enSalud({ slug: 'a' })]));

    expect(r.versionDisponible).toBe(DISPONIBLE);
  });

  it('una empresa con dos problemas sale dos veces, y lo grave primero', () => {
    // Cada motivo es una acción distinta, así que se cuentan aparte a propósito.
    const r = resumir(
      [
        empresa({ slug: 'norte' }),
        empresa({ slug: 'demo', codigoPlan: null }),
        empresa({ slug: 'roto', aprovisionamiento: EstadoAprovisionamiento.Fallida }),
      ],
      AHORA,
      reporte([
        enSalud({ slug: 'norte' }),
        enSalud({ slug: 'demo', desfasada: true, migracionesPendientes: 2 }),
      ]),
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
