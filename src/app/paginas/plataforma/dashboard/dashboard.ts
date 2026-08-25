import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Barra } from '../../../disposicion/barra';
import { ApiPlataforma } from '../../../nucleo/api/api-plataforma';
import { EstadoTenant, type ResumenEmpresa } from '../../../nucleo/api/contratos-plataforma';
import { idioma, t } from '../../../nucleo/i18n/i18n';
import { estadoDeEsquema } from '../salud-esquemas/esquema';
import { DashboardEsqueleto } from './esqueleto';
import { resumir, type MotivoAtencion } from './resumen';

// Trazos de Lucide (ISC), copiados en lugar de instalar el paquete, igual que en
// `opciones-menu.ts`.
const ICONOS = {
  edificios: 'M3 21h18M5 21V7l7-4v18M19 21V11l-7-4M9 9h.01M9 13h.01M9 17h.01',
  marca: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  reloj: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',
  aviso:
    'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0',
  salida: 'M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',
} as const;

/** Los filtros de la tabla. `todas` es el estado inicial. */
type Filtro = 'todas' | 'activas' | 'prueba' | 'detenidas';

/** Total de módulos del catálogo, para la barra de módulos contratados. */
const MODULOS_DEL_CATALOGO = 26;

/**
 * El resumen de la superadministración, y la pantalla de entrada del panel.
 *
 * NO PINTA UN SOLO NÚMERO QUE NO VENGA DE `GET /empresas`. El sistema de diseño prohíbe
 * las métricas de ejemplo —«un número inventado se ve igual que uno real y haría creer
 * que el sistema ya lo calcula»— y un dashboard es justo donde más fácil es saltarse esa
 * regla sin querer. De ahí que no haya ingresos, ni usuarios activos, ni utilización: la
 * API no los da.
 *
 * La estructura sigue el diseño de referencia —barra de la pantalla, cuatro indicadores
 * con el último destacado, banda de gráfica y avisos, tabla con chips— pero cada hueco se
 * llenó con el dato real que le corresponde, no con el del boceto. Donde el boceto pedía
 * «utilización semanal» va **altas por mes**, que es la única serie temporal que la lista
 * de empresas permite calcular.
 *
 * EL AVISO DE ESQUEMA SALE DEL ENDPOINT, no de una deducción. Antes se comparaba la versión
 * de cada empresa contra la más avanzada de la lista, y eso reportaba cero desfase cuando
 * TODAS iban una migración atrás —la más avanzada era una de las atrasadas—, que es el
 * estado normal del sistema. La referencia buena es la del binario que responde y la trae
 * `GET /salud/esquemas`, del mismo recurso compartido que lee la pantalla de esquemas.
 */
