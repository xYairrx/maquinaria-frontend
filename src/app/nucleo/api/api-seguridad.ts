import { HttpClient, httpResource } from '@angular/common/http';
import {
  Injectable,
  Injector,
  computed,
  inject,
  runInInjectionContext,
  type Signal,
} from '@angular/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaRol,
  AltaUsuarioEmpresa,
  Auditoria,
  CambioUsuarioEmpresa,
  EstadoUsuario,
  FiltroBitacora,
  FiltroUsuariosEmpresa,
  InvitacionEmitida,
  MatrizDePermisos,
  ModuloConPermisos,
  Rol,
  UsuarioEmpresa,
} from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';
import { FabricaDeRecursos, type Listado } from './recursos-rest';

/** Los roles con su matriz, ya en señales. Sin paginar: son cuatro y se leen de un vistazo. */
export interface ListaDeRoles {
  readonly roles: Signal<readonly Rol[]>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly recargar: () => void;
}

/**
 * Usuarios, roles y bitácora de la empresa: la sección de Configuración.
 *
 * **TRES ÁREAS EN UN SERVICIO y no tres servicios**, porque se recargan entre sí: cambiar los
 * roles de un usuario cambia el conteo de usuarios de ese rol, y crear un rol cambia lo que la
 * pantalla de usuarios puede asignar. Con tres servicios habría que acordarse de invalidar el
 * de al lado.
 *
 * **LA BITÁCORA NO SE RECARGA POR NINGUNA MUTACIÓN.** Es *append-only* y lo que se escribe en
 * ella lo escribe el interceptor del servidor, no estas llamadas; recargarla tras cada guardado
 * sería una petición por acción sin que nadie la esté mirando.
 *
 * Los tres recursos que no pasan por la fábrica —roles, su catálogo y los módulos de la
 * bitácora— son **PEREZOSOS**, igual que los selectores: un `httpResource` como campo pediría
 * al inyectar el servicio, así que la pantalla de usuarios traería los 174 permisos que solo
 * necesita la de roles. `runInInjectionContext` es lo que permite crearlos fuera del campo.
 */
@Injectable({ providedIn: 'root' })
export class ApiSeguridad {
  private readonly http = inject(HttpClient);
  private readonly inyector = inject(Injector);

  private readonly base = `${configuracion.urlApi}/api`;

  private readonly fabrica = new FabricaDeRecursos(this.http, this.inyector, this.base);

  /**
   * De la fábrica se usan el listado y `editar`. **`crear` no**: invitar devuelve la liga
   * además del usuario, así que va por `publicar`.
   */
  private readonly usuarios = this.fabrica.recurso<UsuarioEmpresa, CambioUsuarioEmpresa>(
    'usuarios',
  );

  listadoUsuarios(filtro: Signal<FiltroUsuariosEmpresa>): Listado<UsuarioEmpresa> {
    return this.usuarios.listado(filtro);
  }

  /**
   * Invita: crea la cuenta, sus roles y su liga, y manda el correo.
   *
   * **Devuelve la liga** porque el correo puede no salir, y del token solo se guarda el hash:
   * si esa respuesta se pierde, la única salida es reenviar. La pantalla la muestra y la deja
   * copiar.
   */
  invitar(alta: AltaUsuarioEmpresa): Observable<InvitacionEmitida> {
    return this.fabrica.publicar<InvitacionEmitida>('usuarios', alta, { recargar: 'usuarios' });
  }

  /** Reenvía la liga e **invalida la anterior**. Solo a quien sigue Invitado; si no, 409. */
  reenviarInvitacion(id: string): Observable<InvitacionEmitida> {
    return this.fabrica.publicar<InvitacionEmitida>(
      `usuarios/${encodeURIComponent(id)}/invitacion`,
      {},
      { recargar: 'usuarios' },
    );
  }

  editarUsuario(id: string, cambio: CambioUsuarioEmpresa): Observable<UsuarioEmpresa> {
    return this.usuarios.editar(id, cambio);
  }

  /**
   * Activa, suspende o da de baja.
   *
   * **Dos 409 que la pantalla tiene que explicar con el texto del servidor**: activar a quien
   * nunca definió contraseña —no podría entrar— e intentar cambiarse el estado a sí mismo, que
   * es como alguien se deja fuera de su propia empresa.
   */
  cambiarEstadoUsuario(id: string, estado: EstadoUsuario): Observable<UsuarioEmpresa> {
    return this.fabrica.parcheo<UsuarioEmpresa>(
      `usuarios/${encodeURIComponent(id)}/estado`,
      { estado },
      { recargar: 'usuarios' },
    );
  }

