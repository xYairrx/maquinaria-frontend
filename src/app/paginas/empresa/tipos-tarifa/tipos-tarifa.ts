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
import type { TipoTarifa, FiltroListado } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { t } from '../../../nucleo/i18n/i18n';
import { TiposTarifaEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/**
 * Tipos de concepto cobrable: Operacion, Fletes, Maniobras.
 *
 * De un tipo cuelgan las TARIFAS, y la columna de conteo lo enseña.
 *
 * MISMA FORMA QUE MARCAS —el razonamiento completo de la búsqueda diferida, el esqueleto
 * solo en la primera carga, los tres estados del filtro y el vacío que dice por qué está
 * vacío está en `marcas.ts`, y no se repite aquí—.
 */
@Component({
  selector: 'app-tipos-tarifa',
  imports: [BarraHerramientas, PanelLateral, TiposTarifaEsqueleto, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tipos-tarifa.html',
})
export class TiposTarifa {
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

  private readonly listado = this.api.tiposTarifa.listado(this.filtro);

  protected readonly tipos = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  /** Solo la PRIMERA carga: recargar no tapa la tabla. Ver `marcas.ts`. */
  protected readonly cargando = computed(
    () => this.listado.cargando() && this.tipos().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<TipoTarifa | null>(null);

  protected readonly formulario = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: [''],
  });

  /** El vacío dice POR QUÉ está vacío. Los cuatro casos, en `marcas.ts`. */
  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().tiposTarifa.sinResultados(texto);
    }

    if (this.soloActivas() === true) {
      return t().tiposTarifa.sinActivas;
    }

    if (this.soloActivas() === false) {
      return t().tiposTarifa.sinRetiradas;
    }

    return t().tiposTarifa.sinFilas;
  });

  /** El contexto de la barra cuenta lo mismo que la lista, no «el catálogo». */
  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().tiposTarifa.contextoResultados(n);
    }

    if (this.soloActivas() === true) {
      return t().tiposTarifa.contextoActivas(n);
    }

    if (this.soloActivas() === false) {
      return t().tiposTarifa.contextoRetiradas(n);
    }

    return t().tiposTarifa.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().tiposTarifa.titulo,
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

  protected abrirEdicion(tipo: TipoTarifa): void {
    this.editando.set(tipo);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion ?? '',
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
      ? this.api.tiposTarifa.editar(enEdicion.id, alta)
      : this.api.tiposTarifa.crear(alta);

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

  protected async alternarActivo(tipo: TipoTarifa): Promise<void> {
    if (tipo.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().tiposTarifa.retirar,
        mensaje: t().tiposTarifa.confirmarRetiro(tipo.nombre),
        confirmar: t().tiposTarifa.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.tiposTarifa.cambiarActivo(tipo.id, !tipo.activo).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
