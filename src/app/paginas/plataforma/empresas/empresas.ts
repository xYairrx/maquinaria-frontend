import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Barra } from '../../../disposicion/barra';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiPlataforma } from '../../../nucleo/api/api-plataforma';
import { t } from '../../../nucleo/i18n/i18n';
import { configuracion } from '../../../nucleo/ambiente/configuracion';
import {
  EstadoAprovisionamiento,
  EstadoTenant,
  SIN_LIMITE,
  type EmpresaAprovisionada,
  type LimiteDeEmpresa,
  type ResumenEmpresa,
  type ResultadoReenvio,
} from '../../../nucleo/api/contratos-plataforma';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import {
  normalizarCorreo,
  normalizarRfc,
  normalizarTelefono,
  soloDigitos,
  validadorCorreo,
  validadorRequerido,
  validadorRfc,
  validadorTelefono,
} from '../../../nucleo/formularios/validadores';
import { SesionPlataformaStore } from '../../../nucleo/sesion/sesion-plataforma';
import { EmpresasEsqueleto } from './esqueleto';

/** Mismo patrón que el CHECK de la base y que FormatoSlug en el dominio. */
const PATRON_SLUG = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

@Component({
  selector: 'app-empresas',
  imports: [EmpresasEsqueleto, ErrorCampo, PanelLateral, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empresas.html',
})
export class Empresas {
  private readonly api = inject(ApiPlataforma);
  private readonly barra = inject(Barra);
  private readonly sesion = inject(SesionPlataformaStore);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;

  /**
   * Si el mensaje de error de un campo se tiene que ver. La regla está en `error-campo.ts`,
   * una sola vez: inválido Y tocado, nunca mientras se escribe el primer carácter.
   *
   * Se expone como miembro porque Angular no puede llamar a una función importada desde el
   * marcado. Es la misma línea que van a escribir las 26 pantallas que vienen.
   */
  protected readonly mal = errorVisible;

  protected readonly lista = EstadoAprovisionamiento.Lista;
  protected readonly fallida = EstadoAprovisionamiento.Fallida;

  /** Para enseñar en el formulario cómo quedará la URL de la empresa nueva. */
  protected readonly dominioBase = configuracion.dominioBase;

  protected readonly identidad = this.sesion.identidad;

  /**
   * La lista NO se pide aquí: viene del recurso compartido de `ApiPlataforma`, el mismo que
   * lee el dashboard. Y el alta lo recarga sola, así que esta pantalla ya no tiene una
   * función `recargar()` que alguien pueda olvidarse de llamar.
   */
  protected readonly empresas = this.api.empresas;
  protected readonly cargando = this.api.empresasCargando;

  /**
   * Solo los planes ACTIVOS: un plan retirado sigue existiendo para quien ya lo contrato,
   * pero no se puede contratar de nuevo — `AprovisionarEmpresa` lo rechaza igual, y ofrecerlo
   * aqui seria ofrecer algo que el servidor va a negar.
   *
   * Del recurso compartido, asi que la pantalla de Planes y esta hacen una peticion entre
   * las dos.
   */
  protected readonly planes = this.api.planesActivos;

  protected readonly enviando = signal(false);
  protected readonly reciente = signal<EmpresaAprovisionada | null>(null);

  /**
   * EL SLUG del reenvio en vuelo, o `null`. Era un booleano, y con el boton dentro de cada
   * fila un booleano miente: deshabilitaba el boton de TODAS las filas al pulsar una. Con el
   * slug se deshabilita solo el que se pulso.
   */
  protected readonly reenviandoSlug = signal<string | null>(null);

  /**
   * Lo que contesto el ultimo reenvio, para decir a que correo fue.
   *
   * Va aparte de `reciente()` y no lo pisa: el aviso del alta cuenta lo que paso al crearla
   * —la base, el esquema, su liga— y este cuenta el reenvio. Su aviso vive ARRIBA DE LA
   * TABLA, junto al hueco del error, porque ahora el reenvio se dispara desde la fila de
   * cualquier empresa y tiene que verse tambien cuando no hay ningun alta reciente.
   */
  protected readonly reenvio = signal<ResultadoReenvio | null>(null);

  /**
   * Si el panel del alta esta abierto. El `<dialog>`, el velo y el cierre los maneja
   * `app-panel-lateral`; aqui solo se dice cuando se ve. Mismo trato que en la pantalla de
   * planes.
   */
  protected readonly panelAbierto = signal(false);

  /**
   * El error de lo que la persona acaba de disparar en esta pantalla —el alta o un reenvio—.
   * El de la lista lo trae el recurso.
   */
  private readonly errorAlta = signal<string | null>(null);

  /**
   * Un solo hueco para el aviso, con el del alta por delante: es el que acaba de provocar
   * la persona, así que taparlo con un fallo de la lista sería contestar a otra pregunta.
   */
  protected readonly error = computed(() => this.errorAlta() ?? this.api.empresasError());

  protected readonly formulario = this.fb.group({
    slug: ['', [Validators.required, Validators.pattern(PATRON_SLUG)]],
    razonSocial: ['', validadorRequerido],
    // Opcionales los dos: vacío es válido y se manda `null`. Lo que ya NO se admite es
    // cualquier cosa — el RFC pedía longitud libre y el teléfono aceptaba letras. Las reglas
    // son espejo de las del backend y viven en `nucleo/formularios/validadores.ts`, porque
    // `Cliente` y `Proveedor` llevan los mismos dos campos.
    rfc: ['', validadorRfc],
    telefono: ['', validadorTelefono],
    nombreAdministrador: ['', validadorRequerido],
    // `validadorCorreo` SUSTITUYE a `Validators.email`, que da por bueno `a@b`: un correo sin
    // punto en el dominio no lo entrega ningún servidor, y por ahí va la invitación del
    // primer administrador. `required` se queda al lado, que es quien reclama el vacío.
    correoAdministrador: ['', [validadorRequerido, validadorCorreo]],
    // Ya no va fijo a 'base': el catalogo existe, asi que se elige. Arranca vacio y el
    // `required` obliga a escogerlo — preseleccionar el primero haria que alguien diera de
    // alta una empresa con un plan que no miro.
    codigoPlan: ['', Validators.required],
  });

  constructor() {
    // El alta ya NO vive en la pantalla: vive en el panel lateral, asi que la barra por
    // fin tiene accion principal. Antes no la tenia porque un boton amarillo que apuntara
    // al formulario de mas abajo no llevaba a ninguna parte; ahora abre el panel, igual que
    // en planes. Es `alPulsar` y no `ruta`, asi que el armazon pinta un `<button>`: anunciar
    // «enlace» para algo que abre un panel en la misma pantalla le miente a un lector.
    effect(() =>
      this.barra.configurar({
        titulo: t().empresas.titulo,
        contexto: t().panel.contexto(this.empresas().length),
        accion: { etiqueta: t().empresas.crear, alPulsar: () => this.abrirPanel() },
      }),
    );
  }

  protected abrirPanel(): void {
    // El aviso del intento anterior no se arrastra al panel nuevo: quien lo abre otra vez
    // no esta mirando el fallo de hace un rato.
    this.errorAlta.set(null);
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  /**
   * Sin un plan activo NO se puede dar de alta nada: `AprovisionarEmpresa` lo rechaza en el
   * servidor, asi que dejar el boton habilitado seria prometer un viaje que acaba en error.
   */
  protected puedeEnviar(): boolean {
    return this.formulario.valid && this.planes().length > 0 && !this.enviando();
  }

  /**
   * Reenvia la invitacion del administrador de una empresa.
   *
   * NO MANDA NINGUN CORREO como parametro, y no es un olvido: el endpoint no lo acepta. El
   * destinatario sale de la base de la empresa, y viene de VUELTA en la respuesta para poder
   * decir a donde fue. Si alguien le agrega aqui un campo de correo, esta reabriendo la
   * escalada de privilegios que el reintento del alta tuvo.
   *
   * Un envio que falla NO es un error de esta llamada: el servidor contesta 200 con
   * `invitacionEnviada: false`, porque la invitacion si se reemitio —y la anterior ya quedo
   * invalidada—. Lo que falta es reintentar el correo.
   *
   * No recarga la lista a mano: eso lo encadena `ApiPlataforma.reenviarInvitacion`, que es
   * quien sabe que un reenvio correcto cambia el `invitacionEnviada` de la fila.
   */
  protected reenviarInvitacion(slug: string): void {
    // El guard es POR SLUG y no global: pulsar dos veces la misma fila reemitiria otra vez e
    // invalidaria la liga que acaba de salir, mientras que dos filas distintas son dos
    // reenvios legitimos.
    //
    // ponytail: un solo slug y no un conjunto. Con dos reenvios en vuelo el aviso ensena el
    // que contesta al final y el boton del primero se rehabilita antes de tiempo. Es un
    // segundo de ventana, la peticion vuelve igual y su resultado se ve en la fila al
    // recargarse la lista; un `Set` para eso serian mas estados que el fallo que arregla.
    if (this.reenviandoSlug() === slug) {
      return;
    }

    this.reenviandoSlug.set(slug);
    this.errorAlta.set(null);
    this.reenvio.set(null);

    this.api.reenviarInvitacion(slug).subscribe({
      next: (resultado) => {
        this.reenvio.set(resultado);
        this.reenviandoSlug.set(null);
      },
      error: (e: unknown) => {
        this.errorAlta.set(mensajeDeError(e));
        this.reenviandoSlug.set(null);
      },
    });
  }

  // ------------------------------------------------------------------ límites --
  //
  // Los cupos de una empresa, en su propio panel. Se abren desde la fila porque es lo que
  // se está mirando: un cupo es de UNA empresa, así que una pantalla suelta obligaría a
  // volver a elegirla.

  /** El slug cuyo panel de límites está abierto, o `null`. Hace de «abierto» y de «cuál». */
  protected readonly limitesSlug = signal<string | null>(null);

  protected readonly limites = signal<readonly LimiteDeEmpresa[]>([]);

  protected readonly limitesCargando = signal(false);

  /**
   * La clave del cupo que tiene una petición en vuelo.
   *
   * Por clave y no un booleano global, por lo mismo que `reenviandoSlug`: con el booleano,
   * guardar un cupo deshabilitaba los botones de los cuatro.
   */
  protected readonly limiteEnVuelo = signal<string | null>(null);

  protected readonly errorLimites = signal<string | null>(null);

  /**
   * Lo que hay escrito en cada fila, por clave.
   *
   * Se guarda el TEXTO y no el número: un `<input type="number">` vacío da `null`, y
   * distinguir «lo borré para escribir otro» de «vale cero» necesita el texto tal cual.
   * Es la trampa 3 de `AGENTS.md`, vista desde el otro lado.
   */
  protected readonly borrador = signal<Record<string, { texto: string; sinLimite: boolean }>>({});

  protected abrirLimites(slug: string): void {
    this.limitesSlug.set(slug);
    this.limites.set([]);
    this.borrador.set({});
    this.errorLimites.set(null);
    this.limitesCargando.set(true);

    this.api.limitesDe(slug).subscribe({
      next: (lista) => this.recibirLimites(lista),
      error: (e: unknown) => {
        this.errorLimites.set(mensajeDeError(e));
        this.limitesCargando.set(false);
      },
    });
  }

  protected cerrarLimites(): void {
    this.limitesSlug.set(null);
  }

  /** El valor efectivo, ya legible: «sin límite» no es un número que se pueda enseñar. */
  protected valorMostrado(l: LimiteDeEmpresa): string {
    return l.valor === SIN_LIMITE ? t().empresas.limites.sinLimite : `${l.valor} ${l.unidad}`;
  }

  /** Lo que aplicaría si se quitara la excepción. Solo hace falta cuando la hay. */
  protected defectoMostrado(l: LimiteDeEmpresa): string {
    return l.valorDefecto === SIN_LIMITE
      ? t().empresas.limites.sinLimite
      : `${l.valorDefecto} ${l.unidad}`;
  }

  protected filaDe(clave: string): { texto: string; sinLimite: boolean } {
    return this.borrador()[clave] ?? { texto: '', sinLimite: false };
  }

  protected escribirValor(clave: string, texto: string): void {
    this.borrador.update((b) => ({ ...b, [clave]: { ...this.filaDe(clave), texto } }));
  }

  protected alternarSinLimite(clave: string, sinLimite: boolean): void {
    this.borrador.update((b) => ({ ...b, [clave]: { ...this.filaDe(clave), sinLimite } }));
  }

  /**
   * El valor que se mandaría, o `null` si lo escrito no sirve.
   *
   * `Number.isInteger` y no `parseInt`: `parseInt('3 equipos')` devuelve 3 y guardaría un
   * cupo que nadie escribió.
   */
  private valorAMandar(clave: string): number | null {
    const fila = this.filaDe(clave);

    if (fila.sinLimite) {
      return SIN_LIMITE;
    }

    const n = Number(fila.texto);

    return fila.texto.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : null;
  }

  /** Deshabilita el botón mientras lo escrito no sea válido o no haya cambiado nada. */
  protected puedeGuardar(l: LimiteDeEmpresa): boolean {
    const valor = this.valorAMandar(l.clave);

    return valor !== null && !(valor === l.valor && l.esExcepcion) && !this.limiteEnVuelo();
  }

  protected guardarLimite(l: LimiteDeEmpresa): void {
    const valor = this.valorAMandar(l.clave);
    const slug = this.limitesSlug();

    if (valor === null || slug === null) {
      return;
    }

    this.limiteEnVuelo.set(l.clave);
    this.errorLimites.set(null);

    this.api.fijarLimite(slug, l.clave, valor).subscribe({
      next: (lista) => this.recibirLimites(lista),
      error: (e: unknown) => {
        this.errorLimites.set(mensajeDeError(e));
        this.limiteEnVuelo.set(null);
      },
    });
  }

  protected quitarLimite(l: LimiteDeEmpresa): void {
    const slug = this.limitesSlug();

    if (slug === null) {
      return;
    }

    this.limiteEnVuelo.set(l.clave);
    this.errorLimites.set(null);

    this.api.quitarLimite(slug, l.clave).subscribe({
      next: (lista) => this.recibirLimites(lista),
      error: (e: unknown) => {
        this.errorLimites.set(mensajeDeError(e));
        this.limiteEnVuelo.set(null);
      },
    });
  }

  /**
   * Los tres endpoints devuelven la lista completa, así que se repinta de la respuesta y
   * el borrador se resiembra con lo que quedó guardado.
   *
   * Resembrar y no conservar lo tecleado: si el servidor normalizó algo, lo que se ve
   * tiene que ser lo que hay en la base, no lo que se escribió.
   */
  private recibirLimites(lista: readonly LimiteDeEmpresa[]): void {
    this.limites.set(lista);
    this.borrador.set(
      Object.fromEntries(
        lista.map((l) => [
          l.clave,
          {
            texto: l.valor === SIN_LIMITE ? '' : String(l.valor),
            sinLimite: l.valor === SIN_LIMITE,
          },
        ]),
      ),
    );
    this.limitesCargando.set(false);
    this.limiteEnVuelo.set(null);
  }

  protected enProceso(e: ResumenEmpresa): boolean {
    return (
      e.aprovisionamiento === EstadoAprovisionamiento.Pendiente ||
      e.aprovisionamiento === EstadoAprovisionamiento.Creando
    );
  }

  // Los dos `switch` siguen siendo exhaustivos a propósito: sin `default`, agregar un
  // valor al enum del contrato es un error de compilación aquí, que es donde tiene que
  // doler. Lo único que cambió es de dónde sale el texto.
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

  protected nombreAprovisionamiento(estado: EstadoAprovisionamiento): string {
    const a = t().empresas.aprovisionamiento;

    switch (estado) {
      case EstadoAprovisionamiento.Pendiente:
        return a.pendiente;
      case EstadoAprovisionamiento.Creando:
        return a.creando;
      case EstadoAprovisionamiento.Lista:
        return a.lista;
      case EstadoAprovisionamiento.Fallida:
        return a.fallida;
    }
  }

  /**
   * Filtra el telefono MIENTRAS SE ESCRIBE, y tambien al pegar.
   *
   * Sin esto el campo dejaba teclear letras y simbolos y solo protestaba al validar, que es
   * lo que se reporto: «sigue dejando meter caracteres que no se deberian permitir». Un
   * campo que solo admite digitos no debe aceptar la pulsacion y quejarse despues.
   *
   * NO se hace con `type="number"`, que trae flechitas, acepta notacion exponencial y se
   * come los ceros a la izquierda —fatal para una lada—. Se queda en `type="tel"` con
   * `inputmode="numeric"` para el teclado del telefono, y el filtro va aqui.
   *
   * `emitEvent: false` evita una segunda vuelta de validacion por la escritura que acabamos
   * de hacer nosotros; el valor ya quedo puesto y su estado se recalcula igual.
   */
  protected filtrarTelefono(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const limpio = soloDigitos(campo.value);

    if (limpio === campo.value) {
      return;
    }

    // Se conserva la posicion del cursor descontando lo que se quito antes de el: sin esto,
    // escribir en medio de un numero salta el cursor al final en cada pulsacion.
    const cursor = campo.selectionStart ?? campo.value.length;
    const quitadosAntes =
      campo.value.slice(0, cursor).length - soloDigitos(campo.value.slice(0, cursor)).length;

    campo.value = limpio;
    this.formulario.controls.telefono.setValue(limpio, { emitEvent: false });
    campo.setSelectionRange(cursor - quitadosAntes, cursor - quitadosAntes);
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      // Marcado y no silencio: sin esto, pulsar con un campo en falta no producia ningun
      // efecto visible.
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorAlta.set(null);

    const v = this.formulario.getRawValue();

    // Se normaliza lo MISMO que se validó, con las mismas funciones: si aquí se mandara el
    // valor crudo, el servidor recibiría algo que este formulario no comprobó. El teléfono
    // solo se recorta —su formato lo eligió quien lo escribió y varía por país—; el RFC va en
    // mayúsculas y sin espacios, y el correo en minúsculas.
    const rfc = normalizarRfc(v.rfc);
    const telefono = normalizarTelefono(v.telefono);

    this.api
      .darDeAltaEmpresa({
        slug: v.slug,
        razonSocial: v.razonSocial,
        // Los opcionales van como null y no como cadena vacía: en la base la columna es
        // nullable, y guardar '' significaría "capturado y vacío", que es otra cosa.
        nombreComercial: null,
        rfc: rfc === '' ? null : rfc,
        telefono: telefono === '' ? null : telefono,
        correoContacto: null,
        correoAdministrador: normalizarCorreo(v.correoAdministrador),
        nombreAdministrador: v.nombreAdministrador,
        codigoPlan: v.codigoPlan,
      })
      .subscribe({
        next: (creada) => {
          // Sin `recargar()`: `darDeAltaEmpresa` refresca el recurso compartido, asi que la
          // lista de esta pantalla —y la del dashboard— se actualizan solas.
          this.reciente.set(creada);
          this.formulario.reset();
          this.enviando.set(false);

          // Se cierra al terminar, y la confirmacion queda en la PANTALLA y no en el panel:
          // lleva la liga de invitacion, que es justo lo que hay que poder copiar y leer con
          // calma. Dejarla dentro de un panel que se cierra al terminar la haria
          // desaparecer con el mismo movimiento que la abrio.
          this.cerrarPanel();
        },
        error: (e: unknown) => {
          this.errorAlta.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }
}
