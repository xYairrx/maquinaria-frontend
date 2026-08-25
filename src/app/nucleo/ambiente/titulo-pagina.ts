import { Injectable, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  TitleStrategy,
  type ActivatedRouteSnapshot,
  type ResolveFn,
  type RouterStateSnapshot,
} from '@angular/router';

import { idioma } from '../i18n/i18n';
import { sitio } from './sitio';

/**
 * Compone el título de la pestaña: «Entrar · RETROMAQ».
 *
 * Sin esto, cada ruta pone su `title` a secas y el nombre del producto solo aparece en
 * el `<title>` estático de `index.html`, que el router pisa en la primera navegación.
 * Con varias pestañas abiertas —y aquí es lo normal: la plataforma y una empresa a la
 * vez— «Entrar» y «Entrar» no se distinguen.
 *
 * El nombre sale de `sitio.nombre`, así que cambiarlo cambia también las pestañas.
 *
 * Y SE RECOMPONE AL CAMBIAR DE IDIOMA, que es de donde sale casi todo lo que sigue: el
 * router solo llama a `updateTitle` cuando navega, así que sin esto la pestaña se
 * quedaba en el idioma anterior. En una pantalla de acceso, donde no se navega a ningún
 * sitio, eso es para siempre.
 */
@Injectable({ providedIn: 'root' })
export class TituloPagina extends TitleStrategy {
  private readonly titulo = inject(Title);

  /** El último estado de ruta, para recomponer sin que el router navegue. */
  private readonly ultimoEstado = signal<RouterStateSnapshot | null>(null);

  constructor() {
    super();

    effect(() => {
      // Leer el idioma es lo que suscribe este efecto a sus cambios.
      idioma();

      const estado = this.ultimoEstado();

      if (estado !== null) {
        this.aplicar(estado);
      }
    });
  }

  override updateTitle(estado: RouterStateSnapshot): void {
    // Se aplica ya, sin esperar al efecto: un efecto se agenda para el siguiente ciclo y
    // la pestaña parpadearía con el título anterior al navegar.
    this.ultimoEstado.set(estado);
    this.aplicar(estado);
  }

  private aplicar(estado: RouterStateSnapshot): void {
    const propio = this.resolver(estado);

    // Una ruta sin `title` deja solo el nombre del producto, no « · RETROMAQ».
    this.titulo.setTitle(propio === null ? sitio.nombre : `${propio} · ${sitio.nombre}`);
  }

  /**
   * NO se usa `buildTitle` heredado, y esa es la parte que cuesta un rato entender.
   *
   * Los títulos de las rutas son funciones —`title: () => t().titulos.entrar`— para que
   * se traduzcan. El router las invoca UNA vez, al navegar, y guarda la cadena
   * resultante en el snapshot; `buildTitle` lee esa cadena. Así que al cambiar de idioma
   * devolvía tan campante el título en el idioma viejo, ya resuelto.
   *
   * `routeConfig` sí conserva la definición original, función incluida, y volver a
   * llamarla da el título en el idioma de AHORA. Se recorre hasta la hoja más profunda
   * que tenga título, que es el comportamiento de `buildTitle`: en un árbol con armazón
   * padre, el título lo pone la pantalla, no el armazón.
   *
   * Estas funciones no usan `inject()`, así que se llaman directas y no con
   * `runInInjectionContext`. Si algún día un título necesitara inyectar algo, esto es lo
   * que habría que cambiar.
   */
  private resolver(estado: RouterStateSnapshot): string | null {
    let ruta: ActivatedRouteSnapshot | null = estado.root;
    let encontrado: string | null = null;

    while (ruta !== null) {
      const definicion = ruta.routeConfig?.title;

      if (typeof definicion === 'string') {
        encontrado = definicion;
      } else if (typeof definicion === 'function') {
        // `Route.title` admite además un resolver de CLASE, que en tiempo de ejecución
        // también es `function`. Aquí no se usa ninguno —la forma de clase está obsoleta
        // en Angular— así que se estrecha a `ResolveFn` con una aserción.
        const resuelto = (definicion as ResolveFn<string>)(ruta, estado);

        // Un `ResolveFn` puede devolver una promesa o un observable. Los de este
        // proyecto devuelven la cadena directa; cualquier otra cosa se ignora en lugar de
        // pintar «[object Promise]» en la pestaña.
        if (typeof resuelto === 'string') {
          encontrado = resuelto;
        }
      }

      ruta = ruta.firstChild;
    }

    return encontrado;
  }
}
