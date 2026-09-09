import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { Barra } from '../../../disposicion/barra';
import { ApiReportes } from '../../../nucleo/api/api-reportes';
import type { FiltroReporte } from '../../../nucleo/api/contratos';
import { t } from '../../../nucleo/i18n/i18n';

/** Las seis categorías. El orden es el de lectura: qué tengo, cuánto se usa, qué produce. */
type Categoria = 'parque' | 'utilizacion' | 'rentas' | 'movimientos' | 'mantenimiento' | 'clientes';

const CATEGORIAS: readonly Categoria[] = [
  'parque',
  'utilizacion',
  'rentas',
  'movimientos',
  'mantenimiento',
  'clientes',
];

/** Las cuatro que exigen periodo. Las otras dos son foto de hoy. */
const CON_PERIODO: readonly Categoria[] = ['utilizacion', 'rentas', 'movimientos', 'mantenimiento'];

/**
 * Los seis reportes del MVP, de solo lectura.
 *
 * **LOS SEIS EN UNA PANTALLA CON PESTAÑAS, no seis rutas.** Comparten el periodo y los filtros;
 * con seis pantallas habría que volver a capturarlo en cada una, o inventar un estado global
 * que las sincronice. La categoría vive en una señal, no en la URL — es una decisión y se puede
 * revisar: pasarla a la ruta haría enlazable «el reporte de utilización de marzo», que es útil
 * y todavía no se pidió.
 *
 * **CUATRO EXIGEN PERIODO Y NO SE PIDEN SIN ÉL.** El recurso devuelve `undefined` como URL
 * mientras falten las fechas, que es como se dice «no pidas todavía»: sin eso, abrir la
 * pantalla en Utilización garantizaría un 400. La pantalla lo explica en lugar de mostrar una
 * tabla vacía.
 *
 * **LOS SEIS RECURSOS SE CREAN AL CONSTRUIR, no al elegir la pestaña**, y ninguno pide hasta
 * que su filtro lo permite: los dos de foto piden al abrir, los cuatro de periodo esperan. Un
 * recurso por pestaña creado bajo demanda exigiría `runInInjectionContext` en un manejador de
 * clic, y volvería a pedir cada vez que alguien cambia de pestaña y vuelve.
 */
@Component({
  selector: 'app-reportes',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reportes.html',
})
export class Reportes {
  private readonly api = inject(ApiReportes);
  private readonly barra = inject(Barra);

  protected readonly t = t;
  protected readonly categorias = CATEGORIAS;

  protected readonly categoria = signal<Categoria>('parque');

  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  /**
   * El filtro que comparten los seis.
   *
   * El día se manda completo: `desde` a las 00:00 y `hasta` a las 23:59:59. Sin la segunda
   * mitad, «hasta hoy» dejaría fuera todo lo de hoy.
   */
  private readonly filtro = computed<FiltroReporte>(() => ({
    Desde: this.desde() ? `${this.desde()}T00:00:00Z` : undefined,
    Hasta: this.hasta() ? `${this.hasta()}T23:59:59Z` : undefined,
  }));

  protected readonly parque = this.api.parque(this.filtro);
  protected readonly utilizacion = this.api.utilizacion(this.filtro);
  protected readonly rentas = this.api.rentas(this.filtro);
  protected readonly movimientos = this.api.movimientos(this.filtro);
  protected readonly mantenimiento = this.api.mantenimiento(this.filtro);
  protected readonly clientes = this.api.clientes(this.filtro);

  /** Si la categoría abierta necesita fechas y todavía no las tiene. */
  protected readonly faltaPeriodo = computed(
    () => CON_PERIODO.includes(this.categoria()) && (this.desde() === '' || this.hasta() === ''),
  );

  protected readonly cargando = computed(() => {
    switch (this.categoria()) {
      case 'parque':
        return this.parque.cargando();
      case 'utilizacion':
        return this.utilizacion.cargando();
      case 'rentas':
        return this.rentas.cargando();
      case 'movimientos':
        return this.movimientos.cargando();
      case 'mantenimiento':
        return this.mantenimiento.cargando();
      case 'clientes':
        return this.clientes.cargando();
    }
  });

  protected readonly error = computed(() => {
    switch (this.categoria()) {
      case 'parque':
        return this.parque.error();
      case 'utilizacion':
        return this.utilizacion.error();
      case 'rentas':
        return this.rentas.error();
      case 'movimientos':
        return this.movimientos.error();
      case 'mantenimiento':
        return this.mantenimiento.error();
      case 'clientes':
        return this.clientes.error();
    }
  });

  /** Cuántas filas tiene la categoría abierta, para el contexto de la barra y el vacío. */
  protected readonly filas = computed(() => {
    switch (this.categoria()) {
      case 'parque':
        return this.parque.filas().length;
      case 'utilizacion':
        return this.utilizacion.filas().length;
      case 'rentas':
        return this.rentas.filas().length;
      case 'movimientos':
        return this.movimientos.filas().length;
      case 'mantenimiento':
        return this.mantenimiento.filas().length;
      case 'clientes':
        return this.clientes.filas().length;
    }
  });

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().reportes.titulo,
        contexto: t().reportes.categorias[this.categoria()],
        busqueda: null,
        accion: null,
      }),
    );
  }

  protected elegir(categoria: Categoria): void {
    this.categoria.set(categoria);
  }

  protected exigePeriodo(categoria: Categoria): boolean {
    return CON_PERIODO.includes(categoria);
  }

  protected cambiarDesde(valor: string): void {
    this.desde.set(valor);
  }

  protected cambiarHasta(valor: string): void {
    this.hasta.set(valor);
  }

  /**
   * El último mes, que es el periodo que casi siempre se quiere.
   *
   * **ES UN ATAJO EXPLÍCITO, no un valor por omisión.** El servidor rechaza un reporte sin
   * periodo justamente para que nadie lea un total sin saber de qué habla; poner estas fechas
   * solo cuando alguien pulsa el botón mantiene esa propiedad y ahorra el trabajo.
   */
  protected ultimoMes(): void {
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);

    this.desde.set(hace30.toISOString().slice(0, 10));
    this.hasta.set(hoy.toISOString().slice(0, 10));
  }

  protected nombreTipoMovimiento(tipo: number): string {
    return t().movimientos.tipos[tipo] ?? String(tipo);
  }

  protected nombreTipoMantenimiento(tipo: number): string {
    return t().mantenimiento.tipos[tipo] ?? String(tipo);
  }

  protected nombreEstadoMantenimiento(estado: number): string {
    return t().mantenimiento.estados[estado] ?? String(estado);
  }

  protected nombreEstadoRenta(estado: number): string {
    return t().reportes.estadosRenta[estado] ?? String(estado);
  }
}
