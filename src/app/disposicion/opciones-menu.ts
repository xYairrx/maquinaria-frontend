/**
 * El menú lateral, como DATOS.
 *
 * Con 26 módulos previstos, un menú escrito a mano en la plantilla se vuelve
 * inmantenible y, peor, cada pantalla nueva obliga a tocar HTML en varios sitios.
 * Aquí agregar un módulo es una línea, y la visibilidad se resuelve sola.
 */

import { t } from '../nucleo/i18n/i18n';

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

  /**
   * `d` de un `<path>` de SVG, 24x24. En línea para no depender de una librería de iconos.
   *
   * OPCIONAL desde que hay acordeones: lo llevan las opciones sueltas y las del panel de
   * plataforma; las hijas de un grupo se distinguen por indentación y filete, no por glifo.
   */
  readonly icono?: string;
}

export interface GrupoMenu {
  /**
   * Nombre del grupo. **Vacío significa «sueltas»**: sus opciones se pintan al ras, sin
   * disparador y sin poder plegarse. Es lo que hace Inicio.
   *
   * Con nombre, el grupo es un ACORDEÓN: una fila con icono y galón que abre y cierra sus
   * opciones. Con 26 módulos previstos, una lista plana —aunque lleve encabezados— obliga a
   * recorrer con la vista todo lo que no interesa para llegar a lo que sí.
   */
  readonly titulo: string;

  /**
   * El icono del GRUPO, no el de sus opciones. Solo lo llevan los grupos con nombre.
   *
   * Dentro de un acordeón las opciones van SIN icono, indentadas y con un filete a la
   * izquierda que las ata a su grupo: repetir un glifo por cada hija llena la columna de
   * ruido y le quita al icono del grupo la función de ancla visual.
   */
  readonly icono?: string;

  readonly opciones: readonly OpcionMenu[];
}

/**
 * Si la ruta activa vive dentro de un grupo.
 *
 * COMPARA POR SEGMENTO, no con `startsWith` a secas. Con `startsWith` pelado, `/tipos` daría
 * por buena una ruta `/tipos-de-cambio` y abriría el grupo equivocado; el separador tiene que
 * entrar en la comparación. Los tres casos que sí cuentan son la ruta exacta, una ruta hija
 * —`/equipos/123`— y la misma ruta con parámetros detrás.
 */
export function contieneLaRuta(grupo: GrupoMenu, url: string): boolean {
  return grupo.opciones.some(
    (opcion) =>
      url === opcion.ruta ||
      url.startsWith(`${opcion.ruta}/`) ||
      url.startsWith(`${opcion.ruta}?`) ||
      url.startsWith(`${opcion.ruta}#`),
  );
}

/**
 * Lo que la persona eligió abrir en el menú.
 *
 * Tres valores, y los tres hacen falta:
 *
 * - `undefined` — **no ha tocado nada**, así que manda la ruta activa.
 * - `null` — cerró el que estaba abierto y no abrió otro. **No es lo mismo que `undefined`**:
 *   sin este valor, cerrar el grupo donde estás lo volvería a abrir en el acto, porque la
 *   ruta seguiría mandando.
 * - `string` — el título del único grupo abierto.
 */
export type EleccionDeMenu = string | null | undefined;

/**
 * Si un grupo se pinta abierto. **Como mucho uno a la vez.**
 *
 * La exclusividad no se vigila con código que cierre a los demás: sale de que el estado sea
 * UN título y no un conjunto. Con un mapa de abiertos habría que acordarse de cerrar el resto
 * en cada sitio que abra uno, y el día que alguien abra un grupo desde otro lado —una ruta
 * profunda, un atajo— se abrirían dos. Aquí no se puede.
 *
 * Mientras nadie elija, abre el que contiene la ruta activa. Eso importa al RECARGAR: sin
 * ello, quien recarga estando en `/tarifas` se encuentra todo cerrado y ninguna pista de
 * dónde está parado.
 */
