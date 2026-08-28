import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Injector, computed, inject, type Signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import type {
  AltaContrato,
  AltaContratoClausula,
  Contrato,
  ContratoClausula,
  EstadoContrato,
} from './contratos';
import { mensajeDeErrorDeRecurso } from './mensaje-error';
import { FabricaDeRecursos } from './recursos-rest';

/** El detalle de UN contrato, con sus cláusulas. */
export interface DetalleDeContrato {
  readonly contrato: Signal<Contrato | null>;
  readonly cargando: Signal<boolean>;
  readonly error: Signal<string | null>;
  readonly recargar: () => void;
}

/**
 * Contratos: el papel que respalda una renta.
 *
 * **UN CONTRATO POR RENTA**, garantizado por un `UNIQUE` de la base. De ahí `porRenta()`: desde la
 * renta se pregunta si ya tiene contrato, y esa consulta contesta con el contrato o con nada, sin
 * tener que buscar en el listado.
 *
 * **NO HAY `PUT`.** El contrato se crea y se le agregan o quitan cláusulas mientras está en
 * Borrador; después es inmutable y **lo impone un trigger**, no solo el servicio. El DTO trae
 * `editable` ya calculado para que la pantalla lo respete sin adivinar.
 *
 * **Las cláusulas se congelan al crear**: se copian título y texto del catálogo. Corregir la
 * plantilla mañana no reescribe lo que alguien firmó.
 */
@Injectable({ providedIn: 'root' })
export class ApiContratos {
  private readonly http = inject(HttpClient);

  private readonly fabrica = new FabricaDeRecursos(
    this.http,
    inject(Injector),
    `${configuracion.urlApi}/api`,
  );

  /**
   * Listado y alta. **`editar` no se usa nunca**: el endpoint no existe.
   *
   * Se deja la fábrica de todas formas porque da el listado paginado, la recarga compartida y el
   * alta; escribir un recurso a medias para esconder un método sería más código para menos.
   */
  readonly contratos = this.fabrica.recurso<Contrato, AltaContrato>('contratos');

  detalleDe(id: Signal<string>): DetalleDeContrato {
    const rec = httpResource<Contrato>(() =>
      id() ? `${configuracion.urlApi}/api/contratos/${encodeURIComponent(id())}` : undefined,
    );

    return {
      contrato: computed(() => (rec.hasValue() ? rec.value() : null)),
      cargando: rec.isLoading,
      error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
      recargar: () => rec.reload(),
    };
  }

  /**
   * El contrato de una renta, si lo tiene.
   *
   * Responde **404 cuando no hay**, que no es un error de la aplicación sino la respuesta: esa
   * renta todavía no tiene contrato. Por eso quien lo consuma tiene que distinguir ese 404 de uno
   * de verdad; el mensaje de error se expone igual y la pantalla decide.
   */
  porRenta(rentaId: Signal<string>): DetalleDeContrato {
    const rec = httpResource<Contrato>(() =>
      rentaId()
        ? `${configuracion.urlApi}/api/contratos/por-renta/${encodeURIComponent(rentaId())}`
        : undefined,
    );

    return {
      contrato: computed(() => (rec.hasValue() ? rec.value() : null)),
      cargando: rec.isLoading,
      error: computed(() => mensajeDeErrorDeRecurso(rec.error())),
      recargar: () => rec.reload(),
    };
  }

  /**
   * Mueve el estado.
   *
   * Dos rechazos distintos caen aquí: la transición inválida —409— y **autorizar sin cláusulas**,
   * también 409. Los dos se muestran con el texto del servidor.
   */
  cambiarEstado(id: string, estado: EstadoContrato): Observable<Contrato> {
    return this.fabrica.parcheo<Contrato>(
      `contratos/${encodeURIComponent(id)}/estado`,
      { estado },
      { recargar: 'contratos' },
    );
  }

  /** Agrega una cláusula PROPIA, redactada en el contrato. **Solo en Borrador.** */
  agregarClausula(id: string, alta: AltaContratoClausula): Observable<ContratoClausula> {
    return this.fabrica.publicar<ContratoClausula>(
      `contratos/${encodeURIComponent(id)}/clausulas`,
      alta,
      { recargar: 'contratos' },
    );
  }

  quitarClausula(id: string, clausulaId: string): Observable<void> {
    return this.fabrica.borrar(
      `contratos/${encodeURIComponent(id)}/clausulas/${encodeURIComponent(clausulaId)}`,
      { recargar: 'contratos' },
    );
  }
}
