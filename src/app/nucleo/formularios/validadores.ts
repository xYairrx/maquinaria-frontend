import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Las reglas de validación de los datos que se repiten en todo el producto: RFC, teléfono
 * y correo.
 *
 * VIVEN EN `nucleo/` Y NO EN LA PANTALLA, y no es una preferencia de orden: `Cliente` y
 * `Proveedor` llevan RFC y teléfono en el dominio, así que el alta de empresa es el PRIMER
 * sitio que las necesita, no el único. Copiadas en cada pantalla, la copia número tres
 * acaba aceptando lo que las otras dos rechazan — y el desacuerdo se descubre cuando el
 * backend contesta 400.
 *
 * Y son funciones PURAS: no tocan el DOM, no inyectan nada y no saben de formularios. Eso
 * es lo que las hace probables sin navegador (`validadores.spec.ts`), que es donde se fija
 * cada caso raro. Los `ValidatorFn` de abajo son una capa de tres líneas encima.
 *
 * LAS REGLAS SON ESPEJO DE LAS DEL BACKEND. Si cambian allá, cambian aquí, y al revés: una
 * validación de cliente más estricta que la del servidor rechaza datos buenos; una más laxa
 * promete un viaje que acaba en 400.
 */

/**
 * RFC mexicano: 12 caracteres para persona moral y 13 para persona física.
 *
 * Los DOS son válidos, y ninguno de los dos es «el bueno»: 3 letras de razón social + 6 de
 * la fecha + 3 de homoclave para una moral, 4 letras del nombre + los mismos 9 para una
 * física.
 *
 * `Ñ` y `&` NO son un adorno del patrón: son caracteres legítimos de un RFC real —«CAÑA»,
 * «PEMEX & CIA»— y un patrón que solo acepte `A-Z` rechaza empresas que existen. Se pagó
 * ese fallo en otros sistemas; aquí está escrito.
 */
const PATRON_RFC = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;

/**
 * SOLO DÍGITOS. Nada de espacios, `+`, guiones ni paréntesis.
 *
 * Admitía esos cuatro separadores hasta el 2026-08-26, razonando que el formato varía por
 * país. Se cambió por petición expresa, y el argumento nuevo es mejor: guardando
 * «(477) 123 4567» y «4771234567» como valores distintos, el mismo teléfono son dos, y el
 * día que haya que buscar por teléfono o comparar dos fichas no coinciden. El formato es
 * cosa de cómo se PINTA, no de cómo se guarda.
 *
 * El campo de la pantalla FILTRA mientras se escribe, así que a este patrón no debería
 * llegarle nunca un separador desde el formulario. Sigue aquí porque un valor pegado, una
 * importación o cualquier otro cliente sí pueden traerlo.
 */
const PATRON_TELEFONO = /^[0-9]+$/;

/** Mínimo: un número nacional mexicano a diez dígitos. */
const MINIMO_DIGITOS_TELEFONO = 10;

/** Máximo: el tope de E.164, que es el número más largo que puede existir en el mundo. */
const MAXIMO_DIGITOS_TELEFONO = 15;

/**
 * `local@dominio.tld`, y nada más: una sola `@`, algo antes, un dominio con al menos un
 * punto y un TLD de dos letras o más. Sin espacios en ninguna parte.
 *
 * NO es una regex «completa» de RFC 5322, y eso es deliberado: las que lo intentan ocupan
 * media pantalla, nadie las puede leer y siguen estando mal —admiten `a@b`, que es lo que
 * hay que rechazar—. La `@` única sale gratis de `[^\s@]`, que la excluye en las dos mitades.
 *
 * Sustituye a `Validators.email`, que da por bueno `a@b`: un correo sin punto no lo puede
 * entregar ningún servidor de internet, y el correo del administrador es por donde va a
 * llegar su invitación.
 */
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/** Tope de una dirección de correo completa (RFC 5321). Más allá, ningún MTA la acepta. */
export const MAXIMO_LARGO_CORREO = 254;

/**
 * El RFC tal como se valida y se envía: en mayúsculas y sin un solo espacio.
 *
 * Los espacios se quitan TODOS, no solo los de las puntas: quien copia un RFC de un PDF se
 * trae «MAQ 940101 AB1», que es el mismo RFC. Y la normalización va ANTES de validar, o el
 * mismo dato se aceptaría o se rechazaría según cómo se pegó.
 */
export function normalizarRfc(valor: string): string {
  return valor.replace(/\s+/gu, '').toUpperCase();
}

/**
 * El correo tal como se valida y se envía: recortado y en minúsculas.
 *
 * La parte del dominio no distingue mayúsculas y en la práctica ningún proveedor las
 * distingue en la parte local, así que guardar `Admin@Bajio.MX` y `admin@bajio.mx` como dos
 * cuentas distintas sería un fallo esperando su turno.
 */
