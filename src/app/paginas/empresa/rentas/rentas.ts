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
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import { ApiRentas } from '../../../nucleo/api/api-rentas';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type { AltaRenta, EstadoRenta, FiltroRentas, Renta } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { aCampoLocal, aInstante } from '../../../nucleo/formularios/fecha-hora';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';
import { RentasEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los diez de `EstadoRenta`, en el orden del enum del backend. */
const ESTADOS: readonly EstadoRenta[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** `EstadoRenta.Borrador`. Con nombre porque decide qué se puede editar. */
const BORRADOR: EstadoRenta = 1;

/** Ver `MONEDA` en `cotizaciones.ts`: la Fase 1 no lleva divisa por documento. */
const MONEDA = 'MXN';

/**
 * Rentas: la operación real, y **el criterio de salida de la Fase 1**.
 *
 * TRES COSAS QUE LA SEPARAN DE LA COTIZACIÓN:
 *
 * **Aquí se compromete el calendario.** Una cotización es una propuesta; una renta confirmada
 * aparta máquinas en fechas concretas, y un `EXCLUDE` de la base impide que dos rentas se pisen.
 * Nada de eso pasa en esta pantalla —el listado no confirma— pero explica por qué las acciones
 * que sí lo hacen viven en el detalle y no en un menú de fila.
 *
 * **El periodo es obligatorio y el lugar también.** No hay tabla `obra`: dónde se trabaja va
 * dentro de la renta, con `lugarDescripcion` obligatoria y la dirección opcional.
 *
 * **Vencida y por vencer NO son estados guardados**, son derivados de la fecha y llegan
 * calculados en el DTO. Se pintan como distintivo junto al estado, no en su lugar: una renta
 * vencida sigue estando Activa, y confundir las dos cosas haría creer que el motor la movió.
 */
@Component({
  selector: 'app-rentas',
  imports: [
    BarraHerramientas,
    CurrencyPipe,
    DatePipe,
    ErrorCampo,
    PanelLateral,
    ReactiveFormsModule,
    RentasEsqueleto,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rentas.html',
})
export class Rentas {
  private readonly api = inject(ApiRentas);
  private readonly terceros = inject(ApiTerceros);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly barra = inject(Barra);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly locale = idioma;
  protected readonly moneda = MONEDA;
  protected readonly estados = ESTADOS;
  protected readonly borrador = BORRADOR;
  protected readonly mal = errorVisible;

  /** Solo los ACTIVOS: `ValidarAsync` rechaza rentarle a un cliente suspendido o de baja. */
  protected readonly clientes = this.terceros.selectorClientesActivos();
  protected readonly trabajadores = this.organizacion.selectorTrabajadores();

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly estadoFiltrado = signal<EstadoRenta | undefined>(undefined);
  protected readonly clienteFiltrado = signal('');

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroRentas>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Estado: this.estadoFiltrado(),
    ClienteId: this.clienteFiltrado() || undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
  }));

  private readonly listado = this.api.rentas.listado(this.filtro);

  protected readonly rentas = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.rentas().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Renta | null>(null);

  protected readonly formulario = this.fb.group({
    clienteId: ['', validadorRequerido],
    trabajadorId: ['', validadorRequerido],

    // `datetime-local` y no `date`: `Inicio` y `Fin` son `DateTime` en el servidor, no
    // `DateOnly` como la fecha de una cotización. Una renta que arranca a las 8:00 y otra que
    // termina a las 7:00 del mismo día NO se traslapan, y con solo la fecha el calendario no
    // podría distinguirlas. El accesor escribe TEXTO, así que se declaran como texto.
    inicio: ['', validadorRequerido],
    fin: ['', validadorRequerido],

    lugarDescripcion: ['', validadorRequerido],
    calle: [''],
    colonia: [''],
    municipio: [''],
    estadoProv: [''],
    codigoPostal: [''],
    contacto: [''],
    telefono: [''],

    // Numéricos, así que `number | null`. Ver la trampa en `validadores.ts`: NO llevan
    // `validadorRequerido`, que está escrito para texto y los dejaría inválidos para siempre.
    deposito: [0 as number | null],
    anticipo: [0 as number | null],
    descuento: [0 as number | null],
    impuestos: [0 as number | null],

    notas: [''],
  });

  private readonly valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  /**
   * El fin tiene que ir después del inicio.
   *
   * Lee `valores()` —una señal— y NO `formulario.getRawValue()`: un `computed` que lee el
   * formulario directamente no registra dependencia y se queda con el primer valor para siempre.
   * Es la trampa que ya costó una depuración en Ubicaciones.
   */
  protected readonly periodoInvertido = computed(() => {
    // `valueChanges` emite un PARCIAL, así que los dos son `string | undefined` por más que el
    // formulario los declare no anulables. El `|| ''` es lo que lo hace cierto en tiempo de
    // ejecución; sin él, comparar `undefined <= undefined` daría `false` en silencio.
    const { inicio = '', fin = '' } = this.valores();

    // Compara TEXTO, y funciona porque `datetime-local` entrega ISO-8601 —`2026-08-28T14:30`—,
    // que ordena igual como cadena que como fecha. Ahorra dos `new Date()` por pulsación.
    return inicio !== '' && fin !== '' && fin <= inicio;
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().rentas.sinResultados(texto);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().rentas.sinDeEseEstado(this.nombreEstado(estado));
    }

    return t().rentas.sinRentas;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().rentas.contextoResultados(n);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().rentas.contextoDeEstado(n, this.nombreEstado(estado));
    }

    return t().rentas.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().rentas.titulo,
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

  protected nombreEstado(estado: EstadoRenta): string {
    return t().rentas.estados[estado] ?? String(estado);
  }

  /** El `<select>` entrega TEXTO; `EstadoRenta` es numérico. */
  protected elegirEstado(valor: string): void {
    this.estadoFiltrado.set(valor === '' ? undefined : (Number(valor) as EstadoRenta));
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.periodoInvertido() && !this.enviando();
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({
      clienteId: '',
      trabajadorId: '',
      inicio: '',
      fin: '',
      lugarDescripcion: '',
      calle: '',
      colonia: '',
      municipio: '',
      estadoProv: '',
      codigoPostal: '',
      contacto: '',
      telefono: '',
      deposito: 0,
      anticipo: 0,
      descuento: 0,
      impuestos: 0,
      notas: '',
    });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(renta: Renta): void {
    this.editando.set(renta);
    this.errorMutacion.set(null);
    this.formulario.reset({
      clienteId: renta.clienteId,
      trabajadorId: renta.trabajadorId,
      inicio: aCampoLocal(renta.inicio),
      fin: aCampoLocal(renta.fin),
      lugarDescripcion: renta.lugar.descripcion,
      calle: renta.lugar.calle ?? '',
      colonia: renta.lugar.colonia ?? '',
      municipio: renta.lugar.municipio ?? '',
      estadoProv: renta.lugar.estadoProv ?? '',
      codigoPostal: renta.lugar.codigoPostal ?? '',
      contacto: renta.lugar.contacto ?? '',
      telefono: renta.lugar.telefono ?? '',
      deposito: renta.deposito,
      anticipo: renta.anticipo,
      descuento: renta.descuento,
      impuestos: renta.impuestos,
      notas: renta.notas ?? '',
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
      clienteId: v.clienteId,
      // La renta nace suelta desde esta pantalla. La que viene de una cotización se crea con
      // `POST rentas/desde-cotizacion/{id}`, que copia los precios congelados.
      cotizacionId: null,
      trabajadorId: v.trabajadorId,
      // A INSTANTE, no el texto tal cual. El campo entrega hora de pared local y la columna
      // es `timestamptz`: mandarlo crudo da un 500 de Npgsql, y pegarle una `Z` lo corre las
      // horas del huso. Está explicado en `fecha-hora.ts`.
      inicio: aInstante(v.inicio) ?? '',
      fin: aInstante(v.fin) ?? '',
      lugar: {
        descripcion: v.lugarDescripcion.trim(),
        calle: vacioANulo(v.calle),
        colonia: vacioANulo(v.colonia),
        municipio: vacioANulo(v.municipio),
        estadoProv: vacioANulo(v.estadoProv),
        codigoPostal: vacioANulo(v.codigoPostal),
        // No se capturan: el alta no las ofrece y el servidor las admite nulas.
        latitud: null,
        longitud: null,
        contacto: vacioANulo(v.contacto),
        telefono: vacioANulo(v.telefono),
      },
      // `?? 0` porque un campo numérico vaciado escribe `null`, y los cuatro son obligatorios.
      deposito: v.deposito ?? 0,
      anticipo: v.anticipo ?? 0,
      descuento: v.descuento ?? 0,
      impuestos: v.impuestos ?? 0,
      notas: vacioANulo(v.notas),
    } satisfies AltaRenta;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.rentas.editar(enEdicion.id, alta)
      : this.api.rentas.crear(alta);

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
