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
