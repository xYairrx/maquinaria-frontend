/**
 * Todos los textos de la interfaz, en los dos idiomas.
 *
 * NO HAY LIBRERÍA DE i18n, y es a propósito. El repo no tiene una sola dependencia de
 * terceros, y lo que hacía falta —cambiar de idioma en vivo y que falte una traducción
 * sea un error— sale de TypeScript: `ES_MX` define la FORMA y `EN_US` se declara con
 * ese tipo, así que una clave que falte o sobre no compila. Con claves de texto
 * (`'entrar.titulo'`) eso solo se descubre viendo la clave cruda en pantalla.
 *
 * `@angular/localize` se descartó por ser de tiempo de compilación: un bundle por
 * idioma obligaría a que el selector recargara en `/en-US/` en vez de cambiar en vivo,
 * y a montar dos builds antes de que el despliegue exista siquiera.
 *
 * DOS REGLAS al agregar textos:
 *
 * 1. Lo que lleva un dato dentro va como FUNCIÓN, no como plantilla con marcadores:
 *    `permisos: (n) => ...`. Así el dato se comprueba de tipo y no hay que interpretar
 *    cadenas en tiempo de ejecución.
 * 2. Un texto que viene de la API no se traduce aquí. Los mensajes de
 *    `/restablecimientos` y los de error de login están redactados en el servidor para
 *    ser uniformes —no delatar si una cuenta existe— y reescribirlos aquí desharía esa
 *    uniformidad sin que se note. Ver `solicitar-restablecimiento.ts`.
 *
 * El nombre del producto NO está aquí: es marca, no texto, y vive en `sitio.ts`.
 */

export type CodigoIdioma = 'es-MX' | 'en-US';

/**
 * El español es la FORMA del diccionario, no solo una traducción más: de aquí sale el
 * tipo `Textos`. Se eligió el español porque es el idioma en el que se escriben las
 * pantallas, así que es el que siempre está completo.
 *
 * Ojo: SIN `as const`. Con él, `salir` tendría el tipo `'Salir'` y ninguna traducción
 * podría satisfacerlo.
 */
