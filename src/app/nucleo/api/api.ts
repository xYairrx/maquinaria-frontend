import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject, type Signal } from '@angular/core';

import { configuracion } from '../ambiente/configuracion';
import { esNoEncontrado, mensajeDeErrorDeRecurso } from './mensaje-error';
import type {
  IdentidadEmpresa,
  InvitacionVigente,
  RestablecimientoAplicado,
  RestablecimientoSolicitado,
  SesionEmpresa,
} from './contratos';

/**
 * Lo que una pantalla necesita saber de una liga que viene por correo.
 *
 * Son señales normales, no el recurso: `httpResource` está marcado `@experimental` en
 * Angular y se queda encerrado en este archivo. Ver
 * `docs/convenciones.md#datos-httpresource-y-el-recurso-compartido`.
 */
export interface ConsultaDeLiga<T> {
  /** Lo que devolvió la API, o `undefined` si todavía no hay. **Nunca lanza.** */
  readonly valor: Signal<T | undefined>;
  readonly cargando: Signal<boolean>;
  /** `true` cuando la consulta terminó bien. */
  readonly resuelta: Signal<boolean>;
  readonly error: Signal<string | null>;
  /** El 404: la liga no existe, ya se usó o caducó. El backend no los distingue. */
  readonly noSirve: Signal<boolean>;
}

/** Llamadas a la API. Un método por endpoint, sin lógica. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = configuracion.urlApi;

  /**
   * Consulta la liga de invitación en cuanto haya empresa y token.
   *
   * Es una FÁBRICA y no un recurso del servicio, al contrario que la lista de empresas de
   * `ApiPlataforma`: esto no lo comparte nadie —una pantalla, una liga— y depende de un
   * parámetro que vive en la pantalla. Lo que sí se mantiene es que `httpResource` no salga
   * de aquí.
   *
   * Se llama desde un inicializador de campo del componente, que es contexto de inyección.
   */
  consultaDeInvitacion(empresa: string, token: Signal<string>): ConsultaDeLiga<InvitacionVigente> {
    return this.consultaDeLiga<InvitacionVigente>(() =>
      // Falsy y no `=== ''`: `withComponentInputBinding` pone `undefined` cuando el
      // parametro no esta en la URL, PISANDO el valor por defecto del `input`. Con la
      // comparacion estricta se colaba una peticion a `.../invitaciones/undefined`.
      !empresa || !token()
        ? undefined
        : `${this.base}/api/empresas/${encodeURIComponent(empresa)}` +
          `/invitaciones/${encodeURIComponent(token())}`,
    );
  }

  /**
   * Consulta la liga de restablecimiento. Responde 204 sin cuerpo: lo único que dice es si
   * la liga sirve, y por eso aquí se mira `resuelta` y no `valor`.
   *
   * El backend NO dice a quién pertenece la liga a propósito —una liga adivinada no debe
   * convertirse en una fuente de correos—, así que esta pantalla no puede saludar por el
   * nombre y no lo inventa.
   */
  consultaDeRestablecimiento(empresa: string, token: Signal<string>): ConsultaDeLiga<void> {
    return this.consultaDeLiga<void>(() =>
      // Ver la nota de `consultaDeInvitacion`: falsy, no `=== ''`.
      !empresa || !token()
        ? undefined
        : `${this.base}/api/empresas/${encodeURIComponent(empresa)}` +
          `/restablecimientos/${encodeURIComponent(token())}`,
    );
  }

  /**
   * El armazón de las dos consultas de arriba.
   *
   * `valor` pasa por `hasValue()` y NO por `value()` directo: leer `value()` con el recurso
   * en estado de error **lanza** un `ResourceValueError`, y estas pantallas leen los datos
   * sin comprobar antes el estado.
   */
  private consultaDeLiga<T>(url: () => string | undefined): ConsultaDeLiga<T> {
    const recurso = httpResource<T>(url);

    return {
      valor: computed(() => (recurso.hasValue() ? recurso.value() : undefined)),
      cargando: recurso.isLoading,
      resuelta: computed(() => recurso.status() === 'resolved'),
      error: computed(() => mensajeDeErrorDeRecurso(recurso.error())),
      noSirve: computed(() => esNoEncontrado(recurso.error())),
    };
  }

  aceptarInvitacion(empresa: string, token: string, contrasena: string) {
    return this.http.post<{ correo: string; empresa: string }>(
      `${this.base}/api/empresas/${encodeURIComponent(empresa)}` +
        `/invitaciones/${encodeURIComponent(token)}`,
      { contrasena },
    );
  }

  solicitarRestablecimiento(empresa: string, correo: string) {
    return this.http.post<RestablecimientoSolicitado>(
      `${this.base}/api/empresas/${encodeURIComponent(empresa)}/restablecimientos`,
      { correo },
    );
  }

  restablecerContrasena(empresa: string, token: string, contrasena: string) {
    return this.http.post<RestablecimientoAplicado>(
      `${this.base}/api/empresas/${encodeURIComponent(empresa)}` +
        `/restablecimientos/${encodeURIComponent(token)}`,
      { contrasena },
    );
  }

  iniciarSesion(empresa: string, correo: string, contrasena: string) {
    return this.http.post<SesionEmpresa>(
      `${this.base}/api/empresas/${encodeURIComponent(empresa)}/sesion`,
      { correo, contrasena },
    );
  }

  miSesion() {
    return this.http.get<IdentidadEmpresa>(`${this.base}/api/mi/sesion`);
  }
}
