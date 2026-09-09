import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { type Observable, map, of, switchMap } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import type {
  DocumentoEquipo,
  EquipoTarifa,
  Tarifa,
  TipoArchivoEquipo,
  UnidadTarifa,
} from '../../../nucleo/api/contratos';
import { ApiMovimientos } from '../../../nucleo/api/api-movimientos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { codigoDesdeNombre, mismoNombre } from '../../../nucleo/formularios/texto';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';

/** Los seis de `TipoArchivoEquipo`. */
const TIPOS_ARCHIVO: readonly TipoArchivoEquipo[] = [1, 2, 3, 4, 5, 6];

/** Los ultimos que caben en un expediente sin volverse un listado. */
const MOVIMIENTOS_VISIBLES = 20;

/** Las seis de `UnidadTarifa`, para el desplegable del concepto que se crea aqui. */
const UNIDADES: readonly UnidadTarifa[] = [1, 2, 3, 4, 5, 6];

/**
 * Donde se cobra un concepto nuevo. **Es un desplegable de tres y no dos casillas** porque la
 * base exige que aplique al menos a una cosa —el CHECK `tarifa_aplica_en_algo`—, y con casillas
 * el estado «ninguna de las dos» es representable: se veria bien y el servidor lo rechazaria.
 */
const AMBITOS = ['renta', 'venta', 'ambas'] as const;

type Ambito = (typeof AMBITOS)[number];

/**
 * El expediente de un equipo: su historial físico, sus documentos y sus precios.
 *
 * ES UNA PANTALLA DE DETALLE, no una hoja: cuelga de `/equipos/:id` y se llega pulsando el
 * código en la lista. Tres secciones con tabla propia; dos con alta.
 *
 * **EL HISTORIAL NO TIENE ALTA, y no es un olvido.** Un movimiento se captura en su propia
 * pantalla, donde el formulario empieza eligiendo la máquina y cambia de forma según el tipo.
 * Meter aquí una versión reducida daría dos formularios para lo mismo, y el de aquí sería el
 * que no sabe que una asignación a proyecto exige obra. Se muestran los últimos veinte: es un
 * expediente, no el módulo de movimientos.
 *
 * **EL PRECIO SE CORRIGE, y hasta el 2026-09-09 no se podía.** El catálogo de tarifas dice QUÉ
 * se cobra; `equipo_tarifa` dice CUÁNTO, para este equipo. Mientras esa tabla tuvo vigencia un
 * precio era un hecho con fecha: cambiarlo era cerrar el vigente y cargar el nuevo, de forma que
 * el histórico quedaba. Retirada la vigencia hay **un precio por concepto** y se edita o se
 * quita; el histórico se pierde y lo cotizado no, porque cada documento guarda su copia
 * congelada. Cargar un segundo precio del mismo concepto responde **409**, con el texto del
 * servidor y no un error genérico.
 *
 * **NO HAY PRECIO POR CLIENTE.** La columna existió hasta el 2026-09-09 y se retiró a petición
 * del cliente: no negocian precios por cuenta.
 *
 * **EL CONCEPTO SE ESCRIBE, y se crea si no está.** Era un `<select>` cerrado del catálogo, que
 * mandaba a otra pantalla —«si falta, créalo en Tarifas»— y de vuelta. Ahora es un campo de
 * texto con `datalist`: el navegador filtra mientras se teclea y, si lo escrito no está, el
 * panel pide lo que hace falta para darlo de alta —código, unidad, tipo y dónde se cobra— y se
 * crea al guardar. Son dos peticiones encadenadas y **en ese orden**: sin la tarifa no hay id
 * con el que cargar el precio.
 */
