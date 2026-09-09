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
import { ApiCotizaciones } from '../../../nucleo/api/api-cotizaciones';
import type {
  AltaCotizacion,
  Cotizacion,
  EstadoCotizacion,
  FiltroCotizaciones,
  TipoCotizacion,
  UnidadTarifa,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';
import { CotizacionesEsqueleto } from './esqueleto';

/**
 * ISO con zona → lo que `<input type="datetime-local">` acepta: `AAAA-MM-DDTHH:mm`.
 *
 * Corta la cadena en lugar de construir un `Date`: el valor llega en UTC y pasarlo por `Date`
 * lo movería a la zona del navegador, que es exactamente lo que no se quiere en un campo que
 * el usuario capturó con esas mismas letras.
 */
function aLocal(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 16) : '';
}

const TAMANO_PAGINA = 50;

/** Los siete de `EstadoCotizacion`, en el orden del enum del backend. */
const ESTADOS: readonly EstadoCotizacion[] = [1, 2, 3, 4, 5, 6, 7];

/** `EstadoCotizacion.Borrador`. Con nombre porque decide qué se puede tocar. */
const BORRADOR: EstadoCotizacion = 1;

/**
 * **LAS CUATRO UNIDADES DE TIEMPO, y solo esas.** `UnidadTarifa` tiene seis; Evento (5) y
 * Kilómetro (6) no se pueden contar a partir de un rango de fechas, así que un CHECK impide
 * que la cotización las lleve y aquí no se ofrecen.
 *
 * Constante y no una función: son cuatro números, y sus rótulos salen del diccionario en la
 * plantilla — así siguen el idioma sin que esto se evalúe al cargar el módulo.
 */
const UNIDADES: readonly UnidadTarifa[] = [1, 2, 3, 4];

/**
 * La moneda de los importes.
 *
 * **La Fase 1 no tiene moneda por documento**: `CotizacionDto` no la trae y el motor no la
 * guarda. Se fija aquí, en un sitio, para que el día que la cotización cargue su propia divisa
 * —una renta a un cliente que factura en dólares— haya un solo punto que cambiar en vez de
 * varios `| currency` repartidos. El plan tiene su `moneda` porque ese sí se cobra en varias.
 */
const MONEDA = 'MXN';

/**
 * Cotizaciones: la propuesta comercial, y la primera pantalla del módulo COMERCIAL con un
 * documento de verdad detrás.
 *
 * DOS COSAS QUE LA SEPARAN DE UN CATÁLOGO:
 *
 * **El listado NO trae las líneas.** El servidor devuelve `Array.Empty` a propósito: son N por
 * documento y cincuenta cotizaciones no se pintan con sus renglones. Lo que sí llega es el
 * total, ya calculado. Las líneas viven en `/cotizaciones/:id`, igual que el expediente vive en
 * `/equipos/:id`.
 *
 * **Editar solo aplica en Borrador.** No es una preferencia de la pantalla: `EditarAsync`
 * responde 409 en cualquier otro estado. Por eso el lápiz solo sale en las de Borrador — y aun
 * así, quien llegue por otra vía recibe el 409 del servidor, que es quien manda.
 *
 * El folio lo genera `IFolios`; no se captura ni se ofrece.
 */
