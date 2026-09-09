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
import { ApiSeguridad } from '../../../nucleo/api/api-seguridad';
import type { Rol } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { nombreModulo, t } from '../../../nucleo/i18n/i18n';
import { RolesEsqueleto } from './esqueleto';

/**
 * Roles y permisos: qué puede hacer cada quien.
 *
 * **LA MATRIZ SE MANDA COMPLETA, no como «agrega esta, quita aquella».** Es un reemplazo: lo
 * que no venga se quita. Eso la vuelve idempotente y evita que dos personas editando a la vez
 * se dejen a medias — la última en guardar manda un estado completo, no un delta contra algo
 * que ya cambió.
 *
 * **EL ROL CON ACCESO TOTAL SE VE Y NO SE TOCA.** Aparece el primero porque es el que explica a
 * los demás, con su matriz vacía y un aviso: **vacía no significa que no pueda nada**, significa
 * que no le hacen falta permisos porque salta la verificación. Sus tres acciones —editar,
 * permisos, borrar— no se dibujan; el servidor las rechaza y un disparador de la base las
 * rechaza otra vez.
 *
 * **UN ROL DE SISTEMA SE RENOMBRA PERO NO SE BORRA.** Son la semilla que toda base nueva trae:
 * borrarlos aquí dejaría a esta empresa con una lista distinta de la de una recién
 * aprovisionada, y nada lo volvería a igualar.
 */
@Component({
  selector: 'app-roles',
  imports: [ErrorCampo, PanelLateral, ReactiveFormsModule, RolesEsqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './roles.html',
})
export class Roles {
  private readonly api = inject(ApiSeguridad);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly mal = errorVisible;
  protected readonly nombreModulo = nombreModulo;

  private readonly lista = this.api.roles();

  protected readonly roles = this.lista.roles;
  protected readonly cargando = computed(() => this.lista.cargando() && this.roles().length === 0);

  private readonly catalogo = this.api.catalogoPermisos();

  /**
   * Los 174 permisos agrupados por módulo, **con sus claves ya extraídas**.
   *
   * El `claves` precalculado no es una optimización cosmética: la casilla «todo el módulo»
   * pregunta si todas están marcadas, y hacer `permisos.map(p => p.clave)` en la plantilla
   * crearía 29 arreglos nuevos en CADA pase de detección de cambios — y además rompería
   * cualquier `track` por identidad.
   */
  protected readonly bloques = computed(() =>
    this.catalogo().map((m) => ({
      modulo: m.modulo,
      permisos: m.permisos,
      claves: m.permisos.map((p) => p.clave),
    })),
  );

  protected readonly enviando = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.lista.error());

  protected readonly panelAbierto = signal(false);
  protected readonly editando = signal<Rol | null>(null);

  /** El rol cuya matriz se está editando. Su propio panel, mucho más grande. */
  protected readonly matrizDe = signal<Rol | null>(null);

  /**
   * Las claves marcadas en la matriz que se está editando.
   *
   * Un `Set` en una señal: la comprobación «¿está marcada?» se hace 174 veces por pase de
   * detección de cambios, y con un arreglo eso es una búsqueda lineal cada vez.
   */
  protected readonly marcadas = signal<ReadonlySet<string>>(new Set());

  protected readonly formulario = this.fb.group({
    codigo: ['', validadorRequerido],
    nombre: ['', validadorRequerido],
    descripcion: [''],
  });

  protected readonly contexto = computed(() => t().roles.contexto(this.roles().length));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().roles.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: { etiqueta: t().roles.crear, alPulsar: () => this.abrirAlta() },
      }),
    );
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.enviando();
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({ codigo: '', nombre: '', descripcion: '' });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(rol: Rol): void {
    this.editando.set(rol);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: rol.codigo,
      nombre: rol.nombre,
      descripcion: rol.descripcion ?? '',
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
      codigo: v.codigo.trim().toLowerCase(),
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
    };

    const enEdicion = this.editando();

    const peticion =
      enEdicion === null ? this.api.crearRol(alta) : this.api.editarRol(enEdicion.id, alta);

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

  protected abrirMatriz(rol: Rol): void {
    this.matrizDe.set(rol);
    this.marcadas.set(new Set(rol.permisos));
    this.errorMutacion.set(null);
  }

  protected cerrarMatriz(): void {
    this.matrizDe.set(null);
  }

  protected estaMarcada(clave: string): boolean {
    return this.marcadas().has(clave);
  }

  protected alternar(clave: string): void {
    this.marcadas.update((actuales) => {
      const copia = new Set(actuales);

      if (!copia.delete(clave)) {
        copia.add(clave);
      }

      return copia;
    });
  }

  /** Marca o desmarca un módulo entero. Con 29 módulos × 6, a mano sería inusable. */
  protected alternarModulo(claves: readonly string[]): void {
    const todas = claves.every((c) => this.marcadas().has(c));

    this.marcadas.update((actuales) => {
      const copia = new Set(actuales);

      for (const clave of claves) {
        if (todas) {
          copia.delete(clave);
        } else {
          copia.add(clave);
        }
      }

      return copia;
    });
  }

  protected moduloCompleto(claves: readonly string[]): boolean {
    return claves.length > 0 && claves.every((c) => this.marcadas().has(c));
  }

  protected guardarMatriz(): void {
    const rol = this.matrizDe();

    if (rol === null) {
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    this.api.actualizarPermisos(rol.id, { claves: [...this.marcadas()] }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarMatriz();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  /**
   * Borra un rol propio. **Pregunta antes**: quien lo tuviera pierde lo que concedía, y no
   * hay deshacer.
   */
  protected async eliminar(rol: Rol): Promise<void> {
    const sigue = await this.confirmacion.pedir({
      titulo: t().roles.eliminar,
      mensaje: t().roles.confirmarBorrado(rol.nombre),
      confirmar: t().roles.eliminar,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    this.errorMutacion.set(null);

    this.api.eliminarRol(rol.id).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
