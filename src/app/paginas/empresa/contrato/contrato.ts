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
import { RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiContratos } from '../../../nucleo/api/api-contratos';
import type { ContratoClausula, EstadoContrato } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { idioma, t } from '../../../nucleo/i18n/i18n';

/** Ver `MONEDA` en `cotizaciones.ts`: la Fase 1 no lleva divisa por documento. */
const MONEDA = 'MXN';

/**
 * LAS TRANSICIONES VÁLIDAS, copiadas de `ServicioContratosEf`.
 *
 * **No hay Cancelado**, y no es un olvido de esta tabla: el enum migrado no lo tiene. Terminado
 * es terminal y por eso está ausente.
 *
 * Igual que en Cotizaciones: la copia no es la garantía —el servidor responde 409— sino la forma
 * de no ofrecer lo que se va a rechazar. Y aquí hay un segundo rechazo que esta tabla NO puede
 * predecir: **autorizar exige cláusulas**. Eso depende de los datos, no del estado, así que se
 * deja llegar el 409 y se muestra su texto.
 *
 * ---
 *
 * **HOY SOLO FUNCIONA LA PRIMERA FILA, Y NO ES CULPA DE ESTA TABLA.** El trigger
 * `contrato_inmutable` rechaza CUALQUIER `UPDATE` sobre un contrato fuera de Borrador —incluido
 * el que solo mueve `estado`—, así que Firmado y Terminado son inalcanzables y `firmadoEn` no
 * puede tener valor nunca. Es una contradicción dentro del backend: el trigger dice una cosa y
 * `Transiciones` dice otra.
 *
 * **Esta tabla se deja completa a propósito.** Recortarla a `{ 1: [2] }` escondería el defecto
 * detrás de una decisión de interfaz y nadie volvería a mirarlo; dejándola, el intento falla
 * mostrando el mensaje del motor y el problema sigue a la vista. El diagnóstico y la migración
 * propuesta están en `maquinaria-backend/docs/guias/estado-y-pendientes.md`.
 */
export const SIGUIENTES: Readonly<Record<number, readonly EstadoContrato[]>> = {
  1: [2], // Borrador  → Autorizado
  2: [3, 4], // Autorizado → Firmado, Terminado
  3: [4], // Firmado   → Terminado
};

/**
 * El detalle de un contrato: sus datos y sus cláusulas.
 *
 * **LO QUE MANDA ES `editable`, NO EL ESTADO.** El DTO lo trae calculado por el servidor —hoy es
 * `estado === Borrador`— y se usa ese campo en lugar de comparar aquí: el día que el motor cambie
 * qué es editable, esta pantalla se entera sola. Detrás hay un TRIGGER, no solo una validación de
 * servicio, así que intentarlo por otra vía tampoco pasa.
 *
 * **Las cláusulas son una COPIA congelada.** Se les copió título y texto al crear el contrato;
 * corregir mañana la plantilla del catálogo no reescribe lo que alguien firmó. `clausulaId` es
 * solo la referencia de dónde salió, y viene nulo cuando la cláusula se redactó aquí.
 *
 * **No hay edición del contrato**: no existe `PUT`. Solo se agregan y quitan cláusulas mientras
 * está en Borrador, y se mueve el estado.
 */
@Component({
  selector: 'app-contrato',
  imports: [CurrencyPipe, DatePipe, ErrorCampo, PanelLateral, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contrato.html',
})
export class ContratoDetalle {
  private readonly api = inject(ApiContratos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly locale = idioma;
  protected readonly moneda = MONEDA;
  protected readonly mal = errorVisible;

  /** Puede llegar `undefined` pese al tipo — ver `expediente.ts`. */
  readonly id = input('');

  private readonly detalle = this.api.detalleDe(this.id);

  protected readonly contrato = this.detalle.contrato;
  protected readonly cargando = this.detalle.cargando;

  protected readonly clausulas = computed<readonly ContratoClausula[]>(
    () => this.contrato()?.clausulas ?? [],
  );

  /**
   * Lo dice el SERVIDOR, no una comparación local.
   *
   * `editable` es un campo calculado del DTO. Llega como opcional en los tipos generados —el
   * generador no distingue una propiedad calculada de una anulable—, de ahí el `=== true`.
   */
  protected readonly editable = computed(() => this.contrato()?.editable === true);

  protected readonly siguientes = computed<readonly EstadoContrato[]>(() => {
    const actual = this.contrato()?.estado;

    return actual === undefined ? [] : (SIGUIENTES[actual] ?? []);
  });

  protected readonly enviando = signal(false);
  protected readonly panelClausula = signal(false);
  protected readonly panelEstado = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.detalle.error());

  protected readonly formularioClausula = this.fb.group({
    titulo: ['', validadorRequerido],
    texto: ['', validadorRequerido],
    // El servidor renumera si choca, así que un valor de partida basta.
    orden: [0 as number | null],
  });

  protected readonly formularioEstado = this.fb.group({
    estado: [2 as EstadoContrato],
  });

  constructor() {
    effect(() => {
      const c = this.contrato();

      this.barra.configurar({
        titulo: t().contrato.titulo,
        contexto: c ? t().contrato.contexto(c.folio) : '',
        busqueda: null,
        accion: null,
      });
    });
  }

  protected nombreEstado(estado: EstadoContrato): string {
    return t().contratos.estados[estado] ?? String(estado);
  }

  protected abrirClausula(): void {
    this.errorMutacion.set(null);
    this.formularioClausula.reset({
      titulo: '',
      texto: '',
      orden: this.clausulas().length + 1,
    });
    this.panelClausula.set(true);
  }

  protected cerrarClausula(): void {
    this.panelClausula.set(false);
  }

  protected puedeAgregar(): boolean {
    return this.formularioClausula.valid && !this.enviando();
  }

  protected agregar(): void {
    if (!this.puedeAgregar()) {
      this.formularioClausula.markAllAsTouched();
      return;
    }

    const v = this.formularioClausula.getRawValue();

    this.ejecutar(
      this.api.agregarClausula(this.id(), {
        titulo: v.titulo.trim(),
        texto: v.texto.trim(),
        orden: Math.trunc(v.orden ?? 0),
      }),
      () => this.cerrarClausula(),
    );
  }

  protected async quitar(clausula: ContratoClausula): Promise<void> {
    if (this.enviando()) {
      return;
    }

    const sigue = await this.confirmacion.pedir({
      titulo: t().contrato.quitar,
      mensaje: t().contrato.confirmarQuitar(clausula.titulo),
      confirmar: t().contrato.quitar,
      peligro: true,
    });

    if (sigue) {
      this.ejecutar(this.api.quitarClausula(this.id(), clausula.id));
    }
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

  protected enviarEstado(): void {
    if (this.enviando()) {
      return;
    }

    const v = this.formularioEstado.getRawValue();

    this.ejecutar(this.api.cambiarEstado(this.id(), v.estado), () => this.cerrarEstado());
  }

  /**
   * El mismo envoltorio para las tres mutaciones.
   *
   * El detalle lo refresca quien lo montó: ese recurso lo crea `detalleDe` por pantalla y no está
   * en el mapa de la fábrica. El listado sí lo recarga el servicio.
   *
   * Aquí aterrizan dos 409 con causas distintas —la transición inválida y **autorizar sin
   * cláusulas**— y los dos se muestran con el texto del servidor, que es el único que sabe cuál
   * de los dos fue.
   */
  private ejecutar(peticion: Observable<unknown>, alTerminar?: () => void): void {
    this.enviando.set(true);
    this.errorMutacion.set(null);

    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.detalle.recargar();
        alTerminar?.();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
