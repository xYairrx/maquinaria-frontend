import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { interceptorToken } from './nucleo/interceptor-token';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    // withComponentInputBinding: los parámetros de ruta y de query llegan a los
    // componentes como input(), que es lo que pide la convención de no usar decoradores.
    provideRouter(routes, withComponentInputBinding()),

    provideHttpClient(withInterceptors([interceptorToken])),
  ],
};
