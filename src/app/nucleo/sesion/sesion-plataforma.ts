import { Injectable, computed, signal } from '@angular/core';

import type { IdentidadPlataforma, SesionPlataforma } from './contratos-plataforma';

const LLAVE_TOKEN = 'maquinaria.plataforma.token';

/**
 * La sesión del superadministrador.
 *
 * SEPARADA de la sesión de empresa, con su propia llave de almacenamiento. No es
 * duplicación: son dos poblaciones distintas con dos audiencias de JWT distintas, y
 * guardarlas en la misma llave permitiría que un token se mandara al ámbito
 * equivocado. Mezclarlas sería deshacer en el cliente la separación que el backend
 * mantiene a propósito.
 *
 * Además, se puede tener las dos abiertas a la vez —dar de alta una empresa y entrar
 * a ella para revisarla— y eso solo funciona si no se pisan.
 */
@Injectable({ providedIn: 'root' })
export class SesionPlataformaStore {
  private readonly _token = signal<string | null>(localStorage.getItem(LLAVE_TOKEN));
  private readonly _identidad = signal<IdentidadPlataforma | null>(null);

  readonly token = this._token.asReadonly();
  readonly identidad = this._identidad.asReadonly();
  readonly activa = computed(() => this._token() !== null);

  abrir(sesion: SesionPlataforma): void {
    localStorage.setItem(LLAVE_TOKEN, sesion.token);
    this._token.set(sesion.token);
    this._identidad.set({ id: '', correo: sesion.correo, nombre: sesion.nombre });
  }

  establecerIdentidad(identidad: IdentidadPlataforma): void {
    this._identidad.set(identidad);
  }

  cerrar(): void {
    localStorage.removeItem(LLAVE_TOKEN);
    this._token.set(null);
    this._identidad.set(null);
  }
}
