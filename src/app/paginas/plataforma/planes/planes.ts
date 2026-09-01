import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiPlataforma } from '../../../nucleo/api/api-plataforma';
import type { ResumenPlan } from '../../../nucleo/api/contratos-plataforma';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { idioma, nombreModulo, t } from '../../../nucleo/i18n/i18n';
import { PlanesEsqueleto } from './esqueleto';

/** Mismo patron que `FormatoCodigoPlan` en el backend. Aqui solo da un mensaje decente. */
const PATRON_CODIGO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Tope del backend. */
const LARGO_CODIGO = 40;

/**
 * El catalogo comercial: los planes y el formulario para crear uno.
 *
 * LA REGLA QUE GOBIERNA ESTA PANTALLA: un plan ES su conjunto de modulos. No es un paquete
 * de cupos —los cupos cuelgan de la empresa, en `tenant_limite`— asi que aqui no hay ni un
 * campo de «maximo de equipos». Meterlo contradiria el modelo, y esta escrito asi en el
 * dominio: «LOS MODULOS SON LA DEFINICION DEL PLAN».
 *
 * Y NO SE PUEDE EDITAR, que es lo que mas extraña al llegar. Dos razones, las dos del
 * modelo: la suscripcion no guarda importe —solo apunta al plan— asi que cambiar el precio
 * reescribiria lo que pagaron los suscriptores anteriores; y quitar un modulo se lo quita a
 * todos, retroactivamente. Lo que si se puede es retirar un plan y crear su sucesor. La
 * pantalla lo dice en voz alta en lugar de dejar a quien llega buscando el boton.
 */
@Component({
  selector: 'app-planes',
  imports: [CurrencyPipe, PanelLateral, PlanesEsqueleto, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planes.html',
})
export class Planes {
  private readonly api = inject(ApiPlataforma);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly locale = idioma;
  protected readonly nombreDeModulo = nombreModulo;

  /** Del recurso compartido: lo mismo que lee el selector de plan del alta de empresa. */
  protected readonly planes = this.api.planes;
  protected readonly modulos = this.api.modulos;

  protected readonly cargando = computed(
    () => this.api.planesCargando() || this.api.modulosCargando(),
  );

  protected readonly enviando = signal(false);

  /**
   * Si el panel del formulario esta abierto. El `<dialog>`, el velo y el cierre los maneja
   * `app-panel-lateral`; aqui solo se dice cuando se ve.
   */
  protected readonly panelAbierto = signal(false);

  /** El error de CREAR. El de la lista lo trae el recurso. */
  private readonly errorCrear = signal<string | null>(null);

  /** Con el de crear por delante: es el que acaba de provocar la persona. */
  protected readonly error = computed(() => this.errorCrear() ?? this.api.planesError());

  /**
   * Los modulos elegidos, como conjunto y no como 26 controles de formulario.
   *
   * Un `FormArray` de veintiseis booleanos obligaria a mantener el orden alineado con el
   * catalogo que llega de la API, y a reconstruirlo si el catalogo cambia. Un conjunto de
   * claves no tiene ese problema y es lo que el contrato pide de todos modos.
   */
  private readonly elegidos = signal<ReadonlySet<string>>(new Set());

  protected readonly totalElegidos = computed(() => this.elegidos().size);

  protected readonly formulario = this.fb.group({
    codigo: [
      '',
      [Validators.required, Validators.pattern(PATRON_CODIGO), Validators.maxLength(LARGO_CODIGO)],
    ],
    nombre: ['', Validators.required],
    descripcion: [''],
    // NUMEROS, no texto: el `NumberValueAccessor` de un `<input type="number">` escribe un
    // number en el control —y `null` si se vacia—, se declare como se declare. `required`
    // cubre ese `null`; declararlos como texto seguiria siendo mentira.
    precioMensual: [0 as number | null, [Validators.required, Validators.min(0)]],
    moneda: ['MXN', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    orden: [0 as number | null, Validators.required],
  });

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().planes.titulo,
        contexto: t().planes.contexto(this.planes().length),
        // La accion de la barra ya no navega: abre el panel. De ahi que `AccionBarra` admita
        // `alPulsar` y el armazon pinte un `<button>` en lugar de un `<a>`.
        accion: { etiqueta: t().planes.crear, alPulsar: () => this.abrirPanel() },
      }),
    );
  }

  protected abrirPanel(): void {
    this.errorCrear.set(null);
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected estaElegido(clave: string): boolean {
    return this.elegidos().has(clave);
  }

  protected alternarModulo(clave: string): void {
    this.elegidos.update((actual) => {
      const siguiente = new Set(actual);

      if (!siguiente.delete(clave)) {
        siguiente.add(clave);
      }

      return siguiente;
    });
  }

  protected elegirTodos(): void {
    this.elegidos.set(new Set(this.modulos().map((m) => m.clave)));
  }

  protected elegirNinguno(): void {
    this.elegidos.set(new Set());
  }

  /** Los modulos de un plan, con su nombre traducido y en orden alfabetico del idioma. */
  protected modulosDe(plan: ResumenPlan): readonly string[] {
    return plan.modulos
      .map((clave) => nombreModulo(clave))
      .sort((a, b) => a.localeCompare(b, idioma()));
  }

  protected puedeEnviar(): boolean {
    // El conjunto de modulos NO esta en el formulario, asi que su validez se comprueba
    // aparte: sin esto se podria enviar un plan vacio, que el backend rechaza igual pero
    // despues de un viaje.
    return this.formulario.valid && this.totalElegidos() > 0 && !this.enviando();
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorCrear.set(null);

    const v = this.formulario.getRawValue();

    this.api
      .crearPlan({
        codigo: v.codigo,
        nombre: v.nombre,
        // Cadena vacia va como null: en la base la columna es nullable, y guardar ''
        // significaria «capturado y vacio», que es otra cosa.
        descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
        precioMensual: v.precioMensual ?? 0,
        moneda: v.moneda.toUpperCase(),
        orden: Math.trunc(v.orden ?? 0),
        modulos: [...this.elegidos()],
      })
      .subscribe({
        next: () => {
          // Sin recargar a mano: `crearPlan` refresca el recurso compartido, asi que la
          // lista de aqui y el selector del alta de empresa se actualizan solos.
          this.formulario.reset({ precioMensual: 0, moneda: 'MXN', orden: 0 });
          this.elegirNinguno();
          this.enviando.set(false);
          this.cerrarPanel();
        },
        error: (e: unknown) => {
          this.errorCrear.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  protected async alternarActivo(plan: ResumenPlan): Promise<void> {
    // Se pregunta solo al RETIRAR: reactivar no le quita nada a nadie.
    //
    // Ya no con `confirm()`: ignoraba el idioma elegido —sus botones salen en el del
    // navegador—, no se podía estilizar y bloqueaba el hilo. Ver `disposicion/confirmacion.ts`.
    if (plan.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().planes.retirar,
        mensaje: t().planes.confirmarRetiro(plan.codigo),
        confirmar: t().planes.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorCrear.set(null);

    this.api.cambiarActivoDePlan(plan.codigo, !plan.activo).subscribe({
      error: (e: unknown) => this.errorCrear.set(mensajeDeError(e)),
    });
  }
}