@Component({
  selector: 'app-dashboard',
  imports: [DashboardEsqueleto, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly api = inject(ApiPlataforma);
  private readonly barra = inject(Barra);

  protected readonly t = t;
  protected readonly iconos = ICONOS;
  protected readonly totalModulos = MODULOS_DEL_CATALOGO;

  /**
   * El locale se le pasa a `| date` explícitamente en la plantilla.
   *
   * `LOCALE_ID` se resuelve al construirse el inyector, así que con el pipe a secas la
   * fecha se quedaría en el idioma con el que se cargó la página mientras el resto de la
   * pantalla ya cambió. Está anotado en `nucleo/i18n/i18n.ts`.
   */
  protected readonly locale = idioma;

  /**
   * El instante de la carga, capturado UNA vez.
   *
   * Es el «actualizado a las…» de la barra, y el ancla de los meses de la gráfica. Leerlo
   * dentro de un `computed` lo volvería a leer en cada recálculo y la gráfica podría
   * cambiar de meses sin que llegue un dato nuevo.
   */
  protected readonly cargadoEn = new Date();

  /**
   * Los datos NO se piden aquí: vienen del recurso compartido de `ApiPlataforma`, que la
   * pantalla de Empresas lee tambien. Antes cada una hacia su propia peticion en cada
   * navegacion; ahora es una entre las dos.
   */
  protected readonly empresas = this.api.empresas;

  /**
   * El reporte de esquemas, del MISMO recurso compartido que lee la pantalla de esquemas:
   * entre las dos hay una sola petición.
   */
  private readonly salud = this.api.saludEsquemas;

  /**
   * Se espera también al reporte, no solo a las empresas.
   *
   * Las dos peticiones salen juntas —dependen de la misma señal de sesión— así que esperar
   * a las dos no retrasa nada, y evita que la tabla enseñe un guion en la columna de
   * esquema y la lista de avisos aparezca incompleta durante un instante. Un aviso que
   * aparece tarde se lee como un aviso que no estaba.
   */
  protected readonly cargando = computed(
    () => this.api.empresasCargando() || this.api.saludEsquemasCargando(),
  );

  protected readonly error = this.api.empresasError;

  /**
   * El error del REPORTE, que no tumba la pantalla.
   *
   * Va como aviso dentro de la tarjeta de avisos y no en el hueco de error de arriba: si
   * `/empresas` respondió, el resto del panel es correcto y taparlo entero sería peor. Pero
   * callarlo también: sin reporte no hay avisos de esquema, y su ausencia se leería como
   * «todo en orden», que es exactamente la mentira que este cambio viene a quitar.
   */
  protected readonly errorSalud = this.api.saludEsquemasError;

  /** El reporte indexado por id, para la columna de la tabla y el detalle del aviso. */
  private readonly esquemas = computed(
    () => new Map((this.salud()?.empresas ?? []).map((e) => [e.id, e])),
  );

  protected readonly busqueda = signal('');
  protected readonly filtro = signal<Filtro>('todas');

  protected readonly resumen = computed(() =>
    resumir(this.empresas(), this.cargadoEn, this.salud()),
  );

  /**
   * La hora de la carga, en el idioma activo.
   *
   * Con `Intl` y no con `DatePipe` porque este dato lo consume el `.ts` —va al servicio de
   * la barra, no a una plantilla— y un pipe ahí obligaría a inyectarlo a mano. Depender de
   * `idioma()` es lo que la vuelve a formatear al cambiar de idioma.
   */
  protected readonly horaDeCarga = computed(() =>
    new Intl.DateTimeFormat(idioma(), { hour: 'numeric', minute: '2-digit' }).format(
      this.cargadoEn,
    ),
  );

  /** El alto de las barras se escala contra el mes más alto, nunca contra un tope fijo. */
  protected readonly maximoAltas = computed(() =>
    Math.max(1, ...this.resumen().altasPorMes.map((m) => m.total)),
  );

  /** Los cuatro chips, con su conteo. El conteo evita filtrar para encontrar un vacío. */
  protected readonly chips = computed(() => {
    const r = this.resumen();
    const m = t().panel;

    return [
      { clave: 'todas' as Filtro, etiqueta: m.chipTodas, total: r.total },
      { clave: 'activas' as Filtro, etiqueta: m.chipActivas, total: r.activas },
      { clave: 'prueba' as Filtro, etiqueta: m.chipPrueba, total: r.enPrueba },
      { clave: 'detenidas' as Filtro, etiqueta: m.chipDetenidas, total: this.detenidas().length },
    ];
  });

  /**
   * Las cuatro tarjetas, como DATOS: así el marcado del indicador se escribe una vez y
   * no cuatro, que es de donde salen las copias que se quedan a medias.
   *
   * «Requieren atención» va destacada y al final, como en el diseño de referencia. Es la
   * única: el sistema de diseño permite una por pantalla, y esta es la que dice si hay
   * que hacer algo ahora.
   */
  protected readonly indicadores = computed(() => {
    const r = this.resumen();
    const p = t().panel;

    return [
      {
        clave: 'total',
        etiqueta: p.totalEmpresas,
        cifra: `${r.total}`,
        pie: p.pieTotal(r.total),
        icono: ICONOS.edificios,
        destacada: false,
      },
      {
        clave: 'activas',
        etiqueta: p.activas,
        // «4 / 6» como en el diseño: una cifra suelta no dice si son muchas o pocas.
        cifra: `${r.activas} / ${r.total}`,
        pie: p.pieActivas,
        icono: ICONOS.marca,
        destacada: false,
      },
      {
        clave: 'prueba',
        etiqueta: p.enPrueba,
        cifra: `${r.enPrueba}`,
        pie: p.pieEnPrueba,
        icono: ICONOS.reloj,
        destacada: false,
      },
      {
        clave: 'atencion',
        etiqueta: p.requierenAtencion,
        cifra: `${r.atencion.length}`,
        pie: r.atencion.length === 0 ? p.pieAtencionCero : p.pieAtencion(r.atencion.length),
        icono: ICONOS.aviso,
        destacada: true,
      },
    ];
  });

  /** Suspendidas y canceladas: las que no operan. Es el chip «detenidas» del diseño. */
  private readonly detenidas = computed(() =>
    this.empresas().filter(
      (e) => e.estado === EstadoTenant.Suspendido || e.estado === EstadoTenant.Cancelado,
    ),
  );

  /**
   * Lo que se ve en la tabla: el chip y la búsqueda se aplican en ese orden.
   *
   * La búsqueda mira slug y razón social, que son los dos campos por los que alguien
   * busca una empresa. Sin acentos y en minúsculas: quien escribe «bajio» tiene que
   * encontrar «Bajío».
   */
  protected readonly visibles = computed(() => {
    const texto = normalizar(this.busqueda());

    const porEstado = (() => {
      switch (this.filtro()) {
        case 'activas':
          return this.empresas().filter((e) => e.estado === EstadoTenant.Activo);
        case 'prueba':
          return this.empresas().filter((e) => e.estado === EstadoTenant.Prueba);
        case 'detenidas':
          return this.detenidas();
        case 'todas':
          return this.empresas();
      }
    })();

    if (texto === '') {
      return porEstado;
    }

    return porEstado.filter(
      (e) => normalizar(e.slug).includes(texto) || normalizar(e.razonSocial).includes(texto),
    );
  });

  constructor() {
    // La barra la dibuja el armazón; aquí solo se dice qué pone. Va en un `effect` y no
    // una vez porque el contexto depende de dos cosas que cambian después: el total, que
    // llega con la petición, y el idioma.
    effect(() => {
      const p = t().panel;

      this.barra.configurar({
        titulo: p.titulo,
        contexto: `${p.contexto(this.resumen().total)} · ${p.actualizado(this.horaDeCarga())}`,
        busqueda: { marcador: p.buscar, valor: this.busqueda },
        accion: { etiqueta: p.nuevaEmpresa, ruta: '/empresas' },
      });
    });
  }

  protected buscar(valor: string): void {
    this.busqueda.set(valor);
  }

  /** El titular del aviso. `switch` exhaustivo: un motivo nuevo no compila sin texto. */
  protected motivo(motivo: MotivoAtencion): string {
    const p = t().panel;

    switch (motivo) {
      case 'fallida':
        return p.motivoFallida;
      case 'sin-suscripcion':
        return p.motivoSinSuscripcion;
      case 'esquema-desfasado':
        return p.motivoEsquemaDesfasado;
      case 'esquema-sin-comparar':
        return p.motivoEsquemaSinComparar;
    }
  }

  protected detalle(motivo: MotivoAtencion, empresa: ResumenEmpresa): string {
    const p = t().panel;

    switch (motivo) {
      case 'fallida':
        return p.detalleFallida;
      case 'sin-suscripcion':
        return p.detalleSinSuscripcion;
      case 'esquema-desfasado':
        // El `?? 0` no llega a pasar: `resumir` solo mete este motivo para una empresa que
        // viene en el reporte. Está para no tener que aseverar el tipo.
        return p.detalleEsquemaDesfasado(
          this.esquemas().get(empresa.id)?.migracionesPendientes ?? 0,
        );
      case 'esquema-sin-comparar':
        return p.detalleEsquemaSinComparar;
    }
  }

  /**
   * El estado de esquema de una empresa para la columna de la tabla, o `null` si no viene
   * en el reporte.
   *
   * Los TRES estados se resuelven con `estadoDeEsquema`, la misma función que usa la
   * pantalla de esquemas: la regla está escrita una vez. Antes esta celda comparaba la
   * versión contra la más avanzada de la lista y por eso decía «Al día» a todas cuando
   * todas iban atrás.
   */
  protected esquemaDe(id: string): { readonly texto: string; readonly aviso: boolean } | null {
    const entrada = this.esquemas().get(id);

    if (entrada === undefined) {
      return null;
    }

    const s = t().salud;

    switch (estadoDeEsquema(entrada)) {
      case 'al-dia':
        return { texto: s.estadoAlDia, aviso: false };
      case 'desfasada':
        return { texto: s.estadoDesfasada, aviso: true };
      case 'sin-comparar':
        return { texto: s.estadoSinComparar, aviso: true };
    }
  }

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
   * La píldora de estado, como en el diseño: negra la que opera, neutra la de prueba,
   * de aviso la detenida.
   *
   * Devuelve las clases desde el `.ts` y no con cuatro `[class.x]` en la plantilla porque
   * son cuatro estados por tres propiedades: en el marcado serían doce bindings que hay
   * que leer en paralelo para saber cómo se ve un «Suspendido».
   *
   * El color NO es el único indicio: la píldora lleva siempre el nombre del estado
   * escrito (WCAG 1.4.1).
   */
  protected clasePildora(estado: EstadoTenant): string {
    switch (estado) {
      case EstadoTenant.Activo:
        return 'bg-negro-tarjeta text-texto-inverso';
      case EstadoTenant.Prueba:
        return 'bg-estado-neutro-fondo text-estado-neutro-texto';
      case EstadoTenant.Suspendido:
      case EstadoTenant.Cancelado:
        return 'bg-alerta-fondo text-alerta-texto';
    }
  }
}

/**
 * Minúsculas y sin diacríticos, para comparar.
 *
 * `NFD` separa la letra de su acento y el rango de escapes borra los acentos sueltos, así
 * que «Bajío» y «bajio» acaban iguales. Es lo que hace que la búsqueda sirva sin obligar
 * a escribir los acentos.
 */
function normalizar(valor: string): string {
  return (
    valor
      .trim()
      .toLowerCase()
      .normalize('NFD')
      // Los diacríticos combinantes, por punto de código y no escritos literalmente: un
      // acento suelto en el fuente es invisible y cualquier editor puede recomponerlo.
      .replace(/[\u0300-\u036f]/g, '')
  );
}
