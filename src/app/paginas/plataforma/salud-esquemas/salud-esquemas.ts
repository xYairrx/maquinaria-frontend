import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Barra } from '../../../disposicion/barra';
import { ApiPlataforma } from '../../../nucleo/api/api-plataforma';
import {
  EstadoAprovisionamiento,
  EstadoTenant,
  type EmpresaEnSalud,
} from '../../../nucleo/api/contratos-plataforma';
import { t } from '../../../nucleo/i18n/i18n';
import { SaludEsquemasEsqueleto } from './esqueleto';
import {
  estadoDeEsquema,
  migracionLegible,
  type EstadoEsquema,
  type MigracionLegible,
} from './esquema';

/** Una fila de la tabla, ya resuelta: el estado y la versión no se recalculan al pintar. */
interface Fila {
  readonly empresa: EmpresaEnSalud;
  readonly estado: EstadoEsquema;
  /** `null` cuando nunca se migró: entonces la celda no enseña una versión, dice eso. */
  readonly version: MigracionLegible | null;
}

/**
 * La salud de los esquemas de las bases de empresa.
 *
 * TODO SALE DE `GET /api/plataforma/salud/esquemas`, incluidos los tres conteos de arriba:
 * `versionDisponible`, `totalEmpresas` y `desfasadas` vienen calculados y NO se recalculan
 * aquí. La regla de qué es estar atrasado vive en el backend a propósito, y el dato que la
 * hace correcta —la migración más avanzada del BINARIO que responde— este lado no lo tiene:
 * deducirla de la lista de empresas es lo que hacía el dashboard, y daba cero desfase
 * cuando todas iban una migración atrás.
 *
 * LO QUE ESTA PANTALLA TIENE QUE DEJAR CLARO son TRES estados, no dos: al día, desfasada y
 * **sin comparar**. El tercero es el peligroso —una base por delante del código desplegado—
 * y si se pinta como los otros dos desaparece. De ahí que la columna de migraciones
 * pendientes enseñe un guion y no un número cuando no se pudo comparar: ese número existe
 * en la respuesta pero no significa nada, y una cifra sin significado se ve igual que una
 * de verdad.
 */
@Component({
  selector: 'app-salud-esquemas',
  imports: [RouterLink, SaludEsquemasEsqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './salud-esquemas.html',
})
export class SaludEsquemas {
  private readonly api = inject(ApiPlataforma);
  private readonly barra = inject(Barra);

  protected readonly t = t;

  /**
   * Del recurso COMPARTIDO de `ApiPlataforma`, el mismo que lee el dashboard para su aviso
   * de desfase: entre las dos pantallas hay una sola petición.
   */
  protected readonly reporte = this.api.saludEsquemas;
  protected readonly cargando = this.api.saludEsquemasCargando;
  protected readonly error = this.api.saludEsquemasError;

  /**
   * La versión del binario, partida en fecha y nombre.
   *
   * `null` en DOS casos que la pantalla trata igual porque para quien mira son lo mismo
   * —no hay referencia contra la que comparar—: que no haya llegado el reporte, y que el
   * reporte la traiga nula. La segunda es posible: en el backend el campo es `string?`.
   */
  protected readonly disponible = computed(() => {
    const version = this.reporte()?.versionDisponible;

    return version ? migracionLegible(version) : null;
  });

  protected readonly filas = computed<readonly Fila[]>(() =>
    (this.reporte()?.empresas ?? []).map((empresa) => ({
      empresa,
      estado: estadoDeEsquema(empresa),
      version: empresa.versionAplicada === null ? null : migracionLegible(empresa.versionAplicada),
    })),
  );

  /**
   * Cuántas no se pudieron comparar.
   *
   * Esto NO es recalcular la regla del backend: es contar un campo booleano que la
   * respuesta ya trae, igual que `planesActivos` filtra los planes retirados. El reporte da
   * `desfasadas` pero no este conteo, y sin él «cero desfasadas» se leería como «todo en
   * orden» con bases que nadie pudo comparar.
   */
  protected readonly sinComparar = computed(
    () => this.filas().filter((f) => f.estado === 'sin-comparar').length,
  );

  /**
   * La línea de apoyo del aviso de «nada que reportar».
   *
   * Con alguna sin comparar, el texto CAMBIA en lugar de añadir una nota al pie: decir
   * «todas al día» y debajo «dos no se pudieron comparar» deja la primera frase, que es la
   * que se lee, siendo falsa.
   */
  protected readonly apoyoNadaQueReportar = computed(() => {
    const s = t().salud;
    const total = this.reporte()?.totalEmpresas ?? 0;

    return this.sinComparar() === 0
      ? s.nadaQueReportarApoyo(total)
      : s.peroSinComparar(this.sinComparar());
  });

  constructor() {
    // La barra la dibuja el armazón. En un `effect` porque el contexto depende del reporte,
    // que llega después, y del idioma. Sin búsqueda —son tantas filas como empresas— y sin
    // acción: migrar no se dispara desde aquí, es el comando `migrar-empresas`.
    effect(() => {
      const s = t().salud;
      const r = this.reporte();

      this.barra.configurar({
        titulo: s.titulo,
        contexto:
          r === null
            ? ''
            : `${s.contexto(r.totalEmpresas)} · ${s.contextoDesfasadas(r.desfasadas)}`,
      });
    });
  }

  /**
   * El estado del tenant. `switch` exhaustivo y sin `default`: agregar un valor al enum del
   * contrato tiene que ser un error de compilación aquí.
   *
   * ponytail: es la tercera copia de este `switch` —las otras están en `empresas.ts` y
   * `dashboard.ts`— y se queda copiada. Extraerlo obliga a tocar dos pantallas que hoy
   * funcionan para ahorrar ocho líneas; el día que aparezca una cuarta copia, ese es el
   * momento de sacarlo a un archivo de la carpeta `plataforma/`.
   */
  protected nombreEstado(estado: EstadoTenant): string {
    const e = t().empresas.estado;

    switch (estado) {
      case EstadoTenant.Prueba:
        return e.prueba;
      case EstadoTenant.Activo:
        return e.activo;
      case EstadoTenant.Suspendido:
        return e.suspendido;
      case EstadoTenant.Cancelado:
        return e.cancelado;
    }
  }

  /**
   * El aprovisionamiento, y solo cuando NO es `Lista`.
   *
   * Es lo que explica una versión aplicada nula: una base cuyo alta va en curso o falló no
   * está desfasada, está a medias. Sin este dato, «nunca se migró» parecería un olvido de
   * mantenimiento en las cuatro situaciones.
   */
  protected enCurso(e: EmpresaEnSalud): string | null {
    const a = t().empresas.aprovisionamiento;

    switch (e.aprovisionamiento) {
      case EstadoAprovisionamiento.Pendiente:
        return a.pendiente;
      case EstadoAprovisionamiento.Creando:
        return a.creando;
      case EstadoAprovisionamiento.Fallida:
        return a.fallida;
      case EstadoAprovisionamiento.Lista:
        return null;
    }
  }
}
