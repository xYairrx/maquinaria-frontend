import {
  EstadoAprovisionamiento,
  EstadoTenant,
  type ResumenEmpresa,
  type SaludEsquemas,
} from '../../../nucleo/api/contratos-plataforma';
import { estadoDeEsquema } from '../salud-esquemas/esquema';

/**
 * Lo que el panel de superadministración puede decir de las empresas.
 *
 * TODO SALE DE LA API y no hay un solo número inventado. Es la regla del sistema de diseño
 * y aquí pesa más que en ninguna otra pantalla: un dashboard es exactamente el sitio donde
 * una cifra de ejemplo se confunde con una real, porque el formato es el mismo y nadie va a
 * comprobarla.
 *
 * Por eso NO hay ingresos, ni usuarios activos, ni retención: la API no los da y calcularlos
 * aquí sería inventarlos. Lo que sí hay son los conteos y avisos que `GET /empresas`
 * permite deducir y que un superadministrador tiene que ver de inmediato.
 *
 * Es una función pura, con la lista por parámetro, para poder probarla sin navegador.
 *
 * LO DEL ESQUEMA ES LA EXCEPCIÓN, y por eso entra por parámetro: aquí no se puede deducir.
 * Antes se comparaba la versión de cada empresa contra la MÁS AVANZADA DE LA LISTA, y eso
 * daba cero desfase justo cuando todas iban una migración atrás —que es el estado normal
 * del sistema— porque la más avanzada era una de las atrasadas. La referencia de verdad es
 * la del binario que responde, y esa la trae `GET /salud/esquemas`.
 */

/**
 * Por qué una empresa aparece en la lista de avisos.
 *
 * `esquema-sin-comparar` es un motivo aparte y no un `esquema-desfasado` más: el reporte
 * dice que NO SE PUDO comparar, y una base que puede ir por delante del código desplegado
 * pide desplegar, no migrar. Son dos acciones distintas.
 */
export type MotivoAtencion =
  'fallida' | 'sin-suscripcion' | 'esquema-desfasado' | 'esquema-sin-comparar';

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
  /**
   * La migración más avanzada DEL BINARIO, tal como la manda el reporte, o `null` sin
   * reporte. No se deduce de la lista: ver la nota de arriba.
   */
  readonly versionDisponible: string | null;
  /** Lo que hay que atender, lo más grave primero. Una empresa puede salir dos veces. */
  readonly atencion: readonly Atencion[];
  /** Las últimas altas, de la más reciente a la más vieja. */
  readonly recientes: readonly ResumenEmpresa[];
  /** Los últimos meses, del más viejo al más nuevo. Siempre `MESES_GRAFICA` entradas. */
  readonly altasPorMes: readonly AltasDelMes[];
}

/** Cuántas altas recientes se enseñan. Caben en una tarjeta sin hacer scroll. */
const RECIENTES = 5;

/**
 * Lo más grave primero: un alta fallida bloquea a un cliente entero.
 *
 * `esquema-sin-comparar` va por delante de `esquema-desfasado` a propósito: una base
 * desfasada se arregla corriendo el comando de migración, mientras que una que no se puede
 * comparar puede ir POR DELANTE del código desplegado, y eso no se arregla migrando.
 */
const GRAVEDAD: Readonly<Record<MotivoAtencion, number>> = {
  fallida: 0,
  'esquema-sin-comparar': 1,
  'esquema-desfasado': 2,
  'sin-suscripcion': 3,
};

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

/**
 * `salud` es OPCIONAL, y sin ella no se dice nada del esquema de nadie.
 *
 * Es lo correcto y no una comodidad: sin reporte este lado no tiene con qué comparar, y
 * callarse es mejor que deducir una referencia falsa. Antes de que existiera el endpoint el
 * dashboard afirmaba «cero desfasadas» con todas las bases atrasadas.
 */
export function resumir(
  empresas: readonly ResumenEmpresa[],
  ahora: Date,
  salud: SaludEsquemas | null = null,
): ResumenPlataforma {
  // Por id y no por slug: el id es la llave del reporte y el slug se puede reusar.
  const esquemas = new Map((salud?.empresas ?? []).map((e) => [e.id, e]));
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

    // El estado del esquema NO se calcula aquí: lo dice el reporte, empresa por empresa, y
    // `estadoDeEsquema` solo elige cuál de los tres es. Una empresa que no venga en el
    // reporte no genera aviso: se acaba de dar de alta y el reporte es de hace un momento.
    const enReporte = esquemas.get(empresa.id);

    if (enReporte !== undefined) {
      switch (estadoDeEsquema(enReporte)) {
        case 'desfasada':
          atencion.push({ empresa, motivo: 'esquema-desfasado' });
          break;
        case 'sin-comparar':
          atencion.push({ empresa, motivo: 'esquema-sin-comparar' });
          break;
        case 'al-dia':
          break;
      }
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
    versionDisponible: salud?.versionDisponible ?? null,
    atencion: atencion.sort((a, b) => GRAVEDAD[a.motivo] - GRAVEDAD[b.motivo]),
    // `slice` antes de ordenar: `sort` muta, y la lista que llega es la del servicio.
    recientes: [...empresas]
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
      .slice(0, RECIENTES),
    altasPorMes: altasPorMes(empresas, ahora),
  };
}