@Component({
  selector: 'app-expediente',
  imports: [ErrorCampo, PanelLateral, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expediente.html',
})
export class Expediente {
  private readonly api = inject(ApiEquipos);
  private readonly movimientosApi = inject(ApiMovimientos);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly tiposArchivo = TIPOS_ARCHIVO;
  protected readonly mal = errorVisible;

  /**
   * El id del equipo, desde la ruta.
   *
   * Puede llegar `undefined` pese al tipo: `withComponentInputBinding` asigna `undefined`
   * cuando el parámetro no está, PISANDO el valor por defecto del `input()`. De ahí que el
   * servicio compruebe con `equipoId() ? ... : undefined` en vez de contra cadena vacía.
   */
  readonly id = input('');

  protected readonly tarifas = this.catalogos.selectorTarifas();
  /** Solo lo usa el concepto que se crea desde aqui. Nulo vale «Operacion», que es el de omision. */
  protected readonly tiposTarifa = this.catalogos.selectorTiposTarifa();
  protected readonly unidades = UNIDADES;
  protected readonly ambitos = AMBITOS;
  // SIN SELECTOR DE CLIENTES: lo leia el desplegable del precio negociado, retirado el
  // 2026-09-09 con la columna `equipo_tarifa.cliente_id`.

  private readonly expediente = this.api.expedienteDe(this.id);

  protected readonly equipo = this.expediente.equipo;
  protected readonly documentos = this.expediente.documentos;
  protected readonly precios = this.expediente.tarifas;
  protected readonly cargando = this.expediente.cargando;

  /**
   * El historial de ESTA maquina. Comparte recurso con la pantalla de Movimientos: es la
   * misma ruta con `EquipoId` puesto, asi que registrar un movimiento alla recarga esto sin
   * que nadie se acuerde.
   *
   * El filtro es un `computed` sobre `id()` —que es un `input()`, o sea una señal— y por eso
   * la peticion vuelve a salir cuando se navega de un equipo a otro. Con un objeto literal
   * fijo se quedaria con el primer id para siempre.
   */
  private readonly historial = this.movimientosApi.listado(
    computed(() => ({ EquipoId: this.id(), Tamano: MOVIMIENTOS_VISIBLES })),
  );

  protected readonly movimientos = this.historial.filas;
  protected readonly totalMovimientos = this.historial.total;

  protected readonly enviando = signal(false);
  protected readonly panelDocumento = signal(false);
  protected readonly panelPrecio = signal(false);

  /**
   * El precio que se está corrigiendo, si se está corrigiendo alguno.
   *
   * **Comparte panel con el alta** y no tiene uno propio: los campos son los mismos menos el
   * concepto, que en una corrección no se cambia —cambiarlo sería otro precio— y por eso se
   * pinta como texto en lugar de como campo.
   */
  protected readonly precioEditando = signal<EquipoTarifa | null>(null);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.expediente.error());

  /** El archivo elegido. No cabe en un `FormControl`: un `<input type="file">` es de solo lectura. */
  protected readonly archivo = signal<File | null>(null);

  /**
   * Si ya se intentó subir sin archivo.
   *
   * HACE FALTA porque el archivo NO está en el `FormGroup` —un `<input type="file">` es de
   * solo lectura y no lo puede manejar un control reactivo—, así que no tiene `touched` y
   * `errorVisible` no le sirve. Sin esta bandera el aviso salía nada más abrir la pantalla,
   * que es exactamente lo que la regla del repo prohíbe: el error se enseña inválido Y
   * tocado, nunca antes de que la persona pueda hacer algo al respecto.
   */
  protected readonly intentoSubir = signal(false);

  /** El aviso del archivo: falta, y ya se intentó. */
  protected readonly faltaArchivo = computed(() => this.intentoSubir() && this.archivo() === null);

  protected readonly formularioDocumento = this.fb.group({
    tipo: [1 as TipoArchivoEquipo],
    descripcion: [''],
  });

  protected readonly formularioPrecio = this.fb.group({
    /**
     * EL NOMBRE DEL CONCEPTO, no su id. Es un campo de texto con `datalist`: se teclea, el
     * navegador filtra y lo escrito puede no estar en el catálogo — entonces se crea.
     */
    conceptoTexto: ['', validadorRequerido],
    precio: [null as number | null],
    moneda: ['MXN'],

    // ── Los cuatro de abajo SOLO se usan cuando el concepto no está en el catálogo ──
    codigoNuevo: [''],
    unidadNueva: [2 as UnidadTarifa],
    tipoTarifaId: [''],
    ambitoNuevo: ['renta' as Ambito],
  });

  /**
   * Los valores COMO SEÑAL. Un `FormGroup` no es reactivo: un `computed` que lo lea directo se
   * queda con el primer valor y el panel no descubriría nunca que lo escrito no está en el
   * catálogo. Es la trampa que ya costó dos arreglos en este repo.
   */
  private readonly valoresPrecio = toSignal(this.formularioPrecio.valueChanges, {
    initialValue: this.formularioPrecio.getRawValue(),
  });

  /** El concepto del catálogo que corresponde a lo escrito, si alguno. */
  protected readonly conceptoDelCatalogo = computed<Tarifa | null>(() => {
    // `?? ''` porque `valueChanges` emite un parcial: el tipo es `string | undefined` aunque
    // el control sea no anulable.
    const texto = this.valoresPrecio().conceptoTexto ?? '';

    return texto.trim() === ''
      ? null
      : (this.tarifas().find((x) => mismoNombre(x.nombre, texto)) ?? null);
  });

  /**
   * Si lo escrito es un concepto NUEVO: hay texto y el catálogo no lo tiene.
   *
   * Es lo que revela los cuatro campos del alta de la tarifa. Mientras se teclea a medias
   * también es cierto —«Fle» no está en el catálogo— y eso es lo correcto: el aviso aparece,
   * y desaparece en cuanto el nombre coincide con uno de la lista.
   */
  protected readonly conceptoNuevo = computed(
    () =>
      (this.valoresPrecio().conceptoTexto ?? '').trim() !== '' &&
      this.conceptoDelCatalogo() === null,
  );

  constructor() {
    effect(() => {
      const e = this.equipo();

      this.barra.configurar({
        titulo: t().expediente.titulo,
        contexto: e ? t().expediente.contexto(e.codigoInterno) : '',
        busqueda: null,
        accion: null,
      });
    });
  }

  protected nombreTipoArchivo(tipo: TipoArchivoEquipo): string {
    return t().expediente.tiposArchivo[tipo] ?? String(tipo);
  }

  /** Bytes a algo legible. Sin librería: son tres ramas. */
  protected tamano(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} kB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected alElegirArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;

    this.archivo.set(entrada.files?.[0] ?? null);
  }

  protected abrirSubida(): void {
    this.errorMutacion.set(null);
    this.archivo.set(null);
    this.intentoSubir.set(false);
    this.formularioDocumento.reset({ tipo: 1, descripcion: '' });
    this.panelDocumento.set(true);
  }

  protected cerrarSubida(): void {
    this.panelDocumento.set(false);
  }

  protected puedeSubir(): boolean {
    return this.archivo() !== null && !this.enviando();
  }

  protected subir(): void {
    const archivo = this.archivo();

    if (archivo === null || this.enviando()) {
      // Aquí es donde el aviso pasa a verse: la persona ya intentó.
      this.intentoSubir.set(true);
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioDocumento.getRawValue();

    this.api
      .subirDocumento(this.id(), archivo, {
        tipo: v.tipo,
        descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.expediente.recargarDocumentos();
          // El contador de documentos del equipo también cambió.
          this.expediente.recargarEquipo();
          this.cerrarSubida();
        },
        error: (e: unknown) => {
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  /**
   * Baja el archivo y lo entrega al navegador.
   *
   * NO es un `<a href>`: la descarga necesita el `Bearer` y un enlace normal no lo lleva. Se
   * pide como blob, se crea una URL temporal y **se revoca**; sin revocarla, cada descarga deja
   * el archivo entero retenido en memoria hasta recargar la página.
   */
  protected descargar(documento: DocumentoEquipo): void {
    this.errorMutacion.set(null);

    this.api.descargarDocumento(this.id(), documento.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');

        enlace.href = url;
        enlace.download = documento.nombreOriginal;
        enlace.click();

        URL.revokeObjectURL(url);
      },
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }

  protected async eliminarDocumento(documento: DocumentoEquipo): Promise<void> {
    const sigue = await this.confirmacion.pedir({
      titulo: t().expediente.eliminarDocumento,
      mensaje: t().expediente.confirmarEliminarDocumento(documento.nombreOriginal),
      confirmar: t().expediente.eliminarDocumento,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    this.errorMutacion.set(null);

    this.api.eliminarDocumento(this.id(), documento.id).subscribe({
      next: () => {
        this.expediente.recargarDocumentos();
        this.expediente.recargarEquipo();
      },
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }

  protected abrirPrecio(): void {
    this.errorMutacion.set(null);
    this.precioEditando.set(null);
    this.formularioPrecio.reset({
      conceptoTexto: '',
      precio: null,
      moneda: 'MXN',
      codigoNuevo: '',
      unidadNueva: 2,
      tipoTarifaId: '',
      ambitoNuevo: 'renta',
    });
    this.panelPrecio.set(true);
  }

  /**
   * Abre el MISMO panel para corregir un precio que ya existe.
   *
   * El concepto va en el formulario aunque no se pueda cambiar: es lo que hace que el campo
   * obligatorio esté satisfecho, y `disable()` no sirve —quitaría el control de `value`, que
   * es la trampa documentada en el CLAUDE.md del repo—. Lo que cambia es la plantilla, que lo
   * pinta como texto y no como campo.
   */
  protected abrirEdicionPrecio(precio: EquipoTarifa): void {
    this.errorMutacion.set(null);
    this.precioEditando.set(precio);
    this.formularioPrecio.reset({
      conceptoTexto: precio.tarifa,
      precio: precio.precio,
      moneda: precio.moneda,
      codigoNuevo: '',
      unidadNueva: 2,
      tipoTarifaId: '',
      ambitoNuevo: 'renta',
    });
    this.panelPrecio.set(true);
  }

  protected cerrarPanelPrecio(): void {
    this.panelPrecio.set(false);
    this.precioEditando.set(null);
  }

  /**
   * Sugiere el código del concepto nuevo a partir del nombre escrito.
   *
   * **NO SOBREESCRIBE lo que ya haya**: quien tecleó un código a mano no quiere que se le
   * cambie por corregir una letra del nombre.
   */
  protected alEscribirConcepto(): void {
    if (!this.conceptoNuevo() || this.formularioPrecio.controls.codigoNuevo.value !== '') {
      return;
    }

    this.formularioPrecio.controls.codigoNuevo.setValue(
      codigoDesdeNombre(this.formularioPrecio.controls.conceptoTexto.value),
    );
  }

  protected puedeGuardarPrecio(): boolean {
    if (
      !this.formularioPrecio.valid ||
      this.formularioPrecio.controls.precio.value === null ||
      this.enviando()
    ) {
      return false;
    }

    // El código solo hace falta cuando además hay que crear el concepto. Se comprueba aquí y
    // no con un validador porque es condicional: un `validadorRequerido` fijo bloquearía el
    // botón al elegir un concepto que ya existe.
    return !this.conceptoNuevo() || this.formularioPrecio.controls.codigoNuevo.value.trim() !== '';
  }

  protected guardarPrecio(): void {
    if (!this.puedeGuardarPrecio()) {
      this.formularioPrecio.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioPrecio.getRawValue();
    const editando = this.precioEditando();

    // El servidor solo acepta cambiar el importe: el concepto es la identidad de la fila.
    const peticion: Observable<unknown> =
      editando !== null
        ? this.api.editarPrecio(this.id(), editando.id, v.precio ?? 0)
        : this.conceptoResuelto().pipe(
            switchMap((tarifaId) =>
              this.api.crearPrecio(this.id(), {
                tarifaId,
                precio: v.precio ?? 0,
                moneda: v.moneda.trim() || 'MXN',
              }),
            ),
          );

    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.expediente.recargarTarifas();
        this.expediente.recargarEquipo();
        this.cerrarPanelPrecio();
      },
      error: (e: unknown) => {
        // Aquí aterrizan los dos 409: el del código de tarifa repetido y el del concepto que
        // esta máquina ya tenía. Los dos se muestran con el texto del servidor, que dice qué
        // hacer, en lugar de un «no se pudo guardar».
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  /**
   * El id del concepto: el del catálogo, o el de la tarifa que se crea antes de usarlo.
   *
   * **Son dos peticiones encadenadas y no una transacción**, así que un fallo al cargar el
   * precio deja la tarifa creada. Es lo correcto: la tarifa es un catálogo y queda disponible
   * para el siguiente intento, mientras que deshacerla borraría un concepto que quizá otra
   * persona ya está usando.
   */
  private conceptoResuelto(): Observable<string> {
    const existente = this.conceptoDelCatalogo();

    if (existente !== null) {
      return of(existente.id);
    }

    const v = this.formularioPrecio.getRawValue();

    return this.catalogos.tarifas
      .crear({
        codigo: v.codigoNuevo.trim(),
        nombre: v.conceptoTexto.trim(),
        descripcion: null,
        unidad: v.unidadNueva,
        // Vacío es «el de omisión», que el servidor resuelve a Operación.
        tipoTarifaId: v.tipoTarifaId === '' ? null : v.tipoTarifaId,
        aplicaRenta: v.ambitoNuevo !== 'venta',
        aplicaVenta: v.ambitoNuevo !== 'renta',
      })
      .pipe(map((tarifa) => tarifa.id));
  }

  /**
   * Quita un precio de la máquina.
   *
   * **SUSTITUYE AL CIERRE POR VIGENCIA.** Sin vigencia no hay forma de «terminar» un precio,
   * solo de borrarlo — y por eso se confirma: lo que se pierde no se recupera.
   */
  protected async quitarPrecio(precio: EquipoTarifa): Promise<void> {
    const sigue = await this.confirmacion.pedir({
      titulo: t().expediente.quitarPrecio,
      mensaje: t().expediente.confirmarQuitarPrecio(precio.tarifa),
      confirmar: t().expediente.quitarPrecio,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    this.errorMutacion.set(null);

    this.api.eliminarPrecio(this.id(), precio.id).subscribe({
      next: () => this.expediente.recargarTarifas(),
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
