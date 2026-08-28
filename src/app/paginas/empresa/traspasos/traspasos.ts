import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiDisponibilidad } from '../../../nucleo/api/api-disponibilidad';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import type { AltaTransferencia, FiltroTransferencias } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';
import { TraspasosEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/**
 * Traspasos: mover una máquina de un almacén a otro.
 *
 * **SOLO LECTURA Y ALTA.** Un traspaso es un HECHO histórico: no se edita ni se borra, así que
 * la tabla no tiene columna de acciones. Es la primera pantalla del producto sin ninguna.
 *
 * **Solo de almacén a almacén** —bodega o patio, nunca desde ni hacia una sucursal— y esa regla
 * **la impone un TRIGGER de la base**, no este código. Una sucursal administra y cotiza; no
 * guarda máquinas. La pantalla lo dice en la ayuda del destino, pero si aun así se intenta, el
 * mensaje que se muestra es el del servidor.
 *
 * **La fecha de llegada decide si se ocupa el calendario.** Con ella, el traslado inserta una
 * ocupación con motivo Traslado y el equipo no se puede rentar en ese periodo. Sin ella, el
 * traspaso se registra como instantáneo. Es opcional a propósito: cerrar un traslado en curso es
 * logística —Fase 2—, y sin ese cierre una ocupación «hasta que llegue» se quedaría abierta.
 */
@Component({
  selector: 'app-traspasos',
  imports: [BarraHerramientas, ErrorCampo, PanelLateral, ReactiveFormsModule, TraspasosEsqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './traspasos.html',
})
export class Traspasos {
  private readonly api = inject(ApiDisponibilidad);
  private readonly equiposApi = inject(ApiEquipos);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly barra = inject(Barra);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly mal = errorVisible;

  protected readonly equipos = this.equiposApi.selectorEquipos();
  /** El FILTRO de la tabla admite cualquier ubicacion: el historial pudo salir de una. */
  protected readonly ubicaciones = this.organizacion.selectorUbicaciones();

  /**
   * El DESTINO, en cambio, solo admite almacenes. Un traspaso hacia una sucursal lo rechaza
   * un trigger de la base, asi que ofrecerla seria invitar a un error garantizado.
   */
  protected readonly almacenes = this.organizacion.selectorAlmacenes();
  protected readonly trabajadores = this.organizacion.selectorTrabajadores();

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly equipoFiltrado = signal('');
  protected readonly ubicacionFiltrada = signal('');
  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroTransferencias>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    EquipoId: this.equipoFiltrado() || undefined,
    UbicacionId: this.ubicacionFiltrada() || undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'fecha',
    Descendente: true,
  }));

  private readonly listado = this.api.transferencias.listado(this.filtro);

  protected readonly traspasos = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.traspasos().length === 0,
  );

  protected readonly recargando = this.listado.cargando;
  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly formulario = this.fb.group({
    equipoId: ['', validadorRequerido],
    destinoId: ['', validadorRequerido],
    trabajadorId: ['', validadorRequerido],
    fecha: [''],
    fin: [''],
    motivo: [''],
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    return texto !== '' ? t().traspasos.sinResultados(texto) : t().traspasos.sinTraspasos;
  });

  protected readonly contexto = computed(() =>
    this.busquedaDiferida().trim() !== ''
      ? t().traspasos.contextoResultados(this.total())
      : t().traspasos.contexto(this.total()),
  );

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().traspasos.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.equipoFiltrado();
      this.ubicacionFiltrada();
      this.pagina.set(1);
    });
  }

  protected filtrarPorEquipo(id: string): void {
    this.equipoFiltrado.set(id);
  }

  protected filtrarPorUbicacion(id: string): void {
    this.ubicacionFiltrada.set(id);
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.enviando();
  }

  protected abrirAlta(): void {
    this.errorMutacion.set(null);
    this.formulario.reset({
      equipoId: '',
      destinoId: '',
      trabajadorId: '',
      fecha: '',
      fin: '',
      motivo: '',
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formulario.getRawValue();

    const alta = {
      equipoId: v.equipoId,
      destinoId: v.destinoId,
      trabajadorId: v.trabajadorId,
      // Sin fecha, ahora: un traspaso siempre ocurre en un momento.
      fecha: v.fecha === '' ? new Date().toISOString() : `${v.fecha}T00:00:00Z`,
      // Con fin, el traslado OCUPA el calendario. Sin él, es instantáneo.
      fin: v.fin === '' ? null : `${v.fin}T00:00:00Z`,
      motivo: v.motivo.trim() === '' ? null : v.motivo.trim(),
    } satisfies AltaTransferencia;

    this.api.crearTransferencia(alta).subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarPanel();
      },
      error: (e: unknown) => {
        // Aquí aterriza el rechazo del TRIGGER si el destino no almacena, con su texto.
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
