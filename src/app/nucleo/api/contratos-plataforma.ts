/** Tipos del panel de plataforma. */

export interface SesionPlataforma {
  readonly token: string;
  readonly expiraEn: string;
  readonly nombre: string;
  readonly correo: string;
}

export interface IdentidadPlataforma {
  readonly id: string;
  readonly correo: string;
  readonly nombre: string;
}

/** Los enums del backend viajan como número. */
export const enum EstadoTenant {
  Prueba = 1,
  Activo = 2,
  Suspendido = 3,
  Cancelado = 4,
}

export const enum EstadoAprovisionamiento {
  Pendiente = 1,
  Creando = 2,
  Lista = 3,
  Fallida = 4,
}

export interface ResumenEmpresa {
  readonly id: string;
  readonly slug: string;
  readonly razonSocial: string;
  readonly rfc: string | null;
  readonly estado: EstadoTenant;
  readonly aprovisionamiento: EstadoAprovisionamiento;
  readonly versionEsquema: string | null;
  readonly codigoPlan: string | null;
  readonly modulos: number;
  readonly creadoEn: string;
}

export interface EmpresaAprovisionada {
  readonly tenantId: string;
  readonly slug: string;
  readonly nombreBd: string;
  readonly versionEsquema: string;
  readonly invitacionEnviada: boolean;
  /** Solo llega en Development. En producción la liga va únicamente por correo. */
  readonly ligaInvitacion: string | null;
}

export interface AltaDeEmpresa {
  readonly slug: string;
  readonly razonSocial: string;
  readonly nombreComercial: string | null;
  readonly rfc: string | null;
  readonly telefono: string | null;
  readonly correoContacto: string | null;
  readonly correoAdministrador: string;
  readonly nombreAdministrador: string;
  readonly codigoPlan: string;
}

/**
 * Un plan del catalogo comercial.
 *
 * `modulos` son las CLAVES, no los nombres: el plan ES su conjunto de modulos —no un
 * paquete de cupos, que esos cuelgan de la empresa— y el nombre para mostrar lo traduce
 * este lado con `nombreModulo()`, que ya tiene los 26 en los dos idiomas.
 */
export interface ResumenPlan {
  readonly id: string;
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly precioMensual: number;
  /** ISO 4217 de tres letras. */
  readonly moneda: string;
  readonly orden: number;
  readonly activo: boolean;
  readonly creadoEn: string;
  readonly modulos: readonly string[];
  /** Cuantas empresas lo tienen contratado. Un plan con suscripciones no se toca a la ligera. */
  readonly suscripciones: number;
}

/**
 * Un modulo del catalogo, para armar un plan.
 *
 * `numero` es el de la especificacion funcional: 8 es M8, logistica. La numeracion llega a
 * 30 pero SALTA el 21, 22, 23 y 28 —esos modulos no existen— asi que son 26 y los huecos
 * son correctos.
 */
export interface ResumenModulo {
  readonly clave: string;
  readonly numero: number;
  readonly orden: number;
}

export interface AltaDePlan {
  readonly codigo: string;
  readonly nombre: string;
  readonly descripcion: string | null;
  readonly precioMensual: number;
  readonly moneda: string;
  readonly orden: number;
  readonly modulos: readonly string[];
}

/**
 * Una empresa en el reporte de salud de esquemas.
 *
 * OJO CON `versionReconocida`, que es el punto entero de este contrato: cuando es `false`
 * significa «no se pudo comparar» —`versionAplicada` nula, o una migración que el binario
 * que respondió no conoce, que es el caso de una base POR DELANTE del código desplegado—
 * y entonces `migracionesPendientes` y `desfasada` NO dicen nada útil. No es un «sí» ni un
 * «no»: es un tercer estado, y colapsarlo a dos esconde justo el caso peligroso. La regla
 * está escrita una sola vez, en `estadoDeEsquema()`.
 */
export interface EmpresaEnSalud {
  readonly id: string;
  readonly slug: string;
  readonly razonSocial: string;
  readonly estado: EstadoTenant;
  readonly aprovisionamiento: EstadoAprovisionamiento;
  /** Nula = nunca se migró. Y sí cuenta como desfasada. */
  readonly versionAplicada: string | null;
  readonly migracionesPendientes: number;
  readonly desfasada: boolean;
  readonly versionReconocida: boolean;
}

/**
 * `GET /api/plataforma/salud/esquemas`.
 *
 * `versionDisponible` es la migración más avanzada DEL BINARIO QUE RESPONDE, no la de la
 * empresa más adelantada. Esa distinción es la razón de ser del endpoint: deducir la
 * referencia de la lista de empresas da cero desfase cuando TODAS van una migración atrás,
 * que es exactamente el estado en el que suele estar el sistema.
 *
 * `totalEmpresas` y `desfasadas` vienen calculados a propósito: la regla de qué es estar
 * atrasado vive en el backend y este lado no la vuelve a calcular.
 */
export interface SaludEsquemas {
  /**
   * NULA es posible, y el tipo tiene que decirlo: en el backend es `string?`, y sale nula
   * cuando el ensamblado no trae ninguna migracion —`disponibles.Count > 0 ? [^1] : null`—.
   * No deberia pasar en produccion, pero estaba tipado `string` y eso es justo la clase de
   * mentira que un cliente escrito A MANO cuela y que `api:sync` atraparia como diff.
   */
  readonly versionDisponible: string | null;
  readonly totalEmpresas: number;
  readonly desfasadas: number;
  readonly empresas: readonly EmpresaEnSalud[];
}
