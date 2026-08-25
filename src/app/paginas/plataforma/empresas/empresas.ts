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
import { Hoja } from '../../../disposicion/hoja';
import { ApiPlataforma } from '../../../nucleo/api/api-plataforma';
import { t } from '../../../nucleo/i18n/i18n';
import { configuracion } from '../../../nucleo/ambiente/configuracion';
import {
  EstadoAprovisionamiento,
  EstadoTenant,
  type EmpresaAprovisionada,
  type ResumenEmpresa,
} from '../../../nucleo/api/contratos-plataforma';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { SesionPlataformaStore } from '../../../nucleo/sesion/sesion-plataforma';
import { EmpresasEsqueleto } from './esqueleto';

/** Mismo patrón que el CHECK de la base y que FormatoSlug en el dominio. */
const PATRON_SLUG = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

@Component({
  selector: 'app-empresas',
  imports: [EmpresasEsqueleto, Hoja, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './empresas.html',
})
export class Empresas {
  private readonly api = inject(ApiPlataforma);
  private readonly barra = inject(Barra);
  private readonly sesion = inject(SesionPlataformaStore);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;

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
   * Si la hoja del alta esta abierta. El `<dialog>`, el gesto y los anclajes los maneja
   * `app-hoja`; aqui solo se dice cuando se ve. Mismo trato que en la pantalla de planes.
   */
  protected readonly hojaAbierta = signal(false);

  /** El error del ALTA, que es de esta pantalla. El de la lista lo trae el recurso. */
  private readonly errorAlta = signal<string | null>(null);

  /**
   * Un solo hueco para el aviso, con el del alta por delante: es el que acaba de provocar
   * la persona, así que taparlo con un fallo de la lista sería contestar a otra pregunta.
   */
  protected readonly error = computed(() => this.errorAlta() ?? this.api.empresasError());

  protected readonly formulario = this.fb.group({
    slug: ['', [Validators.required, Validators.pattern(PATRON_SLUG)]],
    razonSocial: ['', Validators.required],
    rfc: [''],
    telefono: [''],
    nombreAdministrador: ['', Validators.required],
    correoAdministrador: ['', [Validators.required, Validators.email]],
    // Ya no va fijo a 'base': el catalogo existe, asi que se elige. Arranca vacio y el
    // `required` obliga a escogerlo — preseleccionar el primero haria que alguien diera de
    // alta una empresa con un plan que no miro.
    codigoPlan: ['', Validators.required],
  });

  constructor() {
    // El alta ya NO vive en la pantalla: vive en la hoja inferior, asi que la barra por
    // fin tiene accion principal. Antes no la tenia porque un boton amarillo que apuntara
    // al formulario de mas abajo no llevaba a ninguna parte; ahora abre la hoja, igual que
    // en planes. Es `alPulsar` y no `ruta`, asi que el armazon pinta un `<button>`: anunciar
    // «enlace» para algo que abre una hoja en la misma pantalla le miente a un lector.
    effect(() =>
      this.barra.configurar({
        titulo: t().empresas.titulo,
        contexto: t().panel.contexto(this.empresas().length),
        accion: { etiqueta: t().empresas.crear, alPulsar: () => this.abrirHoja() },
      }),
    );
  }

  protected abrirHoja(): void {
    // El aviso del intento anterior no se arrastra a la hoja nueva: quien la abre otra vez
    // no esta mirando el fallo de hace un rato.
    this.errorAlta.set(null);
    this.hojaAbierta.set(true);
  }

  protected cerrarHoja(): void {
    this.hojaAbierta.set(false);
  }

  /**
   * Sin un plan activo NO se puede dar de alta nada: `AprovisionarEmpresa` lo rechaza en el
   * servidor, asi que dejar el boton habilitado seria prometer un viaje que acaba en error.
   */
  protected puedeEnviar(): boolean {
    return this.formulario.valid && this.planes().length > 0 && !this.enviando();
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

    this.api
      .darDeAltaEmpresa({
        slug: v.slug,
        razonSocial: v.razonSocial,
        // Los opcionales van como null y no como cadena vacía: en la base la columna es
        // nullable, y guardar '' significaría "capturado y vacío", que es otra cosa.
        nombreComercial: null,
        rfc: v.rfc === '' ? null : v.rfc,
        telefono: v.telefono === '' ? null : v.telefono,
        correoContacto: null,
        correoAdministrador: v.correoAdministrador,
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

          // Se cierra al terminar, y la confirmacion queda en la PANTALLA y no en la hoja:
          // lleva la liga de invitacion, que es justo lo que hay que poder copiar y leer con
          // calma. Dejarla dentro de una hoja que se descarta con un gesto la haria
          // desaparecer con el mismo movimiento que la abrio.
          this.cerrarHoja();
        },
        error: (e: unknown) => {
          this.errorAlta.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }
}
