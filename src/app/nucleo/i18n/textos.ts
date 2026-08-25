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
    operacion: 'Operación',
    equipos: 'Equipos',
    clientes: 'Clientes',
    rentas: 'Rentas',
    empresas: 'Empresas',
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
    detalleEsquemaDesfasado: (suyo: string, referencia: string) =>
      `Su base está en ${suyo} y la más avanzada va en ${referencia}. Le faltan migraciones.`,

    recientes: 'Últimas altas',
    esquemaReferencia: (version: string) => `Esquema más avanzado: ${version}`,
    sinEsquema: 'Ninguna base está lista todavía.',

    verEmpresas: 'Ver todas las empresas',

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
    alDia: 'Al día',
  },

  empresas: {
    titulo: 'Empresas',
    aprovisionada: (slug: string) => `${slug} aprovisionada`,
    baseYEsquema: (base: string, esquema: string) => `Base ${base}, esquema ${esquema}.`,
    invitacionEnviada: 'Invitación enviada.',
    invitacionNoEnviada: 'La invitación NO se envió',
    hayQueReenviar: '— hay que reenviarla.',
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
    darDeAlta: 'Dar de alta una empresa',
    darDeAltaApoyo:
      'Crea y migra su base de datos, siembra sus roles y permisos, y manda la invitación a su primer administrador.',
    identificador: 'Identificador',
    ayudaIdentificador: 'Minúsculas, dígitos y guiones. Es su subdominio: su gente entrará por',
    razonSocial: 'Razón social',
    rfc: 'RFC',
    telefono: 'Teléfono',
    nombreAdministrador: 'Nombre del administrador',
    correoAdministrador: 'Correo del administrador',
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

  errores: {
    sinServidor: 'No se pudo contactar al servidor. Revisa que la API esté levantada.',
    conCodigo: (codigo: number) => `Error ${codigo}.`,
    inesperado: 'Ocurrió un error inesperado.',
  },

  /** Títulos de pestaña. `TituloPagina` les añade el nombre del producto detrás. */
  titulos: {
    invitacion: 'Define tu contraseña',
    panel: 'Resumen',
    entrar: 'Entrar',
    recuperar: 'Recuperar tu contraseña',
    restablecer: 'Tu contraseña nueva',
    inicio: 'Inicio',
    superadministracion: 'Superadministración',
    empresas: 'Empresas',
    portal: 'Entrar a tu empresa',
  },

  /**
   * Nombres de los 26 módulos. La CLAVE la manda el backend (`modulo.clave` de la base
   * central) y no se traduce; lo que se traduce es lo que se enseña.
   */
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
    operacion: 'Operations',
    equipos: 'Equipment',
    clientes: 'Customers',
    rentas: 'Rentals',
    empresas: 'Companies',
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
    detalleEsquemaDesfasado: (suyo: string, referencia: string) =>
      `Its database is on ${suyo} while the furthest along is on ${referencia}. It is missing migrations.`,

    recientes: 'Latest additions',
    esquemaReferencia: (version: string) => `Furthest schema: ${version}`,
    sinEsquema: 'No database is ready yet.',

    verEmpresas: 'See every company',

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
    alDia: 'Up to date',
  },

  empresas: {
    titulo: 'Companies',
    aprovisionada: (slug: string) => `${slug} provisioned`,
    baseYEsquema: (base: string, esquema: string) => `Database ${base}, schema ${esquema}.`,
    invitacionEnviada: 'Invitation sent.',
    invitacionNoEnviada: 'The invitation was NOT sent',
    hayQueReenviar: '— it has to be resent.',
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
    darDeAlta: 'Add a company',
    darDeAltaApoyo:
      'Creates and migrates its database, seeds its roles and permissions, and sends the invitation to its first administrator.',
    identificador: 'Identifier',
    ayudaIdentificador:
      'Lowercase, digits and hyphens. It is their subdomain: their people will sign in at',
    razonSocial: 'Legal name',
    rfc: 'Tax ID',
    telefono: 'Phone',
    nombreAdministrador: "Administrator's name",
    correoAdministrador: "Administrator's email",
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

  errores: {
    sinServidor: 'Could not reach the server. Check that the API is running.',
    conCodigo: (codigo: number) => `Error ${codigo}.`,
    inesperado: 'Something unexpected went wrong.',
  },

  titulos: {
    invitacion: 'Set your password',
    panel: 'Overview',
    entrar: 'Sign in',
    recuperar: 'Recover your password',
    restablecer: 'Your new password',
    inicio: 'Home',
    superadministracion: 'Platform admin',
    empresas: 'Companies',
    portal: 'Sign in to your company',
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
