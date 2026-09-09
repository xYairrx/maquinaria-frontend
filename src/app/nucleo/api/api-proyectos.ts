import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import type { AltaProyecto, CambioEstadoProyecto, Proyecto } from './contratos';
import { FabricaDeRecursos } from './recursos-rest';

/**
 * Las obras de los clientes. Módulo `proyectos`, nuevo del MVP.
 *
 * Servicio propio y no una entrada en `ApiOrganizacion` por lo que RESPONDE: una obra no
 * describe a la empresa —eso es organización— ni a quien está fuera —eso es terceros—. Es el
 * sitio del cliente donde trabaja nuestra maquinaria, y de ella cuelgan las líneas de renta y
 * los movimientos.
 *
 * **El alta crea DOS filas** —el proyecto y su ubicación— en una transacción del servidor. Aquí
 * no se nota: es un `POST` normal. Lo que sí se nota es que el formulario pide los datos del
 * sitio y no un id de ubicación, porque no hay ninguna que elegir todavía.
 */
@Injectable({ providedIn: 'root' })
export class ApiProyectos {
  private readonly fabrica = new FabricaDeRecursos(
    inject(HttpClient),
    inject(Injector),
    `${configuracion.urlApi}/api`,
  );

  /**
   * La fábrica le da listado, alta y edición. **`cambiarActivo` no se usa**: una obra tiene
   * `Estado` de tres valores —activa, suspendida, cerrada— y su propio `PATCH .../estado`,
   * igual que el cliente y el trabajador.
   */
  readonly proyectos = this.fabrica.recurso<Proyecto, AltaProyecto>('proyectos');

  /**
   * Suspender, reactivar o cerrar una obra.
   *
   * Exige el permiso `proyectos.autorizar` en el servidor, no `editar`: cerrar decide que ya no
   * se le asignan máquinas, y eso no es corregir un dato. Quien pueda consultar verá el botón y
   * recibirá un 403 si no puede — eso lo dice el servidor, no se adivina aquí.
   */
  cambiarEstado(id: string, cambio: CambioEstadoProyecto): Observable<Proyecto> {
    return this.fabrica.parcheo<Proyecto>(`proyectos/${encodeURIComponent(id)}/estado`, cambio, {
      recargar: 'proyectos',
    });
  }

  /**
   * Las obras ACTIVAS, para el desplegable de la línea de una renta.
   *
   * Se filtran por estado y no se traen todas: ofrecer una obra cerrada al asignar una máquina
   * es ofrecer un error, porque el servidor rechaza cerrar una obra con máquinas dentro y
   * asignarle una recién cerrada dejaría el mismo agujero por el otro lado.
   */
  selectorActivos(): Signal<readonly Proyecto[]> {
    return this.fabrica.selectorFiltrado<Proyecto>('proyectos', { Estado: 1 });
  }
}
