import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';

import { Barra } from '../../../disposicion/barra';
import { idioma, nombreModulo, t } from '../../../nucleo/i18n/i18n';
import { Sesion } from '../../../nucleo/sesion/sesion';
import { InicioEsqueleto } from './esqueleto';

/**
 * Total de módulos del catálogo, para el «X de 29». Sale de la base central
 * (`ClavesModulo.Todas`), no de lo que esta empresa contrató.
 *
 * **Era 26 y quedó obsoleto el 2026-09-01**, cuando el MVP agregó `movimientos`, `proyectos` y
 * `ventas`. El síntoma era mudo y absurdo a la vez: una empresa con los 29 contratados leía
 * «29 de 26». Se descubrió el 2026-09-03 mirando la pantalla con datos reales, no compilando.
 *
 * Es un número copiado a mano de otro repositorio y por eso se desincroniza. Vive aquí porque
 * la API no lo manda: `/api/mi/sesion` devuelve los módulos CONTRATADOS, y el total del
 * catálogo es información de la plataforma, no de la empresa.
 */
const MODULOS_DEL_CATALOGO = 29;

/**
 * Los módulos con pantalla propia. El resto se muestra apagado.
 *
 * **EL CRITERIO ES «se puede operar el módulo», no «existe alguna pantalla suya».** Cuando solo
 * existía el catálogo de Marcas, `equipos` NO se marcaba pese a que su endpoint exigía
 * `equipos.consultar`: decirlo habría prometido que se administra el parque, y no se podía.
 *
 * Ese listón es el que hay que seguir aplicando. Hoy los diez de abajo lo pasan porque su ciclo
 * completo está construido, no porque tengan una pantalla.
 *
 * HISTORIA, para que no vuelva: decía `new Set(['usuarios'])` y era falso en dos sentidos —no
 * hay ruta `/usuarios` y el backend no expone endpoints de usuarios ni de roles para una
 * empresa—. Después estuvo VACÍO durante toda la Fase 1, y el «Implementados 0» se quedó
 * mintiendo al revés mientras se construían veintitantas pantallas. Se llenó al cerrar el
 * alcance. Ver `docs/plan-fase1-front.md` §3.1.
 */
const IMPLEMENTADOS = new Set<string>([
  // Alta de máquina, expediente con documentos y precios, traspasos, y sus cuatro catálogos
  // —marcas, categorías, tipos, modelos—. El parque se administra de verdad.
  'equipos',
  'sucursales',
  'clientes',
  'proveedores',
  'disponibilidad',
  'cotizaciones',
  // Las cinco operaciones: confirmar, entregar, extender, devolver y cerrar.
  'rentas',
  'contratos',
  // Órdenes de compra. Su controlador declara `compras` en el servidor.
  'compras',

  // --------------------------------------------- lo que entró con el MVP --
  // Órdenes de venta. Declaraban `compras` hasta el 2026-09-02; ahora exigen `ventas.*`, así
  // que el módulo 23 dejó de estar vacío.
  'ventas',

  // El historial físico: listado con filtros, captura manual de los tres tipos que no nacen
  // de un documento, y el historial dentro del expediente del equipo.
  'movimientos',

  // Las obras, con el alta que crea proyecto y ubicación en una transacción, y sus estados.
  'proyectos',

  // Abrir, marcar en proceso, finalizar y cancelar, con su ocupación del calendario y sus
  // dos movimientos automáticos. El ciclo completo.
  'mantenimiento',

  // Los seis reportes se consultan. La EXPORTACIÓN no existe todavía y no cambia el listón:
  // el módulo se puede operar —se consulta y se lee—, que es lo que esta marca afirma.
  'reportes',

  'dashboard',

  // `usuarios` YA ESTÁ, desde el 2026-09-02. El comentario que vivía aquí decía que el
  // backend no exponía endpoints de usuarios ni de roles para una empresa, y era cierto:
  // ahora expone catorce, y las pantallas de Usuarios, Roles y permisos y Bitácora los usan.
  // Invitar gente dejó de ser una acción de plataforma.
  'usuarios',
]);

@Component({
  selector: 'app-inicio',
  imports: [InicioEsqueleto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inicio.html',
})
export class Inicio {
  // La identidad la carga DisposicionEmpresa, la ruta padre, una sola vez por sesión.
  // Pedirla también aquí duplicaba la petición en cada navegación al inicio.
  protected readonly identidad = inject(Sesion).identidad;

  protected readonly t = t;
  protected readonly totalModulos = MODULOS_DEL_CATALOGO;

  /**
   * Se ordenan por nombre y se marca lo que ya existe.
   *
   * La lista viene de los MÓDULOS CONTRATADOS que devuelve la API, no de una constante
   * del front: si el plan de la empresa no incluye logística, aquí no aparece.
   */
  protected readonly modulos = computed(() =>
    (this.identidad()?.modulos ?? [])
      .map((clave) => ({
        clave,
        nombre: nombreModulo(clave),
        listo: IMPLEMENTADOS.has(clave),
      }))
      // El orden se recalcula con el idioma: alfabético en español no es alfabético en
      // inglés, y `localeCompare` con el locale correcto es lo que coloca la «Ó» de
      // «Órdenes» donde la espera quien lee en español.
      .sort((a, b) => a.nombre.localeCompare(b.nombre, idioma())),
  );

  protected readonly implementados = computed(() => this.modulos().filter((m) => m.listo).length);

  constructor() {
    // El titulo es la razon social de la empresa y el contexto su identificador: es lo
    // que dice a que empresa perteneces sin gastar una linea del contenido.
    const barra = inject(Barra);

    effect(() =>
      barra.configurar({
        titulo: this.identidad()?.razonSocial ?? '…',
        contexto: this.identidad()?.empresa ?? '',
      }),
    );
  }
}
