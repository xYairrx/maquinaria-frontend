import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiCotizaciones } from '../../../nucleo/api/api-cotizaciones';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiRentas } from '../../../nucleo/api/api-rentas';
import type {
  ConversionDeCotizacion,
  CotizacionLinea,
  EstadoCotizacion,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { aInstante } from '../../../nucleo/formularios/fecha-hora';
import {
  validadorCantidad,
  validadorImporte,
  validadorRequerido,
} from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';

/** `EstadoCotizacion.Borrador`: el único estado en el que se tocan las líneas. */
const BORRADOR: EstadoCotizacion = 1;

/** `EstadoCotizacion.Aceptada`: el único desde el que se convierte en renta. */
const ACEPTADA: EstadoCotizacion = 4;

/** Ver `MONEDA` en `cotizaciones.ts`: la Fase 1 no lleva divisa por documento. */
const MONEDA = 'MXN';

/**
 * LAS TRANSICIONES VÁLIDAS, copiadas del servidor.
 *
 * Es el espejo de `Transiciones` en `ServicioCotizacionesEf`. **La copia no es la garantía**:
 * quien manda es el servidor, que responde 409 a una transición inválida y ese texto se muestra
 * tal cual. Esto solo existe para no OFRECER lo que se va a rechazar — un desplegable con los
 * siete estados invita a un error garantizado.
 *
 * Se declara lo permitido y no lo prohibido, igual que allá: agregar un estado obliga a decidir
 * desde dónde se llega a él en vez de que quede alcanzable desde todas partes por omisión.
 * Rechazada, Vencida y Cancelada son TERMINALES: no están en la tabla, y desde ellas el panel
 * dice que no hay a dónde ir en lugar de ofrecer un desplegable vacío.
 *
 * Si el servidor cambia su tabla y esta se queda vieja, el síntoma es benigno en un sentido
 * —se ofrece de menos— y visible en el otro: el 409 aparece con su explicación.
 */
export const SIGUIENTES: Readonly<Record<number, readonly EstadoCotizacion[]>> = {
  1: [2, 7], // Borrador  → Enviada, Cancelada
  2: [3, 4, 5, 6, 7], // Enviada   → En revisión, Aceptada, Rechazada, Vencida, Cancelada
  3: [4, 5, 6, 7], // En revisión → Aceptada, Rechazada, Vencida, Cancelada
  4: [7], // Aceptada  → Cancelada. No es terminal: de ahí sale la renta.
};

/**
 * El detalle de una cotización: sus datos, sus líneas y su estado.
 *
 * ES UNA PANTALLA DE DETALLE, no un panel: cuelga de `/cotizaciones/:id` y se llega con el ojo
 * de la lista. El reparto es el mismo que en el expediente del equipo — el listado trae el
 * encabezado, el detalle trae lo que cuelga de él.
 *
 * **Las líneas solo se tocan en Borrador.** No es una preferencia de la pantalla: tanto
 * `AgregarLineaAsync` como `QuitarLineaAsync` responden 409 en cualquier otro estado. Por eso
 * fuera de Borrador no se dibujan ni el botón de agregar ni el de quitar, y en su lugar hay una
 * línea de texto que dice por qué.
 *
 * **Enviar exige líneas.** Una cotización vacía enviada al cliente es un documento sin
 * contenido, y a partir de Enviada ya no se puede corregir. El servidor lo rechaza con 409 y su
 * texto lo explica; aquí no se duplica la comprobación, se enseña la respuesta.
 *
 * **Ningún importe se calcula aquí.** El subtotal, el importe de cada línea y el total los
 * recalcula el servidor en cada cambio y **nunca los acepta del cuerpo**: un total capturado a
 * mano que no cuadre con las líneas deja dos números y ninguna forma de saber cuál vale.
 */
@Component({
  selector: 'app-cotizacion',
  imports: [CurrencyPipe, DatePipe, ErrorCampo, PanelLateral, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cotizacion.html',
})
export class CotizacionDetalle {
  private readonly api = inject(ApiCotizaciones);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly equipos = inject(ApiEquipos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly apiRentas = inject(ApiRentas);
  private readonly ruteador = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly locale = idioma;
  protected readonly moneda = MONEDA;
  protected readonly mal = errorVisible;

  /**
   * El id de la cotización, desde la ruta.
   *
   * Puede llegar `undefined` pese al tipo: `withComponentInputBinding` asigna `undefined`
   * cuando el parámetro no está, PISANDO el valor por defecto del `input()`. De ahí que el
   * servicio compruebe con `id() ? ... : undefined` en vez de contra cadena vacía.
   */
  readonly id = input('');

  protected readonly tarifas = this.catalogos.selectorTarifas();
  protected readonly tipos = this.catalogos.selectorTipos();
  protected readonly equiposDisponibles = this.equipos.selectorEquipos();

  private readonly detalle = this.api.detalleDe(this.id);

  protected readonly cotizacion = this.detalle.cotizacion;
  protected readonly cargando = this.detalle.cargando;

  protected readonly lineas = computed<readonly CotizacionLinea[]>(
    () => this.cotizacion()?.lineas ?? [],
  );

  /** En Borrador se agregan y se quitan líneas; fuera de él, el servidor responde 409. */
  protected readonly esBorrador = computed(() => this.cotizacion()?.estado === BORRADOR);

  /**
   * Solo una Aceptada se convierte, y lo exige el servidor con un 409.
   *
   * **NO se comprueba si YA se convirtió**, y no es un olvido: convertir no mueve el estado de la
   * cotización —sigue Aceptada— y no hay endpoint que conteste «¿esta cotización ya generó
   * renta?». Averiguarlo exigiría listar rentas y cruzar por `cotizacionId`: el mismo cruce
   * paginado que se rechazó en Contratos, con el mismo riesgo de quedar incompleto en silencio.
   *
   * Convertir dos veces crea dos rentas, las dos válidas y las dos apuntando a la misma
   * cotización. Si eso llega a doler, la guarda va en el SERVIDOR, que es quien puede contestar
   * esa pregunta sin paginar.
   */
  protected readonly esAceptada = computed(() => this.cotizacion()?.estado === ACEPTADA);

  /**
   * A qué estados se puede pasar desde el actual.
   *
   * Vacío significa TERMINAL, y eso es un mensaje, no un desplegable sin opciones.
   */
  protected readonly siguientes = computed<readonly EstadoCotizacion[]>(() => {
    const actual = this.cotizacion()?.estado;

    return actual === undefined ? [] : (SIGUIENTES[actual] ?? []);
  });

  protected readonly enviando = signal(false);
  protected readonly panelLinea = signal(false);
  protected readonly panelEstado = signal(false);
  protected readonly panelConversion = signal(false);

  /**
   * Lo que la conversión devolvió: la renta creada y las líneas que NO pasaron.
   *
   * Se guarda en lugar de navegar de inmediato porque **`pendientes` hay que leerlo**: cada
   * renglón es una máquina sin asignar, y saltar a la renta lo tiraría a la basura.
   */
  protected readonly conversion = signal<ConversionDeCotizacion | null>(null);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.detalle.error());

  protected readonly formularioLinea = this.fb.group({
    tarifaId: ['', validadorRequerido],

    // Vacío = sin equipo, que es válido: una línea de flete no tiene máquina.
    equipoId: [''],

    /**
     * Cotizar por TIPO en lugar de por máquina concreta: «una excavadora de 20 t», sin decir
     * cuál. Es lo normal cuando se cotiza con semanas de anticipación y todavía no se sabe qué
     * máquina va a estar libre.
     *
     * **No es adorno: define el tercer camino de la conversión a renta.** Al convertir, una línea
     * con equipo pasa a `renta_linea`; una con solo tipo se informa en `pendientes` porque cada
     * línea de renta aparta calendario y para eso hace falta la máquina; una sin equipo ni tipo
     * es un cargo —flete— y va a `renta_concepto`.
     *
     * Sin este campo, `pendientes` no se podría producir desde la aplicación.
     */
    tipoEquipoId: [''],

    descripcion: [''],

    // Numéricos, así que `number | null`: un campo vaciado escribe `null`, nunca cadena vacía.
    //
    // Y por eso NO llevan `validadorRequerido`, que pasa por `texto()` y devuelve `''` para
    // todo lo que no sea cadena: puesto aquí daría `{ required: true }` siempre y el botón de
    // guardar no se habilitaría nunca. Costó una depuración; está explicado en `validadores.ts`.
    //
    // Los dos límites son los del servidor: cantidad > 0, precio >= 0.
    cantidad: [1 as number | null, validadorCantidad],
    precioUnitario: [0 as number | null, validadorImporte],
  });

  protected readonly formularioEstado = this.fb.group({
    estado: [1 as EstadoCotizacion],
  });

  /**
   * Lo único que la cotización no tiene y la renta necesita.
   *
   * `datetime-local` porque el calendario razona con horas — ver `fecha-hora.ts`. El depósito y
   * el anticipo tampoco están cotizados; el descuento y los impuestos SÍ se arrastran solos desde
   * la cotización, así que no se preguntan.
   */
  protected readonly formularioConversion = this.fb.group({
    inicio: ['', validadorRequerido],
    fin: ['', validadorRequerido],
    lugarDescripcion: ['', validadorRequerido],
    deposito: [0 as number | null],
    anticipo: [0 as number | null],
  });

  constructor() {
    effect(() => {
      const c = this.cotizacion();

      this.barra.configurar({
        titulo: t().cotizacion.titulo,
        contexto: c ? t().cotizacion.contexto(c.folio) : '',
        busqueda: null,
        accion: null,
      });
    });
  }

  protected nombreEstado(estado: EstadoCotizacion): string {
    return t().cotizaciones.estados[estado] ?? String(estado);
  }

  protected abrirLinea(): void {
    this.errorMutacion.set(null);
    this.formularioLinea.reset({
      tarifaId: '',
      equipoId: '',
      tipoEquipoId: '',
      descripcion: '',
      // Con números y no con null: `reset` con el tipo equivocado devuelve el desajuste que el
      // accesor numérico ya provocó una vez en Modelos.
      cantidad: 1,
      precioUnitario: 0,
    });
    this.panelLinea.set(true);
  }

  protected cerrarLinea(): void {
    this.panelLinea.set(false);
  }

  protected puedeAgregar(): boolean {
    return this.formularioLinea.valid && !this.enviando();
  }

  protected agregar(): void {
    if (!this.puedeAgregar()) {
      this.formularioLinea.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioLinea.getRawValue();

    this.api
      .agregarLinea(this.id(), {
        tarifaId: v.tarifaId,
        equipoId: v.equipoId || null,
        // Si se eligió una máquina concreta, el tipo sobra: la conversión mira `equipoId`
        // PRIMERO y el tipo solo cuenta cuando no hay equipo. Mandar los dos no rompe nada,
        // pero deja un dato que ya no dice nada.
        tipoEquipoId: v.equipoId ? null : v.tipoEquipoId || null,
        descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
        cantidad: v.cantidad ?? 0,
        precioUnitario: v.precioUnitario ?? 0,
        // El orden lo pone la posición actual: las líneas se pintan por `orden` ascendente.
        orden: this.lineas().length + 1,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          // El listado lo recarga el servicio; el detalle lo pide quien lo montó.
          this.detalle.recargar();
          this.cerrarLinea();
        },
        error: (e: unknown) => {
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  protected async quitar(linea: CotizacionLinea): Promise<void> {
    if (this.enviando()) {
      return;
    }

    const sigue = await this.confirmacion.pedir({
      titulo: t().cotizacion.quitar,
      mensaje: t().cotizacion.confirmarQuitar(linea.tarifa),
      confirmar: t().cotizacion.quitar,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    this.api.quitarLinea(this.id(), linea.id).subscribe({
      next: () => {
        this.enviando.set(false);
        this.detalle.recargar();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  protected abrirEstado(): void {
    const primero = this.siguientes()[0];

    if (primero === undefined) {
      return;
    }

    this.errorMutacion.set(null);
    this.formularioEstado.reset({ estado: primero });
    this.panelEstado.set(true);
  }

  protected cerrarEstado(): void {
    this.panelEstado.set(false);
  }

  protected abrirConversion(): void {
    this.errorMutacion.set(null);
    this.conversion.set(null);
    this.formularioConversion.reset({
      inicio: '',
      fin: '',
      lugarDescripcion: '',
      deposito: 0,
      anticipo: 0,
    });
    this.panelConversion.set(true);
  }

  protected cerrarConversion(): void {
    this.panelConversion.set(false);
  }

  protected puedeConvertir(): boolean {
    return this.formularioConversion.valid && !this.enviando();
  }

  /**
   * Convierte la cotización en renta. **NO navega solo**: deja el resultado a la vista.
   *
   * Saltar a la renta recién creada parece lo cómodo y sería un error: **`pendientes` viene en
   * esta respuesta y en ningún otro sitio**. Si se descarta, nadie se entera de que hay líneas
   * cotizadas por tipo que siguen sin máquina — y la renta no se puede confirmar sin ellas, así
   * que el problema reaparecería más tarde y sin explicación.
   */
  protected convertir(): void {
    if (!this.puedeConvertir()) {
      this.formularioConversion.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioConversion.getRawValue();

    this.apiRentas
      .desdeCotizacion(this.id(), {
        // A INSTANTE, no el texto crudo del campo — ver `fecha-hora.ts`.
        inicio: aInstante(v.inicio) ?? '',
        fin: aInstante(v.fin) ?? '',
        lugar: {
          descripcion: v.lugarDescripcion.trim(),
          // El resto del domicilio no se pregunta aquí: se completa editando la renta, que nace
          // en Borrador. Pedir diez campos en el paso de conversión sería un formulario dentro
          // de otro.
          calle: null,
          colonia: null,
          municipio: null,
          estadoProv: null,
          codigoPostal: null,
          latitud: null,
          longitud: null,
          contacto: null,
          telefono: null,
        },
        deposito: v.deposito ?? 0,
        anticipo: v.anticipo ?? 0,
      })
      .subscribe({
        next: (resultado) => {
          this.enviando.set(false);
          this.conversion.set(resultado);
        },
        error: (e: unknown) => {
          // Aquí aterriza el 409 de convertir una que no está Aceptada.
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  /** Ya se leyeron los pendientes: ahora sí, a la renta. */
  protected irALaRenta(): void {
    const r = this.conversion();

    if (r === null) {
      return;
    }

    this.cerrarConversion();
    void this.ruteador.navigate(['/rentas', r.renta.id]);
  }

  protected enviarEstado(): void {
    if (this.enviando()) {
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioEstado.getRawValue();

    this.api.cambiarEstado(this.id(), v.estado).subscribe({
      next: () => {
        this.enviando.set(false);
        this.detalle.recargar();
        this.cerrarEstado();
      },
      error: (e: unknown) => {
        // Aquí aterriza el 409 de una transición inválida y el de «no se puede enviar una
        // cotización sin líneas», con el texto del servidor. El panel se queda abierto: el
        // mensaje se lee donde se tomó la decisión.
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
