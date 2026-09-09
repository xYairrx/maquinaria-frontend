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
import { ApiMantenimiento } from '../../../nucleo/api/api-mantenimiento';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import type { EstadoMantenimiento, TipoMantenimiento } from '../../../nucleo/api/contratos';
import { t } from '../../../nucleo/i18n/i18n';

/**
 * El detalle de un trabajo de taller: lo que se le hizo a la máquina y cómo se cierra.
 *
 * **CERRAR ES LA PANTALLA, no un botón de la lista.** Finalizar libera el calendario, guarda
 * costo y horómetro y **devuelve la máquina**, así que pide a dónde regresa; cancelar hace lo
 * mismo salvo el costo. Ninguna de las dos cabe en un botón de fila sin pedir datos primero.
 *
 * **SI EL TRABAJO TENÍA TALLER, LA UBICACIÓN DE REGRESO ES OBLIGATORIA** — el servidor lo exige
 * porque su movimiento de regreso necesita destino. Si no lo tenía, la máquina nunca salió y el
 * campo ni se muestra: pedirlo sugeriría que hay algo que mover.
 *
 * **UN TRABAJO CERRADO NO SE EDITA.** Su costo y su descripción son lo que se reporta, y
 * cambiarlos después reescribiría el historial de mantenimiento sin dejar rastro. La pantalla
 * lo muestra en solo lectura y lo dice.
 */
@Component({
  selector: 'app-trabajo',
  imports: [PanelLateral, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trabajo.html',
})
export class Trabajo {
  private readonly api = inject(ApiMantenimiento);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;

  /**
   * El id, desde la ruta.
   *
   * Puede llegar `undefined` pese al tipo: `withComponentInputBinding` asigna `undefined`
   * cuando el parámetro no está, PISANDO el valor por omisión del `input()`. Por eso el
   * servicio comprueba con `id() ? ... : undefined` y no contra cadena vacía.
   */
  readonly id = input('');

  private readonly recurso = this.api.trabajo(this.id);

  protected readonly trabajo = this.recurso.trabajo;
  protected readonly cargando = this.recurso.cargando;

  /** A dónde puede volver la máquina. Cualquier ubicación vigente, no solo talleres. */
  protected readonly ubicaciones = this.organizacion.selectorUbicacionesActivas();

  protected readonly enviando = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.recurso.error());

  protected readonly panelCierre = signal(false);

  /** Vigente = Abierto o EnProceso. Es lo único que se puede cerrar o editar. */
  protected readonly vigente = computed(() => {
    const estado = this.trabajo()?.estado;

    return estado === 1 || estado === 2;
  });

  /** Si tenía taller, la máquina salió y hay que decir a dónde vuelve. */
  protected readonly exigeRegreso = computed(() => this.trabajo()?.tallerId != null);

  protected readonly formulario = this.fb.group({
    ubicacionRegresoId: [''],
    fechaFin: [''],
    // `number | null`: es lo que escribe el accesor de un `<input type="number">`.
    horometroFin: [null as number | null],
    costo: [null as number | null],
    observaciones: [''],
  });

  constructor() {
    effect(() => {
      const trabajo = this.trabajo();

      this.barra.configurar({
        titulo: trabajo?.folio ?? t().trabajo.titulo,
        contexto: trabajo
          ? t().trabajo.contexto(trabajo.codigoInterno, this.nombreEstado(trabajo.estado))
          : '',
        busqueda: null,
        accion: null,
      });
    });
  }

  protected nombreTipo(tipo: TipoMantenimiento): string {
    return t().mantenimiento.tipos[tipo] ?? String(tipo);
  }

  protected nombreEstado(estado: EstadoMantenimiento): string {
    return t().mantenimiento.estados[estado] ?? String(estado);
  }

  protected abrirCierre(): void {
    this.errorMutacion.set(null);
    this.formulario.reset({
      ubicacionRegresoId: '',
      fechaFin: '',
      horometroFin: null,
      costo: null,
      observaciones: '',
    });
    this.panelCierre.set(true);
  }

  protected cerrarPanel(): void {
    this.panelCierre.set(false);
  }

  protected puedeFinalizar(): boolean {
    if (this.enviando()) {
      return false;
    }

    // El único requisito condicional, y no lo puede expresar un `Validators.required`:
    // depende de si el trabajo tenía taller.
    return !this.exigeRegreso() || this.formulario.getRawValue().ubicacionRegresoId !== '';
  }

  protected finalizar(): void {
    const trabajo = this.trabajo();

    if (trabajo === undefined || !this.puedeFinalizar()) {
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formulario.getRawValue();

    this.api
      .finalizar(trabajo.id, {
        ubicacionRegresoId: v.ubicacionRegresoId === '' ? null : v.ubicacionRegresoId,
        fechaFin: v.fechaFin === '' ? null : `${v.fechaFin}T00:00:00Z`,
        horometroFin: v.horometroFin,
        costo: v.costo,
        observaciones: v.observaciones.trim() === '' ? null : v.observaciones.trim(),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.cerrarPanel();
          this.recurso.recargar();
        },
        error: (e: unknown) => {
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  /**
   * Cancela el trabajo. **Pregunta antes**: significa que no se hizo, libera el calendario y,
   * si la máquina había salido, la regresa. No se deshace.
   */
  protected async cancelar(): Promise<void> {
    const trabajo = this.trabajo();

    if (trabajo === undefined) {
      return;
    }

    const sigue = await this.confirmacion.pedir({
      titulo: t().trabajo.cancelar,
      mensaje: t().trabajo.confirmarCancelacion(trabajo.folio),
      confirmar: t().trabajo.cancelar,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    const v = this.formulario.getRawValue();

    this.errorMutacion.set(null);

    this.api
      .cancelar(trabajo.id, {
        // Si había salido, vuelve a donde diga el formulario de cierre; si no, va nulo y el
        // servidor no escribe movimiento.
        ubicacionRegresoId: v.ubicacionRegresoId === '' ? null : v.ubicacionRegresoId,
        motivo: v.observaciones.trim() === '' ? null : v.observaciones.trim(),
      })
      .subscribe({
        next: () => {
          this.cerrarPanel();
          this.recurso.recargar();
        },
        error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
      });
  }

  /** Abierto ↔ EnProceso. Informativo: no toca el calendario ni la máquina. */
  protected marcarEnProceso(enProceso: boolean): void {
    const trabajo = this.trabajo();

    if (trabajo === undefined) {
      return;
    }

    this.errorMutacion.set(null);

    this.api.marcarEnProceso(trabajo.id, enProceso).subscribe({
      next: () => this.recurso.recargar(),
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
