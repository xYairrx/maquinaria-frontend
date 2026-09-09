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
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiProyectos } from '../../../nucleo/api/api-proyectos';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type { EstadoProyecto, FiltroListado, Proyecto } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { t } from '../../../nucleo/i18n/i18n';
import { ProyectosEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los tres estados de `EstadoProyecto`, en el orden del enum del backend. */
const ESTADOS: readonly EstadoProyecto[] = [1, 2, 3];

/**
 * Proyectos: las obras de los clientes, a las que se asignan máquinas.
 *
 * MISMA FORMA QUE MARCAS —búsqueda diferida, esqueleto solo en la primera carga, el vacío que
 * dice por qué está vacío—; el razonamiento completo está en `marcas.ts`.
 *
 * **EL ALTA CREA DOS FILAS**: la obra y su ubicación, en una transacción del servidor. Por eso
 * el formulario pide dirección y coordenadas y NO un desplegable de ubicaciones: cuando se
 * abre una obra, su sitio todavía no existe. Pedirle a la persona que cree primero la
 * ubicación, se acuerde de darle tipo Proyecto y después la elija son tres pasos y dos formas
 * de equivocarse.
 *
 * **CERRAR PUEDE RECHAZARSE.** El servidor no cierra una obra con máquinas sin devolver: sería
 * equipo que nadie va a ir a recoger. La columna de máquinas es lo que lo avisa ANTES de
 * intentarlo, y el 409 lo dice con su número si alguien lo intenta igual.
 */
@Component({
  selector: 'app-proyectos',
  imports: [BarraHerramientas, PanelLateral, ProyectosEsqueleto, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proyectos.html',
})
export class Proyectos {
  private readonly api = inject(ApiProyectos);
  private readonly terceros = inject(ApiTerceros);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly estados = ESTADOS;

  /** Los clientes ACTIVOS: a un cliente suspendido no se le abre una obra. */
  protected readonly clientes = this.terceros.selectorClientesActivos();

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  /** `undefined` = los tres estados. Filtra en el servidor. */
  protected readonly estadoFiltro = signal<EstadoProyecto | undefined>(undefined);
  protected readonly pagina = signal(1);

  private readonly filtro = computed(
    () =>
      ({
        Texto: this.busquedaDiferida().trim() || undefined,
        Estado: this.estadoFiltro(),
        Numero: this.pagina(),
        Tamano: TAMANO_PAGINA,
        Orden: 'nombre',
      }) satisfies FiltroListado & { Estado?: EstadoProyecto },
  );

  private readonly listado = this.api.proyectos.listado(this.filtro);

  protected readonly proyectos = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.proyectos().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Proyecto | null>(null);

  protected readonly formulario = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    // `value` y no `ngValue` en el `<option>`: el id del cliente es un uuid, o sea texto.
    clienteId: ['', Validators.required],
    domicilio: [''],
    // Los dos como `number | null`: es lo que escribe el accesor de un `<input type="number">`,
    // y declararlos como cadena rompería el envío en cuanto alguien los capture.
    latitud: [null as number | null],
    longitud: [null as number | null],
    fechaInicio: [''],
    fechaFin: [''],
    contactoNombre: [''],
    contactoTelefono: [''],
    observaciones: [''],
  });

  /**
   * MEDIA COORDENADA NO UBICA NADA, y el servidor la rechaza. Se lee de un signal y no de
   * `getRawValue()`: un `computed` que lee el formulario directo NO reacciona —ya pasó dos
   * veces en este repo— y el botón se quedaría habilitado.
   */
  private readonly valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  protected readonly coordenadaIncompleta = computed(() => {
    const { latitud, longitud } = this.valores();

    return (latitud == null) !== (longitud == null);
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().proyectos.sinResultados(texto);
    }

    if (this.estadoFiltro() !== undefined) {
      return t().proyectos.sinDeEstado(this.nombreEstado(this.estadoFiltro()!));
    }

    return t().proyectos.sinFilas;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().proyectos.contextoResultados(n);
    }

    if (this.estadoFiltro() !== undefined) {
      return t().proyectos.contextoDeEstado(n, this.nombreEstado(this.estadoFiltro()!));
    }

    return t().proyectos.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().proyectos.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.estadoFiltro();
      this.pagina.set(1);
    });
  }

  protected nombreEstado(estado: EstadoProyecto): string {
    return t().proyectos.estados[estado] ?? String(estado);
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: '',
      nombre: '',
      clienteId: this.clientes()[0]?.id ?? '',
      domicilio: '',
      latitud: null,
      longitud: null,
      fechaInicio: '',
      fechaFin: '',
      contactoNombre: '',
      contactoTelefono: '',
      observaciones: '',
    });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(proyecto: Proyecto): void {
    this.editando.set(proyecto);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigo: proyecto.codigo,
      nombre: proyecto.nombre,
      clienteId: proyecto.clienteId,
      // EL DOMICILIO Y LAS COORDENADAS SON DE LA UBICACIÓN, no del proyecto, así que el DTO
      // no los trae: al editar se dejan vacíos y solo se mandan si alguien los cambia. Es la
      // costura de que el alta cree dos filas y la edición toque una.
      domicilio: '',
      latitud: null,
      longitud: null,
      fechaInicio: proyecto.fechaInicio ?? '',
      fechaFin: proyecto.fechaFin ?? '',
      contactoNombre: proyecto.contactoNombre ?? '',
      contactoTelefono: proyecto.contactoTelefono ?? '',
      observaciones: proyecto.observaciones ?? '',
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected filtrarPorEstado(estado: EstadoProyecto | undefined): void {
    this.estadoFiltro.set(estado);
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
    const vacioANulo = (texto: string) => (texto.trim() === '' ? null : texto.trim());

    const alta = {
      codigo: v.codigo.trim().toUpperCase(),
      nombre: v.nombre.trim(),
      clienteId: v.clienteId,
      domicilio: vacioANulo(v.domicilio),
      latitud: v.latitud,
      longitud: v.longitud,
      fechaInicio: vacioANulo(v.fechaInicio),
      fechaFin: vacioANulo(v.fechaFin),
      contactoNombre: vacioANulo(v.contactoNombre),
      contactoTelefono: vacioANulo(v.contactoTelefono),
      observaciones: vacioANulo(v.observaciones),
    };

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.proyectos.editar(enEdicion.id, alta)
      : this.api.proyectos.crear(alta);

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

  /**
   * El `<select>` de la fila entrega su valor como CADENA —los atributos del DOM son texto— y
   * el estrechamiento al tipo del enum se hace aquí, no en la plantilla: `+$any(...)` da
   * `number`, que no es asignable a `1 | 2 | 3`, y meterlo en el marcado obligaría a apagar el
   * tipado justo donde protege.
   */
  protected alElegirEstado(proyecto: Proyecto, valor: string): void {
    const estado = Number(valor) as EstadoProyecto;

    void this.cambiarEstado(proyecto, estado);
  }

  /**
   * Cambia el estado. **Cerrar pregunta antes**, porque decide que a esa obra ya no se le
   * asignan máquinas; suspender y reactivar no, que son reversibles.
   */
  protected async cambiarEstado(proyecto: Proyecto, estado: EstadoProyecto): Promise<void> {
    if (estado === proyecto.estado) {
      return;
    }

    if (estado === 3) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().proyectos.cerrar,
        mensaje: t().proyectos.confirmarCierre(proyecto.nombre),
        confirmar: t().proyectos.cerrar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.cambiarEstado(proyecto.id, { estado }).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
