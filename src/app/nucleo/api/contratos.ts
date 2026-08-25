/**
 * Los tipos que devuelve la API.
 *
 * Escritos a mano por ahora. El plan es generarlos desde `/openapi/v1.json` con un
 * script `api:sync` y commitear el resultado, para que un cambio de contrato aparezca
 * como diff en la revisión en lugar de romper en tiempo de ejecución.
 */

export interface InvitacionVigente {
  readonly correo: string;
  readonly nombre: string;
  /** Razón social, para mostrar a qué empresa se está entrando. */
  readonly empresa: string;
}

export interface SesionEmpresa {
  readonly token: string;
  readonly expiraEn: string;
  readonly tokenRefresco: string;
  readonly nombre: string;
  readonly correo: string;
  /** El slug. */
  readonly empresa: string;
  readonly accesoTotal: boolean;
  readonly permisos: readonly string[];
}

export interface IdentidadEmpresa {
  readonly correo: string;
  readonly nombre: string;
  readonly empresa: string;
  readonly razonSocial: string;
  readonly accesoTotal: boolean;
  readonly permisos: readonly string[];
  /** Módulos que incluye el plan contratado. La interfaz oculta lo que no está. */
  readonly modulos: readonly string[];
}

/** Lo que devuelve la API en cualquier error, por `AddProblemDetails`. */
export interface DetalleProblema {
  readonly title?: string;
  readonly detail?: string;
  readonly status?: number;
}
