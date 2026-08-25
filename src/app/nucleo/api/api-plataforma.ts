import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';
import { tap } from 'rxjs';

import { configuracion } from '../ambiente/configuracion';
import { SesionPlataformaStore } from '../sesion/sesion-plataforma';
import type {
  AltaDeEmpresa,
  AltaDePlan,
  EmpresaAprovisionada,
  IdentidadPlataforma,
  ResumenEmpresa,
  ResumenModulo,
  ResumenPlan,
  SesionPlataforma,
} from './contratos-plataforma';
import { mensajeDeErrorDeRecurso } from './mensaje-error';

/**
 * La API de la plataforma, y **la única fuente de la lista de empresas**.
 *
 * LEE ESTO ANTES DE PEDIR `/empresas` EN UNA PANTALLA NUEVA: la lista ya está aquí, en
 * `empresas`, y es COMPARTIDA. Este servicio es `providedIn: 'root'`, así que hay una sola
 * instancia y un solo recurso: dos pantallas que la lean hacen UNA petición entre las dos,
 * no una cada una. Antes el dashboard y la lista pedían lo mismo por separado en cada
 * navegación.
 *
 * Lo que se expone son SEÑALES NORMALES —`empresas`, `empresasCargando`, `empresasError`—
 * y no el recurso. Es deliberado: `httpResource` está marcado `@experimental` en Angular
 * (desde la 19.2, y sigue así en la 21.2), asi que se queda encerrado en este archivo. Si
 * su API cambia, cambia un archivo y no veintiséis pantallas. No lo expongas hacia fuera.
 */
@Injectable({ providedIn: 'root' })
export class ApiPlataforma {
  private readonly http = inject(HttpClient);
  private readonly sesion = inject(SesionPlataformaStore);
  private readonly base = `${configuracion.urlApi}/api/plataforma`;

  /**
   * El recurso de la lista de empresas.
   *
   * La URL es una FUNCIÓN y devuelve `undefined` sin sesión, que es como `httpResource`
   * expresa «todavía no pidas nada»: sin eso, la pantalla de acceso —que inyecta este
   * mismo servicio para iniciar sesión— dispararía un GET a `/empresas` sin token y se
   * comería un 401 antes de que nadie haya entrado.
   *
   * Al abrirse la sesión la señal cambia y el recurso pide solo, una vez.
   */
  private readonly recursoEmpresas = httpResource<readonly ResumenEmpresa[]>(
    () => (this.sesion.activa() ? `${this.base}/empresas` : undefined),
    { defaultValue: [] },
  );

  /**
   * Las empresas. Vacío mientras carga o si falla, nunca `undefined`, y **nunca lanza**.
   *
   * NO se expone `recursoEmpresas.value` directo, y esta es la trampa mas fea de
   * `httpResource`: leer `value()` con el recurso en estado de error **LANZA** un
   * `ResourceValueError`. Está en su documentación, en una frase de paso, y se paga caro:
   * las dos pantallas leen esta señal dentro de un `effect` sin condición —para poner el
   * contexto de la barra— asi que un fallo de la peticion reventaba el efecto en lugar de
   * pintar el aviso de error. Lo cazó la prueba de este archivo, no el navegador.
   *
   * `hasValue()` es false en error, asi que este `computed` devuelve el vacio y quien lo
   * lea no tiene que saber nada de todo esto.
   */
  readonly empresas = computed<readonly ResumenEmpresa[]>(() =>
    this.recursoEmpresas.hasValue() ? this.recursoEmpresas.value() : [],
  );

  /** `true` también al recargar, no solo en la primera carga. */
  readonly empresasCargando = this.recursoEmpresas.isLoading;

  /**
   * El error, ya traducido a algo que se puede pintar.
   *
   * Se traduce AQUÍ y no en cada pantalla para que `mensajeDeError` —y con él la regla de
   * no reescribir los textos que manda el servidor— pase por un solo sitio.
   */
  readonly empresasError = computed(() => mensajeDeErrorDeRecurso(this.recursoEmpresas.error()));

