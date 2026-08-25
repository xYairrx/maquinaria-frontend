import {
  EstadoAprovisionamiento,
  EstadoTenant,
  type ResumenEmpresa,
} from '../../../nucleo/api/contratos-plataforma';

/**
 * Lo que el panel de superadministración puede decir a partir de `GET /empresas`.
 *
 * TODO SALE DE ESA LISTA, sin endpoint nuevo y sin un solo número inventado. Es la regla
 * del sistema de diseño y aquí pesa más que en ninguna otra pantalla: un dashboard es
 * exactamente el sitio donde una cifra de ejemplo se confunde con una real, porque el
 * formato es el mismo y nadie va a comprobarla.
 *
 * Por eso NO hay altas por mes, ni ingresos, ni usuarios activos, ni retención: la API no
 * los da y calcularlos aquí sería inventarlos. Lo que sí hay son las tres cosas que la
 * lista permite deducir y que un superadministrador tiene que ver de inmediato.
 *
 * Es una función pura, con la lista por parámetro, para poder probarla sin navegador.
 */

/** Por qué una empresa aparece en la lista de avisos. */
export type MotivoAtencion = 'fallida' | 'sin-suscripcion' | 'esquema-desfasado';

export interface Atencion {
  readonly empresa: ResumenEmpresa;
  readonly motivo: MotivoAtencion;
}

/** Una barra de la gráfica: un mes y cuántas altas hubo. */
export interface AltasDelMes {
  /** El primer día del mes, en ISO. La plantilla lo formatea con el locale activo. */
  readonly inicio: string;
  readonly total: number;
}

export interface ResumenPlataforma {
  readonly total: number;
  readonly activas: number;
  readonly enPrueba: number;
  /** `Pendiente` o `Creando`: el alta todavía está en curso. */
  readonly enProceso: number;
  /** La migración más avanzada que se ha visto, o `null` si ninguna base está lista. */
  readonly esquemaReferencia: string | null;
  /** Lo que hay que atender, lo más grave primero. Una empresa puede salir dos veces. */
  readonly atencion: readonly Atencion[];
  /** Las últimas altas, de la más reciente a la más vieja. */
  readonly recientes: readonly ResumenEmpresa[];
  /** Los últimos meses, del más viejo al más nuevo. Siempre `MESES_GRAFICA` entradas. */
  readonly altasPorMes: readonly AltasDelMes[];
}

/** Cuántas altas recientes se enseñan. Caben en una tarjeta sin hacer scroll. */
const RECIENTES = 5;

/** Lo más grave primero: un alta fallida bloquea a un cliente entero. */
const GRAVEDAD: Readonly<Record<MotivoAtencion, number>> = {
  fallida: 0,
  'esquema-desfasado': 1,
  'sin-suscripcion': 2,
};

/**
 * La migración más avanzada entre las bases que YA están listas.
 *
 * Se compara como cadena, y eso es correcto porque un identificador de migración de EF
 * empieza por su marca de tiempo (`20260824232637_EmpresaCatalogos...`): el orden
 * lexicográfico y el cronológico coinciden. Si alguna vez se renombraran las migraciones
 * sin ese prefijo, esta comparación deja de valer.
 *
 * Solo cuentan las `Lista`: una empresa cuyo alta está en curso todavía no tiene esquema,
 * y tomarla como referencia dejaría a todas las demás «desfasadas».
 */
export function esquemaReferencia(empresas: readonly ResumenEmpresa[]): string | null {
  let mayor: string | null = null;

  for (const e of empresas) {
    if (e.aprovisionamiento !== EstadoAprovisionamiento.Lista || e.versionEsquema === null) {
      continue;
    }

    if (mayor === null || e.versionEsquema > mayor) {
      mayor = e.versionEsquema;
    }
  }

  return mayor;
}

/** Cuántos meses enseña la gráfica. Seis caben sin apretar en un teléfono. */
export const MESES_GRAFICA = 6;

/**
 * Altas por mes, incluidos los meses en cero.
 *
 * Los huecos SE RELLENAN a propósito: una gráfica que solo pinta los meses con altas
 * miente sobre el ritmo, porque dos barras seguidas pueden estar a medio año de
 * distancia. Con los ceros dentro, el eje es tiempo de verdad.
 *
 * `ahora` entra por parámetro y no se lee del reloj aquí para que la función sea pura y
 * la prueba no dependa del día en que se corra.
 */
export function altasPorMes(
  empresas: readonly ResumenEmpresa[],
  ahora: Date,
): readonly AltasDelMes[] {
  const meses: AltasDelMes[] = [];

  for (let atras = MESES_GRAFICA - 1; atras >= 0; atras--) {
    // Día 1 y en UTC, igual que `creadoEn`: construir el mes en hora local desplazaría
    // el corte y un alta del día 1 caería en el mes anterior.
    const inicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - atras, 1));
    const siguiente = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1));

    const desde = inicio.toISOString();
    const hasta = siguiente.toISOString();

    meses.push({
      inicio: desde,
      // Comparación de cadenas ISO: son de longitud fija y del mismo formato, así que el
      // orden lexicográfico es el cronológico. Evita convertir cada fecha a Date.
      total: empresas.filter((e) => e.creadoEn >= desde && e.creadoEn < hasta).length,
    });
  }

  return meses;
}

export function resumir(empresas: readonly ResumenEmpresa[], ahora: Date): ResumenPlataforma {
  const referencia = esquemaReferencia(empresas);
  const atencion: Atencion[] = [];

  for (const empresa of empresas) {
    if (empresa.aprovisionamiento === EstadoAprovisionamiento.Fallida) {
      atencion.push({ empresa, motivo: 'fallida' });
    }

    // Una empresa cancelada sin plan no es un problema: es lo esperado. Y a una cuyo
    // alta va en curso todavía no se le ha podido asignar nada.
    if (
      empresa.codigoPlan === null &&
      empresa.estado !== EstadoTenant.Cancelado &&
      empresa.aprovisionamiento === EstadoAprovisionamiento.Lista
    ) {
      atencion.push({ empresa, motivo: 'sin-suscripcion' });
    }

    // El desfase solo tiene sentido contra una referencia y entre bases ya creadas.
    if (
      referencia !== null &&
      empresa.aprovisionamiento === EstadoAprovisionamiento.Lista &&
      empresa.versionEsquema !== null &&
      empresa.versionEsquema < referencia
    ) {
      atencion.push({ empresa, motivo: 'esquema-desfasado' });
    }
  }

  return {
    total: empresas.length,
    activas: empresas.filter((e) => e.estado === EstadoTenant.Activo).length,
    enPrueba: empresas.filter((e) => e.estado === EstadoTenant.Prueba).length,
    enProceso: empresas.filter(
      (e) =>
        e.aprovisionamiento === EstadoAprovisionamiento.Pendiente ||
        e.aprovisionamiento === EstadoAprovisionamiento.Creando,
    ).length,
    esquemaReferencia: referencia,
    atencion: atencion.sort((a, b) => GRAVEDAD[a.motivo] - GRAVEDAD[b.motivo]),
    // `slice` antes de ordenar: `sort` muta, y la lista que llega es la del servicio.
    recientes: [...empresas]
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
      .slice(0, RECIENTES),
    altasPorMes: altasPorMes(empresas, ahora),
  };
}