export function normalizarCorreo(valor: string): string {
  return valor.trim().toLowerCase();
}

/**
 * El teléfono tal como se envía: solo se le recortan las puntas.
 *
 * SOLO RECORTA LAS PUNTAS, y no limpia separadores. Si los limpiara, «477.123.4567» pasaría
 * la validación y «solo números» sería mentira. Quitar lo que alguien PEGA es trabajo de
 * `soloDigitos`, que el campo llama al escribir; esto es la comprobación.
 */
export function normalizarTelefono(valor: string): string {
  return valor.trim();
}

/**
 * Deja solo los dígitos de un texto. Es lo que el CAMPO usa al escribir y al pegar.
 *
 * Va aquí y no en el componente porque es la otra mitad de la misma regla: el patrón dice
 * qué se acepta y esto dice cómo se llega ahí sin que quien captura tenga que borrar a mano
 * lo que pegó. Separadas, una se cambia y la otra no.
 */
export function soloDigitos(valor: string): string {
  return valor.replace(/[^0-9]/gu, '');
}

/**
 * Si un RFC sirve. **Vacío sirve**: el RFC es opcional y una empresa recién dada de alta
 * puede no tenerlo a mano todavía.
 *
 * Normaliza por dentro para que quien la llame no pueda olvidarse de hacerlo.
 */
export function rfcEsValido(valor: string): boolean {
  const rfc = normalizarRfc(valor);

  return rfc === '' || PATRON_RFC.test(rfc);
}

/**
 * Si un teléfono sirve. **Vacío sirve**: también es opcional.
 *
 * Ahora que son solo dígitos, el largo de la cadena ES el conteo de dígitos: con
 * separadores había que contarlos aparte porque no contaban para el largo.
 */
export function telefonoEsValido(valor: string): boolean {
  const telefono = normalizarTelefono(valor);

  if (telefono === '') {
    return true;
  }

  return (
    PATRON_TELEFONO.test(telefono) &&
    telefono.length >= MINIMO_DIGITOS_TELEFONO &&
    telefono.length <= MAXIMO_DIGITOS_TELEFONO
  );
}

/**
 * Si un correo sirve. **Vacío NO sirve**: aquí la ausencia es un correo inválido, y quien
 * quiera tratarla como «todavía no lo ha escrito» tiene `Validators.required` al lado.
 */
export function correoEsValido(valor: string): boolean {
  const correo = normalizarCorreo(valor);

  return correo.length <= MAXIMO_LARGO_CORREO && PATRON_CORREO.test(correo);
}

/** Lo que trae un control de texto, sea `null`, `undefined` o cualquier otra cosa. */
function texto(control: AbstractControl): string {
  return typeof control.value === 'string' ? control.value : '';
}

/**
 * Los tres `ValidatorFn`, que son la envoltura de Angular sobre las funciones de arriba.
 *
 * ponytail: la clave del error (`{ rfc: true }`) no se lee en ninguna parte. Es UN mensaje por
 * campo y no uno por tipo de error, y para estos tres se puede: el mensaje describe la forma
 * completa, así que sirve igual para «vacío», «demasiado corto» y «lleva letras». El día que
 * un campo necesite distinguirlos, el sitio donde mirar es la clave del error.
 */
export const validadorRfc: ValidatorFn = (control): ValidationErrors | null =>
  rfcEsValido(texto(control)) ? null : { rfc: true };

export const validadorTelefono: ValidatorFn = (control): ValidationErrors | null =>
  telefonoEsValido(texto(control)) ? null : { telefono: true };

/**
 * El del correo SÍ deja pasar el vacío, al contrario que `correoEsValido`.
 *
 * Es la convención de Angular y hace falta: de quién es la obligatoriedad lo dice
 * `Validators.required`, y si este también reclamara el vacío el mismo campo tendría dos
 * errores diciendo lo mismo.
 */
export const validadorCorreo: ValidatorFn = (control): ValidationErrors | null => {
  const correo = normalizarCorreo(texto(control));

  return correo === '' || correoEsValido(correo) ? null : { correo: true };
};

/**
 * Obligatorio, pero RECORTANDO. Sustituye a `Validators.required` en los campos de texto
 * libre.
 *
 * `Validators.required` da por bueno `'   '`, así que un campo de espacios pasaba el cliente
 * y lo rechazaba el servidor con un «Datos incompletos» genérico: un viaje de ida y vuelta
 * para no decir cuál de los cuatro campos falta, cuando el mensaje podía estar debajo del
 * campo desde el primer momento.
 *
 * Devuelve la clave `required` a propósito y no una nueva: es la que Angular ya usa y la que
 * cualquier plantilla existente comprueba.
 */
export const validadorRequerido: ValidatorFn = (control): ValidationErrors | null =>
  texto(control).trim() === '' ? { required: true } : null;
