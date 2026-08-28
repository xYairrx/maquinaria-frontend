import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject, type Signal } from '@angular/core';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaCliente,
  AltaProveedor,
  CambioEstadoCliente,
  Cliente,
  Proveedor,
} from './contratos';
import { FabricaDeRecursos } from './recursos-rest';
import type { Observable } from 'rxjs';

/**
 * Terceros: con quién opera la empresa desde fuera. Clientes y proveedores.
 *
 * SEPARADO DE `ApiCatalogos` POR LA URL, igual que `ApiOrganizacion`: estos cuelgan de la raíz
 * de la API —`/api/proveedores`— y no de `/api/catalogos`. La forma de las operaciones es la
 * misma, así que la maquinaria se comparte desde `recursos-rest.ts`; lo único propio es la base.
 *
 * Y separado de `ApiOrganizacion` por lo que RESPONDEN: organización describe a la empresa
 * misma —dónde está, quién trabaja en ella—, y terceros describe a quien está fuera. Es el
 * mismo corte que ya hace el menú lateral.
 */
@Injectable({ providedIn: 'root' })
export class ApiTerceros {
  private readonly fabrica = new FabricaDeRecursos(
    inject(HttpClient),
    inject(Injector),
    `${configuracion.urlApi}/api`,
  );

  /** Permisos de `proveedores`. Retirar es `PATCH .../activo`: no hay borrado. */
  readonly proveedores = this.fabrica.recurso<Proveedor, AltaProveedor>('proveedores');

  /**
   * Clientes: a quién se le renta. Permisos de `clientes`.
   *
   * La fábrica le da listado, alta y edición. **`cambiarActivo` no se usa**: el cliente tiene
   * `Estado` de tres valores y su propio `PATCH .../estado`, igual que el trabajador.
   */
  readonly clientes = this.fabrica.recurso<Cliente, AltaCliente>('clientes');

  /**
   * El estado de un cliente.
   *
   * MÁS SIMPLE QUE EL DEL TRABAJADOR: `CambioEstadoCliente` solo lleva el estado, sin fecha,
   * así que aquí no hay CHECK que respetar ni un segundo campo que coordinar. Se reusa la
   * misma plomería de `parcheo()`, que es para lo que se escribió.
   */
  cambiarEstadoCliente(id: string, cambio: CambioEstadoCliente): Observable<Cliente> {
    return this.fabrica.parcheo<Cliente>(`clientes/${encodeURIComponent(id)}/estado`, cambio, {
      recargar: 'clientes',
    });
  }

  /**
   * Los clientes, para los desplegables de otras pantallas.
   *
   * **Los trae TODOS**, no solo los activos: el cliente no tiene un booleano `Activo` sino un
   * enum de tres valores, y el `Activo: true` que la fábrica manda de serie no lo filtra nadie
   * en `ServicioClientesEf`. Para un desplegable donde solo cabe el activo usa
   * `selectorClientesActivos`.
   */
  selectorClientes(): Signal<readonly Cliente[]> {
    return this.fabrica.selector<Cliente>('clientes');
  }

  /**
   * Solo los clientes en estado Activo.
   *
   * Es el desplegable de la cotización: `ValidarAsync` responde 400 con «el cliente está
   * Suspendido y no se le puede cotizar». Ofrecerlo sería invitar al rechazo.
   *
   * El `1` es `EstadoCliente.Activo`; va como número porque el enum del backend lo es.
   */
  selectorClientesActivos(): Signal<readonly Cliente[]> {
    return this.fabrica.selectorFiltrado<Cliente>('clientes', { Estado: 1 });
  }

  /**
   * Los proveedores activos, para los desplegables de otras pantallas.
   *
   * Lo va a pedir la orden de compra, que es donde el proveedor vive de verdad.
   */
  selectorProveedores(): Signal<readonly Proveedor[]> {
    return this.fabrica.selector<Proveedor>('proveedores');
  }
}
