import { configuracion } from './configuracion';

/**
 * De dónde sale la empresa de la sesión: del subdominio.
 *
 * `bajio.ejemplo.com` es la empresa `bajio`. El usuario que llega a su propia URL no
 * escribe la empresa en ningún lado, que es justo la fricción que se quería quitar.
 *
 * POR QUÉ NO SE DEDUCE DEL CORREO: cada empresa tiene su propia base de datos, así que
 * no hay un lugar donde estén todos los correos. Averiguarlo exigiría un índice
 * `correo → empresa` en la base central, y eso duplicaría correos fuera de su base,
 * rompería la instalación on-premise y permitiría enumerar clientes escribiendo
 * correos. El subdominio dice la empresa ANTES de validar nada, igual que hacía el
 * tercer campo del formulario.
 *
 * ESTO NO ES UN CONTROL DE SEGURIDAD. Solo decide qué pantalla se muestra y qué slug
 * se manda a la API. Que la empresa exista, esté activa y el usuario pertenezca a ella
 * lo resuelve el backend en cada petición; aquí un valor inventado solo consigue un
 * mensaje de error.
 */

/**
 * Subdominios que nunca son una empresa.
 *
 * Duplica a propósito la lista de `SlugsReservados` del backend, que es la
 * autoritativa: aquí solo sirve para no tratar `login.ejemplo.com` como si fuera una
 * empresa llamada «login». Si el backend agrega uno, este también.
 */
const RESERVADOS: ReadonlySet<string> = new Set([
  'login',
  'www',
  'app',
  'api',
  'admin',
  'soporte',
  'status',
]);

/**
 * El slug de empresa que corresponde a un anfitrión, o `null` si no hay ninguno.
 *
 * Función pura y con el anfitrión por parámetro para poder probarla sin navegador.
 */
export function slugDelAnfitrion(anfitrion: string, dominioBase: string): string | null {
  const limpio = anfitrion.trim().toLowerCase();
  const base = dominioBase.trim().toLowerCase();

  if (limpio.length === 0 || base.length === 0) {
    return null;
  }

  const sufijo = '.' + base;

  // El punto del sufijo es lo que hace segura la comparación: `malo-ejemplo.com`
  // termina en `-ejemplo.com`, no en `.ejemplo.com`.
  if (!limpio.endsWith(sufijo)) {
    return null;
  }

  const etiqueta = limpio.slice(0, -sufijo.length);

  // Un subdominio anidado (`a.b.ejemplo.com`) no es una empresa: los slugs no llevan
  // puntos. Se descarta en lugar de quedarse con la última etiqueta.
  if (etiqueta.length === 0 || etiqueta.includes('.')) {
    return null;
  }

  if (RESERVADOS.has(etiqueta)) {
    return null;
  }

  return etiqueta;
}

/** El slug de la empresa en curso, leído del navegador. */
export function tenantActual(): string | null {
  return slugDelAnfitrion(window.location.hostname, configuracion.dominioBase);
}

/**
 * La URL donde vive el acceso de una empresa.
 *
 * `idioma` viaja en la cadena de consulta porque el salto al subdominio es un CAMBIO DE
 * ORIGEN, y `localStorage` es por origen: quien deja el portal en inglés llegaría a
 * `bajio.<dominio>` en español, y el portal no existe para otra cosa que para ese salto.
 * Lo recoge `nucleo/i18n/i18n.ts` al arrancar y lo borra de la URL.
 *
 * Se pasa por parámetro y no se lee de `i18n` aquí para que este módulo siga siendo puro
 * y probable sin navegador.
 */
export function urlDeEmpresa(slug: string, idioma?: string): string {
  const { protocol, port } = window.location;
  const puerto = port.length > 0 ? ':' + port : '';
  const consulta = idioma === undefined ? '' : `?idioma=${encodeURIComponent(idioma)}`;

  return `${protocol}//${slug}.${configuracion.dominioBase}${puerto}/entrar${consulta}`;
}

/**
 * Qué aplicación corresponde a un anfitrión.
 *
 * El subdominio no solo dice QUÉ empresa: dice QUÉ producto se está usando. En
 * `admin.ejemplo.com` vive la superadministración y en `bajio.ejemplo.com` la
 * aplicación de una empresa. Son dos poblaciones, dos audiencias de JWT y dos menús
 * distintos, así que conviene que sean dos árboles de rutas distintos y no uno con
 * ramas escondidas.
 */
export type AmbitoAnfitrion =
  /** `admin.<dominio>` — el panel de superadministración. */
  | { readonly tipo: 'plataforma' }
  /** `<slug>.<dominio>` — la aplicación de una empresa. */
  | { readonly tipo: 'empresa'; readonly slug: string }
  /** El dominio pelado, `login.<dominio>` o cualquier otro reservado: la puerta de entrada. */
  | { readonly tipo: 'portal' };

/** El subdominio donde vive la superadministración. */
export const SUBDOMINIO_PLATAFORMA = 'admin';

export function ambitoDelAnfitrion(anfitrion: string, dominioBase: string): AmbitoAnfitrion {
  const limpio = anfitrion.trim().toLowerCase();
  const base = dominioBase.trim().toLowerCase();

  if (limpio === `${SUBDOMINIO_PLATAFORMA}.${base}`) {
    return { tipo: 'plataforma' };
  }

  const slug = slugDelAnfitrion(limpio, base);

  // Sin empresa reconocible se cae al portal, que es la única pantalla que funciona
  // sin saber a qué empresa se entra. Nunca se adivina una empresa por defecto.
  return slug === null ? { tipo: 'portal' } : { tipo: 'empresa', slug };
}

/** El ámbito de la pestaña actual. */
export function ambitoActual(): AmbitoAnfitrion {
  return ambitoDelAnfitrion(window.location.hostname, configuracion.dominioBase);
}

/**
 * El MISMO patrón que `FormatoSlug` del backend y que el `CHECK tenant_slug_formato`
 * de la base central.
 *
 * Se repite aquí solo para dar un mensaje decente antes de mandar a la persona a un
 * subdominio que no puede existir. La validación que cuenta es la del servidor: esta
 * se salta abriendo la URL a mano.
 */
export const FORMATO_SLUG = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
