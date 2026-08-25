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

  /**
   * Dominio bajo el cual cada empresa tiene su subdominio: `bajio.<dominioBase>`.
   *
   * En desarrollo es `localhost`, y `bajio.localhost:4200` funciona sin tocar el
   * archivo `hosts` porque Chrome y Edge resuelven `*.localhost` a 127.0.0.1 de forma
   * nativa. En producción es el dominio real, y tiene que coincidir con
   * `Cors:DominioBase` de la API o el navegador bloqueará todas las llamadas.
   */
  dominioBase: 'localhost',
} as const;
