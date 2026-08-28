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
import { ApiOrdenes } from '../../../nucleo/api/api-ordenes';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type { AltaOrdenCompra, EstadoOrden, FiltroOrdenes } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';
import { ComprasEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los cuatro de `EstadoOrden`, compartidos con las ventas. */
const ESTADOS: readonly EstadoOrden[] = [1, 2, 3, 4];

/** Ver `MONEDA` en `cotizaciones.ts`: la Fase 1 no lleva divisa por documento. */
const MONEDA = 'MXN';

/**
 * Órdenes de compra: por donde ENTRA maquinaria al parque.
 *
 * **Finalizarla es lo que da de alta los equipos en el catálogo**, y por eso no está aquí sino en
 * el detalle: cada línea necesita su código interno y su tipo, y eso se decide mirando las
 * máquinas de la orden. Un botón de fila invitaría a finalizar sin haber mirado.
 *
 * **No hay edición.** Como el contrato, la orden se crea y se le mueven las líneas mientras está
 * en Borrador. Por eso el listado solo tiene el ojo.
 *
 * El módulo es `compras` — el mismo que las VENTAS, porque así lo declara el servidor:
 * `[RequierePermiso("compras.consultar")]` en los dos controladores.
 */
@Component({
  selector: 'app-compras',
  imports: [
    BarraHerramientas,
    ComprasEsqueleto,
    CurrencyPipe,
    DatePipe,
    ErrorCampo,
    PanelLateral,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './compras.html',
})
export class Compras {
  private readonly api = inject(ApiOrdenes);
  private readonly terceros = inject(ApiTerceros);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly barra = inject(Barra);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly locale = idioma;
  protected readonly moneda = MONEDA;
  protected readonly estados = ESTADOS;
  protected readonly mal = errorVisible;

  protected readonly proveedores = this.terceros.selectorProveedores();
  protected readonly trabajadores = this.organizacion.selectorTrabajadores();

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly estadoFiltrado = signal<EstadoOrden | undefined>(undefined);
  protected readonly contraparteFiltrada = signal('');

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroOrdenes>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Estado: this.estadoFiltrado(),
    // `ContraparteId` es el proveedor en compras y el cliente en ventas: el filtro del
    // servidor es uno solo para las dos.
    ContraparteId: this.contraparteFiltrada() || undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
  }));

  private readonly listado = this.api.compras.listado(this.filtro);

  protected readonly ordenes = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.ordenes().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly formulario = this.fb.group({
    proveedorId: ['', validadorRequerido],
    trabajadorId: ['', validadorRequerido],
    // `date` y no `datetime-local`: `Fecha` es `DateOnly`, la hora no juega.
    fecha: [''],
    // Numérico: sin `validadorRequerido`, que está escrito para texto.
    impuestos: [0 as number | null],
    notas: [''],
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().compras.sinResultados(texto);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().compras.sinDeEseEstado(this.nombreEstado(estado));
    }

    return t().compras.sinCompras;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().ordenes.contextoResultados(n);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().ordenes.contextoDeEstado(n, this.nombreEstado(estado));
    }

    return t().ordenes.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().compras.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.estadoFiltrado();
      this.contraparteFiltrada();
      this.pagina.set(1);
    });
  }

  protected nombreEstado(estado: EstadoOrden): string {
    return t().ordenes.estados[estado] ?? String(estado);
  }

  /** El `<select>` entrega TEXTO; `EstadoOrden` es numérico. */
  protected elegirEstado(valor: string): void {
    this.estadoFiltrado.set(valor === '' ? undefined : (Number(valor) as EstadoOrden));
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
      proveedorId: '',
      trabajadorId: '',
      fecha: '',
      impuestos: 0,
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

    const alta = {
      proveedorId: v.proveedorId,
      trabajadorId: v.trabajadorId,
      // Vacía va NULA: el servidor pone la de hoy.
      fecha: v.fecha || null,
      impuestos: v.impuestos ?? 0,
      notas: v.notas.trim() === '' ? null : v.notas.trim(),
    } satisfies AltaOrdenCompra;

    this.api.compras.crear(alta).subscribe({
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
}
