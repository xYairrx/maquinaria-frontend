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
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import type {
  AltaUbicacion,
  FiltroUbicaciones,
  TipoUbicacion,
  Ubicacion,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { t } from '../../../nucleo/i18n/i18n';
import { UbicacionesEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los tres tipos de `TipoUbicacion`, en el orden del enum del backend. */
const TIPOS: readonly TipoUbicacion[] = [1, 2, 3];

/**
 * Ubicaciones: bodegas, sucursales y patios.
 *
 * MISMA FORMA QUE MARCAS —lo común está razonado en `marcas.ts`—. Lo propio de esta pantalla
 * es que **el tipo no es una etiqueta, es una capacidad**, y de ahí salen tres decisiones:
 *
 * **Se dice qué PUEDE hacer cada tipo, no solo cómo se llama.** «Bodega» no le dice nada a
 * quien captura; «guarda equipo, no cotiza» sí. Son reglas del motor: un equipo solo vive
 * donde se almacena, un traspaso va de almacén a almacén, y una cotización sale de una
 * ubicación administrativa. La pantalla las enseña en vez de esconderlas tras un nombre.
 *
 * **`almacenaEquipo` y `esAdministrativa` NO se capturan.** El servidor los deriva del tipo
 * —en la base son columnas generadas— y por eso `AltaUbicacion` solo acepta `tipo`. Ofrecer
 * casillas dejaría crear una «bodega que cotiza», que no existe.
 *
 * **Cambiar el tipo puede rechazarse.** Bajar un patio a sucursal le quita la capacidad de
 * almacenar; si ya tiene equipos encima, el servidor lo rechaza con un 409. La pantalla lo
 * avisa antes en el texto de ayuda, y si aun así pasa, muestra el motivo del servidor.
 */
@Component({
  selector: 'app-ubicaciones',
  imports: [Hoja, UbicacionesEsqueleto, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ubicaciones.html',
})
export class Ubicaciones {
  private readonly api = inject(ApiOrganizacion);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly tipos = TIPOS;

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly soloActivas = signal<boolean | undefined>(undefined);

  /** `undefined` = los tres tipos. Filtra en el servidor con `Tipo`. */
  protected readonly tipoFiltrado = signal<TipoUbicacion | undefined>(undefined);

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroUbicaciones>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Activo: this.soloActivas(),
    Tipo: this.tipoFiltrado(),
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'nombre',
  }));

  private readonly listado = this.api.ubicaciones.listado(this.filtro);

  protected readonly ubicaciones = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.ubicaciones().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly hojaAbierta = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Ubicacion | null>(null);

  protected readonly formulario = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    // Tipado como TipoUbicacion y no como number: el contrato admite 1|2|3 y el compilador
    // rechaza un 4. Por defecto Bodega, que es el caso más común al empezar.
    tipo: [1 as TipoUbicacion, Validators.required],
    domicilio: [''],
    telefono: [''],
    // NÚMEROS y anulables: un `<input type="number">` escribe un number en el control, y
    // `null` al vaciarse. Ver la regla en `AGENTS.md`; declararlos como texto compila y
    // luego revienta con `.trim is not a function`.
    latitud: [null as number | null],
    longitud: [null as number | null],
  });

  /**
   * El valor del formulario COMO SEÑAL.
   *
   * Un `FormGroup` no es reactivo para las señales: `getRawValue()` es una llamada normal, y
   * un `computed` que la lea **no registra ninguna dependencia** —evalúa una vez y se queda
   * congelado para siempre—. Eso ya pasó con `httpResource` en Marcas, donde la búsqueda no
   * hacía nada; aquí volvió a pasar y dejó la guarda de coordenadas sin efecto.
   *
   * `valueChanges` es el puente: un observable que sí emite, convertido a señal.
   */
  private readonly valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  /**
   * Sirve para dos cosas a la vez: avisar de que el par está a medias, y bloquear el envío.
   *
   * Media coordenada no ubica nada —una latitud sin longitud es una línea, no un punto— así
   * que o van las dos o no va ninguna. Es la única regla que el backend NO comprueba: acepta
   * `latitud` sin `longitud` sin decir nada, y el mapa de la Fase 3 se encontraría el dato
   * inservible. Se corrige aquí, que es donde alguien puede arreglarlo.
   */
  protected readonly coordenadaIncompleta = computed(() => {
    const { latitud, longitud } = this.valores();

    // `== null` a propósito: cubre `null` —lo que escribe un campo numérico vacío— y el
    // `undefined` con el que `valueChanges` tipa sus campos.
    return (latitud == null) !== (longitud == null);
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().ubicaciones.sinResultados(texto);
    }

    const tipo = this.tipoFiltrado();

    if (tipo !== undefined) {
      return t().ubicaciones.sinDeEseTipo(this.nombreTipo(tipo));
    }

    if (this.soloActivas() === true) {
      return t().ubicaciones.sinActivas;
    }

    if (this.soloActivas() === false) {
      return t().ubicaciones.sinRetiradas;
    }

    return t().ubicaciones.sinUbicaciones;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().ubicaciones.contextoResultados(n);
    }

    const tipo = this.tipoFiltrado();

    if (tipo !== undefined) {
      return t().ubicaciones.contextoDeTipo(n, this.nombreTipo(tipo));
    }

    if (this.soloActivas() === true) {
      return t().ubicaciones.contextoActivas(n);
    }

    if (this.soloActivas() === false) {
      return t().ubicaciones.contextoRetiradas(n);
    }

    return t().ubicaciones.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().ubicaciones.titulo,
        contexto: this.contexto(),
        busqueda: { marcador: t().ubicaciones.buscar, valor: this.busqueda },
        accion: { etiqueta: t().ubicaciones.crear, alPulsar: () => this.abrirAlta() },
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.soloActivas();
      this.tipoFiltrado();
      this.pagina.set(1);
    });
  }

  protected nombreTipo(tipo: TipoUbicacion): string {
    return t().ubicaciones.tipos[tipo] ?? String(tipo);
  }

  /** Qué PUEDE hacer cada tipo. Se deriva igual que en el servidor, no se captura. */
  protected capacidadDe(tipo: TipoUbicacion): string {
    return t().ubicaciones.capacidades[tipo] ?? '';
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: '',
      nombre: '',
      tipo: 1,
      domicilio: '',
      telefono: '',
      latitud: null,
      longitud: null,
    });
    this.hojaAbierta.set(true);
  }

  protected abrirEdicion(ubicacion: Ubicacion): void {
    this.editando.set(ubicacion);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: ubicacion.codigo,
      nombre: ubicacion.nombre,
      tipo: ubicacion.tipo,
      domicilio: ubicacion.domicilio ?? '',
      telefono: ubicacion.telefono ?? '',
      latitud: ubicacion.latitud ?? null,
      longitud: ubicacion.longitud ?? null,
    });
    this.hojaAbierta.set(true);
  }

  protected cerrarHoja(): void {
    this.hojaAbierta.set(false);
  }

  protected filtrarPor(activo: boolean | undefined): void {
    this.soloActivas.set(activo);
  }

  protected filtrarPorTipo(tipo: TipoUbicacion | undefined): void {
    this.tipoFiltrado.set(tipo);
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.coordenadaIncompleta() && !this.enviando();
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
      tipo: v.tipo,
      domicilio: v.domicilio.trim() === '' ? null : v.domicilio.trim(),
      telefono: v.telefono.trim() === '' ? null : v.telefono.trim(),
      latitud: v.latitud,
      longitud: v.longitud,
    } satisfies AltaUbicacion;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.ubicaciones.editar(enEdicion.id, alta)
      : this.api.ubicaciones.crear(alta);

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

  protected async alternarActivo(ubicacion: Ubicacion): Promise<void> {
    if (ubicacion.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().ubicaciones.retirar,
        // Con equipos encima la advertencia es otra: no es «deja de ofrecerse», es que hay
        // máquinas registradas ahí. Callarlo haría que la retirara sin saberlo.
        mensaje:
          ubicacion.equipos > 0
            ? t().ubicaciones.confirmarRetiroConEquipos(ubicacion.nombre, ubicacion.equipos)
            : t().ubicaciones.confirmarRetiro(ubicacion.nombre),
        confirmar: t().ubicaciones.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.ubicaciones.cambiarActivo(ubicacion.id, !ubicacion.activo).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
