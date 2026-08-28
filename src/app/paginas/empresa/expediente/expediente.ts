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
import { RouterLink } from '@angular/router';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type {
  AltaEquipoTarifa,
  DocumentoEquipo,
  EquipoTarifa,
  TipoArchivoEquipo,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';

/** Los seis de `TipoArchivoEquipo`. */
const TIPOS_ARCHIVO: readonly TipoArchivoEquipo[] = [1, 2, 3, 4, 5, 6];

/**
 * El expediente de un equipo: sus documentos y sus precios.
 *
 * ES UNA PANTALLA DE DETALLE, no una hoja: cuelga de `/equipos/:id` y se llega pulsando el
 * código en la lista. Dos secciones con tabla propia, cada una con su alta.
 *
 * **El precio no se edita, se CIERRA.** El catálogo de tarifas dice QUÉ se cobra; `equipo_tarifa`
 * dice CUÁNTO, por equipo y con vigencia. Cambiar un precio es ponerle fecha de fin al vigente y
 * cargar el nuevo, de forma que el histórico queda. Un `EXCLUDE` impide dos vigentes para la
 * misma combinación, así que cargar uno encima responde **409** — y eso se muestra con el texto
 * del servidor, no como un error genérico.
 *
 * **Un cliente en el precio significa precio NEGOCIADO** con él, y gana sobre el de lista. Vacío
 * es el de lista.
 */
@Component({
  selector: 'app-expediente',
  imports: [ErrorCampo, PanelLateral, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expediente.html',
})
export class Expediente {
  private readonly api = inject(ApiEquipos);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly terceros = inject(ApiTerceros);
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
  protected readonly clientes = this.terceros.selectorClientes();

  private readonly expediente = this.api.expedienteDe(this.id);

  protected readonly equipo = this.expediente.equipo;
  protected readonly documentos = this.expediente.documentos;
  protected readonly precios = this.expediente.tarifas;
  protected readonly cargando = this.expediente.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelDocumento = signal(false);
  protected readonly panelPrecio = signal(false);
  protected readonly cerrandoPrecio = signal<EquipoTarifa | null>(null);

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
    tarifaId: ['', validadorRequerido],
    clienteId: [''],
    precio: [null as number | null],
    moneda: ['MXN'],
    vigenciaDesde: [''],
  });

  protected readonly formularioCierre = this.fb.group({
    vigenciaHasta: [''],
  });

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
    this.formularioPrecio.reset({
      tarifaId: '',
      clienteId: '',
      precio: null,
      moneda: 'MXN',
      vigenciaDesde: '',
    });
    this.panelPrecio.set(true);
  }

  protected cerrarPanelPrecio(): void {
    this.panelPrecio.set(false);
  }

  protected puedeGuardarPrecio(): boolean {
    return (
      this.formularioPrecio.valid &&
      this.formularioPrecio.controls.precio.value !== null &&
      !this.enviando()
    );
  }

  protected guardarPrecio(): void {
    if (!this.puedeGuardarPrecio()) {
      this.formularioPrecio.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formularioPrecio.getRawValue();

    const alta = {
      tarifaId: v.tarifaId,
      clienteId: v.clienteId === '' ? null : v.clienteId,
      precio: v.precio ?? 0,
      moneda: v.moneda.trim() || 'MXN',
      // El servidor espera fecha y hora. Sin fecha, vale ahora.
      vigenciaDesde:
        v.vigenciaDesde === '' ? new Date().toISOString() : `${v.vigenciaDesde}T00:00:00Z`,
      vigenciaHasta: null,
    } satisfies AltaEquipoTarifa;

    this.api.crearPrecio(this.id(), alta).subscribe({
      next: () => {
        this.enviando.set(false);
        this.expediente.recargarTarifas();
        this.expediente.recargarEquipo();
        this.cerrarPanelPrecio();
      },
      error: (e: unknown) => {
        // Aquí aterriza el 409 del `EXCLUDE`: ya hay un precio vigente para esa combinación.
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  protected abrirCierre(precio: EquipoTarifa): void {
    this.errorMutacion.set(null);
    this.cerrandoPrecio.set(precio);
    this.formularioCierre.reset({ vigenciaHasta: '' });
  }

  protected cancelarCierre(): void {
    this.cerrandoPrecio.set(null);
  }

  protected puedeCerrarPrecio(): boolean {
    return this.formularioCierre.controls.vigenciaHasta.value !== '' && !this.enviando();
  }

  protected cerrarPrecio(): void {
    const precio = this.cerrandoPrecio();

    if (precio === null || !this.puedeCerrarPrecio()) {
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const hasta = `${this.formularioCierre.getRawValue().vigenciaHasta}T00:00:00Z`;

    this.api.cerrarPrecio(this.id(), precio.id, hasta).subscribe({
      next: () => {
        this.enviando.set(false);
        this.expediente.recargarTarifas();
        this.cerrandoPrecio.set(null);
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
