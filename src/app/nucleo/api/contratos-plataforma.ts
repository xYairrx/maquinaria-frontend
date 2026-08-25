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
