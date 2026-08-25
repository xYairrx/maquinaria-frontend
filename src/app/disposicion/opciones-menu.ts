/**
 * El menú lateral, como DATOS.
 *
 * Con 26 módulos previstos, un menú escrito a mano en la plantilla se vuelve
 * inmantenible y, peor, cada pantalla nueva obliga a tocar HTML en varios sitios.
 * Aquí agregar un módulo es una línea, y la visibilidad se resuelve sola.
 */

export interface OpcionMenu {
  readonly titulo: string;

  /** Ruta absoluta dentro de su árbol. */
  readonly ruta: string;

  /**
   * Clave del módulo en el backend (`equipos`, `rentas`, `logistica`...). Debe coincidir
   * con `modulo.clave` de la base central: es lo que se compara contra el plan
   * contratado y contra los permisos del rol.
   *
   * Sin clave, la opción se ve siempre. Solo para pantallas que no pertenecen a ningún
   * módulo, como el inicio.
   */
  readonly modulo?: string;

  /** `d` de un `<path>` de SVG, 24x24. En línea para no depender de una librería de iconos. */
  readonly icono: string;
}

export interface GrupoMenu {
  /**
   * Encabezado del grupo. Vacío para el primer bloque, que no necesita título.
   *
   * Los grupos existen porque 26 módulos en una lista plana no se pueden recorrer con
   * la vista.
   */
  readonly titulo: string;
  readonly opciones: readonly OpcionMenu[];
}

// Iconos. Trazos de Lucide (ISC), copiados en lugar de instalar el paquete: son cinco.
const ICONOS = {
  inicio: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  edificios: 'M3 21h18M5 21V7l7-4v18M19 21V11l-7-4M9 9h.01M9 13h.01M9 17h.01',
  usuarios:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  maquina:
    'M4 17h16M6 17v-5h5l2-4h4l3 5v4M6 12V8h3M8 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0M20 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  documento: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
} as const;

/**
 * Menú de la aplicación de empresa.
 *
 * Hoy solo el inicio: las pantallas de los módulos son la Fase 1 en adelante. Para
 * agregar una, se añade su ruta en `rutas-empresa.ts` y una entrada aquí con la
 * `clave` del módulo; el filtrado por plan y permisos ya funciona.
 */
export const MENU_EMPRESA: readonly GrupoMenu[] = [
  {
    titulo: '',
    opciones: [{ titulo: 'Inicio', ruta: '/inicio', icono: ICONOS.inicio }],
  },
  {
    titulo: 'Operación',
    opciones: [
      { titulo: 'Equipos', ruta: '/equipos', modulo: 'equipos', icono: ICONOS.maquina },
      { titulo: 'Clientes', ruta: '/clientes', modulo: 'clientes', icono: ICONOS.usuarios },
      { titulo: 'Rentas', ruta: '/rentas', modulo: 'rentas', icono: ICONOS.documento },
    ],
  },
];

/**
 * Menú de la superadministración.
 *
 * No lleva claves de módulo: los módulos son lo que una EMPRESA contrata, y el
 * superadministrador no es de ninguna empresa. Su acceso lo decide la policy de ámbito
 * `plataforma` en la API.
 */
export const MENU_PLATAFORMA: readonly GrupoMenu[] = [
  {
    titulo: '',
    opciones: [{ titulo: 'Empresas', ruta: '/empresas', icono: ICONOS.edificios }],
  },
];
