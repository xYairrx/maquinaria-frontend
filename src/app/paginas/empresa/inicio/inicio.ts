import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';

import { Barra } from '../../../disposicion/barra';
import { idioma, nombreModulo, t } from '../../../nucleo/i18n/i18n';
import { Sesion } from '../../../nucleo/sesion/sesion';
import { InicioEsqueleto } from './esqueleto';

/**
 * Total de módulos del catálogo, para el «X de 26». Sale de la base central
 * (`ClavesModulo`), no de lo que esta empresa contrató.
 */
const MODULOS_DEL_CATALOGO = 26;

/**
 * Los módulos con pantalla propia. El resto se muestra apagado.
 *
 * EL CRITERIO ES «se puede operar el módulo», no «existe alguna pantalla suya». Marcas ya
 * está construida y su endpoint exige `equipos.consultar`, pero el módulo de equipos en sí
 * —el alta de una máquina, su expediente— todavía no: marcar `equipos` aquí diría que se
 * puede administrar el parque, y no se puede.
 *
 * Decía `new Set(['usuarios'])` y era falso en dos sentidos: no hay ruta `/usuarios` en
 * `rutas-empresa.ts`, y el backend **no expone endpoints de usuarios ni de roles** para una
 * empresa —solo `/api/mi/sesion` y aceptar una invitación—. Hoy invitar gente a una empresa
 * es una acción de plataforma. Ver `docs/plan-fase1-front.md` §3.1.
 */
const IMPLEMENTADOS = new Set<string>();

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
