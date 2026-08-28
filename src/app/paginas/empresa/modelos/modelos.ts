import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import type {
  AltaModeloEquipo,
  FiltroModelosEquipo,
  ModeloEquipo,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { t } from '../../../nucleo/i18n/i18n';
import { ModelosEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/**
 * Modelos de equipo: el 320D de Caterpillar, el PC200 de Komatsu.
 *
 * MISMA FORMA QUE MARCAS —lo común está razonado en `marcas.ts`—. Es la pantalla con más
 * dependencias de los siete catálogos, y por eso va la última:
 *
 * **Dos selectores, y no son simétricos.** La MARCA es obligatoria —un modelo sin marca no
 * identifica nada— y el TIPO es opcional: el mismo 320D puede clasificarse como excavadora
 * o quedar sin tipo hasta que alguien lo decida. El modelo del backend lo dice con
 * `TipoEquipoId` anulable, y el formulario lo respeta con una opción «sin tipo» que manda
 * `null`, no cadena vacía.
 *
 * **Los dos filtran en el SERVIDOR.** `FiltroModelosEquipo` acepta `MarcaId` y
 * `TipoEquipoId`, así que la pantalla no trae el catálogo entero para filtrarlo en memoria.
 *
 * **`horasEntreServicios` es de mantenimiento, no de catálogo.** Vive aquí porque es una
 * propiedad del modelo —todo 320D se sirve cada tantas horas— y es lo que la Fase 3 usará
 * para calcular el próximo servicio de cada equipo. Es opcional: se captura cuando se sabe.
 */
@Component({
  selector: 'app-modelos',
  imports: [BarraHerramientas, ModelosEsqueleto, PanelLateral, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelos.html',
})
export class Modelos {
  private readonly api = inject(ApiCatalogos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;

  /** Los dos desplegables, compartidos y solo con lo activo. */
  protected readonly marcas = this.api.selectorMarcas();
  protected readonly tipos = this.api.selectorTipos();

  /** Sin marcas activas no hay de dónde colgar un modelo. El tipo sí puede faltar. */
  protected readonly sinMarcas = computed(() => this.marcas().length === 0);

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly soloActivos = signal<boolean | undefined>(undefined);

  /** Vacío = todas. Filtra en el servidor con `MarcaId`. */
  protected readonly marcaFiltrada = signal('');

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroModelosEquipo>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Activo: this.soloActivos(),
    MarcaId: this.marcaFiltrada() || undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'nombre',
  }));

  private readonly listado = this.api.modelos.listado(this.filtro);

  protected readonly modelos = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.modelos().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<ModeloEquipo | null>(null);

  protected readonly formulario = this.fb.group({
    marcaId: ['', Validators.required],
    // Cadena vacía = «sin tipo». Se traduce a `null` al enviar; el backend lo acepta.
    tipoEquipoId: [''],
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: [''],
    // NÚMERO, y anulable. Lo decide el `NumberValueAccessor`, no esta declaración: un
    // `<input type="number">` escribe un number en el control, y `null` cuando está vacío
    // —nunca la cadena vacía—. Declararlo como texto compila igual y revienta al usarlo.
    // Que `null` sea posible es además lo correcto: la columna es `int?` y vacío significa
    // «no se sabe». Ver la regla de `[ngValue]`, que es el mismo engaño.
    horasEntreServicios: [null as number | null],
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().modelos.sinResultados(texto);
    }

    if (this.marcaFiltrada() !== '') {
      return t().modelos.sinDeEsaMarca;
    }

    if (this.soloActivos() === true) {
      return t().modelos.sinActivos;
    }

    if (this.soloActivos() === false) {
      return t().modelos.sinRetirados;
    }

    return t().modelos.sinModelos;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().modelos.contextoResultados(n);
    }

    if (this.soloActivos() === true) {
      return t().modelos.contextoActivos(n);
    }

    if (this.soloActivos() === false) {
      return t().modelos.contextoRetirados(n);
    }

    return t().modelos.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().modelos.titulo,
        contexto: this.contexto(),
        // NI BUSQUEDA NI ACCION AQUI: bajaron a `app-barra-herramientas`, encima de la tabla.
        // Ver el porque en `marcas.ts`, la pantalla canonica.
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.soloActivos();
      this.marcaFiltrada();
      this.pagina.set(1);
    });
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({
      marcaId: '',
      tipoEquipoId: '',
      nombre: '',
      descripcion: '',
      horasEntreServicios: null,
    });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(modelo: ModeloEquipo): void {
    this.editando.set(modelo);
    this.errorMutacion.set(null);
    this.formulario.reset({
      marcaId: modelo.marcaId,
      tipoEquipoId: modelo.tipoEquipoId ?? '',
      nombre: modelo.nombre,
      descripcion: modelo.descripcion ?? '',
      horasEntreServicios: modelo.horasEntreServicios ?? null,
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected filtrarPorMarca(marcaId: string): void {
    this.marcaFiltrada.set(marcaId);
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.enviando();
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formulario.getRawValue();

    // El accessor puede entregar 250.5 aunque el paso sea 1; la columna es `int`, asi que
    // se trunca aqui en vez de mandar un decimal que el enlace de modelo rechaza con un 400.
    const horas = v.horasEntreServicios;

    const alta = {
      marcaId: v.marcaId,
      // Cadena vacía va como null, no como ''. La columna es anulable y '' sería un id
      // inválido que el servidor rechazaría.
      tipoEquipoId: v.tipoEquipoId === '' ? null : v.tipoEquipoId,
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
      horasEntreServicios: horas === null || !Number.isFinite(horas) ? null : Math.trunc(horas),
    } satisfies AltaModeloEquipo;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.modelos.editar(enEdicion.id, alta)
      : this.api.modelos.crear(alta);

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

  protected async alternarActivo(modelo: ModeloEquipo): Promise<void> {
    if (modelo.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().modelos.retirar,
        mensaje: t().modelos.confirmarRetiro(modelo.nombre),
        confirmar: t().modelos.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.modelos.cambiarActivo(modelo.id, !modelo.activo).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
