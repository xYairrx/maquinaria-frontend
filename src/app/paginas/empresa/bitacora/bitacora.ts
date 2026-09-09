import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiSeguridad } from '../../../nucleo/api/api-seguridad';
import type {
  AccionAuditoria,
  Auditoria,
  FiltroBitacora,
  ResultadoAuditoria,
} from '../../../nucleo/api/contratos';
import { nombreModulo, t } from '../../../nucleo/i18n/i18n';
import { BitacoraEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Las once acciones, en el orden del enum del backend. */
const ACCIONES: readonly AccionAuditoria[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * La bitácora: quién hizo qué, cuándo y desde dónde.
 *
 * **SOLO LECTURA, y el motor lo respalda**: la tabla es *append-only* con trigger. No hay
 * columna de acciones, no hay editar, no hay borrar. Es la segunda pantalla del producto sin
 * ninguna acción de fila —la primera fue Movimientos— y por la misma razón.
 *
 * **EL DETALLE ES UN PANEL, no una columna.** Los dos `jsonb` de una fila pueden ser cuarenta
 * campos; meterlos en la tabla la volvería ilegible, y truncarlos escondería justo lo que
 * alguien vino a leer. La fila muestra qué pasó y el panel muestra qué cambió.
 *
 * **DOS COSAS QUE LA PANTALLA TIENE QUE EXPLICAR, porque el dato no se explica solo:**
 *
 * - Una fila **sin módulo** puede ser de sesión —no pertenece a ninguno— o anterior al
 *   2026-09-02, cuando la columna no existía. Las viejas no se rellenaron: la tabla es
 *   append-only y ni una migración la reescribe.
 * - El rol `administrador` en la columna de roles significa que la acción **pasó por el bypass
 *   de acceso total**, no por un permiso concedido. Es justo lo que se audita.
 */
@Component({
  selector: 'app-bitacora',
  imports: [BarraHerramientas, BitacoraEsqueleto, PanelLateral],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bitacora.html',
})
export class Bitacora {
  private readonly api = inject(ApiSeguridad);
  private readonly barra = inject(Barra);

  protected readonly t = t;
  protected readonly acciones = ACCIONES;
  protected readonly nombreModulo = nombreModulo;

  /** Solo los módulos que DE VERDAD tienen registros. Ver `ApiSeguridad`. */
  protected readonly modulos = this.api.modulosDeBitacora();

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly moduloFiltrado = signal('');
  protected readonly accionFiltrada = signal<AccionAuditoria | undefined>(undefined);
  protected readonly resultadoFiltrado = signal<ResultadoAuditoria | undefined>(undefined);
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroBitacora>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Modulo: this.moduloFiltrado() || undefined,
    Accion: this.accionFiltrada(),
    Resultado: this.resultadoFiltrado(),
    // El día se manda completo: `desde` a las 00:00 y `hasta` a las 23:59:59. Sin la
    // segunda mitad, filtrar «hasta hoy» dejaría fuera todo lo de hoy.
    Desde: this.desde() ? `${this.desde()}T00:00:00Z` : undefined,
    Hasta: this.hasta() ? `${this.hasta()}T23:59:59Z` : undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
  }));

  private readonly listado = this.api.listadoBitacora(this.filtro);

  protected readonly filas = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.filas().length === 0,
  );

  protected readonly recargando = this.listado.cargando;
  protected readonly error = this.listado.error;

  /** La fila abierta en el panel de detalle. */
  protected readonly detalle = signal<Auditoria | null>(null);

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().bitacora.sinResultados(texto);
    }

    if (this.hayFiltros()) {
      return t().bitacora.sinDeFiltro;
    }

    return t().bitacora.sinFilas;
  });

  protected readonly hayFiltros = computed(
    () =>
      this.moduloFiltrado() !== '' ||
      this.accionFiltrada() !== undefined ||
      this.resultadoFiltrado() !== undefined ||
      this.desde() !== '' ||
      this.hasta() !== '',
  );

  protected readonly desdeFila = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hastaFila = computed(() =>
    Math.min(this.pagina() * TAMANO_PAGINA, this.total()),
  );

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().bitacora.titulo,
        contexto: t().bitacora.contexto(this.total()),
        busqueda: null,
        // SIN ACCIÓN PRIMARIA: no hay nada que crear. Es lo que la regla de la barra pide —
        // declarar ninguna en lugar de inventar un botón.
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.moduloFiltrado();
      this.accionFiltrada();
      this.resultadoFiltrado();
      this.desde();
      this.hasta();
      this.pagina.set(1);
    });
  }

  protected nombreAccion(accion: AccionAuditoria): string {
    return t().bitacora.acciones[accion] ?? String(accion);
  }

  protected filtrarPorModulo(clave: string): void {
    this.moduloFiltrado.set(clave);
  }

  protected filtrarPorAccion(valor: string): void {
    this.accionFiltrada.set(valor === '' ? undefined : (Number(valor) as AccionAuditoria));
  }

  protected filtrarPorResultado(valor: string): void {
    this.resultadoFiltrado.set(valor === '' ? undefined : (Number(valor) as ResultadoAuditoria));
  }

  protected cambiarDesde(valor: string): void {
    this.desde.set(valor);
  }

  protected cambiarHasta(valor: string): void {
    this.hasta.set(valor);
  }

  protected limpiarFiltros(): void {
    this.moduloFiltrado.set('');
    this.accionFiltrada.set(undefined);
    this.resultadoFiltrado.set(undefined);
    this.desde.set('');
    this.hasta.set('');
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected abrirDetalle(fila: Auditoria): void {
    this.detalle.set(fila);
  }

  protected cerrarDetalle(): void {
    this.detalle.set(null);
  }

  /**
   * El jsonb, formateado para leerlo.
   *
   * **Si no parsea se devuelve tal cual**, en lugar de mostrar un error: el contenido viene
   * de la base y siempre es json válido, pero una fila corrupta o un formato futuro no deben
   * dejar la pantalla en blanco. Mostrar el texto crudo siempre dice algo.
   */
  protected formatear(json: string | null): string {
    if (json === null) {
      return '';
    }

    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  }
}
