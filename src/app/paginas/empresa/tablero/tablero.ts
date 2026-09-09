import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Barra } from '../../../disposicion/barra';
import { ApiReportes } from '../../../nucleo/api/api-reportes';
import { idioma, t } from '../../../nucleo/i18n/i18n';
import { TableroEsqueleto } from './esqueleto';

/** Un indicador dibujado. La ruta es lo que lo vuelve clicable. */
interface Indicador {
  readonly clave: string;
  readonly etiqueta: string;
  readonly cifra: number | string;
  readonly pie: string;
  readonly ruta?: string;
  readonly destacada?: boolean;
}

/**
 * El tablero de la empresa: los cinco bloques de la §16 del documento.
 *
 * **CADA CIFRA ES UN ENLACE al listado ya filtrado**, que es lo que el documento pide y lo que
 * separa un tablero de un adorno: un número que no se puede abrir es un número que nadie puede
 * verificar. Los que no tienen pantalla a la que llevar —el costo del mes— van sin enlace, y se
 * ve porque no cambian al pasar el ratón.
 *
 * **UNA SOLA PETICIÓN.** Los cinco bloques vienen juntos del servidor; cinco llamadas darían
 * cinco esqueletos parpadeando en distinto momento en la pantalla que más se abre.
 *
 * **LA CIFRA DESTACADA ES LA QUE DUELE**: rentas vencidas. Es la única del tablero que
 * representa un problema y no una situación —hay máquina en la calle sin renta que la
 * respalde—, así que va en la variante invertida y al final de su bloque. Si vale cero, deja de
 * destacarse: destacar un cero enseña a ignorar el destacado.
 */