export function grupoEstaAbierto(grupo: GrupoMenu, url: string, eleccion: EleccionDeMenu): boolean {
  return eleccion === undefined ? contieneLaRuta(grupo, url) : eleccion === grupo.titulo;
}

/**
 * Qué queda elegido al pulsar un grupo.
 *
 * Pulsar el que ya está abierto lo CIERRA —a `null`, no a `undefined`—; pulsar cualquier otro
 * lo abre y, por construcción, deja fuera al anterior.
 */
export function alPulsarGrupo(
  grupo: GrupoMenu,
  url: string,
  eleccion: EleccionDeMenu,
): EleccionDeMenu {
  return grupoEstaAbierto(grupo, url, eleccion) ? null : grupo.titulo;
}

/**
 * El `id` del panel de un grupo, para el `aria-controls` de su disparador.
 *
 * Sale del título, que es TEXTO TRADUCIDO: en español lleva acentos y en cualquier idioma
 * puede llevar espacios, y un `id` con eso dentro deja el `aria-controls` apuntando a nada.
 * Se normaliza descomponiendo los acentos y tirando lo que no sea alfanumérico.
 */
export function idDePanel(titulo: string): string {
  const limpio = titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `menu-grupo-${limpio}`;
}

/**
 * Iconos. Trazos de Lucide (ISC), copiados en lugar de instalar el paquete.
 *
 * **CADA OPCIÓN DEL MENÚ LLEVA EL SUYO.** Repetir un glifo entre dos opciones anula para qué
 * sirve: la vista periférica busca la forma, no lee la palabra, y dos entradas idénticas
 * obligan a leer las dos. Pasó con Marcas/Categorías, Tipos/Modelos y Tarifas/Cláusulas.
 *
 * Se dibujan como un `<path>` de trazo —sin relleno—, así que el trazo tiene que quedar
 * legible a 16 px: nada con detalle fino.
 */
const ICONOS = {
  inicio: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  edificios: 'M3 21h18M5 21V7l7-4v18M19 21V11l-7-4M9 9h.01M9 13h.01M9 17h.01',
  usuarios:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  maquina:
    'M4 17h16M6 17v-5h5l2-4h4l3 5v4M6 12V8h3M8 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0M20 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  documento: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  tablero: 'M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z',
  etiqueta:
    'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6M7.5 7.5h.01',
  base: 'M21 5c0 1.66-4.03 3-9 3S3 6.66 3 5s4.03-3 9-3 9 1.34 9 3M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3',
  /** Carpeta: una categoría agrupa tipos. */
  carpeta:
    'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
  /** Capas: un tipo es un estrato por encima del modelo. */
  capas:
    'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83zM2 12.18l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9M2 17.18l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9',
  /**
   * Credencial. Un trabajador es una PERSONA IDENTIFICADA, no un grupo, asi que no repite el
   * glifo de Puestos: dos entradas con el mismo dibujo obligan a leer la palabra, que es
   * justo lo que el icono existe para evitar.
   */
  credencial:
    'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1M9 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4M6 16a3 3 0 0 1 6 0M15 10h4M15 14h3',
  /** Maletin: a un cliente se le RENTA. Distinto del carrito, que es a quien se le compra. */
  maletin:
    'M3 7h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M2 12h20',
  /** Carrito: a un proveedor se le COMPRA. Lo compartira la orden de compra. */
  carrito:
    'M2 3h2.5l2.2 11.2a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 2-1.6L21 7H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  /** Billete: dinero. Lo usa el grupo COMPRAS —ordenes de compra y de venta—. */
  billete:
    'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0M6 12h.01M18 12h.01',
} as const;

/**
 * Menú de la aplicación de empresa.
 *
 * Hoy solo el inicio: las pantallas de los módulos son la Fase 1 en adelante. Para
 * agregar una, se añade su ruta en `rutas-empresa.ts` y una entrada aquí con la
 * `clave` del módulo; el filtrado por plan y permisos ya funciona.
 *
 * Es una FUNCIÓN y no una constante desde que hay dos idiomas: una constante se
 * evaluaría al cargar el módulo y el menú se quedaría en el idioma de ese instante.
 * Llamada dentro de un `computed`, se rehace sola al cambiar de idioma.
 */
