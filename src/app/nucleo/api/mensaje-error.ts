import { HttpErrorResponse } from '@angular/common/http';

import type { DetalleProblema } from './contratos';

/**
 * Saca un mensaje mostrable de un error HTTP.
 *
 * La API responde `ProblemDetails` en todos sus errores, así que `detail` es el texto
 * que ya está pensado para leerse. Se usa ese y NO se inventa uno propio: los mensajes
 * de login son deliberadamente uniformes —"Empresa, correo o contraseña incorrectos"—
 * y reescribirlos aquí podría deshacer esa uniformidad sin darse cuenta.
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No se pudo contactar al servidor. Revisa que la API esté levantada.';
    }

    const problema = error.error as DetalleProblema | null;

    return problema?.detail ?? problema?.title ?? `Error ${error.status}.`;
  }

  return 'Ocurrió un error inesperado.';
}
