import type { IdentidadEmpresa } from '../api/contratos';

/**
 * Qué puede VER un usuario de empresa.
 *
 * ESTO NO ES SEGURIDAD, es interfaz. La autorización de verdad la hace la API en cada
 * petición. Aquí solo se decide qué se dibuja, para no ofrecer botones que el servidor
 * va a rechazar — que es la peor forma de decirle a alguien que no tiene permiso.
 *
 * LA REGLA ES UNA INTERSECCIÓN, y saltársela produce justo ese error:
 *
 *     permisos del rol  ∩  módulos del plan del tenant
 *
 * Son dos compuertas en dos bases distintas. Un usuario con `logistica.crear` en una
 * empresa cuyo plan no incluye logística NO puede crear un flete. Filtrar solo por el
 * permiso del rol enseña el módulo; filtrar solo por el plan enseña acciones que su rol
 * no tiene.
 *
 * El backend ya aplica la intersección al emitir el token, así que `permisos` viene
 * filtrado. La comprobación contra `modulos` se repite igualmente: es barata y evita
 * depender de que la otra punta no cambie.
 */
export function puedeVerModulo(
  identidad: IdentidadEmpresa | null,
  claveModulo: string | undefined,
): boolean {
  // Sin clave la opción no pertenece a ningún módulo y se ve siempre.
  if (claveModulo === undefined) {
    return true;
  }

  if (identidad === null) {
    return false;
  }

  if (!identidad.modulos.includes(claveModulo)) {
    return false;
  }

  // `acceso_total` es una COLUMNA del rol, no una comparación contra su nombre: cada
  // empresa renombra sus roles, así que buscar `codigo === 'administrador'` se rompe.
  if (identidad.accesoTotal) {
    return true;
  }

  // Cualquier acción sobre el módulo basta para verlo en el menú. Qué botones se
  // habilitan dentro ya es cosa de cada pantalla.
  const prefijo = claveModulo + '.';

  return identidad.permisos.some((permiso) => permiso.startsWith(prefijo));
}