  /**
   * Reemplaza los roles del usuario. **Recarga también los roles**: su conteo de usuarios
   * acaba de cambiar y la pantalla de roles lo muestra.
   */
  asignarRoles(id: string, rolesIds: readonly string[]): Observable<UsuarioEmpresa> {
    return this.fabrica
      .reemplazar<UsuarioEmpresa>(
        `usuarios/${encodeURIComponent(id)}/roles`,
        { rolesIds },
        { recargar: 'usuarios' },
      )
      .pipe(tap(() => this.recargarRoles?.()));
  }

  // ------------------------------------------------------------------ roles --

  private listaRoles?: ListaDeRoles;
  private recargarRoles?: () => void;

  /**
   * Los roles con su matriz. Memorizado: dos pantallas que los pidan hacen UNA petición.
   *
   * `value()` LANZA con el recurso en error, así que se envuelve en `hasValue()`. Es la regla
   * del repo, con prueba de regresión en `api-plataforma.spec.ts`.
   */
  roles(): ListaDeRoles {
    if (this.listaRoles !== undefined) {
      return this.listaRoles;
    }

    const rec = runInInjectionContext(this.inyector, () =>
      httpResource<readonly Rol[]>(() => `${this.base}/roles`),
    );

    this.recargarRoles = () => rec.reload();

    this.listaRoles = {
      roles: computed(() => (rec.hasValue() ? rec.value() : [])),
      cargando: rec.isLoading,
      error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
      recargar: () => rec.reload(),
    };

    return this.listaRoles;
  }

  private catalogo?: Signal<readonly ModuloConPermisos[]>;

  /**
   * Los 174 permisos agrupados por módulo. **La matriz los necesita TODOS**, también los que
   * ningún rol tiene: son las casillas vacías.
   */
  catalogoPermisos(): Signal<readonly ModuloConPermisos[]> {
    if (this.catalogo === undefined) {
      const rec = runInInjectionContext(this.inyector, () =>
        httpResource<readonly ModuloConPermisos[]>(() => `${this.base}/roles/catalogo`),
      );

      this.catalogo = computed(() => (rec.hasValue() ? rec.value() : []));
    }

    return this.catalogo;
  }

  crearRol(alta: AltaRol): Observable<Rol> {
    return this.http.post<Rol>(`${this.base}/roles`, alta).pipe(tap(() => this.recargarRoles?.()));
  }

  editarRol(id: string, cambio: AltaRol): Observable<Rol> {
    return this.http
      .put<Rol>(`${this.base}/roles/${encodeURIComponent(id)}`, cambio)
      .pipe(tap(() => this.recargarRoles?.()));
  }

  /**
   * Reemplaza la matriz COMPLETA: lo que no venga se quita.
   *
   * **409** si es el rol con acceso total —su matriz vacía no significa que no pueda nada— y
   * **400** si alguna clave no existe, que es lo que pasaría con un frontend desfasado. Los
   * dos mensajes vienen del servidor.
   */
  actualizarPermisos(id: string, matriz: MatrizDePermisos): Observable<Rol> {
    return this.http
      .put<Rol>(`${this.base}/roles/${encodeURIComponent(id)}/permisos`, matriz)
      .pipe(tap(() => this.recargarRoles?.()));
  }

  /** Borra un rol propio. **409** si es de sistema o si tiene gente asignada. */
  eliminarRol(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.base}/roles/${encodeURIComponent(id)}`)
      .pipe(tap(() => this.recargarRoles?.()));
  }

  // --------------------------------------------------------------- bitácora --

  /**
   * El historial de acciones. Solo lectura.
   *
   * `never` como tipo de alta: la fábrica pide dos parámetros y esta tabla **no tiene alta**
   * —la escribe el interceptor del servidor y un trigger la vuelve append-only—. `never` es
   * lo que hace imposible llamar a `crear` por accidente.
   */
  listadoBitacora(filtro: Signal<FiltroBitacora>): Listado<Auditoria> {
    return this.fabrica.recurso<Auditoria, never>('bitacora').listado(filtro);
  }

  private modulos?: Signal<readonly string[]>;

  /**
   * Los módulos que DE VERDAD tienen registros. Ofrecer los 29 del catálogo daría un filtro
   * con 24 opciones que no devuelven nada — es la misma regla que «no afirmes sobre lo que no
   * consultaste».
   */
  modulosDeBitacora(): Signal<readonly string[]> {
    if (this.modulos === undefined) {
      const rec = runInInjectionContext(this.inyector, () =>
        httpResource<readonly string[]>(() => `${this.base}/bitacora/modulos`),
      );

      this.modulos = computed(() => (rec.hasValue() ? rec.value() : []));
    }

    return this.modulos;
  }
}
