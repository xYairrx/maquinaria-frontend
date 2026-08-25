import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { type Observable, catchError, finalize, map, shareReplay, throwError } from 'rxjs';

import { Api } from '../api/api';
import { Sesion } from './sesion';

/**
 * El refresco del token de acceso, **serializado**.
 *
 * ESTA CLASE EXISTE POR UNA SOLA RAZÓN: que nunca haya dos refrescos en vuelo. El token
 * de refresco ROTA y no tiene ventana de gracia, así que dos peticiones que caducan a la
 * vez canjearían el MISMO token; el backend lee el segundo canje como reuso de token
 * robado y **revoca toda la cadena de sesiones del usuario**. Un refresco sin serializar
 * no degrada la experiencia: echa a la calle a quien estaba trabajando.
 *
 * La serialización es `enVuelo` + `shareReplay`, y las dos mitades hacen falta:
 *
 * - **`enVuelo`** hace que la segunda petición reciba el MISMO observable que la primera,
 *   en vez de crear otro.
 * - **`shareReplay`** hace que ese observable comparta UNA suscripción. Sin él no
 *   serviría de nada: los observables de `HttpClient` son fríos, así que cada quien que
 *   se suscribiera al «mismo» observable dispararía su propia petición POST. Es
 *   exactamente el fallo que se está evitando, y se ve igual en el código.
 *
 * `finalize` va ANTES de `shareReplay` a propósito: así se ejecuta una vez, al terminar
 * la fuente, y no una vez por suscriptor. Es lo que libera `enVuelo` para que el
 * siguiente 401 —que ya tendrá el token rotado— pueda pedir un refresco nuevo.
 *
 * Y `refCount: false` tampoco es un adorno: con `true`, la petición que se cancela
 * —porque su pantalla se destruyó— desmontaría el refresco A MEDIAS, cuando el backend ya
 * rotó el token pero la respuesta no llegó a guardarse. El siguiente refresco iría con el
 * token viejo, o sea con el que el backend ya considera canjeado: revocación de toda la
 * cadena. Con `false` el canje se termina siempre y lo que se guarda es lo que se emitió.
 *
 * Es solo para la sesión de EMPRESA. El backend no tiene `sesion_refresh` para la
 * plataforma; ver `interceptor-refresco.ts`.
 */
@Injectable({ providedIn: 'root' })
export class RefrescoSesion {
  private readonly api = inject(Api);
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);

  /** El refresco en curso, o `null` si no hay ninguno. */
  private enVuelo: Observable<string> | null = null;

  /** El token de acceso nuevo. Todas las peticiones que esperan reciben el mismo. */
  refrescar(): Observable<string> {
    if (this.enVuelo !== null) {
      return this.enVuelo;
    }

    const datos = this.sesion.datosDeRefresco();

    // Token de acceso sin token de refresco: no hay nada que canjear, y quedarse
    // reintentando contra un 401 eterno es peor que mandar a entrar de nuevo.
    if (datos === null) {
      this.terminarSesion();

      return throwError(() => new Error('Sesión sin token de refresco.'));
    }

    this.enVuelo = this.api.refrescarSesion(datos.empresa, datos.tokenRefresco).pipe(
      map((sesion) => {
        // Guardar el token de refresco NUEVO no es opcional: el canje revocó el viejo.
        this.sesion.abrir(sesion);

        return sesion.token;
      }),
      catchError((error: unknown) => {
        // ANTE UN FALLO AQUÍ NO HAY REINTENTO POSIBLE. El 401 tapa seis motivos
        // —inexistente, caducado, revocado, reusado, usuario inactivo, empresa que no
        // puede operar— y ninguno se arregla volviéndolo a pedir. Cualquier otro código
        // tampoco: sin token de acceso vigente no hay nada que hacer con la sesión.
        //
        // Esto corre UNA vez aunque haya diez peticiones esperando, porque está en la
        // cadena de la fuente y no en la de cada suscriptor: de ahí que se limpie y se
        // navegue una sola vez.
        this.terminarSesion();

        // El error se propaga a quien esperaba: cada petición tiene que fallar de verdad
        // para que su pantalla salga de «enviando». Los avisos que pudieran pintar se los
        // lleva la navegación al acceso, que ya está en curso.
        return throwError(() => error);
      }),
      finalize(() => (this.enVuelo = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.enVuelo;
  }

  private terminarSesion(): void {
    this.sesion.cerrar();

    // `expirada=1` sigue el patrón de `?activada=1` y `?restablecida=1`, y la pantalla
    // de acceso ya lo pinta: `entrarEmpresa.expirada` en los dos idiomas. Sin ese aviso
    // la persona volvía al acceso sin explicación y lo leía como que algo se rompió.
    void this.router.navigate(['/entrar'], { queryParams: { expirada: 1 } });
  }
}
