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
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiMantenimiento } from '../../../nucleo/api/api-mantenimiento';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type {
  AltaMantenimiento,
  EstadoMantenimiento,
  FiltroMantenimientos,
  TipoMantenimiento,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';
import { MantenimientoEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

const TIPOS: readonly TipoMantenimiento[] = [1, 2, 3];
const ESTADOS: readonly EstadoMantenimiento[] = [1, 2, 3, 4];

/**
 * Los trabajos de taller.
 *
 * **ABRIR UNO TOCA TRES TABLAS en el servidor**: la fila, el calendario —para que nadie rente
 * una máquina que está en el taller— y, si hay taller, el movimiento que la manda allá. Por eso
 * el alta puede responder **409 del calendario**: la máquina tiene una renta confirmada en esas
 * fechas. Ese mensaje dice con qué choca y se muestra tal cual.
 *
 * **EL TALLER ES OPCIONAL Y CAMBIA EL FLUJO ENTERO.** Sin taller, el trabajo se hace donde está
 * la máquina y no hay movimiento; con taller, sale y al cerrar hay que decir a dónde vuelve. La
 * ayuda del campo lo dice antes de que alguien lo descubra al cerrar.
 *
 * **EL FILTRO POR OMISIÓN SON LOS VIGENTES**, no todos: la pregunta que trae a alguien aquí es
 * «qué hay abierto», y una lista con dos años de trabajos cerrados encima la esconde.
 */
@Component({
  selector: 'app-mantenimiento',
  imports: [
    BarraHerramientas,
    ErrorCampo,
    MantenimientoEsqueleto,
    PanelLateral,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mantenimiento.html',
})
export class Mantenimiento {
  private readonly api = inject(ApiMantenimiento);
  private readonly equiposApi = inject(ApiEquipos);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly terceros = inject(ApiTerceros);
  private readonly barra = inject(Barra);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly mal = errorVisible;
  protected readonly tipos = TIPOS;
  protected readonly estados = ESTADOS;

  protected readonly equipos = this.equiposApi.selectorEquipos();
  protected readonly trabajadores = this.organizacion.selectorTrabajadores();
  protected readonly motivos = this.catalogos.selectorMotivosMovimiento();
  protected readonly proveedores = this.terceros.selectorProveedores();

  /**
   * El selector compartido, resuelto **en el campo y no dentro del `computed`**.
   *
   * NO ES ESTILO: `selectorUbicacionesActivas()` es perezoso y crea su `httpResource` la
   * primera vez que se le llama. Llamarlo dentro de un `computed` lo crea **dentro de un
   * contexto reactivo**, y eso lanza `NG0602: effect() cannot be called from within a
   * reactive context` — el recurso usa un `effect` por dentro.
   *
   * **Ya rompió esta pantalla el 2026-09-03**: la lista no pintaba ni sus filas ni su mensaje
   * de vacío —la sección quedaba en 2 px de borde— y el error solo se veía en la consola del
   * navegador. Ni `ng build` ni las 314 pruebas lo detectaron, porque nada monta el
   * componente con los servicios reales.
   */
  private readonly ubicacionesActivas = this.organizacion.selectorUbicacionesActivas();

  /**
   * Solo las ubicaciones de TIPO TALLER.
   *
   * Se filtra en la pantalla y no en el servidor porque el selector de ubicaciones activas lo
   * comparten cinco pantallas. Ofrecer un patio aquí sería ofrecer un rechazo garantizado: un
   * disparador de la base exige que el taller sea de tipo Taller.
   */
  protected readonly talleres = computed(() =>
    this.ubicacionesActivas().filter((u) => u.tipo === 3),
  );

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  /** `undefined` = todos. Arranca en «vigentes», que es la pregunta real de esta pantalla. */
  protected readonly soloVigentes = signal<boolean | undefined>(true);
  protected readonly tipoFiltrado = signal<TipoMantenimiento | undefined>(undefined);
  protected readonly equipoFiltrado = signal('');
  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroMantenimientos>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Vigentes: this.soloVigentes(),
    Tipo: this.tipoFiltrado(),
    EquipoId: this.equipoFiltrado() || undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
  }));

  private readonly listado = this.api.listado(this.filtro);

  protected readonly trabajos = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.trabajos().length === 0,
  );

  protected readonly recargando = this.listado.cargando;
  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly formulario = this.fb.group({
    equipoId: ['', validadorRequerido],
    // `ngValue` en el `<option>`: el tipo es un número y `[value]` guardaría la cadena.
    // **SIN VALIDADOR, y no es un olvido.** `validadorRequerido` pasa por `texto()`, que
    // devuelve `''` para cualquier valor que no sea cadena: en un campo numerico da
    // `{ required: true }` SIEMPRE y el boton de enviar no se habilita nunca. Esta escrito
    // en `validadores.ts` y en `convenciones.md`, y aun asi lo puse aqui — se descubrio el
    // 2026-09-03 usando la pantalla, porque el sintoma es solo un boton apagado sin ningun
    // mensaje: los avisos salen con `touched` y este campo se rellena sin tocarlo.
    //
    // Tampoco hace falta uno: el `<select>` no tiene opcion vacia y arranca con un valor
    // valido, asi que no puede estar vacio por construccion.
    tipo: [1 as TipoMantenimiento],
    motivoId: ['', validadorRequerido],
    tallerId: [''],
    proveedorId: [''],
    trabajadorId: ['', validadorRequerido],
    fechaInicio: [''],
    // `number | null`: es lo que escribe el accesor de un `<input type="number">`.
    horometroInicio: [null as number | null],
    descripcion: [''],
    observaciones: [''],
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().mantenimiento.sinResultados(texto);
    }

    if (this.soloVigentes() === true) {
      return t().mantenimiento.sinVigentes;
    }

    if (this.tipoFiltrado() !== undefined || this.equipoFiltrado() !== '') {
      return t().mantenimiento.sinDeFiltro;
    }

    return t().mantenimiento.sinFilas;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().mantenimiento.contextoResultados(n);
    }

    if (this.soloVigentes() === true) {
      return t().mantenimiento.contextoVigentes(n);
    }

    return t().mantenimiento.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().mantenimiento.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: { etiqueta: t().mantenimiento.abrir, alPulsar: () => this.abrirAlta() },
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.soloVigentes();
      this.tipoFiltrado();
      this.equipoFiltrado();
      this.pagina.set(1);
    });
  }

  protected nombreTipo(tipo: TipoMantenimiento): string {
    return t().mantenimiento.tipos[tipo] ?? String(tipo);
  }

  protected nombreEstado(estado: EstadoMantenimiento): string {
    return t().mantenimiento.estados[estado] ?? String(estado);
  }

  protected filtrarVigentes(valor: boolean | undefined): void {
    this.soloVigentes.set(valor);
  }

  protected filtrarPorTipo(valor: string): void {
    this.tipoFiltrado.set(valor === '' ? undefined : (Number(valor) as TipoMantenimiento));
  }

  protected filtrarPorEquipo(id: string): void {
    this.equipoFiltrado.set(id);
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
      tipo: 1,
      motivoId: '',
      tallerId: '',
      proveedorId: '',
      trabajadorId: '',
      fechaInicio: '',
      horometroInicio: null,
      descripcion: '',
      observaciones: '',
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
    const vacioANulo = (texto: string) => (texto.trim() === '' ? null : texto.trim());

    const alta = {
      equipoId: v.equipoId,
      tipo: v.tipo,
      motivoId: v.motivoId,
      tallerId: v.tallerId === '' ? null : v.tallerId,
      proveedorId: v.proveedorId === '' ? null : v.proveedorId,
      trabajadorId: v.trabajadorId,
      // Sin fecha, el servidor pone ahora. Fecharla en el pasado ocupa el calendario desde
      // entonces, y si eso choca con una renta confirmada el `EXCLUDE` lo rechaza.
      fechaInicio: v.fechaInicio === '' ? null : `${v.fechaInicio}T00:00:00Z`,
      horometroInicio: v.horometroInicio,
      descripcion: vacioANulo(v.descripcion),
      observaciones: vacioANulo(v.observaciones),
    } satisfies AltaMantenimiento;

    this.api.abrir(alta).subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarPanel();
      },
      error: (e: unknown) => {
        // Aquí aterriza el 409 del calendario, con el texto que dice con qué choca.
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
