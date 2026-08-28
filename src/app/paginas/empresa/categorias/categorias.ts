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
import type { Categoria, FiltroListado } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { t } from '../../../nucleo/i18n/i18n';
import { CategoriasEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/**
 * Categorías de equipo: excavación, carga, compactación.
 *
 * MISMA FORMA QUE MARCAS —el razonamiento completo de la búsqueda diferida, el esqueleto
 * solo en la primera carga, los tres estados del filtro y el vacío que dice por qué está
 * vacío está en `marcas.ts`, y no se repite aquí—. Lo que cambia son los campos: `codigo`,
 * `nombre` y `descripcion` en lugar de un solo nombre.
 *
 * **De una categoría cuelgan los TIPOS de equipo**, y la columna de conteo lo enseña. Por
 * eso retirarla no es inocuo: sus tipos siguen apuntándole, pero deja de ofrecerse al crear
 * uno nuevo.
 */
@Component({
  selector: 'app-categorias',
  imports: [BarraHerramientas, CategoriasEsqueleto, PanelLateral, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './categorias.html',
})
export class Categorias {
  private readonly api = inject(ApiCatalogos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;

  protected readonly busqueda = signal('');

  /** Con retardo, para no pedir por tecla. El porqué, en `marcas.ts`. */
  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly soloActivas = signal<boolean | undefined>(undefined);
  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroListado>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Activo: this.soloActivas(),
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'nombre',
  }));

  private readonly listado = this.api.categorias.listado(this.filtro);

  protected readonly categorias = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  /** Solo la PRIMERA carga: recargar no tapa la tabla. Ver `marcas.ts`. */
  protected readonly cargando = computed(
    () => this.listado.cargando() && this.categorias().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Categoria | null>(null);

  protected readonly formulario = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: [''],
  });

  /** El vacío dice POR QUÉ está vacío. Los cuatro casos, en `marcas.ts`. */
  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().categorias.sinResultados(texto);
    }

    if (this.soloActivas() === true) {
      return t().categorias.sinActivas;
    }

    if (this.soloActivas() === false) {
      return t().categorias.sinRetiradas;
    }

    return t().categorias.sinCategorias;
  });

  /** El contexto de la barra cuenta lo mismo que la lista, no «el catálogo». */
  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().categorias.contextoResultados(n);
    }

    if (this.soloActivas() === true) {
      return t().categorias.contextoActivas(n);
    }

    if (this.soloActivas() === false) {
      return t().categorias.contextoRetiradas(n);
    }

    return t().categorias.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().categorias.titulo,
        contexto: this.contexto(),
        // NI BUSQUEDA NI ACCION AQUI: bajaron a `app-barra-herramientas`, encima de la tabla.
        // Ver el porque en `marcas.ts`, la pantalla canonica.
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.soloActivas();
      this.pagina.set(1);
    });
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({ codigo: '', nombre: '', descripcion: '' });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(categoria: Categoria): void {
    this.editando.set(categoria);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: categoria.codigo,
      nombre: categoria.nombre,
      descripcion: categoria.descripcion ?? '',
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
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
      codigo: v.codigo.trim(),
      nombre: v.nombre.trim(),
      // Cadena vacía va como null: la columna es nullable, y guardar '' significaría
      // «capturado y vacío», que es otra cosa. Mismo criterio que en planes.
      descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
    };

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.categorias.editar(enEdicion.id, alta)
      : this.api.categorias.crear(alta);

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

  protected async alternarActivo(categoria: Categoria): Promise<void> {
    if (categoria.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().categorias.retirar,
        mensaje: t().categorias.confirmarRetiro(categoria.nombre),
        confirmar: t().categorias.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.categorias.cambiarActivo(categoria.id, !categoria.activo).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
