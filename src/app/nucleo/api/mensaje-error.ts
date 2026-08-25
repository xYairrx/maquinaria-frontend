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