  /**
   * El catalogo comercial. Compartido, igual que las empresas: lo leen la pantalla de
   * planes y el selector de plan del alta de empresa, y entre las dos hacen una peticion.
   */
  private readonly recursoPlanes = httpResource<readonly ResumenPlan[]>(
    () => (this.sesion.activa() ? `${this.base}/planes` : undefined),
    { defaultValue: [] },
  );

  /**
   * Los modulos del catalogo, para armar un plan.
   *
   * Se piden a la API y no se leen de `textos.ts` a proposito: el backend es la fuente de
   * verdad de QUE modulos existen —`ClavesModulo`— y este lado solo traduce sus nombres.
   * Asi, agregar un modulo en el backend lo hace aparecer en el selector sin desplegar
   * nada aqui, solo su traduccion.
   */
  private readonly recursoModulos = httpResource<readonly ResumenModulo[]>(
    () => (this.sesion.activa() ? `${this.base}/modulos` : undefined),
    { defaultValue: [] },
  );

  /** Ver el comentario de `empresas`: `hasValue()` porque `value()` lanza en error. */
  readonly planes = computed<readonly ResumenPlan[]>(() =>
    this.recursoPlanes.hasValue() ? this.recursoPlanes.value() : [],
  );

  readonly planesCargando = this.recursoPlanes.isLoading;

  readonly planesError = computed(() => mensajeDeErrorDeRecurso(this.recursoPlanes.error()));

  /** Solo los activos, que son los unicos que el alta de una empresa puede contratar. */
  readonly planesActivos = computed(() => this.planes().filter((p) => p.activo));

  readonly modulos = computed<readonly ResumenModulo[]>(() =>
    this.recursoModulos.hasValue() ? this.recursoModulos.value() : [],
  );

  readonly modulosCargando = this.recursoModulos.isLoading;

  iniciarSesion(correo: string, contrasena: string) {
    return this.http.post<SesionPlataforma>(`${this.base}/sesion`, { correo, contrasena });
  }

  miSesion() {
    return this.http.get<IdentidadPlataforma>(`${this.base}/sesion/actual`);
  }

  /** Vuelve a pedir la lista. Lo llama el alta; una pantalla rara vez lo necesita. */
  recargarEmpresas(): void {
    this.recursoEmpresas.reload();
  }

  /**
   * Da de alta una empresa y **refresca la lista sola**.
   *
   * El `tap` está aquí y no en la pantalla a propósito: quien llame a esto no tiene que
   * acordarse de recargar, y el día que haya un segundo sitio que dé de alta empresas no
   * hay una segunda copia de esa llamada que se pueda olvidar.
   */
  recargarPlanes(): void {
    this.recursoPlanes.reload();
  }

  /** Crea un plan y refresca el catalogo solo, igual que el alta de empresa. */
  crearPlan(alta: AltaDePlan) {
    return this.http
      .post<ResumenPlan>(`${this.base}/planes`, alta)
      .pipe(tap(() => this.recargarPlanes()));
  }

  /**
   * Retira o reactiva un plan.
   *
   * Retirar NO toca a quien ya lo tiene contratado: su suscripcion sigue apuntando al
   * mismo plan con los mismos modulos. Lo unico que cambia es que el alta de empresas deja
   * de ofrecerlo.
   */
  cambiarActivoDePlan(codigo: string, activo: boolean) {
    return this.http
      .patch<ResumenPlan>(`${this.base}/planes/${encodeURIComponent(codigo)}/activo`, { activo })
      .pipe(tap(() => this.recargarPlanes()));
  }

  darDeAltaEmpresa(alta: AltaDeEmpresa) {
    return this.http
      .post<EmpresaAprovisionada>(`${this.base}/empresas`, alta)
      .pipe(tap(() => this.recargarEmpresas()));
  }
}
