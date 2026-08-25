import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
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
  protected readonly empresas = signal<readonly ResumenEmpresa[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly reciente = signal<EmpresaAprovisionada | null>(null);

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

    // La identidad la carga DisposicionPlataforma, la ruta padre. Aquí solo los datos
    // de la pantalla.
    this.recargar();
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
    this.error.set(null);

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
          this.reciente.set(creada);
          this.formulario.reset();
          this.enviando.set(false);
          this.recargar();
        },
        error: (e: unknown) => {
          this.error.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  private recargar(): void {
    this.cargando.set(true);

    this.api.listarEmpresas().subscribe({
      next: (lista) => {
        this.empresas.set(lista);
        this.cargando.set(false);
      },
      error: (e: unknown) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }
}
