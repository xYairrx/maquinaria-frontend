/**
 * Configuración de ambiente.
 *
 * Un solo archivo en lugar de `src/environments/`: Angular 21 ya no genera esa carpeta
 * y el reemplazo de archivos por configuración es una capa más que mantener. Para
 * producción, el valor se sustituye en el build de Cloudflare Pages.
 */
export const configuracion = {
  /** La API en el perfil `http` de launchSettings.json. */
  urlApi: 'http://localhost:5123',
} as const;
