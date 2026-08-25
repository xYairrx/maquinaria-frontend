import { Injectable, computed, signal } from '@angular/core';

import type { IdentidadEmpresa, SesionEmpresa } from '../api/contratos';

const LLAVE_TOKEN = 'maquinaria.token';
const LLAVE_REFRESCO = 'maquinaria.refresco';
const LLAVE_EMPRESA = 'maquinaria.empresa';

/**
 * La sesión del usuario de empresa.
 *
 * Guarda en `localStorage` para que un refresco de página no obligue a entrar de nuevo.
 *
 * DECISIÓN PENDIENTE, y hay que decirla en voz alta: `localStorage` es legible por
 * cualquier script que se ejecute en la página, así que un XSS se lleva el token de
 * refresco de 30 días. La alternativa es una cookie `httpOnly` + `SameSite`, que el
 * JavaScript no puede leer, a cambio de tener que manejar CSRF. Para desarrollo esto
 * sirve; antes de producción hay que decidirlo.
 */
@Injectable({ providedIn: 'root' })
export class Sesion {
  private readonly _token = signal<string | null>(localStorage.getItem(LLAVE_TOKEN));
  private readonly _identidad = signal<IdentidadEmpresa | null>(null);

  readonly token = this._token.asReadonly();
  readonly identidad = this._identidad.asReadonly();

  readonly activa = computed(() => this._token() !== null);

  /**
   * El último slug usado, para prellenar el campo "Empresa".
   *
   * Resuelve la fricción de que la persona tenga que recordar el identificador de su
   * empresa cada vez. La liga de invitación lo trae, y de ahí en adelante se recuerda.
   */
  readonly empresaRecordada = signal<string>(localStorage.getItem(LLAVE_EMPRESA) ?? '');

  abrir(sesion: SesionEmpresa): void {
    localStorage.setItem(LLAVE_TOKEN, sesion.token);
    localStorage.setItem(LLAVE_REFRESCO, sesion.tokenRefresco);
    localStorage.setItem(LLAVE_EMPRESA, sesion.empresa);

    this._token.set(sesion.token);
    this.empresaRecordada.set(sesion.empresa);
  }

  establecerIdentidad(identidad: IdentidadEmpresa): void {
    this._identidad.set(identidad);
  }

  cerrar(): void {
    // El slug NO se borra: no es un secreto y recordarlo es la comodidad que se buscaba.
    localStorage.removeItem(LLAVE_TOKEN);
    localStorage.removeItem(LLAVE_REFRESCO);

    this._token.set(null);
    this._identidad.set(null);
  }
}
