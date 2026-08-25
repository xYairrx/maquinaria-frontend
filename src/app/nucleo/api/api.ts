import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { configuracion } from '../ambiente/configuracion';
import type {
  IdentidadEmpresa,
  InvitacionVigente,
  RestablecimientoAplicado,
  RestablecimientoSolicitado,
  SesionEmpresa,
} from './contratos';

/** Llamadas a la API. Un método por endpoint, sin lógica. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly base = configuracion.urlApi;

  consultarInvitacion(empresa: string, token: string) {
    return this.http.get<InvitacionVigente>(
      `${this.base}/api/empresas/${encodeURIComponent(empresa)}` +
        `/invitaciones/${encodeURIComponent(token)}`,
    );
  }

  aceptarInvitacion(empresa: string, token: string, contrasena: string) {
    return this.http.post<{ correo: string; empresa: string }>(
      `${this.base}/api/empresas/${encodeURIComponent(empresa)}` +
        `/invitaciones/${encodeURIComponent(token)}`,
      { contrasena },
    );
  }

  solicitarRestablecimiento(empresa: string, correo: string) {
    return this.http.post<RestablecimientoSolicitado>(
      `${this.base}/api/empresas/${encodeURIComponent(empresa)}/restablecimientos`,
      { correo },
    );
  }

  consultarRestablecimiento(empresa: string, token: string) {
    return this.http.get<void>(
      `${this.base}/api/empresas/${encodeURIComponent(empresa)}` +
        `/restablecimientos/${encodeURIComponent(token)}`,
    );
  }

  restablecerContrasena(empresa: string, token: string, contrasena: string) {
    return this.http.post<RestablecimientoAplicado>(
      `${this.base}/api/empresas/${encodeURIComponent(empresa)}` +
        `/restablecimientos/${encodeURIComponent(token)}`,
      { contrasena },
    );
  }

  iniciarSesion(empresa: string, correo: string, contrasena: string) {
    return this.http.post<SesionEmpresa>(
      `${this.base}/api/empresas/${encodeURIComponent(empresa)}/sesion`,
      { correo, contrasena },
    );
  }

  miSesion() {
    return this.http.get<IdentidadEmpresa>(`${this.base}/api/mi/sesion`);
  }
}