@Component({
  selector: 'app-cotizaciones',
  imports: [
    BarraHerramientas,
    CotizacionesEsqueleto,
    CurrencyPipe,
    DatePipe,
    ErrorCampo,
    PanelLateral,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cotizaciones.html',
})
export class Cotizaciones {
  private readonly api = inject(ApiCotizaciones);
  private readonly barra = inject(Barra);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly locale = idioma;
  protected readonly moneda = MONEDA;
  protected readonly estados = ESTADOS;
  protected readonly borrador = BORRADOR;
  protected readonly mal = errorVisible;

  /**
   * NI CLIENTES, NI UBICACIONES, NI TRABAJADORES.
   *
   * La cotización se quedó sin los tres: el responsable el 2026-09-08 y el cliente y la
   * ubicación el 2026-09-09. Quien la levantó lo dice la bitácora de auditoría; **el cliente y
   * las condiciones los pide el panel de conversión**, porque la renta sí los necesita — de
   * ella salen el contrato y la factura.
   *
   * Y con la ubicación se fue la regla de «solo se cotiza desde un patio», con su disparador.
   */
  protected readonly unidades = UNIDADES;

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly estadoFiltrado = signal<EstadoCotizacion | undefined>(undefined);

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroCotizaciones>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Estado: this.estadoFiltrado(),
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
  }));

  private readonly listado = this.api.cotizaciones.listado(this.filtro);

  protected readonly cotizaciones = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.cotizaciones().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Cotizacion | null>(null);

  protected readonly formulario = this.fb.group({
    // Las dos fechas son `<input type="date">`, que escribe TEXTO —`2026-08-28` o vacío—, no
    // un `Date`. Se mandan como están: el backend las lee como `DateOnly`.
    fecha: [''],
    // OBLIGATORIA (§10). Es un `<input type="date">`, que guarda TEXTO, así que
    // `validadorRequerido` sirve — a diferencia de un `<select>` numérico, donde da
    // `{ required: true }` siempre.
    vigenciaHasta: ['', validadorRequerido],

    // **SIN VALIDADOR Y CON VALOR INICIAL**: es un `<select>` numérico, y `validadorRequerido`
    // pasa por `texto()`, que devuelve `''` para lo que no sea cadena — daría
    // `{ required: true }` siempre y el botón no se habilitaría nunca. Con dos opciones y sin
    // opción vacía no puede estar vacío por construcción.
    tipo: [1 as TipoCotizacion],

    // **CÓMO SE COBRA EL PERIODO**, y va justo después del tipo porque se lee junto: «una
    // cotización de renta, por día». De ella y del periodo sale la cantidad de cada línea, y
    // multiplicada por el costo del equipo, el costo de la máquina.
    //
    // Sin validador y con valor inicial, por lo mismo que el tipo: es un `<select>` numérico.
    // Solo las cuatro de TIEMPO — Evento y Kilómetro no se pueden contar con fechas.
    unidad: [2 as UnidadTarifa],

    // El periodo PROPUESTO, solo en las de renta. Son `<input type="datetime-local">`, que
    // escribe texto sin zona: se le pega la Z al mandarlo, igual que en Movimientos.
    periodoInicio: [''],
    periodoFin: [''],

    // Numéricos, así que `number | null`: un campo vaciado escribe `null`, nunca cadena vacía.
    // El servidor los declara `decimal` no anulables, así que salen con `?? 0`.
    descuento: [0 as number | null],
    impuestos: [0 as number | null],

    // SIN CONDICIONES: salieron el 2026-09-09. Se capturan en la renta al convertir, que es
    // donde de verdad se firman.
    notas: [''],
  });

  /** Las dos opciones del `<select>`, en el orden del enum. */
  protected readonly tiposCotizacion: readonly TipoCotizacion[] = [1, 2];

  /**
   * Los valores COMO SEÑAL. Sin esto, `esRenta` leería un `FormGroup` —que no es reactivo— y
   * se quedaría con el primer valor: el periodo no aparecería al cambiar el tipo.
   */
  private readonly valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  protected readonly esRenta = computed(() => this.valores().tipo === 1);

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().cotizaciones.sinResultados(texto);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().cotizaciones.sinDeEseEstado(this.nombreEstado(estado));
    }

    return t().cotizaciones.sinCotizaciones;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().cotizaciones.contextoResultados(n);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().cotizaciones.contextoDeEstado(n, this.nombreEstado(estado));
    }

    return t().cotizaciones.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().cotizaciones.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.estadoFiltrado();
      this.pagina.set(1);
    });
  }

  protected nombreEstado(estado: EstadoCotizacion): string {
    return t().cotizaciones.estados[estado] ?? String(estado);
  }

  /** El `<select>` entrega TEXTO; `EstadoCotizacion` es numérico. */
  protected elegirEstado(valor: string): void {
    this.estadoFiltrado.set(valor === '' ? undefined : (Number(valor) as EstadoCotizacion));
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
      fecha: '',
      vigenciaHasta: '',
      tipo: 1 as TipoCotizacion,
      unidad: 2 as UnidadTarifa,
      periodoInicio: '',
      periodoFin: '',
      // Con 0 y no con null: son obligatorios, y `reset` con el tipo equivocado devuelve el
      // desajuste que el accesor numérico ya provocó una vez en Modelos.
      descuento: 0,
      impuestos: 0,
      notas: '',
    });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(cotizacion: Cotizacion): void {
    this.editando.set(cotizacion);
    this.errorMutacion.set(null);
    this.formulario.reset({
      fecha: cotizacion.fecha,
      vigenciaHasta: cotizacion.vigenciaHasta,
      tipo: cotizacion.tipo,
      unidad: cotizacion.unidad,
      // El servidor manda ISO con Z; `datetime-local` quiere `AAAA-MM-DDTHH:mm` sin zona.
      periodoInicio: aLocal(cotizacion.periodoInicio),
      periodoFin: aLocal(cotizacion.periodoFin),
      descuento: cotizacion.descuento,
      impuestos: cotizacion.impuestos,
      notas: cotizacion.notas ?? '',
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
      // Vacía va NULA y no como cadena: el backend pone la de hoy cuando no llega fecha.
      fecha: v.fecha || null,
      // OBLIGATORIA desde el 2026-09-03 (§10): una propuesta sin caducidad es un precio
      // que el cliente puede reclamar un año después.
      vigenciaHasta: v.vigenciaHasta,
      tipo: v.tipo,
      unidad: v.unidad,
      // EL PERIODO SOLO EN LAS DE RENTA. Una de venta lo manda nulo aunque quedara escrito en
      // el control: el servidor lo rechaza y un CHECK lo rechazaría después, pero sobre todo
      // sería un periodo que no significa nada.
      periodoInicio: v.tipo === 1 && v.periodoInicio !== '' ? `${v.periodoInicio}:00Z` : null,
      periodoFin: v.tipo === 1 && v.periodoFin !== '' ? `${v.periodoFin}:00Z` : null,
      descuento: v.descuento ?? 0,
      impuestos: v.impuestos ?? 0,
      notas: v.notas.trim() === '' ? null : v.notas.trim(),
    } satisfies AltaCotizacion;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.cotizaciones.editar(enEdicion.id, alta)
      : this.api.cotizaciones.crear(alta);

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
}