@Component({
  selector: 'app-tablero',
  imports: [RouterLink, TableroEsqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tablero.html',
})
export class Tablero {
  private readonly api = inject(ApiReportes);
  private readonly barra = inject(Barra);

  protected readonly t = t;

  private readonly vivo = this.api.tablero();

  protected readonly datos = this.vivo.datos;
  protected readonly cargando = this.vivo.cargando;
  protected readonly error = this.vivo.error;

  protected readonly parque = computed<readonly Indicador[]>(() => {
    const d = this.datos()?.parque;
    const x = t().tablero;

    if (d === undefined) {
      return [];
    }

    return [
      {
        clave: 'total',
        etiqueta: x.parqueTotal,
        cifra: d.total,
        pie: x.parqueTotalPie,
        ruta: '/equipos',
      },
      {
        clave: 'disponibles',
        etiqueta: x.disponibles,
        cifra: d.disponibles,
        pie: x.disponiblesPie,
        ruta: '/equipos',
      },
      {
        clave: 'rentados',
        etiqueta: x.rentados,
        cifra: d.rentados,
        pie: x.rentadosPie,
        ruta: '/equipos',
      },
      {
        clave: 'taller',
        etiqueta: x.enMantenimiento,
        cifra: d.enMantenimiento,
        pie: x.enMantenimientoPie,
        ruta: '/mantenimiento',
      },
      {
        clave: 'fuera',
        etiqueta: x.fueraDeServicio,
        cifra: d.fueraDeServicio,
        pie: x.fueraDeServicioPie,
        ruta: '/equipos',
      },
      {
        // EL INDICADOR INCÓMODO, y por eso está: son las máquinas que se dieron de alta
        // antes de llegar y nadie colocó. No aparecen en ningún otro número del tablero.
        clave: 'sin-ubicacion',
        etiqueta: x.sinUbicacion,
        cifra: d.sinUbicacion,
        pie: x.sinUbicacionPie,
        ruta: '/movimientos',
        destacada: d.sinUbicacion > 0,
      },
    ];
  });

  protected readonly operacion = computed<readonly Indicador[]>(() => {
    const d = this.datos();
    const x = t().tablero;

    if (d === undefined) {
      return [];
    }

    return [
      {
        clave: 'rentas-vigentes',
        etiqueta: x.rentasVigentes,
        cifra: d.rentas.vigentes,
        pie: x.rentasVigentesPie,
        ruta: '/rentas',
      },
      {
        clave: 'por-entregar',
        etiqueta: x.porEntregar,
        cifra: d.rentas.porEntregar,
        pie: x.porEntregarPie,
        ruta: '/rentas',
      },
      {
        clave: 'por-vencer',
        etiqueta: x.porVencer,
        cifra: d.rentas.porVencer,
        pie: x.porVencerPie,
        ruta: '/rentas',
      },
      {
        clave: 'vencidas',
        etiqueta: x.vencidas,
        cifra: d.rentas.vencidas,
        pie: x.vencidasPie,
        ruta: '/rentas',
        // Cero no se destaca: destacar un cero enseña a ignorar el destacado.
        destacada: d.rentas.vencidas > 0,
      },
    ];
  });

  protected readonly comercial = computed<readonly Indicador[]>(() => {
    const d = this.datos();
    const x = t().tablero;

    if (d === undefined) {
      return [];
    }

    return [
      {
        clave: 'cotizaciones',
        etiqueta: x.cotizacionesAbiertas,
        cifra: d.cotizaciones.abiertas,
        pie: x.cotizacionesAbiertasPie,
        ruta: '/cotizaciones',
      },
      {
        clave: 'cotizaciones-vencer',
        etiqueta: x.cotizacionesPorVencer,
        cifra: d.cotizaciones.porVencer,
        pie: x.cotizacionesPorVencerPie,
        ruta: '/cotizaciones',
      },
      {
        clave: 'aceptadas',
        etiqueta: x.aceptadasSinRenta,
        cifra: d.cotizaciones.aceptadasSinRenta,
        pie: x.aceptadasSinRentaPie,
        ruta: '/cotizaciones',
        destacada: d.cotizaciones.aceptadasSinRenta > 0,
      },
    ];
  });

  protected readonly taller = computed<readonly Indicador[]>(() => {
    const d = this.datos();
    const x = t().tablero;

    if (d === undefined) {
      return [];
    }

    return [
      {
        clave: 'abiertos',
        etiqueta: x.trabajosAbiertos,
        cifra: d.mantenimiento.abiertos,
        pie: x.trabajosAbiertosPie,
        ruta: '/mantenimiento',
      },
      {
        clave: 'en-proceso',
        etiqueta: x.trabajosEnProceso,
        cifra: d.mantenimiento.enProceso,
        pie: x.trabajosEnProcesoPie,
        ruta: '/mantenimiento',
      },
      {
        clave: 'finalizados',
        etiqueta: x.finalizadosDelMes,
        cifra: d.mantenimiento.finalizadosDelMes,
        pie: x.finalizadosDelMesPie,
        ruta: '/mantenimiento',
      },
      {
        // SIN ENLACE: no hay pantalla que muestre «el costo del mes» filtrado, y mandar a
        // Mantenimiento sin ese filtro llevaría a una lista que no explica la cifra.
        clave: 'costo',
        etiqueta: x.costoDelMes,
        cifra: this.moneda(d.mantenimiento.costoDelMes),
        pie: x.costoDelMesPie,
      },
    ];
  });

  protected readonly movimientos = computed<readonly Indicador[]>(() => {
    const d = this.datos();
    const x = t().tablero;

    if (d === undefined) {
      return [];
    }

    return [
      {
        clave: 'hoy',
        etiqueta: x.movimientosHoy,
        cifra: d.movimientos.hoy,
        pie: x.movimientosHoyPie,
        ruta: '/movimientos',
      },
      {
        clave: 'semana',
        etiqueta: x.movimientosSemana,
        cifra: d.movimientos.sieteDias,
        pie: x.movimientosSemanaPie,
        ruta: '/movimientos',
      },
    ];
  });

  /**
   * Los cinco bloques en el orden en que se leen: primero el parque —lo que se tiene—,
   * despues lo que esta pasando con el, y al final lo que se movio.
   *
   * SE ARMA AQUI y no en la plantilla porque es DATOS: cinco secciones copiadas en el
   * marcado se separan a la tercera, y ya paso en el tablero de plataforma.
   */
  protected readonly bloques = computed(() => {
    const x = t().tablero;

    return [
      {
        clave: 'parque',
        titulo: x.bloqueParque,
        apoyo: x.bloqueParqueApoyo,
        indicadores: this.parque(),
      },
      {
        clave: 'operacion',
        titulo: x.bloqueRentas,
        apoyo: x.bloqueRentasApoyo,
        indicadores: this.operacion(),
      },
      {
        clave: 'comercial',
        titulo: x.bloqueCotizaciones,
        apoyo: x.bloqueCotizacionesApoyo,
        indicadores: this.comercial(),
      },
      {
        clave: 'taller',
        titulo: x.bloqueTaller,
        apoyo: x.bloqueTallerApoyo,
        indicadores: this.taller(),
      },
      {
        clave: 'movimientos',
        titulo: x.bloqueMovimientos,
        apoyo: x.bloqueMovimientosApoyo,
        indicadores: this.movimientos(),
      },
    ];
  });

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().tablero.titulo,
        contexto: t().tablero.contexto,
        busqueda: null,
        // La acción recarga en lugar de navegar: es una foto, y lo que se quiere de ella es
        // que esté al día.
        accion: { etiqueta: t().tablero.actualizar, alPulsar: () => this.vivo.recargar() },
      }),
    );
  }

  /**
   * El importe con separadores y sin decimales.
   *
   * `Intl` con la señal `idioma()` y no un `| currency`: el pipe de Angular resuelve su
   * `LOCALE_ID` al construir el inyector y **no cambia en vivo** —está anotado en `i18n.ts`—,
   * así que tras cambiar de idioma seguiría formateando con el anterior. Leyendo la señal,
   * este método se recalcula con el resto de la pantalla.
   */
  private moneda(valor: number): string {
    return new Intl.NumberFormat(idioma(), {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(valor);
  }
}
