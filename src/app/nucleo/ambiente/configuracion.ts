/**
 * Configuración de ambiente.
 *
 * El ambiente se elige por el ANFITRIÓN del navegador, no por el build: el mismo
 * artefacto sirve en local y en producción. Así no hay `fileReplacements`, ni un
 * `--configuration` por ambiente, ni la posibilidad clásica de subir a producción el
 * bundle que apuntaba a la API de pruebas. Cuando vuelva a haber un ambiente
 * desplegado de pruebas, es una entrada más en la lista y nada más.
 *
 * Cuesta una comparación de cadenas al arrancar y a cambio el despliegue es
 * `ng build` una vez y `wrangler deploy --env <lo que sea>` las que hagan falta.
 */

/**
 * Los ambientes conocidos, del más específico al más general.
 *
 * GANA EL PRIMERO QUE COINCIDA, así que el orden no es decorativo: si algún día se
 * agrega `dev.maqvia.com`, va ANTES que `maqvia.com` o `bajio.dev.maqvia.com` se leería
 * como una empresa llamada «bajio.dev».
 *
 * `dominioBase` tiene que coincidir con `Cors:DominioBase` de la API del mismo
 * ambiente, o el navegador bloqueará todas las llamadas.
 */
export const AMBIENTES = [
  {
    urlApi: 'http://localhost:5123',
    dominioBase: 'localhost',
  },
  {
    urlApi: 'https://maquinaria-backend-development.up.railway.app',
    dominioBase: 'maqvia.com',
  },
] as const;

/**
 * El ambiente al que pertenece un anfitrión.
 *
 * Con el anfitrión por parámetro para poder probarla sin navegador, igual que
 * `slugDelAnfitrion`. El punto del sufijo es lo que hace segura la comparación:
 * `malo-maqvia.com` termina en `-maqvia.com`, no en `.maqvia.com`.
 *
 * Un anfitrión desconocido cae en local. Es el valor menos dañino: apunta a una API
 * que no existe fuera de la máquina del desarrollador, así que falla de inmediato en
 * lugar de mandar datos al ambiente equivocado.
 */
export function ambientePara(anfitrion: string): (typeof AMBIENTES)[number] {
  const host = anfitrion.trim().toLowerCase();

  return (
    AMBIENTES.find((a) => host === a.dominioBase || host.endsWith('.' + a.dominioBase)) ??
    AMBIENTES[0]
  );
}

export const configuracion = ambientePara(window.location.hostname);
