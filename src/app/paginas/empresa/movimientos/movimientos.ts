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
import { type Observable, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiMovimientos } from '../../../nucleo/api/api-movimientos';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import { ApiProyectos } from '../../../nucleo/api/api-proyectos';
import { ApiTerceros } from '../../../nucleo/api/api-terceros';
import type {
  AltaMovimiento,
  FiltroMovimientos,
  Movimiento,
  TipoMovimiento,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { t } from '../../../nucleo/i18n/i18n';
import { MovimientosEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los nueve tipos, en el orden del enum del backend. Para el filtro. */
const TIPOS: readonly TipoMovimiento[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Los tres que una persona captura. Los otros seis los escribe el servidor dentro de la
 * transacción del documento que los provoca, y mandarlos al POST se rechaza con un 400.
 *
 * El 1 —entrada al inventario— **no está aquí y sí se ofrece**: ver `tiposDisponibles`.
 */
const MANUALES: readonly TipoMovimiento[] = [2, 3, 4];

/**
 * Movimientos: el historial FÍSICO de las máquinas.
 *
 * **SIN COLUMNA DE ACCIONES, y esta vez no es una elección de la pantalla: la tabla es
 * *append-only* y un trigger de la base rechaza el UPDATE.** No hay editar ni borrar que
 * ofrecer. Una captura equivocada se corrige con el movimiento contrario, que es además lo
 * que de verdad pasó.
 *
 * **EL FORMULARIO CAMBIA SEGÚN EL TIPO**, y los tres campos condicionales son la matriz de la
 * §4 del plan hecha interfaz:
 *
 * - El **origen no se pide nunca**: es donde el equipo está ahora. Se muestra como dato al
 *   elegir la máquina, para que quien captura vea de dónde va a salir.
 * - El **destino** se pide en la salida (2) y el traspaso (3); en la asignación (4) es el
 *   sitio de la obra y lo resuelve el servidor, así que se dice y no se pregunta.
 * - La **obra** solo en la asignación, donde es obligatoria.
 * - El **cliente** solo en la salida, que es el único tipo cuyo destino puede no ser nuestro.
 *
 * **LOS TIPOS OFRECIDOS DEPENDEN DE LA MÁQUINA.** Una sin ubicación solo admite la entrada al
 * inventario —los otros ocho tipos exigen origen—, y una con ubicación no la admite. Ofrecer
 * los cuatro siempre daría dos rechazos garantizados según cuál se elija.
 */
@Component({
  selector: 'app-movimientos',
  imports: [BarraHerramientas, ErrorCampo, MovimientosEsqueleto, PanelLateral, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movimientos.html',
})
export class Movimientos {
  private readonly api = inject(ApiMovimientos);
  private readonly equiposApi = inject(ApiEquipos);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly proyectosApi = inject(ApiProyectos);
  private readonly terceros = inject(ApiTerceros);
  private readonly barra = inject(Barra);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly mal = errorVisible;
  protected readonly tipos = TIPOS;

  protected readonly equipos = this.equiposApi.selectorEquipos();
  protected readonly ubicaciones = this.organizacion.selectorUbicaciones();
  /** El DESTINO solo admite ubicaciones vigentes; el filtro de la tabla admite cualquiera. */
  protected readonly destinos = this.organizacion.selectorUbicacionesActivas();
  protected readonly trabajadores = this.organizacion.selectorTrabajadores();
  protected readonly motivos = this.catalogos.selectorMotivosMovimiento();
  protected readonly proyectos = this.proyectosApi.selectorActivos();
  protected readonly clientes = this.terceros.selectorClientesActivos();

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly equipoFiltrado = signal('');
  protected readonly ubicacionFiltrada = signal('');
  protected readonly tipoFiltrado = signal<TipoMovimiento | undefined>(undefined);
  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroMovimientos>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    EquipoId: this.equipoFiltrado() || undefined,
    UbicacionId: this.ubicacionFiltrada() || undefined,
    Tipo: this.tipoFiltrado(),
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
  }));

  private readonly listado = this.api.listado(this.filtro);

  protected readonly movimientos = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.movimientos().length === 0,
  );

  protected readonly recargando = this.listado.cargando;
  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly formulario = this.fb.group({
    equipoId: ['', validadorRequerido],
    // `ngValue` en el `<option>`, no `value`: el tipo es un número y `[value]` guardaría la
    // cadena '3', que el enum del servidor rechaza con un 400 de model binding.
    // **SIN VALIDADOR, y no es un olvido.** `validadorRequerido` pasa por `texto()`, que
    // devuelve `''` para cualquier valor que no sea cadena: en un campo numerico da
    // `{ required: true }` SIEMPRE y el boton de enviar no se habilita nunca. Esta escrito
    // en `validadores.ts` y en `convenciones.md`, y aun asi lo puse aqui — se descubrio el
    // 2026-09-03 usando la pantalla, porque el sintoma es solo un boton apagado sin ningun
    // mensaje: los avisos salen con `touched` y este campo se rellena sin tocarlo.
    //
    // Tampoco hace falta uno: el `<select>` no tiene opcion vacia y arranca con un valor
    // valido, asi que no puede estar vacio por construccion.
    tipo: [3 as TipoMovimiento],
    destinoId: [''],
    proyectoId: [''],
    clienteId: [''],
    trabajadorId: ['', validadorRequerido],
    motivoId: ['', validadorRequerido],
    fecha: [''],
    // `number | null` porque es lo que escribe el accesor de un `<input type="number">`.
    // Declararlo como cadena rompería el envío en cuanto alguien lo capture.
    horometro: [null as number | null],
    // El folio del papel que originó el movimiento: una orden, un oficio, un correo. TEXTO
    // LIBRE — no referencia ningún documento del sistema, y por eso se puede capturar: el
    // vínculo de verdad (`referenciaId`) lo pone el servidor y no se acepta desde aquí.
    referenciaFolio: [''],
    observaciones: [''],
  });

  /**
   * La evidencia elegida, FUERA del formulario reactivo.
   *
   * Un `<input type="file">` no tiene accesor de valor de Angular: con `formControlName` el
   * control guardaría la cadena `C:\fakepath\foto.jpg` que el navegador expone, no el
   * `File`. Una señal aparte es lo que hay.
   */
  protected readonly evidencia = signal<File | null>(null);

  /**
   * Los valores del formulario COMO SEÑAL. Sin esto, los `computed` de abajo leerían un
   * `FormGroup` —que no es reactivo— y se quedarían con el primer valor para siempre: el
   * formulario no cambiaría de forma al cambiar el tipo. Ya pasó dos veces en este repo.
   */
  private readonly valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  /** La máquina elegida, para saber de dónde sale y qué tipos admite. */
  protected readonly equipoElegido = computed(() => {
    const id = this.valores().equipoId;

    return this.equipos().find((e) => e.id === id);
  });

  protected readonly tipoElegido = computed(() => this.valores().tipo);

  /**
   * **Una máquina sin ubicación solo admite la entrada al inventario.** Es como se coloca una
   * que se dio de alta antes de llegar; los otros ocho tipos exigen origen, así que sin esta
   * puerta se quedaría sin sitio para siempre. Y al contrario: una que ya tiene ubicación no
   * admite una segunda entrada.
   */
  protected readonly tiposDisponibles = computed<readonly TipoMovimiento[]>(() => {
    const equipo = this.equipoElegido();

    return equipo && equipo.ubicacionId === null ? [1] : MANUALES;
  });

  protected readonly pideDestino = computed(() => {
    const tipo = this.tipoElegido();

    // La asignación a proyecto (4) no lo pide: es el sitio de la obra. La salida (2) lo
    // admite sin exigirlo; la entrada (1) y el traspaso (3) lo exigen.
    return tipo === 1 || tipo === 2 || tipo === 3;
  });

  protected readonly exigeDestino = computed(() => {
    const tipo = this.tipoElegido();

    return tipo === 1 || tipo === 3;
  });

  protected readonly pideProyecto = computed(() => this.tipoElegido() === 4);
  protected readonly pideCliente = computed(() => this.tipoElegido() === 2);

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().movimientos.sinResultados(texto);
    }

    if (this.tipoFiltrado() !== undefined) {
      return t().movimientos.sinDeTipo(this.nombreTipo(this.tipoFiltrado()!));
    }

    if (this.equipoFiltrado() !== '' || this.ubicacionFiltrada() !== '') {
      return t().movimientos.sinDeFiltro;
    }

    return t().movimientos.sinFilas;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().movimientos.contextoResultados(n);
    }

    if (this.tipoFiltrado() !== undefined) {
      return t().movimientos.contextoDeTipo(n, this.nombreTipo(this.tipoFiltrado()!));
    }

    return t().movimientos.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().movimientos.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.equipoFiltrado();
      this.ubicacionFiltrada();
      this.tipoFiltrado();
      this.pagina.set(1);
    });

    // EL TIPO SE CORRIGE AL CAMBIAR DE MÁQUINA. Elegir una sin ubicación mientras el tipo es
    // Traspaso dejaría seleccionada una opción que ya no está en la lista, y el `<select>`
    // mostraría en blanco un control que el formulario cree lleno.
    effect(() => {
      const permitidos = this.tiposDisponibles();

      if (!permitidos.includes(this.formulario.controls.tipo.value)) {
        this.formulario.controls.tipo.setValue(permitidos[0]);
      }
    });
  }

  /** La URL de descarga la compone el servicio; la tabla solo la pinta. */
  protected urlEvidencia(id: string): string {
    return this.api.urlEvidencia(id);
  }

  protected nombreTipo(tipo: TipoMovimiento): string {
    return t().movimientos.tipos[tipo] ?? String(tipo);
  }

  /** El `<select>` del filtro entrega cadena; el vacío es «cualquier tipo». */
  protected filtrarPorTipo(valor: string): void {
    this.tipoFiltrado.set(valor === '' ? undefined : (Number(valor) as TipoMovimiento));
  }

  protected filtrarPorEquipo(id: string): void {
    this.equipoFiltrado.set(id);
  }

  protected filtrarPorUbicacion(id: string): void {
    this.ubicacionFiltrada.set(id);
  }

  protected irA(numero: number): void {
    this.pagina.set(Math.min(Math.max(numero, 1), Math.max(this.paginas(), 1)));
  }

  protected puedeEnviar(): boolean {
    if (this.enviando() || !this.formulario.valid) {
      return false;
    }

    const v = this.formulario.getRawValue();

    // Los dos condicionales que un `Validators.required` no puede expresar: dependen del
    // tipo, y cambiar validadores al vuelo deja el control en un estado que nadie recuerda
    // limpiar.
    if (this.exigeDestino() && v.destinoId === '') {
      return false;
    }

    return !(this.pideProyecto() && v.proyectoId === '');
  }

  protected abrirAlta(): void {
    this.errorMutacion.set(null);
    this.formulario.reset({
      equipoId: '',
      tipo: 3,
      destinoId: '',
      proyectoId: '',
      clienteId: '',
      trabajadorId: '',
      motivoId: '',
      fecha: '',
      horometro: null,
      referenciaFolio: '',
      observaciones: '',
    });
    this.evidencia.set(null);
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  /** El `<input type="file">` entrega el `File` por el DOM, no por el formulario. */
  protected elegirEvidencia(entrada: EventTarget | null): void {
    const archivos = (entrada as HTMLInputElement | null)?.files;

    this.evidencia.set(archivos && archivos.length > 0 ? archivos[0] : null);
  }

  protected quitarEvidencia(): void {
    this.evidencia.set(null);
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando.set(true);
    this.errorMutacion.set(null);

    const archivo = this.evidencia();

    // LA EVIDENCIA SE SUBE PRIMERO y su id entra en el alta. Al revés no se puede: el
    // movimiento es inmutable en cuanto existe. Si la subida falla, el movimiento no se
    // registra —el `switchMap` no llega a correr— y quien captura vuelve a intentarlo con
    // todo el formulario intacto.
    (archivo === null
      ? this.registrarCon(null)
      : this.api.subirEvidencia(archivo).pipe(
          // `?? null` porque el esquema generado marca el id como opcional: OpenAPI no
          // distingue «no anulable» de «siempre presente» en una respuesta. El servidor
          // siempre lo manda; el null es la rama que nunca ocurre.
          switchMap((subida) => this.registrarCon(subida.archivoId ?? null)),
        )
    ).subscribe({
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

  private registrarCon(evidenciaArchivoId: string | null): Observable<Movimiento> {
    const v = this.formulario.getRawValue();

    const alta = {
      tipo: v.tipo,
      equipoId: v.equipoId,
      // EL ORIGEN NO SE ELIGE: es donde la máquina está ahora, y va para que el servidor
      // COMPRUEBE que sigue estándolo. Si alguien la movió mientras este panel estaba
      // abierto, la respuesta es un 409 en vez de un movimiento que no encadena.
      ubicacionOrigenId: this.equipoElegido()?.ubicacionId ?? null,
      // Lo que el tipo no pide se manda NULO, no lo que quedó escrito en el control: quien
      // eligió una obra y luego cambió a Traspaso dejaría un `proyectoId` colgado que el
      // servidor guardaría en un movimiento que no va a ninguna obra.
      ubicacionDestinoId: this.pideDestino() && v.destinoId !== '' ? v.destinoId : null,
      proyectoId: this.pideProyecto() && v.proyectoId !== '' ? v.proyectoId : null,
      clienteId: this.pideCliente() && v.clienteId !== '' ? v.clienteId : null,
      // Sin fecha, el servidor pone ahora. Mandar otro día exige `movimientos.autorizar`, y
      // el rechazo lo dice.
      fecha: v.fecha === '' ? null : `${v.fecha}T00:00:00Z`,
      trabajadorId: v.trabajadorId,
      motivoId: v.motivoId,
      referenciaFolio: v.referenciaFolio.trim() === '' ? null : v.referenciaFolio.trim(),
      horometro: v.horometro,
      observaciones: v.observaciones.trim() === '' ? null : v.observaciones.trim(),
      evidenciaArchivoId,
    } satisfies AltaMovimiento;

    return this.api.registrar(alta);
  }
}
