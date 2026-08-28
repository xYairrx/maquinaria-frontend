/**
 * La frontera entre un `<input type="datetime-local">` y un `timestamptz` de la base.
 *
 * HAY QUE CRUZARLA A MANO, Y EN LOS DOS SENTIDOS. El campo entrega **hora de pared local**
 * —`2026-09-01T08:00`, sin zona— y la columna guarda un **instante**. Son cosas distintas, y
 * confundirlas no da un error: da un dato corrido varias horas.
 *
 * DOS COSAS SE ROMPEN SI SE MANDA EL TEXTO TAL CUAL:
 *
 * 1. **Npgsql lo RECHAZA.** `System.Text.Json` lee `"2026-09-01T08:00"` como un `DateTime` con
 *    `Kind=Unspecified`, y Npgsql solo escribe `Kind=Utc` en un `timestamptz`. La excepción no
 *    es una violación de restricción, así que no la atrapa el `catch` del servicio y el endpoint
 *    responde **500**. Pasó al crear la primera renta.
 * 2. **Y pegarle una `Z` al final tampoco vale**, que es el atajo que usan Traspasos y el alta de
 *    precio. Ahí funciona porque el campo es `date` y la hora es arbitraria —medianoche vale—.
 *    Aquí NO: la hora es el dato. Con `Z`, alguien en México capturando las 08:00 guardaría las
 *    08:00 UTC, que son las 02:00 locales, y el `EXCLUDE` del calendario compararía instantes
 *    equivocados. Seis horas de corrimiento en la garantía que sostiene la fase.
 *
 * La conversión correcta la hace el navegador, que sí sabe en qué zona está: `new Date(texto)`
 * interpreta la hora de pared en la zona LOCAL, y `toISOString()` la vuelve el instante real.
 *
 * **LIMITACIÓN CONOCIDA: la zona es la del NAVEGADOR, no la de la empresa.** `tenant.zona_horaria`
 * existe en la base central y todavía no se usa en ningún cálculo. Mientras la operación esté en
 * un solo huso da igual; el día que un capturista en Tijuana registre la renta de una máquina en
 * Cancún, este es el archivo que hay que cambiar.
 */

/**
 * Hora de pared local → instante ISO en UTC, listo para el servidor.
 *
 * Devuelve `null` para el campo vacío, que es lo que un `<input type="datetime-local">` entrega
 * cuando no se llenó y lo que el servidor espera para «no hay fecha».
 */
export function aInstante(local: string): string | null {
  if (local.trim() === '') {
    return null;
  }

  const fecha = new Date(local);

  // `new Date('cualquier cosa')` no lanza: devuelve una fecha inválida cuyo `getTime()` es NaN,
  // y `toISOString()` sobre ella SÍ lanza. El navegador no deja escribir basura en el campo,
  // pero el valor también puede venir de un `reset()` mal escrito.
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

/**
 * Instante ISO del servidor → lo que espera un `<input type="datetime-local">`.
 *
 * El camino de vuelta, para editar. **No es `iso.slice(0, 16)`**: eso corta el texto UTC y lo
 * enseña como si fuera local, así que un instante guardado a las 14:00 UTC aparecería como
 * «14:00» en un campo que significa hora local — el mismo corrimiento del otro lado.
 *
 * Se construye a mano en vez de con `toISOString()` porque ese siempre devuelve UTC; lo que hace
 * falta aquí son los componentes LOCALES.
 */
export function aCampoLocal(iso: string): string {
  const fecha = new Date(iso);

  if (Number.isNaN(fecha.getTime())) {
    return '';
  }

  const dos = (n: number) => String(n).padStart(2, '0');

  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`
  );
}