export function menuEmpresa(): readonly GrupoMenu[] {
  const m = t().menu;

  return [
    {
      // Sin nombre: Inicio va suelto arriba, sin plegarse. Es la pantalla de entrada y
      // esconderla detrás de un galón la pondría a un clic de distancia por nada.
      titulo: '',
      opciones: [{ titulo: m.inicio, ruta: '/inicio', icono: ICONOS.inicio }],
    },
    {
      // CATÁLOGOS: lo que la empresa RENTA o FACTURA, descrito una vez y reutilizado.
      //
      // La clave del modulo es `equipos` y NO `catalogos`: no existe un modulo llamado asi en
      // la base central. Los seis se reparten entre `equipos`, `rentas` y `contratos`, que son
      // los modulos cuyos permisos exigen sus endpoints —MarcasController pide
      // `equipos.consultar`—. Una clave inventada esconde la opcion para siempre, porque nunca
      // coincide con `modulo.clave`. El mapa completo esta en `docs/plan-fase1-front.md` §4.
      titulo: m.catalogos,
      icono: ICONOS.carpeta,
      opciones: [
        { titulo: m.marcas, ruta: '/marcas', modulo: 'equipos' },
        { titulo: m.categorias, ruta: '/categorias', modulo: 'equipos' },
        { titulo: m.tipos, ruta: '/tipos', modulo: 'equipos' },
        { titulo: m.modelos, ruta: '/modelos', modulo: 'equipos' },
        // Tarifas exige `rentas.consultar`, no `equipos`.
        { titulo: m.tarifas, ruta: '/tarifas', modulo: 'rentas' },
        // Clausulas exige `contratos.consultar`.
        { titulo: m.clausulas, ruta: '/clausulas', modulo: 'contratos' },
      ],
    },
    {
      // ORGANIZACIÓN: la empresa MISMA —dónde está y quién trabaja en ella—, que es otra
      // pregunta. Es el mismo corte que el repo ya hizo en la capa de datos al separar
      // `ApiOrganizacion` de `ApiCatalogos`; el menu era la unica capa donde no se veia.
      titulo: m.organizacion,
      icono: ICONOS.edificios,
      opciones: [
        // Puestos NO va bajo `equipos`: PuestosController exige `usuarios.consultar`.
        { titulo: m.puestos, ruta: '/puestos', modulo: 'usuarios' },
        // Ubicaciones exige `sucursales.consultar`: asi se llama el modulo en el backend.
        { titulo: m.ubicaciones, ruta: '/ubicaciones', modulo: 'sucursales' },
        // Trabajadores exige `usuarios.consultar`, el mismo modulo que Puestos: son las dos
        // caras de la misma pregunta, quien trabaja aqui y en que.
        { titulo: m.trabajadores, ruta: '/trabajadores', modulo: 'usuarios' },
      ],
    },
    {
      // OPERACION: el parque y lo que se hace con el. Nace con Equipos, que es la entidad
      // central de la fase. Transferencias y Disponibilidad entran aqui cuando existan.
      titulo: m.operacion,
      icono: ICONOS.maquina,
      opciones: [
        { titulo: m.equipos, ruta: '/equipos', modulo: 'equipos' },
        // Traspasos exige `equipos.*`: mover una maquina es operar sobre el parque.
        { titulo: m.traspasos, ruta: '/traspasos', modulo: 'equipos' },
        { titulo: m.disponibilidad, ruta: '/disponibilidad', modulo: 'disponibilidad' },
      ],
    },
    {
      // COMERCIAL: con quien se opera desde FUERA. Nace con Proveedores, que es su primera
      // pantalla —la regla es que un grupo y su primera ruta se agregan JUNTOS—. Clientes,
      // Cotizaciones, Rentas y Contratos entran aqui conforme existan.
      titulo: m.comercial,
      icono: ICONOS.carrito,
      opciones: [
        // Clientes va primero: es a quien se le RENTA, que es el negocio. El proveedor
        // aparece despues porque su relacion real vive en la orden de compra.
        { titulo: m.clientes, ruta: '/clientes', modulo: 'clientes' },
        { titulo: m.proveedores, ruta: '/proveedores', modulo: 'proveedores' },
        // Cotizaciones exige `cotizaciones.consultar`; el cambio de estado pide ademas
        // `cotizaciones.autorizar`, que es un permiso APARTE de `editar`. El menu solo
        // filtra por modulo, asi que quien pueda consultar vera la pantalla aunque el
        // boton de estado le responda 403: eso lo dice el servidor, no se adivina aqui.
        { titulo: m.cotizaciones, ruta: '/cotizaciones', modulo: 'cotizaciones' },
        // Rentas cierra el ciclo y va al final del grupo, que es el orden en que se
        // trabaja: se cotiza, se acepta, se renta.
        { titulo: m.rentas, ruta: '/rentas', modulo: 'rentas' },
        // El contrato cierra el ciclo: cuelga de una renta y va despues de ella.
        { titulo: m.contratos, ruta: '/contratos', modulo: 'contratos' },
      ],
    },
    {
      // COMPRAS: el otro lado del mostrador. La orden de compra mete maquinaria al parque y
      // la de venta la saca, asi que no van en COMERCIAL —que es lo que se le vende al
      // cliente como servicio— sino en su propio grupo.
      //
      // Las dos usan el modulo `compras`, incluida la de VENTA: asi lo declara el servidor
      // —`[RequierePermiso("compras.consultar")]` en los dos controladores— y el menu filtra
      // por lo que el permiso exige, no por lo que el nombre sugiere.
      titulo: m.compras,
      // BILLETE y no el carrito, que ya es de COMERCIAL. Dos grupos con el mismo icono se
      // leen como el mismo sitio: el icono es lo primero que se ve y lo unico que queda
      // visible cuando el menu esta colapsado.
      icono: ICONOS.billete,
      opciones: [
        { titulo: m.ordenesCompra, ruta: '/ordenes-compra', modulo: 'compras' },
        { titulo: m.ordenesVenta, ruta: '/ordenes-venta', modulo: 'compras' },
      ],
    },
    // Aqui van `Operacion` —equipos, traspasos, disponibilidad—, `Comercial` —clientes,
    // proveedores, cotizaciones, rentas, contratos— y `Compras`. NO se agregan antes que sus
    // pantallas: un grupo `Operacion` con rutas inexistentes ya estuvo en disco, se dibujaba,
    // se pulsaba y caia en el comodin de ruta de vuelta a /inicio. Sus textos siguen en
    // `textos.ts` esperando. La entrada del menu y la ruta se agregan JUNTAS.
  ];
}

/**
 * Menú de la superadministración.
 *
 * No lleva claves de módulo: los módulos son lo que una EMPRESA contrata, y el
 * superadministrador no es de ninguna empresa. Su acceso lo decide la policy de ámbito
 * `plataforma` en la API.
 */
export function menuPlataforma(): readonly GrupoMenu[] {
  return [
    {
      titulo: '',
      opciones: [
        { titulo: t().menu.dashboard, ruta: '/dashboard', icono: ICONOS.tablero },
        { titulo: t().menu.planes, ruta: '/planes', icono: ICONOS.etiqueta },
        { titulo: t().menu.empresas, ruta: '/empresas', icono: ICONOS.edificios },
        // La entrada y su ruta se agregan JUNTAS: `rutas-plataforma.ts` registra
        // `esquemas`. Ver el comentario de `menuEmpresa()`.
        { titulo: t().menu.esquemas, ruta: '/esquemas', icono: ICONOS.base },
      ],
    },
  ];
}
