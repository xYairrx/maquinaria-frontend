import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';

import { sitio } from './sitio';

/**
 * Compone el título de la pestaña: «Entrar · Maquinaria».
 *
 * Sin esto, cada ruta pone su `title` a secas y el nombre del producto solo aparece en
 * el `<title>` estático de `index.html`, que el router pisa en la primera navegación.
 * Con varias pestañas abiertas —y aquí es lo normal: la plataforma y una empresa a la
 * vez— «Entrar» y «Entrar» no se distinguen.
 *
 * El nombre sale de `sitio.nombre`, así que cambiarlo cambia también las pestañas.
 */
@Injectable({ providedIn: 'root' })
export class TituloPagina extends TitleStrategy {
  private readonly titulo = inject(Title);

  override updateTitle(estado: RouterStateSnapshot): void {
    const propio = this.buildTitle(estado);

    // Una ruta sin `title` deja solo el nombre del producto, no « · Maquinaria».
    this.titulo.setTitle(propio ? `${propio} · ${sitio.nombre}` : sitio.nombre);
  }
}
