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
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiPlataforma } from '../../../nucleo/api/api-plataforma';
import { SIN_LIMITE, type TipoLimite } from '../../../nucleo/api/contratos-plataforma';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { t } from '../../../nucleo/i18n/i18n';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { LimitesEsqueleto } from './esqueleto';

/** Mismo patrón que `FormatoClaveLimite` en el backend. Aquí solo da un mensaje decente. */
const PATRON_CLAVE = /^[a-z0-9]([a-z0-9_]*[a-z0-9])?$/;

/** Tope del backend. */
const LARGO_CLAVE = 40;

/**
 * El catálogo de TIPOS de límite: qué límites sabe nombrar el sistema.
 *
 * NO CONFUNDIR CON LOS CUPOS DE UNA EMPRESA, que se ajustan desde su fila en `/empresas`.
 * Aquí se define QUÉ límites existen y cuánto valen por omisión; allá, cuánto le tocó a un
 * cliente concreto.
 *
 * LA ADVERTENCIA QUE ESTA PANTALLA TIENE QUE DAR, y por eso `reconocida` viaja en el
 * contrato: **crear un tipo no crea un límite**. Un límite solo acota cuando hay código que
 * lo lee y bloquea la operación, y ese código busca claves concretas. Un tipo con una clave
 * inventada se puede crear, editar y fijar por empresa, y no va a impedir nada nunca. Si la
 * pantalla no lo dijera, alguien fijaría un cupo confiando en un tope que no existe.
 *
 * Y hoy eso vale para TODOS, incluidos los cuatro reconocidos: todavía no hay ningún caso de
 * uso que lea estos valores. La diferencia es que los reconocidos acotarán cuando se escriba
 * esa verificación, y los inventados no.
 */
@Component({
  selector: 'app-limites',
  imports: [ErrorCampo, LimitesEsqueleto, PanelLateral, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './limites.html',
})
export class Limites {
  private readonly api = inject(ApiPlataforma);
  private readonly barra = inject(Barra);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly sinLimite = SIN_LIMITE;
  protected readonly mal = errorVisible;

  /** Del recurso compartido del servicio, no de un `httpResource` de esta pantalla. */
  protected readonly tipos = this.api.tiposLimite;
  protected readonly cargando = this.api.tiposLimiteCargando;

  protected readonly enviando = signal(false);

  protected readonly panelAbierto = signal(false);

  /**
   * El tipo que se está editando, o `null` si el panel es de alta.
   *
   * Un solo panel para las dos cosas —y no dos— porque los campos son los mismos menos uno:
   * la clave, que al editar se enseña y no se toca.
   */
  protected readonly editando = signal<TipoLimite | null>(null);

  /** El error de lo que la persona acaba de disparar. El de la lista lo trae el recurso. */
  private readonly errorAccion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorAccion() ?? this.api.tiposLimiteError());

  /**
   * Cuántas empresas quedarían afectadas si se mueve el valor por defecto del tipo que se
   * está editando: las que NO tienen excepción propia.
   *
   * No se sabe cuántas empresas hay en total desde aquí, así que se dice al revés —«las que
   * no tengan cupo propio»— en lugar de inventar una resta con un total que esta pantalla no
   * pidió. Es la misma regla del estado vacío: no afirmar sobre lo que no se consultó.
   */
  protected readonly conExcepcion = computed(() => this.editando()?.excepciones ?? 0);

  protected readonly formulario = this.fb.group({
    clave: [
      '',
      [Validators.required, Validators.pattern(PATRON_CLAVE), Validators.maxLength(LARGO_CLAVE)],
    ],
    nombre: ['', Validators.required],
    descripcion: [''],
    unidad: ['', Validators.required],
    // NÚMEROS y no texto: el `NumberValueAccessor` escribe un number en el control —y `null`
    // al vaciarse— se declare como se declare.
    valorDefecto: [SIN_LIMITE as number | null, [Validators.required, Validators.min(SIN_LIMITE)]],
    orden: [0 as number | null, Validators.required],
    activo: [true],
  });

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().limites.titulo,
        contexto: t().limites.contexto(this.tipos().length),
        accion: { etiqueta: t().limites.crear, alPulsar: () => this.abrirAlta() },
      }),
    );
  }

  protected abrirAlta(): void {
    this.errorAccion.set(null);
    this.editando.set(null);

    this.formulario.reset({
      clave: '',
      nombre: '',
      descripcion: '',
      unidad: '',
      // Nace SIN LÍMITE, nunca en cero: un tipo que naciera en cero dejaría a todas las
      // empresas sin poder crear ninguno, de golpe y sin que nadie lo pidiera empresa por
      // empresa. Es el mismo criterio que el inicializador de `TipoLimite` en el dominio.
      valorDefecto: SIN_LIMITE,
      orden: 0,
      activo: true,
    });

    this.formulario.controls.clave.enable();
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(tipo: TipoLimite): void {
    this.errorAccion.set(null);
    this.editando.set(tipo);

    this.formulario.reset({
      clave: tipo.clave,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion,
      unidad: tipo.unidad,
      valorDefecto: tipo.valorDefecto,
      orden: tipo.orden,
      activo: tipo.activo,
    });

    // La clave no se edita: es lo que el código busca para aplicar el límite, así que
    // cambiarla desconectaría la fila de lo único que la hace servir. Se deshabilita en
    // lugar de esconderse, porque es el dato que identifica lo que se está editando.
    this.formulario.controls.clave.disable();
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.enviando();
  }

  /** El valor por defecto, ya legible: «sin límite» no es un número que se pueda enseñar. */
  protected defectoMostrado(tipo: TipoLimite): string {
    return tipo.valorDefecto === SIN_LIMITE
      ? t().limites.sinLimite
      : `${tipo.valorDefecto} ${tipo.unidad}`;
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      return;
    }

    // `getRawValue` y no `value`: al editar, la clave está deshabilitada, y `value` deja
    // fuera los controles deshabilitados. Aquí no hace falta para el PATCH —la clave va en
    // la ruta— pero sí para no leer `undefined` al armar la petición de alta.
    const v = this.formulario.getRawValue();

    // `??` y no `||`: el 0 es un valor válido para los dos, y con `||` se convertiría en el
    // de reemplazo. `Validators.required` ya rechazó el `null` de un campo vacío.
    const valorDefecto = v.valorDefecto ?? SIN_LIMITE;
    const orden = v.orden ?? 0;
    const descripcion = v.descripcion.trim() === '' ? null : v.descripcion.trim();

    this.enviando.set(true);
    this.errorAccion.set(null);

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.editarTipoLimite(enEdicion.clave, {
          nombre: v.nombre,
          descripcion,
          unidad: v.unidad,
          valorDefecto,
          orden,
          activo: v.activo,
        })
      : this.api.crearTipoLimite({
          clave: v.clave,
          nombre: v.nombre,
          descripcion,
          unidad: v.unidad,
          valorDefecto,
          orden,
        });

    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarPanel();
      },
      error: (e: unknown) => {
        this.errorAccion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }
}
