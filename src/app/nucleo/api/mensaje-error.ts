import { HttpErrorResponse } from '@angular/common/http';

import { t } from '../i18n/i18n';
import type { DetalleProblema } from './contratos';

/**
 * Saca un mensaje mostrable de un error HTTP.
 *
 * La API responde `ProblemDetails` en todos sus errores, así que `detail` es el texto
 * que ya está pensado para leerse. Se usa ese y NO se inventa uno propio: los mensajes
 * de login son deliberadamente uniformes —"Empresa, correo o contraseña incorrectos"—
 * y reescribirlos aquí podría deshacer esa uniformidad sin darse cuenta.
 *
 * SOLO SE TRADUCE LO QUE ES NUESTRO: los tres textos de abajo se generan aquí, así que
 * viven en el diccionario. El `detail` del servidor se sigue mostrando tal cual, y hoy
 * llega siempre en español —la API no lee `Accept-Language`—. Es la costura visible de
 * esta primera versión del inglés, y arreglarla es trabajo de backend, no de aquí.
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return t().errores.sinServidor;
    }

    const problema = error.error as DetalleProblema | null;

    return problema?.detail ?? problema?.title ?? t().errores.conCodigo(error.status);
  }

  return t().errores.inesperado;
}

/**
 * Lo mismo, pero para el error de un `Resource`, y `null` si no hay error.
 *
 * Existe porque `Resource.error` está tipado como `Error` y Angular **envuelve** lo que no
 * sea «parecido a un error», dejando el original en `cause`. Un `HttpErrorResponse` pasa tal
 * cual —tiene `name` y `message`, que es lo que mira su `isErrorLike`—, pero se desenvuelve
 * igual: son dos líneas y así esto no depende de un detalle interno de una API que Angular
 * marca como experimental. Sin desenvolver, un error envuelto perdería el `detail` del
 * `ProblemDetails` y se vería como «Ocurrió un error inesperado».
 */
export function mensajeDeErrorDeRecurso(error: Error | undefined): string | null {
  return error === undefined ? null : mensajeDeError(desenvolver(error));
}

/**
 * Si el error de un `Resource` es un 404.
 *
 * Importa donde el 404 significa algo distinto de «falló la red»: en las ligas de
 * invitación y de restablecimiento, un 404 dice que la liga no sirve —no existe, ya se usó o
 * caducó, y el backend no los distingue a propósito— mientras que cualquier otro código es
 * un fallo de transporte que no dice NADA de la liga.
 */
export function esNoEncontrado(error: Error | undefined): boolean {
  if (error === undefined) {
    return false;
  }

  const real = desenvolver(error);

  return real instanceof HttpErrorResponse && real.status === 404;
}

function desenvolver(error: Error): unknown {
  return error.cause ?? error;
}
