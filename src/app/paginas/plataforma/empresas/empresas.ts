import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ApiPlataforma } from '../../../nucleo/api/api-plataforma';
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
  private readonly sesion = inject(SesionPlataformaStore);
  private readonly fb = inject(NonNullableFormBuilder);

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

  protected nombreEstado(estado: EstadoTenant): string {
    switch (estado) {
      case EstadoTenant.Prueba:
        return 'Prueba';
      case EstadoTenant.Activo:
        return 'Activo';
      case EstadoTenant.Suspendido:
        return 'Suspendido';
      case EstadoTenant.Cancelado:
        return 'Cancelado';
    }
  }

  protected nombreAprovisionamiento(estado: EstadoAprovisionamiento): string {
    switch (estado) {
      case EstadoAprovisionamiento.Pendiente:
        return 'Pendiente';
      case EstadoAprovisionamiento.Creando:
        return 'Creando…';
      case EstadoAprovisionamiento.Lista:
        return 'Lista';
      case EstadoAprovisionamiento.Fallida:
        return 'Fallida';
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
