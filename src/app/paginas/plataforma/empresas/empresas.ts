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

/** Mismo patrón que el CHECK de la base y que FormatoSlug en el dominio. */
const PATRON_SLUG = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

@Component({
  selector: 'app-empresas',
  imports: [ReactiveFormsModule],
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

  protected readonly enviando = signal(false);
  protected readonly reciente = signal<EmpresaAprovisionada | null>(null);

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
  });

  constructor() {
    // Sin busqueda ni accion: el formulario de alta esta en esta misma pantalla, asi que
    // un boton amarillo que apunte aqui no lleva a ninguna parte.
    effect(() =>
      this.barra.configurar({
        titulo: t().empresas.titulo,
        contexto: t().panel.contexto(this.empresas().length),
      }),
    );
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
    if (this.formulario.invalid || this.enviando()) {
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
        codigoPlan: 'base',
      })
      .subscribe({
        next: (creada) => {
          // Sin `recargar()`: `darDeAltaEmpresa` refresca el recurso compartido, asi que la
          // lista de esta pantalla —y la del dashboard— se actualizan solas.
          this.reciente.set(creada);
          this.formulario.reset();
          this.enviando.set(false);
        },
        error: (e: unknown) => {
          this.errorAlta.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }
}
