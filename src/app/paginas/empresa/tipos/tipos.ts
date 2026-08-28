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
import type { FiltroTiposEquipo, TipoEquipo } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { t } from '../../../nucleo/i18n/i18n';
import { TiposEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/**
 * Tipos de equipo: excavadora, retroexcavadora, compactador.
 *
 * MISMA FORMA QUE MARCAS —el razonamiento de la búsqueda diferida, el esqueleto solo en la
 * primera carga y el vacío que explica por qué lo está viven en `marcas.ts`—.
 *
 * **LO QUE ESTA PANTALLA AÑADE ES UNA DEPENDENCIA:** un tipo cuelga de una CATEGORÍA, y la
 * categoría es obligatoria. De ahí el desplegable, que se llena de
 * `ApiCatalogos.selectorCategorias()` — un recurso compartido que trae solo las **activas**:
 * una categoría retirada sigue en el catálogo y en los tipos que ya la usan, pero no debe
 * poder elegirse para uno nuevo.
 *
 * **Sin categorías activas no se puede crear un tipo**, y la pantalla lo dice en lugar de
 * ofrecer un desplegable vacío que rechaza el servidor después de un viaje.
 */
@Component({
  selector: 'app-tipos',
  imports: [BarraHerramientas, PanelLateral, ReactiveFormsModule, TiposEsqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos.html',
})
export class Tipos {
  private readonly api = inject(ApiCatalogos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;

  /** Las categorías activas, para el desplegable. Compartido con quien más las pida. */
  protected readonly categorias = this.api.selectorCategorias();

  /** Sin ninguna activa no hay de dónde colgar un tipo. */
  protected readonly sinCategorias = computed(() => this.categorias().length === 0);

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly soloActivos = signal<boolean | undefined>(undefined);

  /** Vacío = todas. Filtra en el SERVIDOR con `CategoriaEquipoId`, no en memoria. */
  protected readonly categoriaFiltrada = signal('');

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroTiposEquipo>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Activo: this.soloActivos(),
    CategoriaEquipoId: this.categoriaFiltrada() || undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'nombre',
  }));

  private readonly listado = this.api.tipos.listado(this.filtro);

  protected readonly tipos = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.tipos().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<TipoEquipo | null>(null);

  protected readonly formulario = this.fb.group({
    categoriaEquipoId: ['', Validators.required],
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().tipos.sinResultados(texto);
    }

    if (this.categoriaFiltrada() !== '') {
      return t().tipos.sinDeEsaCategoria;
    }

    if (this.soloActivos() === true) {
      return t().tipos.sinActivos;
    }

    if (this.soloActivos() === false) {
      return t().tipos.sinRetirados;
    }

    return t().tipos.sinTipos;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().tipos.contextoResultados(n);
    }

    // «0 tipos» con una categoria elegida se lee como «el catalogo esta vacio». Se nombra
    // lo que se esta contando, igual que con el filtro de activos.
    if (this.categoriaFiltrada() !== '') {
      return t().tipos.contextoDeCategoria(n);
    }

    if (this.soloActivos() === true) {
      return t().tipos.contextoActivos(n);
    }

    if (this.soloActivos() === false) {
      return t().tipos.contextoRetirados(n);
    }

    return t().tipos.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().tipos.titulo,
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
      this.categoriaFiltrada();
      this.pagina.set(1);
    });
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({ categoriaEquipoId: '', codigo: '', nombre: '' });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(tipo: TipoEquipo): void {
    this.editando.set(tipo);
    this.errorMutacion.set(null);
    this.formulario.reset({
      categoriaEquipoId: tipo.categoriaEquipoId,
      codigo: tipo.codigo,
      nombre: tipo.nombre,
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected filtrarPorCategoria(categoriaId: string): void {
    this.categoriaFiltrada.set(categoriaId);
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

    const alta = {
      categoriaEquipoId: v.categoriaEquipoId,
      codigo: v.codigo.trim(),
      nombre: v.nombre.trim(),
    };

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.tipos.editar(enEdicion.id, alta)
      : this.api.tipos.crear(alta);

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

  protected async alternarActivo(tipo: TipoEquipo): Promise<void> {
    if (tipo.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().tipos.retirar,
        mensaje: t().tipos.confirmarRetiro(tipo.nombre),
        confirmar: t().tipos.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.tipos.cambiarActivo(tipo.id, !tipo.activo).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
