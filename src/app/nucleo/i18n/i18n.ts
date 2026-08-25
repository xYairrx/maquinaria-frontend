import { computed, signal } from '@angular/core';

import { TEXTOS, type CodigoIdioma, type Textos } from './textos';

/**
 * El idioma elegido y los textos que le corresponden.
 *
 * Es un MÓDULO y no un servicio inyectable, igual que `sitio.ts`, `configuracion.ts` y
 * `tenant.ts`: el idioma es estado de la aplicación entera, no de un árbol de
 * inyección, y así `mensaje-error.ts` —que es una función suelta, no un servicio—
 * puede traducir sin que cada quien que la llame tenga que pasarle nada.
 *
 * Para usarlo en una plantilla, el componente expone `protected readonly t = t;` y la
 * plantilla escribe `t().seccion.clave`. Angular no puede llamar a una función
 * importada desde el marcado, así que el miembro es obligatorio.
 */

/** Llave de `localStorage`. Mismo prefijo que las de sesión. */
const CLAVE = 'maquinaria.idioma';

/** El español es el idioma del producto: si no hay nada guardado, es este. */
const PREDETERMINADO: CodigoIdioma = 'es-MX';

export interface Idioma {
  readonly codigo: CodigoIdioma;
  /** Lo que se enseña plegado: dos letras. */
  readonly corto: string;
  /** El nombre en su propio idioma, como manda la convención de los selectores. */
  readonly nombre: string;
}

/**
 * Los idiomas disponibles. Vive aquí y no en `selector-idioma.ts` porque la lista es
 * del dominio del idioma, no de un componente: el día que haya un ajuste de perfil,
 * necesitará la misma lista sin importar el selector de las pantallas de acceso.
 */
export const IDIOMAS: readonly Idioma[] = [
  { codigo: 'es-MX', corto: 'ES', nombre: 'Español' },
  { codigo: 'en-US', corto: 'EN', nombre: 'English' },
];

function esCodigo(valor: string | null): valor is CodigoIdioma {
  return IDIOMAS.some((i) => i.codigo === valor);
}

/** Parámetro de consulta con el que el idioma cruza de un subdominio a otro. */
const PARAMETRO = 'idioma';

/**
 * El idioma que trae la URL, si trae uno válido.
 *
 * Existe por el portal: mandar a alguien a `bajio.<dominio>` es un CAMBIO DE ORIGEN y
 * `localStorage` es por origen, así que la preferencia no viaja sola. `urlDeEmpresa()`
 * la pone en la URL y aquí se recoge. Un valor inventado se ignora.
 */
function idiomaDeLaUrl(): CodigoIdioma | null {
  const valor = new URLSearchParams(window.location.search).get(PARAMETRO);

  return esCodigo(valor) ? valor : null;
}

/**
 * El idioma con el que arranca esta pestaña: el de la URL si lo trae, y si no el
 * guardado.
 *
 * Se exporta porque `LOCALE_ID` la necesita como fábrica en el arranque: los `pipe` de
 * fecha, número y moneda leen el locale UNA vez, al construirse el inyector.
 *
 * `localStorage` puede lanzar —Safari en privado, cookies bloqueadas por directiva—, y
 * no poder recordar el idioma no vale tirar el arranque de la aplicación.
 */
export function idiomaGuardado(): CodigoIdioma {
  const deLaUrl = idiomaDeLaUrl();

  if (deLaUrl !== null) {
    return deLaUrl;
  }

  try {
    const guardado = localStorage.getItem(CLAVE);

    return esCodigo(guardado) ? guardado : PREDETERMINADO;
  } catch {
    return PREDETERMINADO;
  }
}

const elegido = signal<CodigoIdioma>(idiomaGuardado());

/** El idioma activo. Solo lectura: se cambia con `elegirIdioma`. */
export const idioma = elegido.asReadonly();

/** Los textos del idioma activo. Es la puerta por la que pasa TODO texto de interfaz. */
export const t = computed<Textos>(() => TEXTOS[elegido()]);

/**
 * El nombre para mostrar de un módulo del backend.
 *
 * Está aquí y no en la pantalla porque la clave la manda la API como `string` y el
 * diccionario tiene las 26 claves tipadas —lo que obliga a traducirlas todas—. Este es
 * el único sitio donde se cruza esa frontera, y por eso el único con la conversión.
 *
 * Una clave que el diccionario no conozca se muestra tal cual: si el backend agrega un
 * módulo antes que el frontend, mejor ver `subrenta` que un hueco.
 */
export function nombreModulo(clave: string): string {
  return (t().modulos as Record<string, string>)[clave] ?? clave;
}

/**
 * Cambia el idioma y lo recuerda.
 *
 * `<html lang>` se actualiza aquí porque los lectores de pantalla eligen la voz por ese
 * atributo (WCAG 3.1.1): sin esto, al pasar a inglés se seguiría leyendo con fonética
 * española. `index.html` lo trae en `es-MX` para el primer instante, antes de que
 * Angular arranque.
 *
 * ponytail: el cambio es en vivo para los TEXTOS, pero `LOCALE_ID` se fija al arrancar,
 * así que fechas, números y moneda se quedan con el idioma con el que se cargó la
 * página. Hoy no se nota porque no hay un solo `| date` ni `| number` en la aplicación.
 * Cuando llegue el primero, hay dos salidas: pasarle el locale al pipe
 * (`| date: 'short' : undefined : idioma()`) o recargar aquí con `location.reload()`.
 */
/**
 * Lo que hay que correr una vez al arrancar.
 *
 * Hace tres cosas, y las tres tienen que pasar aunque el idioma haya llegado por la URL
 * y no por un clic: dejar `<html lang>` de acuerdo con el idioma real, guardar la
 * preferencia en ESTE origen —si vino del portal, es la primera vez que se ve aquí— y
 * quitar el parámetro de la barra de direcciones, que ya cumplió y solo estorba si
 * alguien comparte la liga.
 *
 * `replaceState` y no `pushState`: el parámetro no es un paso de navegación, así que el
 * botón de atrás no debe volver a él.
 */
export function iniciarIdioma(): void {
  elegirIdioma(elegido());

  const url = new URL(window.location.href);

  if (url.searchParams.has(PARAMETRO)) {
    url.searchParams.delete(PARAMETRO);
    window.history.replaceState(window.history.state, '', url);
  }
}

export function elegirIdioma(codigo: CodigoIdioma): void {
  elegido.set(codigo);
  document.documentElement.lang = codigo;

  try {
    localStorage.setItem(CLAVE, codigo);
  } catch {
    // Mismo caso que al leer: se pierde la preferencia entre visitas y nada más.
  }
}
