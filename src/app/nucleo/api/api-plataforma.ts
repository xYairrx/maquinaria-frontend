import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaDeEmpresa,
  EmpresaAprovisionada,
  IdentidadPlataforma,
  ResumenEmpresa,
  SesionPlataforma,
} from './contratos-plataforma';

@Injectable({ providedIn: 'root' })
export class ApiPlataforma {
  private readonly http = inject(HttpClient);
  private readonly base = `${configuracion.urlApi}/api/plataforma`;

  iniciarSesion(correo: string, contrasena: string) {
    return this.http.post<SesionPlataforma>(`${this.base}/sesion`, { correo, contrasena });
  }

  miSesion() {
    return this.http.get<IdentidadPlataforma>(`${this.base}/sesion/actual`);
  }

  listarEmpresas() {
    return this.http.get<readonly ResumenEmpresa[]>(`${this.base}/empresas`);
  }

  darDeAltaEmpresa(alta: AltaDeEmpresa) {
    return this.http.post<EmpresaAprovisionada>(`${this.base}/empresas`, alta);
  }
}
