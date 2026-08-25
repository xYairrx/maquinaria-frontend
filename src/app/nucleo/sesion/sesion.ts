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
   * Guarda una sesión recién emitida.
   *
   * La usan el login Y el refresco: la respuesta de `/sesion/refresco` tiene la misma
   * forma, y el `tokenRefresco` que trae SUSTITUYE al anterior —el canje revoca el viejo
   * en la misma operación—, así que escribirlo no es opcional. La identidad no se toca:
   * el refresco no la cambia y volver a pedirla en cada renovación sería una petición de
   * más.
   */
  abrir(sesion: SesionEmpresa): void {
    localStorage.setItem(LLAVE_TOKEN, sesion.token);
    localStorage.setItem(LLAVE_REFRESCO, sesion.tokenRefresco);
    localStorage.setItem(LLAVE_EMPRESA, sesion.empresa);

    this._token.set(sesion.token);
  }

  /**
   * Lo que hace falta para pedir un refresco, o `null` si falta algo.
   *
   * Los dos datos vienen de la respuesta del login y se leen del almacenamiento en el
   * momento de pedir el refresco, nunca de una copia en memoria: el token de refresco
   * ROTA en cada canje, y una copia vieja sería exactamente el «reuso de token robado»
   * que el backend castiga revocando toda la cadena de sesiones.
   *
   * El slug sale de la sesión y no del subdominio (`tenantActual()`) porque es el que la
   * API contestó al abrirla; el subdominio ya decidió a qué empresa se entró.
   *
   * ponytail: no es una señal —nada de la interfaz lo pinta— así que se lee directo.
   */
  datosDeRefresco(): { readonly empresa: string; readonly tokenRefresco: string } | null {
    const tokenRefresco = localStorage.getItem(LLAVE_REFRESCO);
    const empresa = localStorage.getItem(LLAVE_EMPRESA);

    return tokenRefresco === null || empresa === null ? null : { empresa, tokenRefresco };
  }

  establecerIdentidad(identidad: IdentidadEmpresa): void {
    this._identidad.set(identidad);
  }

  cerrar(): void {
    // El slug NO se borra: lo usa el subdominio, no una preferencia del usuario.
    localStorage.removeItem(LLAVE_TOKEN);
    localStorage.removeItem(LLAVE_REFRESCO);

    this._token.set(null);
    this._identidad.set(null);
  }
}