const ES_MX = {
  comun: {
    salir: 'Salir',
    cancelar: 'Cancelar',
    irAlContenido: 'Ir al contenido',
    abrirMenu: 'Abrir el menú',
    cerrarMenu: 'Cerrar el menú',
    tuCuenta: 'Tu cuenta',
    cargando: 'Cargando…',
    entrar: 'Entrar',
    entrando: 'Entrando…',
    correo: 'Correo electrónico',
    marcadorCorreo: 'Tu correo electrónico',
    faltanCredenciales: 'Escribe tu correo y tu contraseña.',
    noCoinciden: 'Las dos contraseñas no coinciden.',
    /** La instrucción del campo de contraseña nueva. El mínimo lo manda la API. */
    largoMinimo: (n: number) =>
      `Al menos ${n} caracteres. No se exigen mayúsculas ni símbolos: lo que cuenta es la longitud.`,
  },

  campoContrasena: {
    etiqueta: 'Contraseña',
    marcador: 'Tu contraseña',
    mostrar: 'Mostrar la contraseña',
    ocultar: 'Ocultar la contraseña',
  },

  idioma: {
    /** Etiqueta del selector. El nombre del idioma va en su propio idioma, sin traducir. */
    etiqueta: (nombre: string) => `Idioma: ${nombre}`,
  },

  menu: {
    inicio: 'Inicio',
    dashboard: 'Dashboard',
    planes: 'Planes',
    catalogos: 'Catálogos',
    marcas: 'Marcas',
    categorias: 'Categorías',
    puestos: 'Puestos',
    tipos: 'Tipos',
    tarifas: 'Tarifas',
    clausulas: 'Cláusulas',
    modelos: 'Modelos',
    ubicaciones: 'Ubicaciones',
    operacion: 'Operación',
    equipos: 'Equipos',
    clientes: 'Clientes',
    rentas: 'Rentas',
    empresas: 'Empresas',
    esquemas: 'Esquemas',
    navegacionPrincipal: 'Navegación principal',
    navegacionEmpresa: 'Navegación de la empresa',
    navegacionPlataforma: 'Navegación de la plataforma',
    superadministracion: 'Superadministración',
  },

  entrarEmpresa: {
    titulo: 'Iniciar sesión',
    apoyo: 'Ingresa tus datos para gestionar los activos de',
    olvidaste: '¿Olvidaste tu contraseña?',
    activada: 'Tu cuenta quedó activada. Entra con tu correo y tu contraseña nueva.',
    restablecida:
      'Tu contraseña quedó cambiada y se cerraron las demás sesiones. Entra con la nueva.',
    expirada: 'Tu sesión expiró. Entra otra vez con tu correo y tu contraseña.',
  },

  entrarPlataforma: {
    titulo: 'Panel administrativo',
    apoyo: 'Controla y gestiona las empresas del sistema.',
  },

  portal: {
    titulo: 'Entrar a tu empresa',
    apoyo: 'Cada empresa tiene su propia página de acceso. Te llevamos a la tuya.',
    etiquetaEmpresa: 'Empresa',
    marcadorEmpresa: 'El identificador de tu empresa',
    ayudaEmpresa: 'El identificador que te dieron. Te llevaremos a la página de tu empresa.',
    formatoInvalido: 'Usa solo letras minúsculas, números y guiones.',
    continuar: 'Continuar',
  },

  invitacion: {
    titulo: 'Define tu contraseña',
    /** Quién activa el acceso y a qué empresa. Los tres datos llegan de la API. */
    activando: (nombre: string, correo: string, empresa: string) =>
      `Estás activando el acceso de ${nombre} (${correo}) a ${empresa}.`,
    verificando: 'Verificando la liga…',
    pideOtra: 'Pide una invitación nueva a quien administra el sistema.',
    ligaIncompleta: 'La liga está incompleta.',
    etiquetaNueva: 'Contraseña',
    marcadorNueva: 'Tu contraseña nueva',
    etiquetaRepetir: 'Repítela',
    marcadorRepetir: 'Repite la contraseña',
    activar: 'Activar mi cuenta',
    activando_: 'Activando…',
  },

  recuperar: {
    titulo: 'Recuperar tu contraseña',
    apoyo: 'Recuperando el acceso a',
    etiquetaCorreo: 'Correo',
    marcadorCorreo: 'Tu correo',
    ayudaCorreo: 'El correo con el que entras a esta empresa. La liga caduca en una hora.',
    enviar: 'Enviarme la liga',
    enviando: 'Enviando…',
    volver: 'Volver a entrar',
    /** El 429 llega sin cuerpo: el límite es 3 cada 15 minutos por empresa e IP. */
    demasiadas: 'Se pidieron demasiadas ligas desde aquí. Espera 15 minutos e inténtalo de nuevo.',
  },

  restablecer: {
    titulo: 'Tu contraseña nueva',
    tituloInvalida: 'La liga ya no sirve',
    apoyo: 'Restableciendo el acceso a',
    comprobando: 'Comprobando la liga…',
    duranUnaHora:
      'Las ligas de restablecimiento duran una hora y sirven una sola vez. Puedes pedir otra.',
    pedirOtra: 'Pedir una liga nueva',
    noSePudoComprobar:
      'No se pudo comprobar la liga. Vuelve a abrirla en un momento: sigue siendo válida hasta que caduque.',
    etiquetaNueva: 'Contraseña nueva',
    marcadorNueva: 'Tu contraseña nueva',
    etiquetaRepetir: 'Repítela',
    marcadorRepetir: 'Repite la contraseña',
    muyCorta: (n: number) => `La contraseña necesita al menos ${n} caracteres.`,
    avisoSesiones:
      'Al guardarla se cerrarán las demás sesiones abiertas de tu cuenta. Tendrás que entrar de nuevo en los otros dispositivos.',
    guardar: 'Guardar y cerrar las otras sesiones',
    guardando: 'Guardando…',
    ligaIncompleta: 'La liga está incompleta.',
  },

  inicio: {
    tuAcceso: 'Tu acceso',
    autorizacion: 'Autorización',
    accesoTotal: 'Acceso total (rol de sistema)',
    permisos: (n: number) => `${n} permisos`,
    modulosContratados: 'Módulos contratados',
    deTotal: (n: number, total: number) => `${n} de ${total}`,
    implementados: 'Implementados',
    avisoAccesoTotal:
      'Tu rol salta la verificación de permisos. No se puede editar ni borrar, y no se asigna desde la interfaz.',
    modulos: 'Módulos',
    disponible: 'Disponible',
    porConstruir: 'Por construir',
    cargandoSesion: 'Cargando tu sesión…',
  },

  panel: {
    titulo: 'Resumen',
    apoyo: 'Todo lo que se ve aquí sale del alta de empresas. No hay ninguna cifra estimada.',

    totalEmpresas: 'Empresas',
    pieTotal: (n: number) => (n === 1 ? 'Una en la plataforma' : `${n} en la plataforma`),
    activas: 'Activas',
    pieActivas: 'Con suscripción en curso',
    enPrueba: 'En prueba',
    pieEnPrueba: 'Todavía sin contratar',
    requierenAtencion: 'Requieren atención',
    pieAtencionCero: 'Nada pendiente',
    pieAtencion: (n: number) => (n === 1 ? '1 aviso abierto' : `${n} avisos abiertos`),

    enProceso: (n: number) =>
      n === 1 ? 'Un alta en curso ahora mismo' : `${n} altas en curso ahora mismo`,

    avisos: 'Qué hay que atender',
    sinAvisos: 'No hay nada que atender.',
    sinEmpresas: 'Todavía no hay ninguna empresa dada de alta.',

    motivoFallida: 'El alta falló',
    detalleFallida:
      'Su base quedó a medias. Volver a darla de alta con el mismo identificador reintenta el proceso.',
    motivoSinSuscripcion: 'Sin suscripción',
    detalleSinSuscripcion:
      'Su base existe pero no tiene plan, así que su gente no ve ningún módulo.',
    motivoEsquemaDesfasado: 'Esquema desfasado',
    /** El conteo lo manda el reporte; este lado no lo calcula. */
    detalleEsquemaDesfasado: (pendientes: number) =>
      pendientes === 1
        ? 'Le falta una migración para llegar a la del binario que responde.'
        : `Le faltan ${pendientes} migraciones para llegar a la del binario que responde.`,
    motivoEsquemaSinComparar: 'Esquema sin comparar',
    detalleEsquemaSinComparar:
      'No se pudo comparar su versión con la del binario: o nunca se migró, o va por delante del código desplegado. No se sabe si le faltan migraciones.',

    recientes: 'Últimas altas',
    esquemaReferencia: (version: string) => `Esquema más avanzado: ${version}`,
    sinEsquema: 'Ninguna base está lista todavía.',

    verEmpresas: 'Ver todas las empresas',
    verSalud: 'Ver la salud de los esquemas',

    // --- Barra de la pantalla ---
    contexto: (n: number) => (n === 1 ? 'Una empresa' : `${n} empresas`),
    actualizado: (hora: string) => `Actualizado a las ${hora}`,
    buscar: 'Buscar una empresa',
    nuevaEmpresa: 'Nueva empresa',

    // --- Gráfica ---
    altasPorMes: 'Altas por mes',
    altasPorMesApoyo: 'Empresas dadas de alta en cada uno de los últimos seis meses',
    altasEnElMes: (n: number, mes: string) =>
      n === 1 ? `Un alta en ${mes}` : `${n} altas en ${mes}`,

    // --- Tabla ---
    tabla: 'Estado de las empresas',
    chipTodas: 'Todas',
    chipActivas: 'Activas',
    chipPrueba: 'En prueba',
    chipDetenidas: 'Detenidas',
    verModulo: 'Ver módulo',
    colEsquema: 'Esquema',
    colModulos: 'Módulos',
    sinCoincidencias: 'Ninguna empresa coincide con lo que buscas.',
    modulosDe: (n: number, total: number) => `${n} de ${total} módulos`,
  },

  /** La pantalla de salud de esquemas, y el vocabulario de los TRES estados de esquema. */
  salud: {
    titulo: 'Salud de esquemas',
    contexto: (n: number) => (n === 1 ? 'Una empresa' : `${n} empresas`),
    contextoDesfasadas: (n: number) => (n === 1 ? 'una desfasada' : `${n} desfasadas`),

    versionDisponible: 'Versión disponible',
    versionDisponibleApoyo:
      'La migración más avanzada del binario que respondió, no la de la empresa más adelantada.',
    totalEmpresas: 'Empresas',
    pieTotal: 'En el reporte',
    desfasadas: 'Desfasadas',
    pieDesfasadas: (n: number) =>
      n === 0 ? 'Ninguna' : n === 1 ? 'Una base por migrar' : `${n} bases por migrar`,

    nadaQueReportar: 'No hay ninguna empresa desfasada.',
    nadaQueReportarApoyo: (n: number) =>
      n === 1
        ? 'La única base del reporte va en la versión disponible.'
        : `Las ${n} bases del reporte van en la versión disponible.`,
    peroSinComparar: (n: number) =>
      n === 1
        ? 'Ninguna aparece desfasada, pero hay una que no se pudo comparar. Revísala en la tabla.'
        : `Ninguna aparece desfasada, pero hay ${n} que no se pudieron comparar. Revísalas en la tabla.`,

    tabla: 'Esquema de cada empresa',
    verEmpresas: 'Ver todas las empresas',
    sinEmpresas: 'El reporte no trae ninguna empresa.',
    sinReporte: 'Todavía no hay reporte de esquemas.',

    colEmpresa: 'Identificador',
    colVersionAplicada: 'Versión aplicada',
    colPendientes: 'Pendientes',
    colEsquema: 'Esquema',
    nuncaMigrada: 'Nunca se migró',
    noAplica: 'No se pudo comparar',

    estadoAlDia: 'Al día',
    estadoDesfasada: 'Desfasada',
    estadoSinComparar: 'Sin comparar',
    leyendaAlDia: 'Su base va en la versión disponible.',
    leyendaDesfasada:
      'Le faltan migraciones para llegar a la versión disponible. Las aplica el comando migrar-empresas.',
    leyendaSinComparar:
      'No se pudo comparar: o nunca se migró, o su versión no la conoce el binario que respondió, que es lo que pasa cuando la base va POR DELANTE del código desplegado. Aquí no se afirma si le faltan migraciones ni cuántas.',
    limitacion:
      'El reporte abre cada base y lee su historial de migraciones, no la copia que la central tiene registrada, así que detecta también a quien migró por fuera. La contrapartida: una base que no responda aparece como «sin comparar», no como un error.',
  },

  hoja: {
    expandir: 'Expandir la hoja',
    contraer: 'Contraer la hoja',
    cerrar: 'Cerrar',
  },

  planes: {
    titulo: 'Planes',
    contexto: (n: number) => (n === 1 ? 'Un plan en el catálogo' : `${n} planes en el catálogo`),

    // --- Qué es un plan, dicho una vez y bien ---
    queEsUnPlan:
      'Crea y gestiona los planes que cada empresa podrá contratar. Los límites por empresa se gestionan en la propia empresa: este catálogo solo define qué módulos incluye cada plan.',

    sinPlanes: 'Todavía no hay ningún plan en el catálogo.',
    colPlan: 'Plan',
    colPrecio: 'Precio mensual',
    colModulos: 'Módulos',
    colEmpresas: 'Empresas',
    activo: 'Activo',
    retirado: 'Retirado',
    retirar: 'Retirar',
    reactivar: 'Reactivar',
    /** Se pregunta antes de retirar porque deja de poder contratarse. */
    confirmarRetiro: (codigo: string) =>
      `¿Retirar el plan «${codigo}»? Deja de ofrecerse en el alta de empresas. Quien ya lo tiene contratado no se ve afectado.`,
    sinSuscripciones: 'Nadie',
    conSuscripciones: (n: number) => (n === 1 ? 'Una empresa' : `${n} empresas`),

    // --- Formulario ---
    crear: 'Crear un plan',
    crearApoyo: 'El código no se puede cambiar después: es lo que viaja en el alta de una empresa.',
    codigo: 'Código',
    ayudaCodigo: 'Minúsculas, dígitos y guiones. Por ejemplo: profesional, basico-anual.',
    nombre: 'Nombre',
    descripcion: 'Descripción',
    opcional: '(opcional)',
    precio: 'Precio mensual',
    ayudaPrecio: 'Cero es válido: es un plan de cortesía o de prueba.',
    moneda: 'Moneda',
    orden: 'Orden',
    ayudaOrden: 'Posición al comparar planes. El menor va primero.',
    modulos: 'Módulos que incluye',
    ayudaModulos:
      'Al menos uno. Un plan sin módulos deja a la empresa dentro sin ver ni una pantalla.',
    seleccionados: (n: number, total: number) => `${n} de ${total} seleccionados`,
    todos: 'Todos',
    ninguno: 'Ninguno',
    guardar: 'Crear el plan',
    guardando: 'Creando…',

    // --- Lo que no se puede hacer, y por qué ---
    ayuda: 'Por qué no se puede editar un plan',
    cerrar: 'Cerrar',
    noSeEdita: 'Por qué no se puede editar un plan',
    noSeEditaPrecio:
      'El precio no tiene historia: la suscripción no guarda importe, solo apunta al plan. Cambiarlo reescribiría lo que pagaron los suscriptores anteriores.',
    noSeEditaModulos:
      'Quitar un módulo se lo quita a todos sus suscriptores, retroactivamente. Para cambiar la composición se retira el plan y se crea su sucesor.',
  },

  empresas: {
    titulo: 'Empresas',
    aprovisionada: (slug: string) => `${slug} aprovisionada`,
    baseYEsquema: (base: string, esquema: string) => `Base ${base}, esquema ${esquema}.`,
    invitacionEnviada: 'Invitación enviada.',
    invitacionNoEnviada: 'Invitación no enviada.',
    hayQueReenviar: 'Reenvíala desde su fila en la lista.',
    reenviar: 'Reenviar la invitación',
    reenviando: 'Reenviando…',
    // Ya no dice que el botón desaparece al recargar: dejó de ser verdad cuando la lista
    // empezó a traer `invitacionEnviada`. Lo que sí desaparece —y hay que decirlo, porque es
    // lo que se ve al terminar— es el botón de ESA fila cuando el envío sale bien.
    reenviarApoyo:
      'Se manda al correo que la empresa tiene guardado, no a uno que se pueda escribir aquí. Cuando el envío sale bien, el botón desaparece de su fila.',
    reenviada: (correo: string) => `Invitación reenviada a ${correo}.`,
    reenvioSinCorreo: 'La invitación se reemitió pero el correo NO salió',
    reenvioSinCorreoApoyo:
      '— y la liga anterior ya quedó invalidada, así que hay que volver a reenviarla.',
    ligaSoloDesarrollo: 'Liga (solo en desarrollo):',
    conteo: (n: number) => `${n} empresas`,
    ninguna: 'Todavía no hay ninguna.',
    colEmpresa: 'Empresa',
    colRazonSocial: 'Razón social',
    colEstado: 'Estado',
    colBase: 'Base',
    colPlan: 'Plan',
    sinSuscripcion: '— sin suscripción',
    conModulos: (n: number) => `(${n} módulos)`,
    crear: 'Nueva empresa',
    darDeAlta: 'Dar de alta una empresa',
    darDeAltaApoyo:
      'Crea y migra su base de datos, siembra sus roles y permisos, y manda la invitación a su primer administrador.',
    cerrar: 'Cerrar',
    identificador: 'Identificador',
    ayudaIdentificador: 'Minúsculas, dígitos y guiones. Es su subdominio: su gente entrará por',
    razonSocial: 'Razón social',
    rfc: 'RFC',
    telefono: 'Teléfono',
    nombreAdministrador: 'Nombre del administrador',
    correoAdministrador: 'Correo del administrador',
    plan: 'Plan que contrata',
    ayudaPlan: 'Determina a qué módulos tendrá acceso. Solo se ofrecen los planes activos.',
    sinPlanesActivos: 'No hay ningún plan activo: crea uno antes de dar de alta una empresa.',

    // --- Los mensajes de error de los campos propios de este alta ---
    //
    // Los de RFC, teléfono y correo NO están aquí: viven en `validacion`, porque son las
    // reglas de tres datos del dominio que también llevan `Cliente` y `Proveedor`. Estos
    // cuatro sí son de esta pantalla y de ninguna otra.
    //
    // Cada mensaje dice QUÉ SE ESPERA, nunca «campo inválido»: el mensaje es el único que
    // puede explicar por qué el botón amarillo sigue gris.
    errorIdentificador:
      'El identificador va en minúsculas, dígitos y guiones, de 3 a 50 caracteres, y no puede empezar ni terminar con guion.',
    errorRazonSocial: 'Escribe la razón social de la empresa, tal como aparece en su acta.',
    errorNombreAdministrador: 'Escribe el nombre de quien va a administrar la empresa.',
    errorPlan: 'Elige el plan que contrata la empresa.',

    aprovisionar: 'Dar de alta',
    aprovisionando: 'Aprovisionando…',
    tardaUnosSegundos: 'Tarda unos segundos: crea la base y le corre todas las migraciones.',
    estado: {
      prueba: 'Prueba',
      activo: 'Activo',
      suspendido: 'Suspendido',
      cancelado: 'Cancelado',
    },
    aprovisionamiento: {
      pendiente: 'Pendiente',
      creando: 'Creando…',
      lista: 'Lista',
      fallida: 'Fallida',
    },
  },

  /**
   * Los mensajes de los validadores de `nucleo/formularios/validadores.ts`.
   *
   * Están en su propia sección y no dentro de `empresas` porque las tres reglas son de datos
   * del DOMINIO, no de una pantalla: `Cliente` y `Proveedor` llevan RFC y teléfono, y
   * cualquier alta de usuario lleva correo. Un mensaje por regla, en el mismo sitio que la
   * regla.
   *
   * Y ninguno dice «campo inválido»: dicen la forma que se espera, con las longitudes. Es la
   * diferencia entre corregirlo en un intento y adivinar.
   */
  validacion: {
    rfc: 'El RFC lleva 12 caracteres si es persona moral y 13 si es persona física: 3 o 4 letras, 6 dígitos de la fecha y 3 de la homoclave. Puedes dejarlo vacío.',
    telefono: 'El teléfono lleva de 10 a 15 dígitos, solo números. Puedes dejarlo vacío.',
    correo:
      'El correo va con la forma nombre@dominio.mx: una sola arroba, un punto en el dominio y sin espacios.',
  },

  errores: {
    sinServidor: 'No se pudo contactar al servidor. Revisa que la API esté levantada.',
    conCodigo: (codigo: number) => `Error ${codigo}.`,
    inesperado: 'Ocurrió un error inesperado.',
  },

  /** Títulos de pestaña. `TituloPagina` les añade el nombre del producto detrás. */
  titulos: {
    invitacion: 'Define tu contraseña',
    panel: 'Resumen',
    planes: 'Planes',
    entrar: 'Entrar',
    recuperar: 'Recuperar tu contraseña',
    restablecer: 'Tu contraseña nueva',
    inicio: 'Inicio',
    marcas: 'Marcas',
    categorias: 'Categorías de equipo',
    puestos: 'Puestos de trabajo',
    tipos: 'Tipos de equipo',
    tarifas: 'Tarifas',
    clausulas: 'Cláusulas',
    modelos: 'Modelos',
    ubicaciones: 'Ubicaciones',
    superadministracion: 'Superadministración',
    empresas: 'Empresas',
    saludEsquemas: 'Salud de esquemas',
    portal: 'Entrar a tu empresa',
  },

  /**
   * Marcas de maquinaria. Es la pantalla canónica de un catálogo: los otros seis reusan
   * esta forma de textos —título, contexto, columnas, chips de filtro y la hoja—.
   */
  marcas: {
    titulo: 'Marcas',
    contexto: (n: number) => (n === 1 ? '1 marca' : `${n} marcas`),
    contextoActivas: (n: number) => (n === 1 ? '1 activa' : `${n} activas`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retirada' : `${n} retiradas`),
    contextoResultados: (n: number) => (n === 1 ? '1 resultado' : `${n} resultados`),
    buscar: 'Buscar una marca',
    crear: 'Nueva marca',
    crearApoyo: 'El nombre es su identidad: no puede repetirse.',
    editarTitulo: 'Editar la marca',
    editarApoyo: 'Cambiar el nombre lo cambia en todos los equipos que la usan.',
    nombre: 'Nombre',
    ayudaNombre: 'Como lo escribe el fabricante: Caterpillar, Komatsu, JCB.',
    todas: 'Todas',
    activas: 'Activas',
    retiradas: 'Retiradas',
    retirada: 'Retirada',
    colMarca: 'Marca',
    colModelos: 'Modelos',
    acciones: 'Acciones',
    editar: 'Editar',
    retirar: 'Retirar',
    reactivar: 'Reactivar',
    confirmarRetiro: (nombre: string) =>
      `¿Retirar «${nombre}»? Deja de ofrecerse al capturar un equipo. Los modelos y los equipos que ya la usan no cambian.`,
    sinMarcas: 'Todavía no hay marcas. La primera se crea con el botón de arriba.',
    sinResultados: (texto: string) => `Ninguna marca coincide con «${texto}».`,
    sinActivas: 'Ninguna marca está activa ahora mismo. Quita el filtro para ver las retiradas.',
    sinRetiradas: 'Ninguna marca está retirada. Quita el filtro para ver el catálogo completo.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} de ${total}`,
    paginacion: 'Paginación',
    paginaDe: (actual: number, total: number) => `Página ${actual} de ${total}`,
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    guardar: 'Guardar',
    guardando: 'Guardando…',
    cerrar: 'Cerrar',
  },

  /**
   * Nombres de los 26 módulos. La CLAVE la manda el backend (`modulo.clave` de la base
   * central) y no se traduce; lo que se traduce es lo que se enseña.
   */
  /**
   * Categorías de equipo. Mismo juego de textos que marcas, más los campos propios:
   * código y descripción. De una categoría cuelgan los TIPOS de equipo.
   */
  categorias: {
    titulo: 'Categorías de equipo',
    contexto: (n: number) => (n === 1 ? '1 categoría' : `${n} categorías`),
    contextoActivas: (n: number) => (n === 1 ? '1 activa' : `${n} activas`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retirada' : `${n} retiradas`),
    contextoResultados: (n: number) => (n === 1 ? '1 resultado' : `${n} resultados`),
    buscar: 'Buscar una categoría',
    crear: 'Nueva categoría',
    crearApoyo: 'Agrupa los tipos de equipo. El código no puede repetirse.',
    editarTitulo: 'Editar la categoría',
    editarApoyo: 'Los tipos que ya cuelgan de ella no cambian.',
    codigo: 'Código',
    ayudaCodigo: 'Corto y estable: EXC, CARGA, COMP. Identifica la categoría.',
    nombre: 'Nombre',
    descripcion: 'Descripción',
    opcional: '(opcional)',
    todas: 'Todas',
    activas: 'Activas',
    retiradas: 'Retiradas',
    retirada: 'Retirada',
    colCategoria: 'Categoría',
    colDescripcion: 'Descripción',
    colTipos: 'Tipos',
    acciones: 'Acciones',
    editar: 'Editar',
    retirar: 'Retirar',
    reactivar: 'Reactivar',
    confirmarRetiro: (nombre: string) =>
      `¿Retirar «${nombre}»? Deja de ofrecerse al crear un tipo de equipo. Los tipos que ya cuelgan de ella no cambian.`,
    sinCategorias: 'Todavía no hay categorías. La primera se crea con el botón de arriba.',
    sinResultados: (texto: string) => `Ninguna categoría coincide con «${texto}».`,
    sinActivas: 'Ninguna categoría está activa ahora mismo. Quita el filtro para ver las retiradas.',
    sinRetiradas: 'Ninguna categoría está retirada. Quita el filtro para ver el catálogo completo.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} de ${total}`,
    paginacion: 'Paginación',
    paginaDe: (actual: number, total: number) => `Página ${actual} de ${total}`,
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    guardar: 'Guardar',
    guardando: 'Guardando…',
    cerrar: 'Cerrar',
  },
  tipos: {
    titulo: 'Tipos de equipo',
    filtrarCategoria: 'Filtrar por categoría',
    todasLasCategorias: 'Todas las categorías',
    contextoDeCategoria: (n: number) =>
      n === 1 ? '1 en esta categoría' : `${n} en esta categoría`,
    sinDeEsaCategoria:
      'Esa categoría no tiene tipos. Elige «Todas las categorías» para ver el catálogo completo.',
    contexto: (n: number) => (n === 1 ? '1 tipo' : `${n} tipos`),
    contextoActivos: (n: number) => (n === 1 ? '1 activo' : `${n} activos`),
    contextoRetirados: (n: number) => (n === 1 ? '1 retirado' : `${n} retirados`),
    contextoResultados: (n: number) => (n === 1 ? '1 resultado' : `${n} resultados`),
    buscar: 'Buscar un tipo',
    crear: 'Nuevo tipo',
    crearApoyo: 'Cuelga de una categoría. El código no puede repetirse.',
    editarTitulo: 'Editar el tipo',
    editarApoyo: 'Los equipos que ya son de este tipo no cambian.',
    codigo: 'Código',
    ayudaCodigo: 'Corto y estable: EXC20, RETRO. Identifica el tipo.',
    nombre: 'Nombre',
    todos: 'Todos',
    activos: 'Activos',
    retirados: 'Retirados',
    retirado: 'Retirado',
    colTipo: 'Tipo',
    colCategoria: 'Categoría',
    categoria: 'Categoría',
    elegirCategoria: 'Elige una categoría',
    ayudaCategoria: 'Solo se ofrecen las categorías activas. Una retirada conserva los tipos que ya cuelgan de ella.',
    hacenFaltaCategorias: 'Todavía no hay categorías activas. Un tipo cuelga de una, así que primero crea una categoría.',
    
    colEquipos: 'Equipos',
    acciones: 'Acciones',
    editar: 'Editar',
    retirar: 'Retirar',
    reactivar: 'Reactivar',
    confirmarRetiro: (nombre: string) =>
      `¿Retirar «${nombre}»? Deja de ofrecerse al dar de alta un equipo. Los equipos que ya son de este tipo no cambian.`,
    sinTipos: 'Todavía no hay tipos. El primero se crea con el botón de arriba.',
    sinResultados: (texto: string) => `Ningún tipo coincide con «${texto}».`,
    sinActivos: 'Ningún tipo está activo ahora mismo. Quita el filtro para ver los retirados.',
    sinRetirados: 'Ningún tipo está retirado. Quita el filtro para ver el catálogo completo.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} de ${total}`,
    paginacion: 'Paginación',
    paginaDe: (actual: number, total: number) => `Página ${actual} de ${total}`,
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    guardar: 'Guardar',
    guardando: 'Guardando…',
    cerrar: 'Cerrar',
  },
  /**
   * Tarifas: el catálogo de conceptos cobrables. Los nombres de las unidades se traducen
   * aquí; los NÚMEROS son el contrato y no se tocan.
   */
  tarifas: {
    titulo: 'Tarifas',
    contexto: (n: number) => (n === 1 ? '1 tarifa' : `${n} tarifas`),
    contextoActivas: (n: number) => (n === 1 ? '1 activa' : `${n} activas`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retirada' : `${n} retiradas`),
    contextoResultados: (n: number) => (n === 1 ? '1 resultado' : `${n} resultados`),
    buscar: 'Buscar una tarifa',
    crear: 'Nueva tarifa',
    crearApoyo: 'Un concepto cobrable: renta por día, flete, limpieza.',
    editarTitulo: 'Editar la tarifa',
    editarApoyo: 'Las rentas que ya la usan conservan el importe que se capturó.',
    codigo: 'Código',
    ayudaCodigo: 'Corto y estable: RENTA-DIA, FLETE. Identifica la tarifa.',
    nombre: 'Nombre',
    descripcion: 'Descripción',
    opcional: '(opcional)',
    unidad: 'Unidad',
    ayudaUnidad: 'Decide cómo se multiplica el precio al cobrarla.',
    unidades: { 1: 'Hora', 2: 'Día', 3: 'Semana', 4: 'Mes', 5: 'Evento', 6: 'Kilómetro' } as Record<number, string>,
    dondeSeCobra: 'Dónde se cobra',
    ayudaDondeSeCobra:
      'No son excluyentes: un flete se cobra igual en una renta que en una venta. Al menos una.',
    renta: 'Renta',
    venta: 'Venta',
    rentaYVenta: 'Renta y venta',
    deRenta: 'De renta',
    deVenta: 'De venta',
    todas: 'Todas',
    activas: 'Activas',
    retiradas: 'Retiradas',
    retirada: 'Retirada',
    colTarifa: 'Tarifa',
    colUnidad: 'Unidad',
    colAplicaA: 'Se cobra en',
    acciones: 'Acciones',
    editar: 'Editar',
    retirar: 'Retirar',
    reactivar: 'Reactivar',
    confirmarRetiro: (nombre: string) =>
      `¿Retirar «${nombre}»? Deja de ofrecerse al cotizar y al rentar. Las rentas que ya la usan no cambian.`,
    sinTarifas: 'Todavía no hay tarifas. La primera se crea con el botón de arriba.',
    sinResultados: (texto: string) => `Ninguna tarifa coincide con «${texto}».`,
    sinActivas: 'Ninguna tarifa está activa ahora mismo. Quita el filtro para ver las retiradas.',
    sinRetiradas: 'Ninguna tarifa está retirada. Quita el filtro para ver el catálogo completo.',
    sinDeRenta: 'Ninguna tarifa se cobra en renta. Quita el filtro para ver las demás.',
    sinDeVenta: 'Ninguna tarifa se cobra en venta. Quita el filtro para ver las demás.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} de ${total}`,
    paginacion: 'Paginación',
    paginaDe: (actual: number, total: number) => `Página ${actual} de ${total}`,
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    guardar: 'Guardar',
    guardando: 'Guardando…',
    cerrar: 'Cerrar',
  },
  /**
   * Cláusulas de contrato. `orden` decide cómo se imprimen; `obligatoria` es una propiedad
   * de la cláusula, no un estado, así que se filtra aparte de activas.
   */
  clausulas: {
    titulo: 'Cláusulas',
    contexto: (n: number) => (n === 1 ? '1 cláusula' : `${n} cláusulas`),
    contextoActivas: (n: number) => (n === 1 ? '1 activa' : `${n} activas`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retirada' : `${n} retiradas`),
    contextoResultados: (n: number) => (n === 1 ? '1 resultado' : `${n} resultados`),
    buscar: 'Buscar una cláusula',
    crear: 'Nueva cláusula',
    crearApoyo: 'Entra al catálogo del que se enganchan las cláusulas de cada contrato.',
    editarTitulo: 'Editar la cláusula',
    editarApoyo: 'Los contratos ya firmados conservan el texto con el que se firmaron.',
    codigo: 'Código',
    tituloCampo: 'Título',
    texto: 'Texto',
    ayudaTexto: 'El párrafo tal como va a salir impreso en el contrato.',
    orden: 'Orden',
    ayudaOrden: 'Decide en qué posición se imprime, no cómo se lista aquí.',
    obligatoriedad: 'Obligatoriedad',
    esObligatoria: 'Entra en todos los contratos',
    ayudaObligatoria:
      'Una cláusula obligatoria se agrega sola y no hay que elegirla. Retirarla es lo que la saca.',
    todas: 'Todas',
    activas: 'Activas',
    retiradas: 'Retiradas',
    retirada: 'Retirada',
    cualquiera: 'Cualquiera',
    obligatorias: 'Obligatorias',
    opcionales: 'Opcionales',
    obligatoria: 'Obligatoria',
    colOrden: '#',
    colClausula: 'Cláusula',
    colTexto: 'Texto',
    acciones: 'Acciones',
    editar: 'Editar',
    retirar: 'Retirar',
    reactivar: 'Reactivar',
    confirmarRetiro: (titulo: string) =>
      `¿Retirar «${titulo}»? Deja de ofrecerse al armar un contrato. Los contratos que ya la llevan no cambian.`,
    confirmarRetiroObligatoria: (titulo: string) =>
      `«${titulo}» es OBLIGATORIA: hoy entra sola en todos los contratos. Al retirarla dejará de hacerlo, y los contratos nuevos saldrán sin ella. Los ya firmados no cambian.`,
    sinClausulas: 'Todavía no hay cláusulas. La primera se crea con el botón de arriba.',
    sinResultados: (texto: string) => `Ninguna cláusula coincide con «${texto}».`,
    sinActivas: 'Ninguna cláusula está activa ahora mismo. Quita el filtro para ver las retiradas.',
    sinRetiradas: 'Ninguna cláusula está retirada. Quita el filtro para ver el catálogo completo.',
    sinObligatorias: 'Ninguna cláusula es obligatoria. Quita el filtro para ver las opcionales.',
    sinOpcionales: 'Ninguna cláusula es opcional. Quita el filtro para ver las obligatorias.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} de ${total}`,
    paginacion: 'Paginación',
    paginaDe: (actual: number, total: number) => `Página ${actual} de ${total}`,
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    guardar: 'Guardar',
    guardando: 'Guardando…',
    cerrar: 'Cerrar',
  },
  /**
   * Modelos de equipo. La marca es obligatoria y el tipo no; los textos lo dicen en vez de
   * dejar que se deduzca del asterisco que no hay.
   */
  modelos: {
    titulo: 'Modelos',
    contexto: (n: number) => (n === 1 ? '1 modelo' : `${n} modelos`),
    contextoActivos: (n: number) => (n === 1 ? '1 activo' : `${n} activos`),
    contextoRetirados: (n: number) => (n === 1 ? '1 retirado' : `${n} retirados`),
    contextoResultados: (n: number) => (n === 1 ? '1 resultado' : `${n} resultados`),
    buscar: 'Buscar un modelo',
    crear: 'Nuevo modelo',
    crearApoyo: 'El 320D de Caterpillar, el PC200 de Komatsu. De él cuelgan los equipos.',
    editarTitulo: 'Editar el modelo',
    editarApoyo: 'Los equipos que ya son de este modelo se quedan como están.',
    marca: 'Marca',
    elegirMarca: 'Elige una marca',
    tipo: 'Tipo de equipo',
    ayudaTipo: 'Se puede dejar sin tipo y clasificarlo después.',
    sinTipo: 'Sin tipo',
    nombre: 'Nombre',
    ayudaNombre: 'Como lo nombra el fabricante: 320D, PC200-8, 3CX.',
    descripcion: 'Descripción',
    horasEntreServicios: 'Horas entre servicios',
    ayudaHoras: 'Cada cuántas horas de motor toca mantenimiento. Se puede dejar vacío.',
    filtrarMarca: 'Filtrar por marca',
    todasLasMarcas: 'Todas las marcas',
    todos: 'Todos',
    activos: 'Activos',
    retirados: 'Retirados',
    retirado: 'Retirado',
    colModelo: 'Modelo',
    colMarca: 'Marca',
    colTipo: 'Tipo',
    colServicio: 'Servicio',
    colEquipos: 'Equipos',
    cadaHoras: (n: number) => `Cada ${n} h`,
    sinDato: 'Sin definir',
    acciones: 'Acciones',
    editar: 'Editar',
    retirar: 'Retirar',
    reactivar: 'Reactivar',
    confirmarRetiro: (nombre: string) =>
      `¿Retirar «${nombre}»? Deja de ofrecerse al dar de alta un equipo. Los equipos que ya son de este modelo no cambian.`,
    hacenFaltaMarcas:
      'Todavía no hay marcas activas, y un modelo tiene que colgar de una. Crea la marca primero, en Marcas.',
    sinModelos: 'Todavía no hay modelos. El primero se crea con el botón de arriba.',
    sinResultados: (texto: string) => `Ningún modelo coincide con «${texto}».`,
    sinDeEsaMarca: 'Esa marca no tiene modelos. Elige «Todas las marcas» para ver el catálogo completo.',
    sinActivos: 'Ningún modelo está activo ahora mismo. Quita el filtro para ver los retirados.',
    sinRetirados: 'Ningún modelo está retirado. Quita el filtro para ver el catálogo completo.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} de ${total}`,
    paginacion: 'Paginación',
    paginaDe: (actual: number, total: number) => `Página ${actual} de ${total}`,
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    guardar: 'Guardar',
    guardando: 'Guardando…',
    cerrar: 'Cerrar',
  },
  /**
   * Ubicaciones. Los rótulos de `tipos` y `capacidades` van indexados por el valor del enum
   * —1 Bodega · 2 Sucursal · 3 Patio— para que un tipo nuevo en el backend salte aquí.
   *
   * `capacidades` no describe el tipo, dice QUÉ PUEDE HACER: es lo que decide si esa
   * ubicación sirve para lo que la persona necesita.
   */
  ubicaciones: {
    titulo: 'Ubicaciones',
    contexto: (n: number) => (n === 1 ? '1 ubicación' : `${n} ubicaciones`),
    contextoActivas: (n: number) => (n === 1 ? '1 activa' : `${n} activas`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retirada' : `${n} retiradas`),
    contextoResultados: (n: number) => (n === 1 ? '1 resultado' : `${n} resultados`),
    contextoDeTipo: (n: number, tipo: string) =>
      n === 1 ? `1 ${tipo}` : `${n} de tipo ${tipo}`,
    buscar: 'Buscar una ubicación',
    crear: 'Nueva ubicación',
    crearApoyo: 'Una bodega, una sucursal o un patio. De aquí cuelgan los equipos.',
    editarTitulo: 'Editar la ubicación',
    editarApoyo: 'Los equipos que ya están aquí se quedan donde están.',
    tipos: { 1: 'Bodega', 2: 'Sucursal', 3: 'Patio' } as Record<number, string>,
    capacidades: {
      1: 'guarda equipo, no cotiza',
      2: 'cotiza, no guarda equipo',
      3: 'guarda equipo y cotiza',
    } as Record<number, string>,
    codigo: 'Código',
    ayudaCodigo: 'Corto y único. Es como se nombra la ubicación en los documentos.',
    nombre: 'Nombre',
    tipo: 'Tipo',
    ayudaTipo:
      'Decide si aquí se puede guardar equipo y si desde aquí se puede cotizar. No se elige por separado.',
    ayudaTipoEdicion:
      'Si le quitas la capacidad de guardar equipo y ya hay máquinas aquí, el cambio se rechaza. Muévelas primero.',
    domicilio: 'Domicilio',
    telefono: 'Teléfono',
    latitud: 'Latitud',
    longitud: 'Longitud',
    ayudaCoordenadas: 'Opcionales. Si pones una, pon la otra: media coordenada no ubica nada.',
    coordenadaIncompleta: 'Faltan la latitud o la longitud. Van las dos, o ninguna.',
    todas: 'Todas',
    activas: 'Activas',
    retiradas: 'Retiradas',
    retirada: 'Retirada',
    cualquierTipo: 'Cualquier tipo',
    colUbicacion: 'Ubicación',
    colTipo: 'Tipo',
    colDomicilio: 'Domicilio',
    colTelefono: 'Teléfono',
    colEquipos: 'Equipos',
    sinDato: 'Sin definir',
    acciones: 'Acciones',
    editar: 'Editar',
    retirar: 'Retirar',
    reactivar: 'Reactivar',
    confirmarRetiro: (nombre: string) =>
      `¿Retirar «${nombre}»? Deja de ofrecerse al dar de alta un equipo o al mover uno.`,
    confirmarRetiroConEquipos: (nombre: string, n: number) =>
      `«${nombre}» tiene ${n === 1 ? '1 equipo' : `${n} equipos`} registrados. Al retirarla dejará de ofrecerse, pero esas máquinas se quedan asignadas ahí. Conviene moverlas antes.`,
    sinUbicaciones: 'Todavía no hay ubicaciones. La primera se crea con el botón de arriba.',
    sinResultados: (texto: string) => `Ninguna ubicación coincide con «${texto}».`,
    sinDeEseTipo: (tipo: string) =>
      `No hay ninguna de tipo ${tipo}. Elige «Cualquier tipo» para ver el catálogo completo.`,
    sinActivas: 'Ninguna ubicación está activa ahora mismo. Quita el filtro para ver las retiradas.',
    sinRetiradas: 'Ninguna ubicación está retirada. Quita el filtro para ver el catálogo completo.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} de ${total}`,
    paginacion: 'Paginación',
    paginaDe: (actual: number, total: number) => `Página ${actual} de ${total}`,
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    guardar: 'Guardar',
    guardando: 'Guardando…',
    cerrar: 'Cerrar',
  },





  puestos: {
    titulo: 'Puestos de trabajo',
    contexto: (n: number) => (n === 1 ? '1 puesto' : `${n} puestos`),
    contextoActivas: (n: number) => (n === 1 ? '1 activo' : `${n} activos`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retirado' : `${n} retirados`),
    contextoResultados: (n: number) => (n === 1 ? '1 resultado' : `${n} resultados`),
    buscar: 'Buscar un puesto',
    crear: 'Nuevo puesto',
    crearApoyo: 'De él cuelgan los trabajadores. El código no puede repetirse.',
    editarTitulo: 'Editar el puesto',
    editarApoyo: 'Los trabajadores que ya lo tienen no cambian.',
    codigo: 'Código',
    ayudaCodigo: 'Corto y estable: OPER, MEC, CHOFER. Identifica el puesto.',
    nombre: 'Nombre',
    descripcion: 'Descripción',
    opcional: '(opcional)',
    todas: 'Todos',
    activas: 'Activos',
    retiradas: 'Retirados',
    retirada: 'Retirado',
    colPuesto: 'Puesto',
    colDescripcion: 'Descripción',
    colTrabajadores: 'Trabajadores',
    acciones: 'Acciones',
    editar: 'Editar',
    retirar: 'Retirar',
    reactivar: 'Reactivar',
    confirmarRetiro: (nombre: string) =>
      `¿Retirar «${nombre}»? Deja de ofrecerse al dar de alta un trabajador. Los que ya lo tienen no cambian.`,
    sinPuestos: 'Todavía no hay puestos. El primero se crea con el botón de arriba.',
    sinResultados: (texto: string) => `Ningún puesto coincide con «${texto}».`,
    sinActivas: 'Ningún puesto está activo ahora mismo. Quita el filtro para ver los retirados.',
    sinRetiradas: 'Ningún puesto está retirado. Quita el filtro para ver el catálogo completo.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} de ${total}`,
    paginacion: 'Paginación',
    paginaDe: (actual: number, total: number) => `Página ${actual} de ${total}`,
    anterior: 'Anterior',
    siguiente: 'Siguiente',
    guardar: 'Guardar',
    guardando: 'Guardando…',
    cerrar: 'Cerrar',
  },


  modulos: {
    dashboard: 'Dashboard',
    equipos: 'Equipos',
    disponibilidad: 'Disponibilidad',
    clientes: 'Clientes',
    cotizaciones: 'Cotizaciones',
    contratos: 'Contratos',
    rentas: 'Rentas',
    logistica: 'Logística y fletes',
    'inspeccion-salida': 'Inspección de salida',
    'inspeccion-devolucion': 'Inspección de devolución',
    evidencias: 'Evidencias',
    horometros: 'Horómetros',
    mantenimiento: 'Mantenimiento',
    'ordenes-trabajo': 'Órdenes de trabajo',
    'proximo-servicio': 'Próximo servicio',
    refacciones: 'Refacciones',
    compras: 'Compras',
    proveedores: 'Proveedores',
    pagos: 'Pagos y cobranza',
    facturacion: 'Facturación',
    sucursales: 'Sucursales y patios',
    usuarios: 'Usuarios y permisos',
    notificaciones: 'Notificaciones',
    reportes: 'Reportes',
    qr: 'QR de equipos',
    subrenta: 'Subrentas',
  },
};

/** La forma del diccionario. Sale del español, que es el que siempre está completo. */
export type Textos = typeof ES_MX;

/**
 * El inglés se declara CON el tipo, no inferido: eso es lo que convierte una traducción
 * que falta —o una clave inventada— en un error de compilación.
 */
const EN_US: Textos = {
  comun: {
    salir: 'Sign out',
    cancelar: 'Cancel',
    irAlContenido: 'Skip to content',
    abrirMenu: 'Open the menu',
    cerrarMenu: 'Close the menu',
    tuCuenta: 'Your account',
    cargando: 'Loading…',
    entrar: 'Sign in',
    entrando: 'Signing in…',
    correo: 'Email address',
    marcadorCorreo: 'Your email address',
    faltanCredenciales: 'Enter your email and password.',
    noCoinciden: 'The two passwords do not match.',
    largoMinimo: (n: number) =>
      `At least ${n} characters. No uppercase or symbols required: length is what counts.`,
  },

  campoContrasena: {
    etiqueta: 'Password',
    marcador: 'Your password',
    mostrar: 'Show the password',
    ocultar: 'Hide the password',
  },

  idioma: {
    etiqueta: (nombre: string) => `Language: ${nombre}`,
  },

  menu: {
    inicio: 'Home',
    dashboard: 'Dashboard',
    planes: 'Plans',
    catalogos: 'Catalogs',
    marcas: 'Brands',
    categorias: 'Categories',
    puestos: 'Positions',
    tipos: 'Types',
    tarifas: 'Rates',
    clausulas: 'Clauses',
    modelos: 'Models',
    ubicaciones: 'Locations',
    operacion: 'Operations',
    equipos: 'Equipment',
    clientes: 'Customers',
    rentas: 'Rentals',
    empresas: 'Companies',
    esquemas: 'Schemas',
    navegacionPrincipal: 'Main navigation',
    navegacionEmpresa: 'Company navigation',
    navegacionPlataforma: 'Platform navigation',
    superadministracion: 'Platform admin',
  },

  entrarEmpresa: {
    titulo: 'Sign in',
    apoyo: 'Enter your details to manage the assets of',
    olvidaste: 'Forgot your password?',
    activada: 'Your account is active. Sign in with your email and your new password.',
    restablecida:
      'Your password was changed and all other sessions were closed. Sign in with the new one.',
    expirada: 'Your session expired. Sign in again with your email and password.',
  },

  entrarPlataforma: {
    titulo: 'Admin panel',
    apoyo: 'Manage and control the companies on the system.',
  },

  portal: {
    titulo: 'Sign in to your company',
    apoyo: 'Each company has its own sign-in page. We will take you to yours.',
    etiquetaEmpresa: 'Company',
    marcadorEmpresa: "Your company's identifier",
    ayudaEmpresa: "The identifier you were given. We will take you to your company's page.",
    formatoInvalido: 'Use only lowercase letters, numbers and hyphens.',
    continuar: 'Continue',
  },

  invitacion: {
    titulo: 'Set your password',
    activando: (nombre: string, correo: string, empresa: string) =>
      `You are activating access for ${nombre} (${correo}) to ${empresa}.`,
    verificando: 'Checking the link…',
    pideOtra: 'Ask whoever administers the system for a new invitation.',
    ligaIncompleta: 'The link is incomplete.',
    etiquetaNueva: 'Password',
    marcadorNueva: 'Your new password',
    etiquetaRepetir: 'Repeat it',
    marcadorRepetir: 'Repeat the password',
    activar: 'Activate my account',
    activando_: 'Activating…',
  },

  recuperar: {
    titulo: 'Recover your password',
    apoyo: 'Recovering access to',
    etiquetaCorreo: 'Email',
    marcadorCorreo: 'Your email',
    ayudaCorreo: 'The email you use to sign in to this company. The link expires in one hour.',
    enviar: 'Send me the link',
    enviando: 'Sending…',
    volver: 'Back to sign in',
    demasiadas: 'Too many links were requested from here. Wait 15 minutes and try again.',
  },

  restablecer: {
    titulo: 'Your new password',
    tituloInvalida: 'This link no longer works',
    apoyo: 'Resetting access to',
    comprobando: 'Checking the link…',
    duranUnaHora: 'Reset links last one hour and work only once. You can request another.',
    pedirOtra: 'Request a new link',
    noSePudoComprobar:
      'The link could not be checked. Open it again in a moment: it stays valid until it expires.',
    etiquetaNueva: 'New password',
    marcadorNueva: 'Your new password',
    etiquetaRepetir: 'Repeat it',
    marcadorRepetir: 'Repeat the password',
    muyCorta: (n: number) => `The password needs at least ${n} characters.`,
    avisoSesiones:
      'Saving it will close every other open session on your account. You will have to sign in again on your other devices.',
    guardar: 'Save and close the other sessions',
    guardando: 'Saving…',
    ligaIncompleta: 'The link is incomplete.',
  },

  inicio: {
    tuAcceso: 'Your access',
    autorizacion: 'Authorization',
    accesoTotal: 'Full access (system role)',
    permisos: (n: number) => `${n} permissions`,
    modulosContratados: 'Modules included',
    deTotal: (n: number, total: number) => `${n} of ${total}`,
    implementados: 'Built',
    avisoAccesoTotal:
      'Your role skips the permission check. It cannot be edited or deleted, and it is not assigned from the interface.',
    modulos: 'Modules',
    disponible: 'Available',
    porConstruir: 'Not built yet',
    cargandoSesion: 'Loading your session…',
  },

  panel: {
    titulo: 'Overview',
    apoyo: 'Everything here comes from company provisioning. No figure is an estimate.',

    totalEmpresas: 'Companies',
    pieTotal: (n: number) => (n === 1 ? 'One on the platform' : `${n} on the platform`),
    activas: 'Active',
    pieActivas: 'With a running subscription',
    enPrueba: 'On trial',
    pieEnPrueba: 'Not signed up yet',
    requierenAtencion: 'Need attention',
    pieAtencionCero: 'Nothing pending',
    pieAtencion: (n: number) => (n === 1 ? '1 open alert' : `${n} open alerts`),

    enProceso: (n: number) =>
      n === 1 ? 'One provisioning run in progress' : `${n} provisioning runs in progress`,

    avisos: 'What needs attention',
    sinAvisos: 'Nothing needs attention.',
    sinEmpresas: 'No company has been added yet.',

    motivoFallida: 'Provisioning failed',
    detalleFallida:
      'Its database was left half-built. Adding it again with the same identifier retries the process.',
    motivoSinSuscripcion: 'No subscription',
    detalleSinSuscripcion:
      'Its database exists but has no plan, so its people see no modules at all.',
    motivoEsquemaDesfasado: 'Schema behind',
    detalleEsquemaDesfasado: (pendientes: number) =>
      pendientes === 1
        ? 'It is one migration behind the binary that answered.'
        : `It is ${pendientes} migrations behind the binary that answered.`,
    motivoEsquemaSinComparar: 'Schema not comparable',
    detalleEsquemaSinComparar:
      'Its version could not be compared with the binary: either it was never migrated, or it is ahead of the deployed code. Whether it is missing migrations is unknown.',

    recientes: 'Latest additions',
    esquemaReferencia: (version: string) => `Furthest schema: ${version}`,
    sinEsquema: 'No database is ready yet.',

    verEmpresas: 'See every company',
    verSalud: 'See schema health',

    // --- Barra de la pantalla ---
    contexto: (n: number) => (n === 1 ? 'One company' : `${n} companies`),
    actualizado: (hora: string) => `Updated at ${hora}`,
    buscar: 'Search for a company',
    nuevaEmpresa: 'New company',

    // --- Grafica ---
    altasPorMes: 'Additions per month',
    altasPorMesApoyo: 'Companies added in each of the last six months',
    altasEnElMes: (n: number, mes: string) =>
      n === 1 ? `One addition in ${mes}` : `${n} additions in ${mes}`,

    // --- Tabla ---
    tabla: 'Company status',
    chipTodas: 'All',
    chipActivas: 'Active',
    chipPrueba: 'On trial',
    chipDetenidas: 'Stopped',
    verModulo: 'Open module',
    colEsquema: 'Schema',
    colModulos: 'Modules',
    sinCoincidencias: 'No company matches your search.',
    modulosDe: (n: number, total: number) => `${n} of ${total} modules`,
  },

  salud: {
    titulo: 'Schema health',
    contexto: (n: number) => (n === 1 ? 'One company' : `${n} companies`),
    contextoDesfasadas: (n: number) => (n === 1 ? 'one behind' : `${n} behind`),

    versionDisponible: 'Available version',
    versionDisponibleApoyo:
      'The furthest migration of the binary that answered, not that of the most advanced company.',
    totalEmpresas: 'Companies',
    pieTotal: 'In the report',
    desfasadas: 'Behind',
    pieDesfasadas: (n: number) =>
      n === 0 ? 'None' : n === 1 ? 'One database to migrate' : `${n} databases to migrate`,

    nadaQueReportar: 'No company is behind.',
    nadaQueReportarApoyo: (n: number) =>
      n === 1
        ? 'The only database in the report is on the available version.'
        : `All ${n} databases in the report are on the available version.`,
    peroSinComparar: (n: number) =>
      n === 1
        ? 'None shows as behind, but one could not be compared. Check it in the table.'
        : `None shows as behind, but ${n} could not be compared. Check them in the table.`,

    tabla: 'Schema of each company',
    verEmpresas: 'See every company',
    sinEmpresas: 'The report has no companies in it.',
    sinReporte: 'There is no schema report yet.',

    colEmpresa: 'Identifier',
    colVersionAplicada: 'Applied version',
    colPendientes: 'Pending',
    colEsquema: 'Schema',
    nuncaMigrada: 'Never migrated',
    noAplica: 'Could not be compared',

    estadoAlDia: 'Up to date',
    estadoDesfasada: 'Behind',
    estadoSinComparar: 'Not comparable',
    leyendaAlDia: 'Its database is on the available version.',
    leyendaDesfasada:
      'It is missing migrations to reach the available version. The migrar-empresas command applies them.',
    leyendaSinComparar:
      'It could not be compared: either it was never migrated, or the binary that answered does not know its version, which is what happens when the database is AHEAD of the deployed code. Nothing is claimed here about whether or how many migrations it is missing.',
    limitacion:
      'The report opens each database and reads its migration history, not the copy the central database has on record, so it also catches anyone who migrated outside the tool. The trade-off: a database that does not answer shows up as “could not compare”, not as an error.',
  },

  hoja: {
    expandir: 'Expand the sheet',
    contraer: 'Collapse the sheet',
    cerrar: 'Close',
  },

  planes: {
    titulo: 'Plans',
    contexto: (n: number) =>
      n === 1 ? 'One plan in the catalogue' : `${n} plans in the catalogue`,

    queEsUnPlan:
      'A plan is its set of modules: that is what is sold. Quotas —equipment, users, storage— do not belong here: they are negotiated per company.',

    sinPlanes: 'There are no plans in the catalogue yet.',
    colPlan: 'Plan',
    colPrecio: 'Monthly price',
    colModulos: 'Modules',
    colEmpresas: 'Companies',
    activo: 'Active',
    retirado: 'Retired',
    retirar: 'Retire',
    reactivar: 'Reactivate',
    confirmarRetiro: (codigo: string) =>
      `Retire the plan "${codigo}"? It stops being offered when adding a company. Whoever already has it is unaffected.`,
    sinSuscripciones: 'Nobody',
    conSuscripciones: (n: number) => (n === 1 ? 'One company' : `${n} companies`),

    crear: 'Create a plan',
    crearApoyo: 'The code cannot be changed later: it is what travels when adding a company.',
    codigo: 'Code',
    ayudaCodigo: 'Lowercase, digits and hyphens. For example: professional, basic-annual.',
    nombre: 'Name',
    descripcion: 'Description',
    opcional: '(optional)',
    precio: 'Monthly price',
    ayudaPrecio: 'Zero is valid: it is a courtesy or trial plan.',
    moneda: 'Currency',
    orden: 'Order',
    ayudaOrden: 'Position when comparing plans. The lowest goes first.',
    modulos: 'Modules included',
    ayudaModulos:
      'At least one. A plan with no modules leaves the company inside without a single screen.',
    seleccionados: (n: number, total: number) => `${n} of ${total} selected`,
    todos: 'All',
    ninguno: 'None',
    guardar: 'Create the plan',
    guardando: 'Creating…',

    ayuda: 'Why a plan cannot be edited',
    cerrar: 'Close',
    noSeEdita: 'Why a plan cannot be edited',
    noSeEditaPrecio:
      'The price has no history: a subscription stores no amount, it only points at the plan. Changing it would rewrite what previous subscribers paid.',
    noSeEditaModulos:
      'Removing a module removes it from every subscriber, retroactively. To change the composition, retire the plan and create its successor.',
  },

  empresas: {
    titulo: 'Companies',
    aprovisionada: (slug: string) => `${slug} provisioned`,
    baseYEsquema: (base: string, esquema: string) => `Database ${base}, schema ${esquema}.`,
    invitacionEnviada: 'Invitation sent.',
    invitacionNoEnviada: 'The invitation was NOT sent',
    hayQueReenviar: '— resend it from its row in the list.',
    reenviar: 'Resend the invitation',
    reenviando: 'Resending…',
    reenviarApoyo:
      'It goes to the email stored on the company, not to one you could type here. When the send succeeds, the button disappears from its row.',
    reenviada: (correo: string) => `Invitation resent to ${correo}.`,
    reenvioSinCorreo: 'The invitation was reissued but the email did NOT go out',
    reenvioSinCorreoApoyo:
      '— and the previous link is already invalidated, so it has to be resent again.',
    ligaSoloDesarrollo: 'Link (development only):',
    conteo: (n: number) => `${n} companies`,
    ninguna: 'There are none yet.',
    colEmpresa: 'Company',
    colRazonSocial: 'Legal name',
    colEstado: 'Status',
    colBase: 'Database',
    colPlan: 'Plan',
    sinSuscripcion: '— no subscription',
    conModulos: (n: number) => `(${n} modules)`,
    crear: 'New company',
    darDeAlta: 'Add a company',
    darDeAltaApoyo:
      'Creates and migrates its database, seeds its roles and permissions, and sends the invitation to its first administrator.',
    cerrar: 'Close',
    identificador: 'Identifier',
    ayudaIdentificador:
      'Lowercase, digits and hyphens. It is their subdomain: their people will sign in at',
    razonSocial: 'Legal name',
    rfc: 'Tax ID',
    telefono: 'Phone',
    nombreAdministrador: "Administrator's name",
    correoAdministrador: "Administrator's email",
    plan: 'Plan',
    ayudaPlan: 'Decides which modules they will have access to. Only active plans are offered.',
    sinPlanesActivos: 'There is no active plan: create one before adding a company.',

    errorIdentificador:
      'The identifier takes lowercase letters, digits and hyphens, 3 to 50 characters, and cannot start or end with a hyphen.',
    errorRazonSocial: "Write the company's legal name, as it appears on its incorporation deed.",
    errorNombreAdministrador: 'Write the name of whoever will administer the company.',
    errorPlan: 'Pick the plan the company subscribes to.',

    aprovisionar: 'Add',
    aprovisionando: 'Provisioning…',
    tardaUnosSegundos:
      'Takes a few seconds: it creates the database and runs every migration on it.',
    estado: {
      prueba: 'Trial',
      activo: 'Active',
      suspendido: 'Suspended',
      cancelado: 'Cancelled',
    },
    aprovisionamiento: {
      pendiente: 'Pending',
      creando: 'Creating…',
      lista: 'Ready',
      fallida: 'Failed',
    },
  },

  validacion: {
    rfc: 'A Mexican tax ID is 12 characters for a company and 13 for an individual: 3 or 4 letters, 6 date digits and a 3-character check code. You may leave it empty.',
    telefono: 'A phone number takes 10 to 15 digits, numbers only. You may leave it empty.',
    correo:
      'The email must look like name@domain.com: a single at sign, a dot in the domain and no spaces.',
  },

  errores: {
    sinServidor: 'Could not reach the server. Check that the API is running.',
    conCodigo: (codigo: number) => `Error ${codigo}.`,
    inesperado: 'Something unexpected went wrong.',
  },

  titulos: {
    invitacion: 'Set your password',
    panel: 'Overview',
    planes: 'Plans',
    entrar: 'Sign in',
    recuperar: 'Recover your password',
    restablecer: 'Your new password',
    inicio: 'Home',
    marcas: 'Brands',
    categorias: 'Equipment categories',
    puestos: 'Job positions',
    tipos: 'Equipment types',
    tarifas: 'Rates',
    clausulas: 'Clauses',
    modelos: 'Models',
    ubicaciones: 'Locations',
    superadministracion: 'Platform admin',
    empresas: 'Companies',
    saludEsquemas: 'Schema health',
    portal: 'Sign in to your company',
  },

  marcas: {
    titulo: 'Brands',
    contexto: (n: number) => (n === 1 ? '1 brand' : `${n} brands`),
    contextoActivas: (n: number) => (n === 1 ? '1 active' : `${n} active`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retired' : `${n} retired`),
    contextoResultados: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    buscar: 'Search a brand',
    crear: 'New brand',
    crearApoyo: 'The name is its identity: it cannot repeat.',
    editarTitulo: 'Edit brand',
    editarApoyo: 'Renaming it changes it on every piece of equipment that uses it.',
    nombre: 'Name',
    ayudaNombre: 'As the manufacturer writes it: Caterpillar, Komatsu, JCB.',
    todas: 'All',
    activas: 'Active',
    retiradas: 'Retired',
    retirada: 'Retired',
    colMarca: 'Brand',
    colModelos: 'Models',
    acciones: 'Actions',
    editar: 'Edit',
    retirar: 'Retire',
    reactivar: 'Reactivate',
    confirmarRetiro: (nombre: string) =>
      `Retire "${nombre}"? It stops being offered when adding equipment. Models and equipment already using it do not change.`,
    sinMarcas: 'No brands yet. Create the first one with the button above.',
    sinResultados: (texto: string) => `No brand matches “${texto}”.`,
    sinActivas: 'No brand is active right now. Clear the filter to see retired ones.',
    sinRetiradas: 'No brand is retired. Clear the filter to see the whole catalog.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} of ${total}`,
    paginacion: 'Pagination',
    paginaDe: (actual: number, total: number) => `Page ${actual} of ${total}`,
    anterior: 'Previous',
    siguiente: 'Next',
    guardar: 'Save',
    guardando: 'Saving…',
    cerrar: 'Close',
  },

  categorias: {
    titulo: 'Equipment categories',
    contexto: (n: number) => (n === 1 ? '1 category' : `${n} categories`),
    contextoActivas: (n: number) => (n === 1 ? '1 active' : `${n} active`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retired' : `${n} retired`),
    contextoResultados: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    buscar: 'Search a category',
    crear: 'New category',
    crearApoyo: 'Groups equipment types. The code cannot repeat.',
    editarTitulo: 'Edit category',
    editarApoyo: 'Types already under it do not change.',
    codigo: 'Code',
    ayudaCodigo: 'Short and stable: EXC, LOAD, COMP. It identifies the category.',
    nombre: 'Name',
    descripcion: 'Description',
    opcional: '(optional)',
    todas: 'All',
    activas: 'Active',
    retiradas: 'Retired',
    retirada: 'Retired',
    colCategoria: 'Category',
    colDescripcion: 'Description',
    colTipos: 'Types',
    acciones: 'Actions',
    editar: 'Edit',
    retirar: 'Retire',
    reactivar: 'Reactivate',
    confirmarRetiro: (nombre: string) =>
      `Retire "${nombre}"? It stops being offered when creating an equipment type. Types already under it do not change.`,
    sinCategorias: 'No categories yet. Create the first one with the button above.',
    sinResultados: (texto: string) => `No category matches “${texto}”.`,
    sinActivas: 'No category is active right now. Clear the filter to see retired ones.',
    sinRetiradas: 'No category is retired. Clear the filter to see the whole catalog.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} of ${total}`,
    paginacion: 'Pagination',
    paginaDe: (actual: number, total: number) => `Page ${actual} of ${total}`,
    anterior: 'Previous',
    siguiente: 'Next',
    guardar: 'Save',
    guardando: 'Saving…',
    cerrar: 'Close',
  },
  tipos: {
    titulo: 'Equipment types',
    filtrarCategoria: 'Filter by category',
    todasLasCategorias: 'All categories',
    contextoDeCategoria: (n: number) => (n === 1 ? '1 in this category' : `${n} in this category`),
    sinDeEsaCategoria:
      'That category has no types. Pick “All categories” to see the whole catalog.',
    contexto: (n: number) => (n === 1 ? '1 type' : `${n} types`),
    contextoActivos: (n: number) => (n === 1 ? '1 active' : `${n} active`),
    contextoRetirados: (n: number) => (n === 1 ? '1 retired' : `${n} retired`),
    contextoResultados: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    buscar: 'Search a type',
    crear: 'New type',
    crearApoyo: 'It hangs from a category. The code cannot repeat.',
    editarTitulo: 'Edit type',
    editarApoyo: 'Equipment already of this type does not change.',
    codigo: 'Code',
    ayudaCodigo: 'Short and stable: EXC20, RETRO. It identifies the type.',
    nombre: 'Name',
    
    
    todos: 'All',
    activos: 'Active',
    retirados: 'Retired',
    retirado: 'Retired',
    colTipo: 'Type',
    colCategoria: 'Category',
    categoria: 'Category',
    elegirCategoria: 'Choose a category',
    ayudaCategoria: 'Only active categories are offered. A retired one keeps the types it already has.',
    hacenFaltaCategorias: 'There are no active categories yet. A type hangs from one, so create a category first.',
    
    colEquipos: 'Equipment',
    acciones: 'Actions',
    editar: 'Edit',
    retirar: 'Retire',
    reactivar: 'Reactivate',
    confirmarRetiro: (nombre: string) =>
      `Retire "${nombre}"? It stops being offered when adding equipment. Equipment already of this type does not change.`,
    sinTipos: 'No types yet. Create the first one with the button above.',
    sinResultados: (texto: string) => `No type matches “${texto}”.`,
    sinActivos: 'No type is active right now. Clear the filter to see retired ones.',
    sinRetirados: 'No type is retired. Clear the filter to see the whole catalog.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} of ${total}`,
    paginacion: 'Pagination',
    paginaDe: (actual: number, total: number) => `Page ${actual} of ${total}`,
    anterior: 'Previous',
    siguiente: 'Next',
    guardar: 'Save',
    guardando: 'Saving…',
    cerrar: 'Close',
  },
  tarifas: {
    titulo: 'Rates',
    contexto: (n: number) => (n === 1 ? '1 rate' : `${n} rates`),
    contextoActivas: (n: number) => (n === 1 ? '1 active' : `${n} active`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retired' : `${n} retired`),
    contextoResultados: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    buscar: 'Search a rate',
    crear: 'New rate',
    crearApoyo: 'A billable concept: daily rental, haulage, cleaning.',
    editarTitulo: 'Edit rate',
    editarApoyo: 'Rentals already using it keep the amount that was captured.',
    codigo: 'Code',
    ayudaCodigo: 'Short and stable: RENT-DAY, HAUL. It identifies the rate.',
    nombre: 'Name',
    descripcion: 'Description',
    opcional: '(optional)',
    unidad: 'Unit',
    ayudaUnidad: 'Decides how the price is multiplied when charged.',
    unidades: { 1: 'Hour', 2: 'Day', 3: 'Week', 4: 'Month', 5: 'Event', 6: 'Kilometer' } as Record<number, string>,
    dondeSeCobra: 'Where it is charged',
    ayudaDondeSeCobra:
      'Not exclusive: haulage is charged on a rental as well as on a sale. At least one.',
    renta: 'Rental',
    venta: 'Sale',
    rentaYVenta: 'Rental and sale',
    deRenta: 'Rental only',
    deVenta: 'Sale only',
    todas: 'All',
    activas: 'Active',
    retiradas: 'Retired',
    retirada: 'Retired',
    colTarifa: 'Rate',
    colUnidad: 'Unit',
    colAplicaA: 'Charged on',
    acciones: 'Actions',
    editar: 'Edit',
    retirar: 'Retire',
    reactivar: 'Reactivate',
    confirmarRetiro: (nombre: string) =>
      `Retire "${nombre}"? It stops being offered when quoting and renting. Rentals already using it do not change.`,
    sinTarifas: 'No rates yet. Create the first one with the button above.',
    sinResultados: (texto: string) => `No rate matches “${texto}”.`,
    sinActivas: 'No rate is active right now. Clear the filter to see retired ones.',
    sinRetiradas: 'No rate is retired. Clear the filter to see the whole catalog.',
    sinDeRenta: 'No rate is charged on rentals. Clear the filter to see the others.',
    sinDeVenta: 'No rate is charged on sales. Clear the filter to see the others.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} of ${total}`,
    paginacion: 'Pagination',
    paginaDe: (actual: number, total: number) => `Page ${actual} of ${total}`,
    anterior: 'Previous',
    siguiente: 'Next',
    guardar: 'Save',
    guardando: 'Saving…',
    cerrar: 'Close',
  },
  clausulas: {
    titulo: 'Clauses',
    contexto: (n: number) => (n === 1 ? '1 clause' : `${n} clauses`),
    contextoActivas: (n: number) => (n === 1 ? '1 active' : `${n} active`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retired' : `${n} retired`),
    contextoResultados: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    buscar: 'Search a clause',
    crear: 'New clause',
    crearApoyo: 'Joins the catalog each contract picks its clauses from.',
    editarTitulo: 'Edit clause',
    editarApoyo: 'Signed contracts keep the text they were signed with.',
    codigo: 'Code',
    tituloCampo: 'Title',
    texto: 'Text',
    ayudaTexto: 'The paragraph exactly as it will be printed on the contract.',
    orden: 'Order',
    ayudaOrden: 'Decides where it is printed, not how it is listed here.',
    obligatoriedad: 'Requirement',
    esObligatoria: 'Goes into every contract',
    ayudaObligatoria:
      'A required clause is added on its own and nobody has to pick it. Retiring it is what takes it out.',
    todas: 'All',
    activas: 'Active',
    retiradas: 'Retired',
    retirada: 'Retired',
    cualquiera: 'Any',
    obligatorias: 'Required',
    opcionales: 'Optional',
    obligatoria: 'Required',
    colOrden: '#',
    colClausula: 'Clause',
    colTexto: 'Text',
    acciones: 'Actions',
    editar: 'Edit',
    retirar: 'Retire',
    reactivar: 'Reactivate',
    confirmarRetiro: (titulo: string) =>
      `Retire "${titulo}"? It stops being offered when building a contract. Contracts already carrying it do not change.`,
    confirmarRetiroObligatoria: (titulo: string) =>
      `"${titulo}" is REQUIRED: today it goes into every contract on its own. Retiring it stops that, and new contracts will come out without it. Signed ones do not change.`,
    sinClausulas: 'No clauses yet. Create the first one with the button above.',
    sinResultados: (texto: string) => `No clause matches “${texto}”.`,
    sinActivas: 'No clause is active right now. Clear the filter to see retired ones.',
    sinRetiradas: 'No clause is retired. Clear the filter to see the whole catalog.',
    sinObligatorias: 'No clause is required. Clear the filter to see the optional ones.',
    sinOpcionales: 'No clause is optional. Clear the filter to see the required ones.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} of ${total}`,
    paginacion: 'Pagination',
    paginaDe: (actual: number, total: number) => `Page ${actual} of ${total}`,
    anterior: 'Previous',
    siguiente: 'Next',
    guardar: 'Save',
    guardando: 'Saving…',
    cerrar: 'Close',
  },
  modelos: {
    titulo: 'Models',
    contexto: (n: number) => (n === 1 ? '1 model' : `${n} models`),
    contextoActivos: (n: number) => (n === 1 ? '1 active' : `${n} active`),
    contextoRetirados: (n: number) => (n === 1 ? '1 retired' : `${n} retired`),
    contextoResultados: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    buscar: 'Search a model',
    crear: 'New model',
    crearApoyo: "Caterpillar's 320D, Komatsu's PC200. Equipment hangs off it.",
    editarTitulo: 'Edit model',
    editarApoyo: 'Equipment already on this model stays as it is.',
    marca: 'Brand',
    elegirMarca: 'Pick a brand',
    tipo: 'Equipment type',
    ayudaTipo: 'It can be left untyped and classified later.',
    sinTipo: 'No type',
    nombre: 'Name',
    ayudaNombre: 'As the manufacturer names it: 320D, PC200-8, 3CX.',
    descripcion: 'Description',
    horasEntreServicios: 'Hours between services',
    ayudaHoras: 'How many engine hours between maintenance. Can be left blank.',
    filtrarMarca: 'Filter by brand',
    todasLasMarcas: 'All brands',
    todos: 'All',
    activos: 'Active',
    retirados: 'Retired',
    retirado: 'Retired',
    colModelo: 'Model',
    colMarca: 'Brand',
    colTipo: 'Type',
    colServicio: 'Service',
    colEquipos: 'Equipment',
    cadaHoras: (n: number) => `Every ${n} h`,
    sinDato: 'Not set',
    acciones: 'Actions',
    editar: 'Edit',
    retirar: 'Retire',
    reactivar: 'Reactivate',
    confirmarRetiro: (nombre: string) =>
      `Retire "${nombre}"? It stops being offered when registering equipment. Equipment already on this model does not change.`,
    hacenFaltaMarcas:
      'There are no active brands yet, and a model has to hang off one. Create the brand first, under Brands.',
    sinModelos: 'No models yet. Create the first one with the button above.',
    sinResultados: (texto: string) => `No model matches “${texto}”.`,
    sinDeEsaMarca: 'That brand has no models. Pick “All brands” to see the whole catalog.',
    sinActivos: 'No model is active right now. Clear the filter to see retired ones.',
    sinRetirados: 'No model is retired. Clear the filter to see the whole catalog.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} of ${total}`,
    paginacion: 'Pagination',
    paginaDe: (actual: number, total: number) => `Page ${actual} of ${total}`,
    anterior: 'Previous',
    siguiente: 'Next',
    guardar: 'Save',
    guardando: 'Saving…',
    cerrar: 'Close',
  },
  ubicaciones: {
    titulo: 'Locations',
    contexto: (n: number) => (n === 1 ? '1 location' : `${n} locations`),
    contextoActivas: (n: number) => (n === 1 ? '1 active' : `${n} active`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retired' : `${n} retired`),
    contextoResultados: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    contextoDeTipo: (n: number, tipo: string) =>
      n === 1 ? `1 ${tipo}` : `${n} of type ${tipo}`,
    buscar: 'Search a location',
    crear: 'New location',
    crearApoyo: 'A warehouse, a branch or a yard. Equipment hangs off it.',
    editarTitulo: 'Edit location',
    editarApoyo: 'Equipment already here stays where it is.',
    tipos: { 1: 'Warehouse', 2: 'Branch', 3: 'Yard' } as Record<number, string>,
    capacidades: {
      1: 'stores equipment, does not quote',
      2: 'quotes, does not store equipment',
      3: 'stores equipment and quotes',
    } as Record<number, string>,
    codigo: 'Code',
    ayudaCodigo: 'Short and unique. It is how the location is named on documents.',
    nombre: 'Name',
    tipo: 'Type',
    ayudaTipo:
      'Decides whether equipment can be stored here and whether quotes can come from here. Not picked separately.',
    ayudaTipoEdicion:
      'If you take away its ability to store equipment while machines are here, the change is rejected. Move them first.',
    domicilio: 'Address',
    telefono: 'Phone',
    latitud: 'Latitude',
    longitud: 'Longitude',
    ayudaCoordenadas:
      'Optional. If you enter one, enter the other: half a coordinate locates nothing.',
    coordenadaIncompleta: 'Latitude or longitude is missing. Both, or neither.',
    todas: 'All',
    activas: 'Active',
    retiradas: 'Retired',
    retirada: 'Retired',
    cualquierTipo: 'Any type',
    colUbicacion: 'Location',
    colTipo: 'Type',
    colDomicilio: 'Address',
    colTelefono: 'Phone',
    colEquipos: 'Equipment',
    sinDato: 'Not set',
    acciones: 'Actions',
    editar: 'Edit',
    retirar: 'Retire',
    reactivar: 'Reactivate',
    confirmarRetiro: (nombre: string) =>
      `Retire "${nombre}"? It stops being offered when registering equipment or moving it.`,
    confirmarRetiroConEquipos: (nombre: string, n: number) =>
      `"${nombre}" has ${n === 1 ? '1 piece of equipment' : `${n} pieces of equipment`} registered. Retiring it stops it being offered, but those machines stay assigned there. Better to move them first.`,
    sinUbicaciones: 'No locations yet. Create the first one with the button above.',
    sinResultados: (texto: string) => `No location matches “${texto}”.`,
    sinDeEseTipo: (tipo: string) =>
      `There is no ${tipo}. Pick “Any type” to see the whole catalog.`,
    sinActivas: 'No location is active right now. Clear the filter to see retired ones.',
    sinRetiradas: 'No location is retired. Clear the filter to see the whole catalog.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} of ${total}`,
    paginacion: 'Pagination',
    paginaDe: (actual: number, total: number) => `Page ${actual} of ${total}`,
    anterior: 'Previous',
    siguiente: 'Next',
    guardar: 'Save',
    guardando: 'Saving…',
    cerrar: 'Close',
  },





  puestos: {
    titulo: 'Job positions',
    contexto: (n: number) => (n === 1 ? '1 position' : `${n} positions`),
    contextoActivas: (n: number) => (n === 1 ? '1 active' : `${n} active`),
    contextoRetiradas: (n: number) => (n === 1 ? '1 retired' : `${n} retired`),
    contextoResultados: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    buscar: 'Search a position',
    crear: 'New position',
    crearApoyo: 'Workers hang from it. The code cannot repeat.',
    editarTitulo: 'Edit position',
    editarApoyo: 'Workers already in it do not change.',
    codigo: 'Code',
    ayudaCodigo: 'Short and stable: OPER, MECH, DRIVER. It identifies the position.',
    nombre: 'Name',
    descripcion: 'Description',
    opcional: '(optional)',
    todas: 'All',
    activas: 'Active',
    retiradas: 'Retired',
    retirada: 'Retired',
    colPuesto: 'Position',
    colDescripcion: 'Description',
    colTrabajadores: 'Workers',
    acciones: 'Actions',
    editar: 'Edit',
    retirar: 'Retire',
    reactivar: 'Reactivate',
    confirmarRetiro: (nombre: string) =>
      `Retire "${nombre}"? It stops being offered when adding a worker. Workers already in it do not change.`,
    sinPuestos: 'No positions yet. Create the first one with the button above.',
    sinResultados: (texto: string) => `No position matches “${texto}”.`,
    sinActivas: 'No position is active right now. Clear the filter to see retired ones.',
    sinRetiradas: 'No position is retired. Clear the filter to see the whole catalog.',
    rango: (desde: number, hasta: number, total: number) => `${desde}-${hasta} of ${total}`,
    paginacion: 'Pagination',
    paginaDe: (actual: number, total: number) => `Page ${actual} of ${total}`,
    anterior: 'Previous',
    siguiente: 'Next',
    guardar: 'Save',
    guardando: 'Saving…',
    cerrar: 'Close',
  },


  modulos: {
    dashboard: 'Dashboard',
    equipos: 'Equipment',
    disponibilidad: 'Availability',
    clientes: 'Customers',
    cotizaciones: 'Quotes',
    contratos: 'Contracts',
    rentas: 'Rentals',
    logistica: 'Logistics and freight',
    'inspeccion-salida': 'Check-out inspection',
    'inspeccion-devolucion': 'Return inspection',
    evidencias: 'Evidence',
    horometros: 'Hour meters',
    mantenimiento: 'Maintenance',
    'ordenes-trabajo': 'Work orders',
    'proximo-servicio': 'Next service',
    refacciones: 'Spare parts',
    compras: 'Purchasing',
    proveedores: 'Suppliers',
    pagos: 'Payments and collections',
    facturacion: 'Invoicing',
    sucursales: 'Branches and yards',
    usuarios: 'Users and permissions',
    notificaciones: 'Notifications',
    reportes: 'Reports',
    qr: 'Equipment QR',
    subrenta: 'Subrentals',
  },
};

export const TEXTOS: Readonly<Record<CodigoIdioma, Textos>> = {
  'es-MX': ES_MX,
  'en-US': EN_US,
};
