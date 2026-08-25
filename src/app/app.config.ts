import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeEnUs from '@angular/common/locales/en';
import localeEsMx from '@angular/common/locales/es-MX';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { TitleStrategy, provideRouter, withComponentInputBinding } from '@angular/router';

import { rutasDelAnfitrion } from './app.routes';
import { TituloPagina } from './nucleo/ambiente/titulo-pagina';
import { idiomaGuardado, iniciarIdioma } from './nucleo/i18n/i18n';
import { interceptorRefresco } from './nucleo/sesion/interceptor-refresco';
import { interceptorToken } from './nucleo/sesion/interceptor-token';

// Los datos de locale se registran ANTES de que exista el inyector: sin esto, el primer
// `| date` o `| currency` lanza en tiempo de ejecución en lugar de fallar al compilar.
// Angular solo trae `en-US` de fábrica, así que `es-MX` —que es el predeterminado— es
// justo el que faltaría.
registerLocaleData(localeEsMx);
registerLocaleData(localeEnUs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    // El locale de los `pipe` de fecha, número y moneda. Se lee del idioma GUARDADO y no
    // de una constante: quien dejó la interfaz en inglés espera también sus fechas en
    // inglés al volver.
    //
    // Se resuelve una sola vez, al construirse el inyector, así que cambiar de idioma en
    // vivo no lo mueve. El porqué y las dos salidas están en `nucleo/i18n/i18n.ts`.
    { provide: LOCALE_ID, useFactory: idiomaGuardado },

    // `index.html` trae `lang="es-MX"` fijo, que es lo correcto para el primer instante
    // —el lector de pantalla elige la voz antes de que Angular arranque—, pero deja de
    // ser cierto si la preferencia guardada es otra. Eso, guardar la preferencia en este
    // origen y limpiar el `?idioma=` con el que viaja entre subdominios, todo en uno.
    provideAppInitializer(iniciarIdioma),

    // Las rutas dependen del subdominio: en admin.<dominio> se registra la
    // superadministración y en <slug>.<dominio> la aplicación de esa empresa. Se
    // resuelve aquí, una sola vez, antes de que el router exista.
    //
    // withComponentInputBinding: los parámetros de ruta y de query llegan a los
    // componentes como input(), que es lo que pide la convención de no usar decoradores.
    provideRouter(rutasDelAnfitrion(), withComponentInputBinding()),

    // EL ORDEN IMPORTA, y no es cosmético. `interceptorRefresco` va primero, es decir por
    // FUERA: su `siguiente` es el resto de la cadena, así que la petición que reintenta
    // tras refrescar vuelve a pasar por `interceptorToken` y sale con el `Bearer` nuevo.
    // Al revés, el reintento saldría con el token ya caducado y daría otro 401.
    provideHttpClient(withInterceptors([interceptorRefresco, interceptorToken])),

    // El título de la pestaña lleva el nombre del producto detrás del de la pantalla.
    // Sin esto, dos pestañas abiertas —la plataforma y una empresa— dicen «Entrar» las
    // dos y no se distinguen.
    { provide: TitleStrategy, useClass: TituloPagina },
  ],
};
