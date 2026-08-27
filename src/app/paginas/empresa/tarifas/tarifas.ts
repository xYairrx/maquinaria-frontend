import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { Hoja } from '../../../disposicion/hoja';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import type {
  AltaTarifa,
  FiltroTarifas,
  Tarifa,
  UnidadTarifa,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { t } from '../../../nucleo/i18n/i18n';
import { TarifasEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/**
 * Las seis unidades de `UnidadTarifa`, en el orden del enum del backend.
 *
 * Los NÚMEROS son el contrato —así viajan en el JSON— y sus nombres se traducen en
 * `textos.ts`. Desde que el documento OpenAPI declara los valores del enum, el tipo generado
 * es `1 | 2 | 3 | 4 | 5 | 6` y no `number`: mandar un 9 ya no compila.
 */
const UNIDADES = [1, 2, 3, 4, 5, 6] as const;

/**
 * Tarifas: el catálogo de conceptos cobrables. Renta por día, flete, limpieza.
 *
 * MISMA FORMA QUE MARCAS —lo común está razonado en `marcas.ts`—. Lo propio de esta pantalla
 * son tres cosas:
 *
 * **La unidad es un enum**, no texto libre: hora, día, semana, mes, evento o kilómetro. Es lo
 * que decide cómo se multiplica el precio en una renta.
 *
 * **`aplicaRenta` y `aplicaVenta` son independientes, no excluyentes.** Un concepto puede
 * cobrarse en las dos —un flete se cobra igual si el equipo se renta o se vende— y el modelo
 * lo permite. Por eso son dos casillas y no un par de opciones.
 *
 * **Filtra por `AplicaRenta`, `AplicaVenta` y `Unidad` en el SERVIDOR.** `FiltroTarifas` los
 * acepta, así que la pantalla no trae todo para filtrar en memoria.
 */
@Component({
  selector: 'app-tarifas',
  imports: [Hoja, TarifasEsqueleto, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tarifas.html',
})
export class Tarifas {
  private readonly api = inject(ApiCatalogos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly unidades = UNIDADES;

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly soloActivas = signal<boolean | undefined>(undefined);

  /** `undefined` = las dos. Filtra en el servidor, no en memoria. */
  protected readonly aplicaA = signal<'renta' | 'venta' | undefined>(undefined);

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroTarifas>(() => {
    const aplica = this.aplicaA();

    return {
      Texto: this.busquedaDiferida().trim() || undefined,
      Activo: this.soloActivas(),
      // El backend expone las dos banderas por separado; la pantalla ofrece una elección
      // entre tres, que es como se piensa el catálogo.
      AplicaRenta: aplica === 'renta' ? true : undefined,
      AplicaVenta: aplica === 'venta' ? true : undefined,
      Numero: this.pagina(),
      Tamano: TAMANO_PAGINA,
      Orden: 'nombre',
    };
  });

  private readonly listado = this.api.tarifas.listado(this.filtro);

  protected readonly tarifas = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.tarifas().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly hojaAbierta = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Tarifa | null>(null);

  protected readonly formulario = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: [''],
    // Tipado como UnidadTarifa y no como number: el contrato admite 1..6 y el compilador
    // lo hace cumplir desde que el documento OpenAPI declara los valores del enum.
    unidad: [2 as UnidadTarifa, Validators.required],
    aplicaRenta: [true],
    aplicaVenta: [false],
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().tarifas.sinResultados(texto);
    }

    if (this.aplicaA() === 'renta') {
      return t().tarifas.sinDeRenta;
    }

    if (this.aplicaA() === 'venta') {
      return t().tarifas.sinDeVenta;
    }

    if (this.soloActivas() === true) {
      return t().tarifas.sinActivas;
    }

    if (this.soloActivas() === false) {
      return t().tarifas.sinRetiradas;
    }

    return t().tarifas.sinTarifas;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().tarifas.contextoResultados(n);
    }

    if (this.soloActivas() === true) {
      return t().tarifas.contextoActivas(n);
    }

    if (this.soloActivas() === false) {
      return t().tarifas.contextoRetiradas(n);
    }

    return t().tarifas.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().tarifas.titulo,
        contexto: this.contexto(),
        busqueda: { marcador: t().tarifas.buscar, valor: this.busqueda },
        accion: { etiqueta: t().tarifas.crear, alPulsar: () => this.abrirAlta() },
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.soloActivas();
      this.aplicaA();
      this.pagina.set(1);
    });
  }

  protected nombreUnidad(unidad: UnidadTarifa): string {
    return t().tarifas.unidades[unidad] ?? String(unidad);
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: '',
      nombre: '',
      descripcion: '',
      unidad: 2,
      aplicaRenta: true,
      aplicaVenta: false,
    });
    this.hojaAbierta.set(true);
  }

  protected abrirEdicion(tarifa: Tarifa): void {
    this.editando.set(tarifa);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: tarifa.codigo,
      nombre: tarifa.nombre,
      descripcion: tarifa.descripcion ?? '',
      unidad: tarifa.unidad,
      aplicaRenta: tarifa.aplicaRenta,
      aplicaVenta: tarifa.aplicaVenta,
    });
    this.hojaAbierta.set(true);
  }

  protected cerrarHoja(): void {
    this.hojaAbierta.set(false);
  }

  protected filtrarPor(activo: boolean | undefined): void {
    this.soloActivas.set(activo);
  }

  protected filtrarAplicaA(valor: 'renta' | 'venta' | undefined): void {
    this.aplicaA.set(valor);
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  /**
   * Una tarifa que no aplica ni a renta ni a venta no se puede cobrar en ningún lado.
   * El servidor lo rechaza igual, pero después de un viaje.
   */
  protected puedeEnviar(): boolean {
    const v = this.formulario.getRawValue();

    return this.formulario.valid && (v.aplicaRenta || v.aplicaVenta) && !this.enviando();
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const v = this.formulario.getRawValue();

    const alta = {
      codigo: v.codigo.trim(),
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim() === '' ? null : v.descripcion.trim(),
      unidad: v.unidad,
      aplicaRenta: v.aplicaRenta,
      aplicaVenta: v.aplicaVenta,
    } satisfies AltaTarifa;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.tarifas.editar(enEdicion.id, alta)
      : this.api.tarifas.crear(alta);

    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.cerrarHoja();
      },
      error: (e: unknown) => {
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  protected async alternarActivo(tarifa: Tarifa): Promise<void> {
    if (tarifa.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().tarifas.retirar,
        mensaje: t().tarifas.confirmarRetiro(tarifa.nombre),
        confirmar: t().tarifas.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.tarifas.cambiarActivo(tarifa.id, !tarifa.activo).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
