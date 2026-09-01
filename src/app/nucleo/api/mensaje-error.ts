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

    // Un 400 de enlace de modelo llega como ValidationProblemDetails: su `title` es el
    // genérico «One or more validation errors occurred» y lo útil está en `errors`, un
    // diccionario de campo a mensajes.
    //
    // SIN ESTO, ese 400 se ve como una frase que no dice qué campo falló ni por qué, y
    // encima en inglés aunque la interfaz esté en español. Costó un rato de depuración con
    // el `<select>` de unidad: el control mandaba la cadena «1» donde el enum espera un
    // entero, y el servidor lo decía —en `errors.unidad`— mientras la pantalla mostraba el
    // título genérico.
    //
    // Va ANTES que `detail` porque cuando hay `errors` el `detail` no viene.
    const porCampo = detalleDeValidacion(problema);

    return (
      porCampo ??
      traducido(problema) ??
      problema?.detail ??
      problema?.title ??
      t().errores.conCodigo(error.status)
    );
  }

  return t().errores.inesperado;
}

/**
 * El mensaje en el idioma de la interfaz, cuando el servidor manda un código que conocemos.
 *
 * ES LA EXCEPCIÓN A «no traduzcas lo que viene de la API», y no la contradice: lo que se
 * traduce no es el texto del servidor sino un CÓDIGO estable que él emite justamente para
 * esto. La regla existía porque reescribir a ojo los mensajes de login podía deshacer su
 * uniformidad; un código no puede, porque no distingue más de lo que el servidor decidió
 * distinguir — los cinco motivos del rechazo del login comparten uno solo.
 *
 * DEVUELVE `null` PARA LO DESCONOCIDO, y de eso depende que esto no rompa nada: un código
 * nuevo sin traducir cae al `detail` de siempre en lugar de dejar la pantalla muda.
 */
function traducido(problema: DetalleProblema | null): string | null {
  const e = t().errores;

  switch (problema?.codigo) {
    case 'credenciales_incorrectas':
      return e.credencialesIncorrectas;
    case 'servicio_suspendido':
      return e.servicioSuspendido;
    case 'servicio_cancelado':
      return e.servicioCancelado;
    case 'demasiados_intentos':
      // Los segundos vienen aparte del texto, así que la frase se arma aquí. Si faltaran
      // —un servidor viejo— se dice sin número en lugar de enseñar «undefined».
      return problema.segundos === undefined
        ? e.demasiadosIntentos
        : e.demasiadosIntentosEn(problema.segundos);

    // UN SOLO CÓDIGO para las dieciséis entidades, con `entidad` aparte. Un código por
    // cada una habría sido dieciséis constantes en los dos lados para decir lo mismo.
    case 'no_encontrado':
      return e.noExiste(nombreDeEntidad(problema.entidad));

    case 'periodo_obligatorio':
      return e.periodoObligatorio;
    case 'periodo_invertido':
      return e.periodoInvertido;
    case 'liga_no_valida':
      return e.ligaNoValida;
    case 'credenciales_obligatorias':
      return e.credencialesObligatorias;
    case 'archivo_vacio':
      return e.archivoVacio;
    case 'alta_empresa_incompleta':
      return e.altaEmpresaIncompleta;
    case 'estado_no_valido':
      return e.estadoNoValido;

    default:
      return null;
  }
}

/**
 * El nombre de la entidad que no se encontró, en el idioma de la interfaz.
 *
 * Devuelve un genérico cuando la clave no está en el diccionario: una entidad nueva del
 * servidor tiene que dar «no se encontró lo que buscabas» y no una cadena cruda como
 * `orden_compra` metida a media frase.
 */
function nombreDeEntidad(clave: string | undefined): string {
  const nombres: Readonly<Record<string, string>> = t().errores.entidades;

  return (clave === undefined ? undefined : nombres[clave]) ?? t().errores.entidadGenerica;
}

/**
 * Los mensajes de un `ValidationProblemDetails`, aplanados en una línea.
 *
 * No se traducen: los redacta el servidor, igual que el `detail`. Se juntan con «·» en vez
 * de una lista porque esto alimenta un `<p role="alert">` de una sola línea; si algún día
 * hacen falta por campo —para marcar el `<input>` que falló— el sitio de ese cambio es este,
 * no cada pantalla.
 */
function detalleDeValidacion(problema: DetalleProblema | null): string | null {
  const errores = problema?.errors;

  if (errores === undefined || errores === null) {
    return null;
  }

  const mensajes = Object.entries(errores).flatMap(([campo, textos]) =>
    (textos ?? []).map((texto) => (campo === '' ? texto : `${campo}: ${texto}`)),
  );

  return mensajes.length === 0 ? null : mensajes.join(' · ');
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
