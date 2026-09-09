import type { Route } from '@angular/router';

import { rutasEmpresa } from '../rutas-empresa';
import { menuEmpresa } from './opciones-menu';

/**
 * LA PRUEBA QUE VIGILA QUE NINGUNA OPCIÓN DEL MENÚ LLEVE A NINGÚN LADO.
 *
 * El repo ya pagó ese error: el 2026-08-25 se retiró un grupo «Operación» con `/equipos`,
 * `/clientes` y `/rentas` que **no estaban registradas** en `rutas-empresa.ts`. Se dibujaba, se
 * pulsaba, caía en el comodín `**` y volvía a `/inicio`. La regla que quedó escrita —«la entrada
 * del menú y la ruta se agregan JUNTAS»— era una convención que nada comprobaba.
 *
 * Ahora la comprueba esto, y sin navegador: las dos listas son datos y se cruzan.
 */
describe('menú de empresa', () => {
  /** Las rutas registradas, aplanadas: el armazón cuelga las suyas de un padre con `children`. */
  const registradas = (function aplanar(rutas: readonly Route[], prefijo = ''): string[] {
    return rutas.flatMap((ruta) => {
      const camino = [prefijo, ruta.path ?? ''].filter((p) => p !== '').join('/');
      const hijas = ruta.children ? aplanar(ruta.children, camino) : [];

      return camino === '' ? hijas : [camino, ...hijas];
    });
  })(rutasEmpresa);

  const opciones = menuEmpresa().flatMap((grupo) => grupo.opciones);

  it('tiene las seis secciones del MVP, en orden', () => {
    // La primera no cuenta: es Inicio, que va suelto arriba y sin título.
    const titulos = menuEmpresa()
      .map((g) => g.titulo)
      .filter((titulo) => titulo !== '');

    expect(titulos.length).toBe(6);
  });

  it.each(menuEmpresa().flatMap((g) => g.opciones.map((o) => [o.titulo, o.ruta] as const)))(
    '«%s» apunta a una ruta registrada: %s',
    (_titulo, ruta) => {
      // La ruta del menú lleva barra inicial y la registrada no.
      expect(registradas).toContain(ruta.replace(/^\//, ''));
    },
  );

  /**
   * La clave de módulo, al menos en su FORMA.
   *
   * Lo que de verdad importa —que la clave exista en la tabla `modulo` de la base central— no
   * se puede comprobar desde aquí sin una sesión, y **no se va a comprobar copiando las 29
   * claves a este repositorio**: esa copia es exactamente la referencia blanda que se
   * desincroniza y da falsa confianza. Lo garantiza la prueba del backend
   * —`SemillaModulosYPermisosPruebas`—, que cruza la semilla contra `ClavesModulo`.
   *
   * Aquí solo se atrapa el error de dedo: una mayúscula, un espacio, un guion bajo. Un módulo
   * mal escrito no da error en ningún sitio; simplemente su opción no se dibuja nunca.
   */
  it.each(
    menuEmpresa()
      .flatMap((g) => g.opciones)
      .filter((o) => o.modulo !== undefined)
      .map((o) => [o.titulo, o.modulo!] as const),
  )('«%s» declara un módulo con forma de clave: %s', (_titulo, modulo) => {
    expect(modulo).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it('ninguna ruta se repite en dos opciones', () => {
    const rutas = opciones.map((o) => o.ruta);

    expect(new Set(rutas).size).toBe(rutas.length);
  });
});
