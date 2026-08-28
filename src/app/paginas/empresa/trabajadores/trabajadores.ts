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
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import type {
  AltaTrabajador,
  EstadoTrabajador,
  FiltroTrabajadores,
  Trabajador,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import {
  validadorCorreo,
  validadorRequerido,
  validadorTelefono,
} from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';
import { TrabajadoresEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los tres de `EstadoTrabajador`, en el orden del enum del backend. */
const ESTADOS: readonly EstadoTrabajador[] = [1, 2, 3];

/** `EstadoTrabajador.Baja`. Con nombre, porque de él cuelgan tres reglas de esta pantalla. */
const BAJA: EstadoTrabajador = 3;

/**
 * Trabajadores: las personas de la organización.
 *
 * MISMA FORMA QUE UBICACIONES en todo lo común. Lo propio es que **el estado no es un
 * booleano**, y de ahí salen las cuatro decisiones de abajo.
 *
 * **Un trabajador no es un usuario.** Es la persona; el usuario es la cuenta. Quien opera una
 * máquina puede no tener acceso al sistema y hay que poder registrarlo igual. Esta pantalla NO
 * invita ni da acceso: el correo que captura sirve para localizar a la persona.
 *
 * **El estado tiene su propio panel, y no está en el formulario de alta.** `AltaTrabajador`
 * excluye `estado` y `fechaBaja` a propósito: el CHECK `trabajador_baja_coherente` exige que la
 * baja y su fecha viajen JUNTAS, y dejar que la edición las moviera por separado es la forma de
 * topar con ese CHECK como un 500. Van por `PATCH {id}/estado`.
 *
 * **La baja NO es reversible** —la persona dejó la empresa— así que se pregunta antes con
 * `Confirmacion`. Inactivo sí lo es, y no la merece: confirmar todo le quita el significado a
 * confirmar.
 *
 * **El filtro de estado de la barra de herramientas no se usa.** Es booleano, y el servidor lee
 * `Activo` como «no dado de baja», que colapsa Activo e Inactivo en un solo grupo y esconde
 * justo la distinción que a esta pantalla le importa. Se filtra por `Estado`, en `[filtros]`.
 */
@Component({
  selector: 'app-trabajadores',
  imports: [
    BarraHerramientas,
    ErrorCampo,
    PanelLateral,
    ReactiveFormsModule,
    TrabajadoresEsqueleto,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trabajadores.html',
})
export class Trabajadores {
  private readonly api = inject(ApiOrganizacion);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly estados = ESTADOS;
  protected readonly mal = errorVisible;

  /** Los dos desplegables. Compartidos: una petición entre todas las pantallas que los usen. */
  protected readonly puestos = this.catalogos.selectorPuestos();
  protected readonly ubicaciones = this.api.selectorUbicaciones();

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  /** `undefined` = los tres estados. */
  protected readonly estadoFiltrado = signal<EstadoTrabajador | undefined>(undefined);

  /** Cadena vacía = cualquiera. Los ids son GUID, así que viajan como texto. */
  protected readonly puestoFiltrado = signal('');
  protected readonly ubicacionFiltrada = signal('');

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroTrabajadores>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Estado: this.estadoFiltrado(),
    PuestoId: this.puestoFiltrado() || undefined,
    UbicacionId: this.ubicacionFiltrada() || undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'nombre',
  }));

  private readonly listado = this.api.trabajadores.listado(this.filtro);

  protected readonly trabajadores = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.trabajadores().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);
  protected readonly panelEstadoAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Trabajador | null>(null);

  /** A quién se le está cambiando el estado. Nulo mientras ese panel está cerrado. */
  protected readonly cambiandoEstadoA = signal<Trabajador | null>(null);

  protected readonly formulario = this.fb.group({
    // `validadorRequerido` y no `Validators.required`: este RECORTA, y el otro da por bueno un
    // campo de puros espacios que el servidor rechazaría con un mensaje genérico.
    numeroEmpleado: ['', validadorRequerido],
    nombre: ['', validadorRequerido],
    apellidos: [''],
    // Un GUID ES una cadena, así que su `<option>` puede llevar `[value]` sin más.
    puestoId: ['', validadorRequerido],
    ubicacionId: [''],
    telefono: ['', validadorTelefono],
    // `validadorCorreo` deja pasar el vacío: aquí el correo es opcional, y de la obligatoriedad
    // se encargaría `validadorRequerido`, que no está puesto a propósito.
    correo: ['', validadorCorreo],
    // `<input type="date">` escribe una CADENA —su accesor es el de texto, no el numérico—.
    // Vacío llega como '' y se traduce a null al enviar.
    fechaIngreso: [''],
  });

  protected readonly formularioEstado = this.fb.group({
    // Numérico, así que su `<option>` necesita `[ngValue]`.
    estado: [1 as EstadoTrabajador],
    fechaBaja: [''],
  });

  /**
   * El valor del formulario de estado COMO SEÑAL.
   *
   * Un `FormGroup` no es reactivo: un `computed` que leyera `getRawValue()` no registraría
   * ninguna dependencia y evaluaría una sola vez. Ya pasó dos veces en este repo —la búsqueda
   * de Marcas y la guarda de coordenadas de Ubicaciones—, así que el puente es `valueChanges`.
   */
  private readonly valoresEstado = toSignal(this.formularioEstado.valueChanges, {
    initialValue: this.formularioEstado.getRawValue(),
  });

  /** Si lo elegido es la baja. De esto dependen la fecha, el aviso y el texto del botón. */
  protected readonly esBaja = computed(() => this.valoresEstado().estado === BAJA);

  /**
   * La fecha de baja es OBLIGATORIA si el estado es Baja y PROHIBIDA en cualquier otro.
   *
   * Es literalmente el CHECK `trabajador_baja_coherente`. Se comprueba aquí para que el aviso
   * salga debajo del campo, en vez de volver como un error del servidor.
   */
  protected readonly fechaBajaIncoherente = computed(() => {
    const { estado, fechaBaja } = this.valoresEstado();

    return estado === BAJA ? !fechaBaja : Boolean(fechaBaja);
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().trabajadores.sinResultados(texto);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().trabajadores.sinDeEseEstado(this.nombreEstado(estado));
    }

    const puesto = this.nombrePuesto(this.puestoFiltrado());

    if (puesto !== '') {
      return t().trabajadores.sinDeEsePuesto(puesto);
    }

    return t().trabajadores.sinTrabajadores;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().trabajadores.contextoResultados(n);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().trabajadores.contextoDeEstado(n, this.nombreEstado(estado));
    }

    const puesto = this.nombrePuesto(this.puestoFiltrado());

    if (puesto !== '') {
      return t().trabajadores.contextoDePuesto(n, puesto);
    }

    return t().trabajadores.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().trabajadores.titulo,
        contexto: this.contexto(),
        // Ni búsqueda ni acción aquí: bajaron a `app-barra-herramientas`, encima de la tabla.
        busqueda: null,
        accion: null,
      }),
    );

    /**
     * AL SALIR DE BAJA, LA FECHA SE LIMPIA SOLA.
     *
     * Sin esto la pantalla se queda sin salida, y solo se ve usándola: eliges Baja, escribes la
     * fecha, cambias de opinión a Activo —el campo se ESCONDE con su valor dentro—, y el envío
     * queda bloqueado por la guarda de coherencia con el único campo editable siendo el estado.
     * No hay forma de borrar la fecha; el único camino era cerrar el panel y volver a abrirlo.
     *
     * Limpiarla aquí no vuelve inútil a `fechaBajaIncoherente`: esa guarda sigue siendo la que
     * describe el CHECK de la base, y `enviarEstado` sigue mandando `null` fuera de la baja. Lo
     * que cambia es que el estado imposible deja de ser alcanzable desde la interfaz.
     */
    effect(() => {
      if (!this.esBaja() && this.formularioEstado.controls.fechaBaja.value !== '') {
        this.formularioEstado.controls.fechaBaja.setValue('');
      }
    });

    effect(() => {
      this.busquedaDiferida();
      this.estadoFiltrado();
      this.puestoFiltrado();
      this.ubicacionFiltrada();
      this.pagina.set(1);
    });
  }

  protected nombreEstado(estado: EstadoTrabajador): string {
    return t().trabajadores.estados[estado] ?? String(estado);
  }

  /** Qué significa cada estado. Se dice, en lugar de dejarlo al nombre. */
  protected situacionDe(estado: EstadoTrabajador): string {
    return t().trabajadores.situaciones[estado] ?? '';
  }

  /** Vacío si no hay filtro de puesto, o si el id no está entre los activos. */
  private nombrePuesto(id: string): string {
    return this.puestos().find((p) => p.id === id)?.nombre ?? '';
  }

  protected nombreCompleto(trabajador: Trabajador): string {
    return trabajador.apellidos
      ? `${trabajador.nombre} ${trabajador.apellidos}`
      : trabajador.nombre;
  }

  /** El `<select>` entrega TEXTO; `EstadoTrabajador` es numérico. */
  protected elegirEstado(valor: string): void {
    this.estadoFiltrado.set(valor === '' ? undefined : (Number(valor) as EstadoTrabajador));
  }

  protected filtrarPorPuesto(id: string): void {
    this.puestoFiltrado.set(id);
  }

  protected filtrarPorUbicacion(id: string): void {
    this.ubicacionFiltrada.set(id);
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({
      numeroEmpleado: '',
      nombre: '',
      apellidos: '',
      puestoId: '',
      ubicacionId: '',
      telefono: '',
      correo: '',
      fechaIngreso: '',
    });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(trabajador: Trabajador): void {
    this.editando.set(trabajador);
    this.errorMutacion.set(null);
    this.formulario.reset({
      numeroEmpleado: trabajador.numeroEmpleado,
      nombre: trabajador.nombre,
      apellidos: trabajador.apellidos ?? '',
      puestoId: trabajador.puestoId,
      ubicacionId: trabajador.ubicacionId ?? '',
      telefono: trabajador.telefono ?? '',
      correo: trabajador.correo ?? '',
      fechaIngreso: trabajador.fechaIngreso ?? '',
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected abrirEstado(trabajador: Trabajador): void {
    this.cambiandoEstadoA.set(trabajador);
    this.errorMutacion.set(null);
    this.formularioEstado.reset({
      estado: trabajador.estado,
      fechaBaja: trabajador.fechaBaja ?? '',
    });
    this.panelEstadoAbierto.set(true);
  }

  protected cerrarPanelEstado(): void {
    this.panelEstadoAbierto.set(false);
  }

  protected puedeEnviar(): boolean {
    return this.formulario.valid && !this.enviando();
  }

  protected puedeEnviarEstado(): boolean {
    return !this.fechaBajaIncoherente() && !this.enviando();
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
      numeroEmpleado: v.numeroEmpleado.trim(),
      nombre: v.nombre.trim(),
      apellidos: vacioANulo(v.apellidos),
      puestoId: v.puestoId,
      ubicacionId: vacioANulo(v.ubicacionId),
      // El enlace con la cuenta NO se toca desde aquí: esta pantalla registra personas, y ligar
      // una cuenta es parte de Usuarios, que todavía no tiene API de empresa. Se CONSERVA el
      // que ya tuviera, o la edición lo borraría sin que nadie lo pidiera.
      usuarioId: this.editando()?.usuarioId ?? null,
      telefono: vacioANulo(v.telefono),
      correo: vacioANulo(v.correo),
      fechaIngreso: vacioANulo(v.fechaIngreso),
    } satisfies AltaTrabajador;

    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.trabajadores.editar(enEdicion.id, alta)
      : this.api.trabajadores.crear(alta);

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

  protected async enviarEstado(): Promise<void> {
    const trabajador = this.cambiandoEstadoA();

    if (trabajador === null || !this.puedeEnviarEstado()) {
      this.formularioEstado.markAllAsTouched();
      return;
    }

    const v = this.formularioEstado.getRawValue();

    // La baja no se puede deshacer, así que se pregunta antes. Los otros dos cambios son
    // reversibles y no la merecen: confirmar todo le quita el significado a confirmar.
    if (v.estado === BAJA) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().trabajadores.darDeBaja,
        mensaje: t().trabajadores.confirmarBaja(this.nombreCompleto(trabajador)),
        confirmar: t().trabajadores.darDeBaja,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    this.api
      .cambiarEstadoTrabajador(trabajador.id, {
        estado: v.estado,
        // Prohibida fuera de la baja: mandarla igual toparía con el CHECK de la base.
        fechaBaja: v.estado === BAJA ? v.fechaBaja : null,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.cerrarPanelEstado();
        },
        error: (e: unknown) => {
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }
}
