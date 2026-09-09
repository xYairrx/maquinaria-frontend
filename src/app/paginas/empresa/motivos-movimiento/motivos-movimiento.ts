import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import type {
  AltaMotivoMovimiento,
  FiltroListado,
  MotivoMovimiento,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';
import { Sesion } from '../../../nucleo/sesion/sesion';
import { MotivosMovimientoEsqueleto } from './esqueleto';

/**
 * El catálogo de motivos de movimiento. **Solo el ADMINISTRADOR añade y edita.**
 *
 * **`accesoTotal` y nunca el nombre del rol.** Cada empresa renombra los suyos, así que un
 * `codigo === 'administrador'` se rompe en la primera que lo llame «Dueño». Es la misma regla
 * que sigue `puedeVerModulo`, y está escrita allí también.
 *
 * **ESTO NO ES SEGURIDAD, ES INTERFAZ.** La puerta de verdad son los tres endpoints, que son
 * `[SoloAdministrador]`. Aquí solo se decide qué se dibuja, para no ofrecer botones que el
 * servidor va a rechazar — que es la peor forma de decirle a alguien que no tiene permiso.
 *
 * **UNA REGLA QUE NI EL ADMINISTRADOR PUEDE SALTARSE**, y la pantalla la dice en voz alta: el
 * `codigo` de los nueve motivos de la semilla no se cambia y esas filas no se borran, porque es
 * lo que los seis movimientos automáticos resuelven —`WHERE codigo = 'ENTREGA'`—. El nombre y
 * la descripción sí se pueden corregir. Lo impone un disparador de PostgreSQL, así que el campo
 * va deshabilitado en esos nueve en lugar de dejar intentarlo y recibir un 409.
 *
 * SIN BUSCADOR, SIN FILTRO Y SIN PAGINACIÓN: son nueve, y diez el día que se añada uno. Los
 * demás catálogos los llevan porque crecen sin techo; este no.
 */
@Component({
  selector: 'app-motivos-movimiento',
  imports: [ErrorCampo, MotivosMovimientoEsqueleto, PanelLateral, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motivos-movimiento.html',
})
export class MotivosMovimiento {
  private readonly api = inject(ApiCatalogos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly sesion = inject(Sesion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly mal = errorVisible;

  /**
   * Los nueve códigos que los movimientos automáticos resuelven. **La lista está aquí, en el
   * servicio del backend y en el disparador**: tres copias, y es consciente. La del disparador
   * es la que manda; la del servicio da el mensaje; esta solo decide si el campo se deshabilita.
   *
   * Duplicarla es peor que una constante compartida, sí — pero la alternativa era un endpoint
   * que devolviera «¿cuáles son intocables?», y eso es una petición para pintar un `disabled`.
   */
  private static readonly DEL_CONTRATO = new Set([
    'ALTA',
    'ENTREGA',
    'DEVOLUCION',
    'OBRA',
    'REACOMODO',
    'SERVICIO',
    'FALLA',
    'VENTA',
    'OTRO',
  ]);

  protected readonly esAdministrador = computed(
    () => this.sesion.identidad()?.accesoTotal === true,
  );

  /** Fijo. `computed` y no una constante porque el recurso solo repite si su filtro es señal. */
  private readonly filtro = computed<FiltroListado>(() => ({ Numero: 1, Tamano: 50 }));

  private readonly listado = this.api.motivosMovimiento.listado(this.filtro);

  protected readonly motivos = this.listado.filas;
  protected readonly cargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);
  protected readonly editando = signal<MotivoMovimiento | null>(null);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly formulario = this.fb.group({
    codigo: ['', validadorRequerido],
    nombre: ['', validadorRequerido],
    descripcion: [''],
  });

  /** Si el que se está editando es uno de los nueve: su código no se toca. */
  protected readonly codigoBloqueado = computed(() => {
    const enEdicion = this.editando();

    return enEdicion !== null && MotivosMovimiento.DEL_CONTRATO.has(enEdicion.codigo);
  });

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().motivosMovimiento.titulo,
        contexto: t().motivosMovimiento.contexto(this.motivos().length),
        busqueda: null,
        // La acción principal SOLO para el administrador. `alPulsar` y no `ruta`: abre un
        // panel en esta misma pantalla, y anunciar «enlace» para eso miente al lector.
        accion: this.esAdministrador()
          ? { etiqueta: t().motivosMovimiento.crear, alPulsar: () => this.abrirAlta() }
          : null,
      }),
    );
  }

  protected esDelContrato(codigo: string): boolean {
    return MotivosMovimiento.DEL_CONTRATO.has(codigo);
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({ codigo: '', nombre: '', descripcion: '' });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(motivo: MotivoMovimiento): void {
    this.editando.set(motivo);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: motivo.codigo,
      nombre: motivo.nombre,
      descripcion: motivo.descripcion ?? '',
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
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
      codigo: v.codigo.trim().toUpperCase(),
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
    } satisfies AltaMotivoMovimiento;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.motivosMovimiento.editar(enEdicion.id, alta)
      : this.api.motivosMovimiento.crear(alta);

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

  /**
   * Retira o reactiva. **Retirar uno de los nueve se permite**: los movimientos automáticos lo
   * buscan por código sin filtrar por `activo`, así que solo desaparece de los desplegables de
   * la captura manual. Lo que rompería el contrato es cambiar el código o borrar la fila.
   */
  protected async cambiarActivo(motivo: MotivoMovimiento): Promise<void> {
    if (motivo.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().motivosMovimiento.retirar,
        mensaje: t().motivosMovimiento.confirmarRetiro(motivo.nombre),
        confirmar: t().motivosMovimiento.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.motivosMovimiento.cambiarActivo(motivo.id, !motivo.activo).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
