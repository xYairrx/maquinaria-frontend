import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';

import { rutasDelAnfitrion } from './app.routes';
import { TituloPagina } from './nucleo/ambiente/titulo-pagina';
import { interceptorToken } from './nucleo/sesion/interceptor-token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    // Las rutas dependen del subdominio: en admin.<dominio> se registra la
    // superadministración y en <slug>.<dominio> la aplicación de esa empresa. Se
    // resuelve aquí, una sola vez, antes de que el router exista.
    //
    // withComponentInputBinding: los parámetros de ruta y de query llegan a los
    // componentes como input(), que es lo que pide la convención de no usar decoradores.
    provideRouter(rutasDelAnfitrion(), withComponentInputBinding()),

    provideHttpClient(withInterceptors([interceptorToken])),

    // El título de la pestaña lleva el nombre del producto detrás del de la pantalla.
    // Sin esto, dos pestañas abiertas —la plataforma y una empresa— dicen «Entrar» las
    // dos y no se distinguen.
    { provide: TitleStrategy, useClass: TituloPagina },
  ],
};
