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
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import type {
  AltaEquipo,
  Equipo,
  EstadoEquipo,
  FiltroEquipos,
  OrigenEquipo,
  PropositoEquipo,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';
import { EquiposEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los ocho de `EstadoEquipo`. Sirven para FILTRAR y para leer la tabla. */
const ESTADOS: readonly EstadoEquipo[] = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Los cuatro que una persona SÍ puede poner a mano.
 *
 * Los otros —Reservado, Rentado, En traslado y Vendido— los pone la operación al confirmar una
 * renta, un traspaso o una venta, y **el servidor rechaza cambiarlos desde aquí** con un 400
 * explícito. No es una regla que se invente la pantalla: está en `ServicioEquiposEf` como
 * `EstadosDeDocumento`. Ofrecerlos dejaría el calendario y el estado contándose cosas distintas.
 */
const ESTADOS_MANUALES: readonly EstadoEquipo[] = [1, 5, 6, 8];

const PROPOSITOS: readonly PropositoEquipo[] = [1, 2, 3];
const ORIGENES: readonly OrigenEquipo[] = [1, 2];

/**
 * El parque de equipos. **La entidad central de la fase.**
 *
 * TRES COSAS QUE NO SON OBVIAS:
 *
 * **El estado no se captura entero.** De los ocho, solo cuatro se ponen a mano; los otros salen
 * de confirmar una renta, un traspaso o una venta, y el servidor los rechaza. La pantalla
 * ofrece los cuatro y explica por qué faltan los demás, en vez de dejar que el usuario descubra
 * el 400.
 *
 * **Mover la ubicación aquí NO es un traspaso.** Corrige el dato del expediente; el traspaso es
 * su propio proceso, con su registro en `transferencia_equipo`. La ayuda del campo lo dice.
 *
 * **Es la primera pantalla con DELETE.** `equipo` es una de las tres entidades con borrado
 * lógico, así que aquí sí hay eliminar además de cambiar de estado. Y puede responder **409**:
 * el servidor rechaza sacar de circulación —o borrar— una máquina con calendario ocupado. Ese
 * 409 es la garantía de no-traslape hablando, así que se muestra con el texto del servidor y no
 * como un «error al guardar».
 */
@Component({
  selector: 'app-equipos',
  imports: [
    BarraHerramientas,
    EquiposEsqueleto,
    ErrorCampo,
    PanelLateral,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipos.html',
})
export class Equipos {
  private readonly api = inject(ApiEquipos);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly estados = ESTADOS;
  protected readonly estadosManuales = ESTADOS_MANUALES;
  protected readonly propositos = PROPOSITOS;
  protected readonly origenes = ORIGENES;
  protected readonly mal = errorVisible;

  /** Los tres desplegables del alta. Compartidos entre pantallas: una petición cada uno. */
  protected readonly modelos = this.catalogos.selectorModelos();
  protected readonly tipos = this.catalogos.selectorTipos();
  protected readonly ubicaciones = this.organizacion.selectorUbicaciones();

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly estadoFiltrado = signal<EstadoEquipo | undefined>(undefined);
  protected readonly ubicacionFiltrada = signal('');
  protected readonly propositoFiltrado = signal<PropositoEquipo | undefined>(undefined);

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroEquipos>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Estado: this.estadoFiltrado(),
    UbicacionId: this.ubicacionFiltrada() || undefined,
    Proposito: this.propositoFiltrado(),
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'codigo',
  }));

  private readonly listado = this.api.equipos.listado(this.filtro);

  protected readonly equipos = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.equipos().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);
  protected readonly panelEstadoAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Equipo | null>(null);
  protected readonly cambiandoEstadoA = signal<Equipo | null>(null);

  protected readonly formulario = this.fb.group({
    codigoInterno: ['', validadorRequerido],
    modeloEquipoId: ['', validadorRequerido],
    tipoEquipoId: ['', validadorRequerido],
    ubicacionId: [''],
    numeroSerie: [''],
    // NUMÉRICOS Y ANULABLES: un `<input type="number">` escribe `null` al vaciarse, y en el DTO
    // estos SÍ son opcionales, así que null es su valor legítimo. Declararlos como texto
    // compila y luego revienta con `.trim is not a function`.
    anio: [null as number | null],
    proposito: [1 as PropositoEquipo],
    origen: [1 as OrigenEquipo],
    fechaAdquisicion: [''],
    costoAdquisicion: [null as number | null],
    valorActual: [null as number | null],
    horometro: [null as number | null],
    kilometraje: [null as number | null],
    notas: [''],
  });

  protected readonly formularioEstado = this.fb.group({
    estado: [1 as EstadoEquipo],
    nota: [''],
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().equipos.sinResultados(texto);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().equipos.sinDeEseEstado(this.nombreEstado(estado));
    }

    return t().equipos.sinEquipos;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().equipos.contextoResultados(n);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().equipos.contextoDeEstado(n, this.nombreEstado(estado));
    }

    return t().equipos.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().equipos.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.estadoFiltrado();
      this.ubicacionFiltrada();
      this.propositoFiltrado();
      this.pagina.set(1);
    });
  }

  protected nombreEstado(estado: EstadoEquipo): string {
    return t().equipos.estados[estado] ?? String(estado);
  }

  protected nombreProposito(proposito: PropositoEquipo): string {
    return t().equipos.propositos[proposito] ?? String(proposito);
  }

  protected nombreOrigen(origen: OrigenEquipo): string {
    return t().equipos.origenes[origen] ?? String(origen);
  }

  /** Los `<select>` entregan TEXTO; los tres enums son numéricos. */
  protected elegirEstado(valor: string): void {
    this.estadoFiltrado.set(valor === '' ? undefined : (Number(valor) as EstadoEquipo));
  }

  protected elegirProposito(valor: string): void {
    this.propositoFiltrado.set(valor === '' ? undefined : (Number(valor) as PropositoEquipo));
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
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigoInterno: '',
      modeloEquipoId: '',
      tipoEquipoId: '',
      ubicacionId: '',
      numeroSerie: '',
      anio: null,
      proposito: 1,
      origen: 1,
      fechaAdquisicion: '',
      costoAdquisicion: null,
      valorActual: null,
      horometro: null,
      kilometraje: null,
      notas: '',
    });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(equipo: Equipo): void {
    this.editando.set(equipo);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigoInterno: equipo.codigoInterno,
      modeloEquipoId: equipo.modeloEquipoId,
      tipoEquipoId: equipo.tipoEquipoId,
      ubicacionId: equipo.ubicacionId ?? '',
      numeroSerie: equipo.numeroSerie ?? '',
      anio: equipo.anio ?? null,
      proposito: equipo.proposito,
      origen: equipo.origen,
      fechaAdquisicion: equipo.fechaAdquisicion ?? '',
      costoAdquisicion: equipo.costoAdquisicion ?? null,
      valorActual: equipo.valorActual ?? null,
      horometro: equipo.horometro ?? null,
      kilometraje: equipo.kilometraje ?? null,
      notas: equipo.notas ?? '',
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected abrirEstado(equipo: Equipo): void {
    this.cambiandoEstadoA.set(equipo);
    this.errorMutacion.set(null);
    // Si el equipo está en un estado que pone la operación, el desplegable no puede
    // preseleccionarlo: se arranca en Disponible, que es el destino habitual.
    const actual = ESTADOS_MANUALES.includes(equipo.estado) ? equipo.estado : 1;
    this.formularioEstado.reset({ estado: actual, nota: '' });
    this.panelEstadoAbierto.set(true);
  }

  protected cerrarPanelEstado(): void {
    this.panelEstadoAbierto.set(false);
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formulario.getRawValue();
    const vacioANulo = (texto: string) => (texto.trim() === '' ? null : texto.trim());

    const alta = {
      codigoInterno: v.codigoInterno.trim().toUpperCase(),
      modeloEquipoId: v.modeloEquipoId,
      tipoEquipoId: v.tipoEquipoId,
      ubicacionId: vacioANulo(v.ubicacionId),
      numeroSerie: vacioANulo(v.numeroSerie),
      // `Math.trunc` porque el accesor usa `parseFloat`: un año con decimales llegaría al
      // servidor y una columna `int` lo rechazaría con un 400 de model binding.
      anio: v.anio === null ? null : Math.trunc(v.anio),
      proposito: v.proposito,
      origen: v.origen,
      fechaAdquisicion: vacioANulo(v.fechaAdquisicion),
      costoAdquisicion: v.costoAdquisicion,
      valorActual: v.valorActual,
      horometro: v.horometro,
      kilometraje: v.kilometraje,
      notas: vacioANulo(v.notas),
    } satisfies AltaEquipo;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.equipos.editar(enEdicion.id, alta)
      : this.api.equipos.crear(alta);

    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarPanel();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  protected enviarEstado(): void {
    const equipo = this.cambiandoEstadoA();

    if (equipo === null || this.enviando()) {
      return;
    }

    const v = this.formularioEstado.getRawValue();

    this.enviando.set(true);
    this.errorMutacion.set(null);

    this.api
      .cambiarEstadoEquipo(equipo.id, {
        estado: v.estado,
        nota: v.nota.trim() === '' ? null : v.nota.trim(),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.cerrarPanelEstado();
        },
        error: (e: unknown) => {
          // Aquí es donde aparece el 409 del calendario ocupado, con el texto del servidor.
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  protected async eliminar(equipo: Equipo): Promise<void> {
    const sigue = await this.confirmacion.pedir({
      titulo: t().equipos.eliminar,
      mensaje: t().equipos.confirmarEliminar(equipo.codigoInterno),
      confirmar: t().equipos.eliminar,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    this.errorMutacion.set(null);

    this.api.eliminarEquipo(equipo.id).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
