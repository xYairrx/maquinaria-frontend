import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type { AltaProveedor, FiltroListado, Proveedor } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import {
  validadorCorreo,
  validadorRequerido,
  validadorRfc,
  validadorTelefono,
} from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';
import { ProveedoresEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/**
 * Proveedores: a quién se le compra.
 *
 * MOLDE ESTÁNDAR, sin nada propio: `activo` booleano y `PATCH .../activo` para retirar, igual
 * que los siete catálogos. Lo que cambia son los campos.
 *
 * **El proveedor vive en la ORDEN DE COMPRA**, no en el equipo: `equipo` no tiene
 * `proveedor_id` —se quitó del modelo el 2026-08-25— y desde un equipo se llega por
 * `equipo → orden_compra_detalle → orden_compra → proveedor`. Por eso la tabla cuenta órdenes
 * y no equipos: es la relación que existe de verdad, y la advertencia del retiro habla de
 * órdenes por lo mismo.
 */
@Component({
  selector: 'app-proveedores',
  imports: [BarraHerramientas, ErrorCampo, PanelLateral, ProveedoresEsqueleto, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proveedores.html',
})
export class Proveedores {
  private readonly api = inject(ApiTerceros);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly mal = errorVisible;

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly soloActivos = signal<boolean | undefined>(undefined);

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroListado>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Activo: this.soloActivos(),
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'razonsocial',
  }));

  private readonly listado = this.api.proveedores.listado(this.filtro);

  protected readonly proveedores = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.proveedores().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Proveedor | null>(null);

  protected readonly formulario = this.fb.group({
    codigo: ['', validadorRequerido],
    razonSocial: ['', validadorRequerido],
    nombreComercial: [''],
    // Los tres validadores son espejo de los del backend y viven en `nucleo/formularios`.
    rfc: ['', validadorRfc],
    telefono: ['', validadorTelefono],
    correo: ['', validadorCorreo],
    domicilio: [''],
    contacto: [''],
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().proveedores.sinResultados(texto);
    }

    if (this.soloActivos() === true) {
      return t().proveedores.sinActivos;
    }

    if (this.soloActivos() === false) {
      return t().proveedores.sinRetirados;
    }

    return t().proveedores.sinProveedores;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().proveedores.contextoResultados(n);
    }

    if (this.soloActivos() === true) {
      return t().proveedores.contextoActivos(n);
    }

    if (this.soloActivos() === false) {
      return t().proveedores.contextoRetirados(n);
    }

    return t().proveedores.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().proveedores.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.soloActivos();
      this.pagina.set(1);
    });
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: '',
      razonSocial: '',
      nombreComercial: '',
      rfc: '',
      telefono: '',
      correo: '',
      domicilio: '',
      contacto: '',
    });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(proveedor: Proveedor): void {
    this.editando.set(proveedor);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: proveedor.codigo,
      razonSocial: proveedor.razonSocial,
      nombreComercial: proveedor.nombreComercial ?? '',
      rfc: proveedor.rfc ?? '',
      telefono: proveedor.telefono ?? '',
      correo: proveedor.correo ?? '',
      domicilio: proveedor.domicilio ?? '',
      contacto: proveedor.contacto ?? '',
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.enviando();
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formulario.getRawValue();
    const vacioANulo = (texto: string) => (texto.trim() === '' ? null : texto.trim());

    const alta = {
      codigo: v.codigo.trim().toUpperCase(),
      razonSocial: v.razonSocial.trim(),
      nombreComercial: vacioANulo(v.nombreComercial),
      rfc: vacioANulo(v.rfc.toUpperCase()),
      telefono: vacioANulo(v.telefono),
      correo: vacioANulo(v.correo.toLowerCase()),
      domicilio: vacioANulo(v.domicilio),
      contacto: vacioANulo(v.contacto),
    } satisfies AltaProveedor;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.proveedores.editar(enEdicion.id, alta)
      : this.api.proveedores.crear(alta);

    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarPanel();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  protected async alternarActivo(proveedor: Proveedor): Promise<void> {
    if (proveedor.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().proveedores.retirar,
        // Con órdenes encima la advertencia es otra: no es «deja de ofrecerse», es que hay
        // compras registradas con él. Callarlo haría que lo retirara sin saberlo.
        mensaje:
          proveedor.ordenesCompra > 0
            ? t().proveedores.confirmarRetiroConOrdenes(
                proveedor.razonSocial,
                proveedor.ordenesCompra,
              )
            : t().proveedores.confirmarRetiro(proveedor.razonSocial),
        confirmar: t().proveedores.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.proveedores.cambiarActivo(proveedor.id, !proveedor.activo).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
