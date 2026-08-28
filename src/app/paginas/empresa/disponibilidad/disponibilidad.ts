import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiDisponibilidad } from '../../../nucleo/api/api-disponibilidad';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type {
  EquipoDisponible,
  FiltroDisponibilidad,
  MotivoOcupacion,
  Ocupacion,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo } from '../../../nucleo/formularios/error-campo';
import { t } from '../../../nucleo/i18n/i18n';

/**
 * Los TRES motivos que se capturan a mano.
 *
 * Renta, Reserva y Traslado los pone un Proceso, porque salen de un documento: una renta
 * confirmada, una reserva interna, un traspaso con fecha de llegada. Ofrecerlos aquí dejaría el
 * calendario diciendo que hay una renta donde no hay ninguna.
 */
const MOTIVOS_MANUALES: readonly MotivoOcupacion[] = [3, 4, 6];

/**
 * Disponibilidad: qué máquinas están libres entre dos fechas.
 *
 * **NO ES UN LISTADO, ES UNA PREGUNTA.** Y por eso no tiene el molde de las otras diez: no hay
 * barra de herramientas con búsqueda, hay un formulario de periodo. El servidor **rechaza la
 * consulta sin fechas con un 400** —«qué hay disponible» sin periodo no es algo que el
 * calendario pueda contestar— así que la pantalla no pide nada hasta tenerlas.
 *
 * De cada equipo libre se puede abrir su CALENDARIO, que muestra todo lo que lo ocupa —incluido
 * lo ya liberado— y permite bloquearlo a mano.
 *
 * **`ocupacion_equipo` es la pieza que sostiene la fase**: todo lo que ocupa un equipo inserta
 * una fila ahí, y un `EXCLUDE` con índice GiST hace imposible que dos se traslapen. Por eso
 * crear un bloqueo puede responder **409**, y ese 409 es la garantía hablando.
 */
