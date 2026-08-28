import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { ApiContratos } from '../../../nucleo/api/api-contratos';
import { ApiRentas } from '../../../nucleo/api/api-rentas';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type { AltaContrato, EstadoContrato, FiltroContratos } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';
import { ContratosEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los cuatro de `EstadoContrato`. **No hay Cancelado**: el enum migrado no lo tiene. */
const ESTADOS: readonly EstadoContrato[] = [1, 2, 3, 4];

/** Ver `MONEDA` en `cotizaciones.ts`: la Fase 1 no lleva divisa por documento. */
const MONEDA = 'MXN';

/**
 * Contratos: el papel que respalda una renta.
 *
 * **UN CONTRATO POR RENTA.** Lo garantiza un `UNIQUE` de la base y el servidor lo explica con un
 * 409 nombrando el folio. La pantalla **no recorta** el desplegable a las rentas sin contrato:
 * ese filtro no existe en el servidor y calcularlo aquí sería incompleto en silencio en cuanto la
 * empresa pase de 200 rentas. Se ofrecen todas y el rechazo explica cuál ya tiene.
 *
 * **NO HAY EDICIÓN.** El endpoint no existe: un contrato se crea, se le mueven las cláusulas
 * mientras está en Borrador, y después es inmutable —lo impone un trigger, no solo el servicio—.
 * Por eso esta pantalla no tiene lápiz: solo el ojo que lleva al detalle.
 *
 * TRES CAMPOS TOMAN VALOR DE LA RENTA cuando se omiten, y por buenas razones: las fechas, el
 * depósito —**es el mismo dinero**, capturarlo dos veces es como los dos documentos acaban
 * diciendo cifras distintas— y las cláusulas, que vacías copian **todas las obligatorias
 * activas**.
 */
@Component({
  selector: 'app-contratos',
  imports: [
    BarraHerramientas,
    ContratosEsqueleto,
    CurrencyPipe,
    DatePipe,
    ErrorCampo,
    PanelLateral,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contratos.html',
})
export class Contratos {
  private readonly api = inject(ApiContratos);
  private readonly rentasApi = inject(ApiRentas);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly terceros = inject(ApiTerceros);
  private readonly barra = inject(Barra);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly locale = idioma;
  protected readonly moneda = MONEDA;
  protected readonly estados = ESTADOS;
  protected readonly mal = errorVisible;

  protected readonly rentas = this.rentasApi.selectorRentas();
  protected readonly clientes = this.terceros.selectorClientes();
  protected readonly clausulas = this.catalogos.selectorClausulas();

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly estadoFiltrado = signal<EstadoContrato | undefined>(undefined);
  protected readonly clienteFiltrado = signal('');

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroContratos>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Estado: this.estadoFiltrado(),
    ClienteId: this.clienteFiltrado() || undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
  }));

  private readonly listado = this.api.contratos.listado(this.filtro);

  protected readonly contratos = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.contratos().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  /**
   * Las cláusulas del catálogo que se van a copiar.
   *
   * FUERA del `FormGroup`: son una selección múltiple de tamaño variable, y **vacía significa
   * algo distinto de «ninguna»** — significa «todas las obligatorias activas», que es lo que el
   * servidor hace por omisión. Un `FormArray` de casillas obligaría a distinguir «no toqué nada»
   * de «desmarqué todo», y esa distinción no existe en el contrato del servidor.
   */
  protected readonly clausulasElegidas = signal<readonly string[]>([]);

  protected readonly formulario = this.fb.group({
    rentaId: ['', validadorRequerido],
    // `date` y no `datetime-local`: son `DateOnly` en el servidor, la hora no juega.
    fechaInicio: [''],
    fechaFin: [''],
    // Numérico, así que `number | null`. Sin `validadorRequerido`, que está escrito para texto.
    deposito: [0 as number | null],
    notas: [''],
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().contratos.sinResultados(texto);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().contratos.sinDeEseEstado(this.nombreEstado(estado));
    }

    return t().contratos.sinContratos;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().contratos.contextoResultados(n);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().contratos.contextoDeEstado(n, this.nombreEstado(estado));
    }

    return t().contratos.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().contratos.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.estadoFiltrado();
      this.clienteFiltrado();
      this.pagina.set(1);
    });
  }

  protected nombreEstado(estado: EstadoContrato): string {
    return t().contratos.estados[estado] ?? String(estado);
  }

  /** El `<select>` entrega TEXTO; `EstadoContrato` es numérico. */
  protected elegirEstado(valor: string): void {
    this.estadoFiltrado.set(valor === '' ? undefined : (Number(valor) as EstadoContrato));
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected clausulaElegida(id: string): boolean {
    return this.clausulasElegidas().includes(id);
  }

  protected alternarClausula(id: string, marcada: boolean): void {
    this.clausulasElegidas.update((actuales) =>
      marcada ? [...actuales, id] : actuales.filter((x) => x !== id),
    );
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.enviando();
  }

  protected abrirAlta(): void {
    this.errorMutacion.set(null);
    this.clausulasElegidas.set([]);
    this.formulario.reset({
      rentaId: '',
      fechaInicio: '',
      fechaFin: '',
      deposito: 0,
      notas: '',
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
    const elegidas = this.clausulasElegidas();

    const alta = {
      rentaId: v.rentaId,
      // Vacías van NULAS: el servidor toma las de la renta, que es lo que se quiere.
      fechaInicio: v.fechaInicio || null,
      fechaFin: v.fechaFin || null,
      // En cero toma el de la renta. No se traduce a null: el contrato lo declara `decimal`.
      deposito: v.deposito ?? 0,
      notas: v.notas.trim() === '' ? null : v.notas.trim(),
      // Vacía va NULA y no como arreglo vacío: los dos significan lo mismo para el servidor
      // —copiar todas las obligatorias— pero el nulo lo dice sin ambigüedad.
      clausulasDelCatalogo: elegidas.length === 0 ? null : [...elegidas],
    } satisfies AltaContrato;

    this.api.contratos.crear(alta).subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarPanel();
      },
      error: (e: unknown) => {
        // Aquí aterriza el 409 de «esa renta ya tiene contrato», con el folio dentro.
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
