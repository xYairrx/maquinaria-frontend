import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';

import { Barra } from '../../../disposicion/barra';
import { idioma, nombreModulo, t } from '../../../nucleo/i18n/i18n';
import { Sesion } from '../../../nucleo/sesion/sesion';

/**
 * Total de módulos del catálogo, para el «X de 26». Sale de la base central
 * (`ClavesModulo`), no de lo que esta empresa contrató.
 */
const MODULOS_DEL_CATALOGO = 26;

/** Lo que ya se puede construir. El resto se muestra apagado. */
const IMPLEMENTADOS = new Set(['usuarios']);

@Component({
  selector: 'app-inicio',
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