@Component({
  selector: 'app-disponibilidad',
  imports: [ErrorCampo, PanelLateral, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './disponibilidad.html',
})
export class Disponibilidad {
  private readonly api = inject(ApiDisponibilidad);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly terceros = inject(ApiTerceros);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly motivosManuales = MOTIVOS_MANUALES;

  protected readonly tipos = this.catalogos.selectorTipos();
  protected readonly ubicaciones = this.organizacion.selectorUbicaciones();
  protected readonly clientes = this.terceros.selectorClientes();

  /**
   * El periodo consultado. **Se APLICA al pulsar Consultar**, no al teclear.
   *
   * Es la diferencia con las demás pantallas: allí la búsqueda filtra sola con retardo, y aquí
   * no puede — mientras se escribe una fecha pasa por estados inválidos («2026-0», día 31 de
   * febrero) que el servidor rechazaría con un 400 por cada tecla.
   */
  private readonly consultado = signal<{ desde: string; hasta: string } | null>(null);

  protected readonly tipoFiltrado = signal('');
  protected readonly ubicacionFiltrada = signal('');
  protected readonly clienteFiltrado = signal('');

  protected readonly formularioPeriodo = this.fb.group({
    desde: [''],
    hasta: [''],
  });

  /** El periodo es válido si están las dos y la final es posterior. Igual que lo valida el servidor. */
  protected periodoValido(): boolean {
    const { desde, hasta } = this.formularioPeriodo.getRawValue();

    return desde !== '' && hasta !== '' && hasta > desde;
  }

  private readonly filtro = computed<FiltroDisponibilidad>(() => {
    const p = this.consultado();

    return {
      Desde: p ? `${p.desde}T00:00:00Z` : undefined,
      Hasta: p ? `${p.hasta}T00:00:00Z` : undefined,
      TipoEquipoId: this.tipoFiltrado() || undefined,
      UbicacionId: this.ubicacionFiltrada() || undefined,
      ClienteId: this.clienteFiltrado() || undefined,
      Tamano: 200,
    };
  });

  private readonly consulta = this.api.disponibles(this.filtro);

  protected readonly libres = this.consulta.filas;
  protected readonly total = this.consulta.total;
  protected readonly cargando = this.consulta.cargando;

  protected readonly hayConsulta = computed(() => this.consultado() !== null);

  protected readonly enviando = signal(false);
  protected readonly panelCalendario = signal(false);
  protected readonly panelBloqueo = signal(false);
  protected readonly equipoDelCalendario = signal<EquipoDisponible | null>(null);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.consulta.error());

  /** El id del equipo cuyo calendario se mira. Vacío = no pidas nada. */
  private readonly idDelCalendario = computed(() => this.equipoDelCalendario()?.id ?? '');

  private readonly calendario = this.api.calendarioDe(this.idDelCalendario);

  protected readonly ocupaciones = this.calendario.ocupaciones;
  protected readonly cargandoCalendario = this.calendario.cargando;

  protected readonly formularioBloqueo = this.fb.group({
    inicio: [''],
    fin: [''],
    motivo: [3 as MotivoOcupacion],
    nota: [''],
  });

  protected readonly contexto = computed(() =>
    this.hayConsulta() ? t().disponibilidad.contexto(this.total()) : t().disponibilidad.sinPeriodo,
  );

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().disponibilidad.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );
  }

  protected nombreMotivo(motivo: MotivoOcupacion): string {
    return t().disponibilidad.motivos[motivo] ?? String(motivo);
  }

  protected consultar(): void {
    if (!this.periodoValido()) {
      this.formularioPeriodo.markAllAsTouched();
      return;
    }

    const { desde, hasta } = this.formularioPeriodo.getRawValue();

    this.errorMutacion.set(null);
    this.consultado.set({ desde, hasta });
  }

  protected filtrarPorTipo(id: string): void {
    this.tipoFiltrado.set(id);
  }

  protected filtrarPorUbicacion(id: string): void {
    this.ubicacionFiltrada.set(id);
  }

  protected filtrarPorCliente(id: string): void {
    this.clienteFiltrado.set(id);
  }

  protected abrirCalendario(equipo: EquipoDisponible): void {
    this.errorMutacion.set(null);
    this.equipoDelCalendario.set(equipo);
    this.panelCalendario.set(true);
  }

  protected cerrarCalendario(): void {
    this.panelCalendario.set(false);
  }

  /**
   * Abre el bloqueo Y CIERRA EL CALENDARIO.
   *
   * Los dos son paneles laterales del mismo tamaño, así que abiertos a la vez el segundo tapa
   * al primero exactamente y se lee como un fallo de pintado. Dos `<dialog>` modales apilados
   * FUNCIONAN —el de arriba gana la capa superior y el de abajo queda inerte— pero que algo
   * funcione no lo hace legible.
   */
  protected abrirBloqueo(): void {
    this.errorMutacion.set(null);
    this.panelCalendario.set(false);
    const p = this.consultado();
    // Se precarga el periodo consultado: es casi siempre el que se quiere bloquear.
    this.formularioBloqueo.reset({
      inicio: p?.desde ?? '',
      fin: p?.hasta ?? '',
      motivo: 3,
      nota: '',
    });
    this.panelBloqueo.set(true);
  }

  protected cerrarBloqueo(): void {
    this.panelBloqueo.set(false);
  }

  /** Cancelar devuelve al calendario, de donde se salio. */
  protected cancelarBloqueo(): void {
    this.panelBloqueo.set(false);
    this.panelCalendario.set(true);
  }

  protected puedeBloquear(): boolean {
    return this.formularioBloqueo.controls.inicio.value !== '' && !this.enviando();
  }

  protected crearBloqueo(): void {
    const equipo = this.equipoDelCalendario();

    if (equipo === null || !this.puedeBloquear()) {
      this.formularioBloqueo.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioBloqueo.getRawValue();

    this.api
      .crearBloqueo({
        equipoId: equipo.id,
        inicio: `${v.inicio}T00:00:00Z`,
        // Vacío bloquea todo lo posterior: es lo correcto para un equipo fuera de servicio.
        fin: v.fin === '' ? null : `${v.fin}T00:00:00Z`,
        motivo: v.motivo,
        nota: v.nota.trim() === '' ? null : v.nota.trim(),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.calendario.recargar();
          this.cerrarBloqueo();
          // Vuelve el calendario: es donde se ve el bloqueo que se acaba de crear.
          this.panelCalendario.set(true);
        },
        error: (e: unknown) => {
          // Aquí aterriza el 409 del `EXCLUDE`: ya hay algo ocupando ese periodo.
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  protected async liberar(ocupacion: Ocupacion): Promise<void> {
    const sigue = await this.confirmacion.pedir({
      titulo: t().disponibilidad.liberar,
      mensaje: t().disponibilidad.confirmarLiberar(this.nombreMotivo(ocupacion.motivo)),
      confirmar: t().disponibilidad.liberar,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    this.errorMutacion.set(null);

    this.api.liberarBloqueo(ocupacion.id).subscribe({
      next: () => this.calendario.recargar(),
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
