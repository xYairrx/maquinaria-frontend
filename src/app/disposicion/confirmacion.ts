import { Injectable, signal } from '@angular/core';

/** Lo que se le pregunta a la persona antes de una acción que no quiere deshacer. */
export interface PeticionConfirmacion {
  readonly titulo: string;

  /**
   * El porqué, no la repetición del título. «Deja de ofrecerse al capturar un equipo» dice
   * qué cambia; «¿estás seguro?» no dice nada y obliga a decidir a ciegas.
   */
  readonly mensaje: string;

  /**
   * La etiqueta del botón que confirma. **Es un verbo, no «Aceptar»**: leer «Retirar» dice
   * qué va a pasar aunque no se haya leído el texto, que es como se usa un diálogo de
   * verdad.
   */
  readonly confirmar: string;

  /** Pinta el botón de confirmar en rojo. Para lo que destruye o retira. */
  readonly peligro?: boolean;
}

/**
 * Preguntar antes de una acción irreversible, sin el `confirm()` del navegador.
 *
 * POR QUÉ NO `confirm()`, que es lo que había:
 *
 * - **Ignora el idioma de la aplicación.** Sus botones salen en el del navegador, así que
 *   alguien con la interfaz en español ve «OK / Cancel». El diccionario de este proyecto no
 *   puede alcanzarlos.
 * - **No se puede estilizar.** Rompe el sistema de diseño en el único momento en que la
 *   persona está a punto de romper algo.
 * - **Bloquea el hilo.** Detiene el renderizado y las animaciones mientras está abierto.
 * - **No distingue lo destructivo de lo neutro.** «Retirar una marca» y «Guardar cambios»
 *   se ven idénticos.
 *
 * CÓMO SE USA, y es el mismo reemplazo que `confirm()`, línea por línea:
 *
 * ```ts
 * const sigue = await this.confirmacion.pedir({
 *   titulo: t().marcas.retirar,
 *   mensaje: t().marcas.confirmarRetiro(marca.nombre),
 *   confirmar: t().marcas.retirar,
 *   peligro: true,
 * });
 *
 * if (!sigue) return;
 * ```
 *
 * El servicio guarda la petición; quien la dibuja es `<app-dialogo-confirmacion />`, que
 * los dos armazones montan una sola vez. Mismo reparto que `Barra`: el estado en un
 * servicio, el marcado en el armazón, y la pantalla no dibuja nada.
 */
@Injectable({ providedIn: 'root' })
export class Confirmacion {
  private readonly _peticion = signal<PeticionConfirmacion | null>(null);

  /** La pregunta abierta, o `null`. La lee el diálogo. */
  readonly peticion = this._peticion.asReadonly();

  /**
   * Quién espera la respuesta.
   *
   * No es una señal porque no lo lee nadie de forma reactiva: es el cabo suelto de la
   * promesa que hay que atar exactamente una vez.
   */
  private resolver?: (respuesta: boolean) => void;

  /** Pregunta, y resuelve a `true` solo si la persona confirmó. */
  pedir(peticion: PeticionConfirmacion): Promise<boolean> {
    // Si ya había una abierta, se responde que NO antes de sustituirla. Dejarla colgada
    // filtraría una promesa que nunca se resuelve, y quien la esperaba se quedaría con su
    // botón en «Guardando…» para siempre.
    this.resolver?.(false);

    this._peticion.set(peticion);

    return new Promise<boolean>((resolver) => {
      this.resolver = resolver;
    });
  }

  /**
   * Cierra y responde. Lo llaman los dos botones, Escape y el clic en el velo.
   *
   * El resolver se limpia ANTES de invocarlo: si el código que espera volviera a pedir una
   * confirmación dentro del mismo turno, encontraría el cabo ya soltado en lugar de que
   * `pedir` lo resolviera otra vez en `false`.
   */
  responder(respuesta: boolean): void {
    this._peticion.set(null);

    const resolver = this.resolver;
    this.resolver = undefined;
    resolver?.(respuesta);
  }
}
