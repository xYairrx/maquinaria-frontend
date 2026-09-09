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
import { RouterLink } from '@angular/router';
import {
  type Observable,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  forkJoin,
} from 'rxjs';

import { Barra } from '../../../disposicion/barra';
import { BarraHerramientas } from '../../../disposicion/barra-herramientas';
import { Confirmacion } from '../../../disposicion/confirmacion';
import { PanelLateral } from '../../../disposicion/panel-lateral';
import { ApiCatalogos } from '../../../nucleo/api/api-catalogos';
import { ApiEquipos } from '../../../nucleo/api/api-equipos';
import { ApiOrganizacion } from '../../../nucleo/api/api-organizacion';
import type {
  AltaEquipo,
  Equipo,
  EstadoEquipo,
  FiltroEquipos,
} from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { ErrorCampo, errorVisible } from '../../../nucleo/formularios/error-campo';
import { validadorRequerido } from '../../../nucleo/formularios/validadores';
import { mismoNombre } from '../../../nucleo/formularios/texto';
import { t } from '../../../nucleo/i18n/i18n';
import { EquiposEsqueleto } from './esqueleto';

const TAMANO_PAGINA = 50;

/** Los ocho de `EstadoEquipo`. Sirven para FILTRAR y para leer la tabla. */
const ESTADOS: readonly EstadoEquipo[] = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Los cuatro que una persona SÍ puede poner a mano.
 *
 * Los otros —Reservado, Rentado, En traslado y Vendido— los pone la operación al confirmar una
 * renta, un traspaso o una venta, y **el servidor rechaza cambiarlos desde aquí** con un 400
 * explícito. No es una regla que se invente la pantalla: está en `ServicioEquiposEf` como
 * `EstadosDeDocumento`. Ofrecerlos dejaría el calendario y el estado contándose cosas distintas.
 */
const ESTADOS_MANUALES: readonly EstadoEquipo[] = [1, 5, 6, 8];

// SIN PROPOSITOS NI ORIGENES: las dos columnas salieron el 2026-09-09. Con el proposito
// se fue la distincion entre maquinaria de renta y de venta — cualquier equipo se puede
// rentar y cualquiera se puede vender; lo unico que lo impide es su estado.

/**
 * El parque de equipos. **La entidad central de la fase.**
 *
 * TRES COSAS QUE NO SON OBVIAS:
 *
 * **El estado no se captura entero.** De los ocho, solo cuatro se ponen a mano; los otros salen
 * de confirmar una renta, un traspaso o una venta, y el servidor los rechaza. La pantalla
 * ofrece los cuatro y explica por qué faltan los demás, en vez de dejar que el usuario descubra
 * el 400.
 *
 * **La ubicación solo se elige en el ALTA.** En la edición se muestra y no se toca: moverla
 * es un MOVIMIENTO, y el servidor rechaza el cambio desde aquí con un 409. Antes se permitía
 * «como corrección de captura», y el resultado era una máquina que cambiaba de sitio sin
 * dejar rastro: el expediente decía Patio Norte de una que llevaba tres meses en una obra.
 *
 * **Y EL ALTA YA NO PREGUNTA QUIÉN LA RECIBE**, retirado el 2026-09-09. Lo preguntaba porque
 * el alta con ubicación escribe el movimiento de entrada al inventario y un movimiento siempre
 * tiene quien lo firma; ahora ese responsable lo pone el servidor con **el de la ubicación de
 * destino**, que es un dato que ya existe y que esta pantalla no puede contradecir. Si esa
 * ubicación no tiene responsable, el alta se rechaza diciéndolo.
 *
 * Dar de alta sin ubicación sigue siendo legítimo —una máquina que todavía no llegó— y entonces
 * no hay movimiento que escribir: se coloca después con uno capturado a mano.
 *
 * **Es la primera pantalla con DELETE.** `equipo` es una de las tres entidades con borrado
 * lógico, así que aquí sí hay eliminar además de cambiar de estado. Y puede responder **409**:
 * el servidor rechaza sacar de circulación —o borrar— una máquina con calendario ocupado. Ese
 * 409 es la garantía de no-traslape hablando, así que se muestra con el texto del servidor y no
 * como un «error al guardar».
 */
@Component({
  selector: 'app-equipos',
  imports: [
    BarraHerramientas,
    EquiposEsqueleto,
    ErrorCampo,
    PanelLateral,
    ReactiveFormsModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './equipos.html',
})
export class Equipos {
  private readonly api = inject(ApiEquipos);
  private readonly catalogos = inject(ApiCatalogos);
  private readonly organizacion = inject(ApiOrganizacion);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;
  protected readonly estados = ESTADOS;
  protected readonly estadosManuales = ESTADOS_MANUALES;
  protected readonly mal = errorVisible;

  /** Los desplegables del alta. Compartidos entre pantallas: una petición cada uno. */
  protected readonly marcas = this.catalogos.selectorMarcas();
  protected readonly categorias = this.catalogos.selectorCategorias();
  private readonly todosLosModelos = this.catalogos.selectorModelos();
  protected readonly anios = this.api.selectorAnios();
  protected readonly ubicaciones = this.organizacion.selectorUbicaciones();

  protected readonly busqueda = signal('');

  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  protected readonly estadoFiltrado = signal<EstadoEquipo | undefined>(undefined);
  protected readonly ubicacionFiltrada = signal('');
  /**
   * Filtrar por marca y por categoría, que es lo que las columnas de `equipo` hacen barato:
   * el servidor resuelve las dos sin unir con el catálogo de modelos ni con el de tipos.
   */
  protected readonly marcaFiltrada = signal('');
  protected readonly categoriaFiltrada = signal('');

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroEquipos>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Estado: this.estadoFiltrado(),
    UbicacionId: this.ubicacionFiltrada() || undefined,
    MarcaId: this.marcaFiltrada() || undefined,
    CategoriaEquipoId: this.categoriaFiltrada() || undefined,
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'codigo',
  }));

  private readonly listado = this.api.equipos.listado(this.filtro);

  protected readonly equipos = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  protected readonly cargando = computed(
    () => this.listado.cargando() && this.equipos().length === 0,
  );

  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly panelAbierto = signal(false);
  protected readonly panelEstadoAbierto = signal(false);

  private readonly errorMutacion = signal<string | null>(null);

  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  protected readonly editando = signal<Equipo | null>(null);
  protected readonly cambiandoEstadoA = signal<Equipo | null>(null);

  protected readonly formulario = this.fb.group({
    codigoInterno: ['', validadorRequerido],
    // LA MARCA ES UN FILTRO Y NO SE MANDA: se deriva del modelo, y guardarla aparte permitiría
    // un equipo que dice «Caterpillar» cuyo modelo dice «Komatsu». Acota la lista de modelos,
    // que es lo que hacía falta.
    /**
     * MARCA, MODELO Y CATEGORÍA SE ESCRIBEN, NO SE ELIGEN DE UNA LISTA CERRADA.
     *
     * Son `<input list=...>` con un `datalist`: el navegador filtra mientras se teclea y, si
     * lo escrito no está en el catálogo, **se crea al guardar** y queda disponible para el
     * siguiente equipo. Es lo que pidió el cliente el 2026-09-07.
     *
     * Por eso el control guarda TEXTO y no un id: el id no existe todavía cuando se teclea.
     * Se resuelve —o se crea— en `enviar`.
     *
     * `datalist` y no un combobox propio: un `role="combobox"` obliga a implementar flechas,
     * Home y End, y anunciar el rol sin su contrato de teclado es peor que no anunciarlo. El
     * nativo trae filtrado, teclado y lector de pantalla hechos.
     */
    marcaTexto: ['', validadorRequerido],
    modeloTexto: ['', validadorRequerido],
    categoriaTexto: ['', validadorRequerido],
    ubicacionId: [''],
    // Obligatorio SOLO cuando hay ubicacion, y eso no lo expresa un `Validators.required`:
    // depende de otro campo. Lo decide `puedeEnviar`.
    numeroSerie: [''],
    // NUMÉRICOS Y ANULABLES: un `<input type="number">` escribe `null` al vaciarse, y en el DTO
    // estos SÍ son opcionales, así que null es su valor legítimo. Declararlos como texto
    // compila y luego revienta con `.trim is not a function`.
    anio: [null as number | null],
    fechaAdquisicion: [''],
    costoAdquisicion: [null as number | null],
    // Las cuatro tarifas de referencia de §5.1. PRECIO SUGERIDO: el que se cobra se
    // captura en la línea de la cotización o de la renta, y eso no cambia.
    tarifaHora: [null as number | null],
    tarifaDia: [null as number | null],
    tarifaSemana: [null as number | null],
    tarifaMes: [null as number | null],
    horometro: [null as number | null],
    kilometraje: [null as number | null],
    // DOS CAMPOS Y NO UNO, como pide el documento funcional: la descripción se cuenta
    // hacia fuera —se copia a una cotización— y las notas se quedan dentro.
    descripcion: [''],
    notas: [''],
  });

  protected readonly formularioEstado = this.fb.group({
    estado: [1 as EstadoEquipo],
    nota: [''],
  });

  /**
   * Los valores COMO SEÑAL. Un `FormGroup` no es reactivo: un `computed` que lo lea directo se
   * queda con el primer valor y las listas no se filtrarían nunca al cambiar de marca. Es la
   * trampa que ya costó dos arreglos en este repo.
   */
  private readonly valores = toSignal(this.formulario.valueChanges, {
    initialValue: this.formulario.getRawValue(),
  });

  /**
   * Los modelos de la marca elegida. Sin marca, todos.
   *
   * **Los selectores perezosos van en campos y aquí solo se LEEN.** Llamar
   * `selectorModelos()` dentro de este `computed` lanzaría `NG0602`: crea su `httpResource` en
   * la primera llamada, y eso es un `effect` dentro de un contexto reactivo. Pasó en
   * Mantenimiento el 2026-09-03 y la lista no pintaba ni filas ni mensaje de vacío.
   */
  /**
   * Los modelos de la marca escrita. Sin marca, todos.
   *
   * Se acota por el NOMBRE y no por el id, porque la marca también es texto libre: mientras se
   * teclea puede no corresponder a ninguna del catálogo, y entonces no hay nada que acotar —lo
   * que se está escribiendo es una marca nueva y todavía no tiene modelos—.
   */
  protected readonly modelos = computed(() => {
    // `?? ''` porque `valueChanges` emite un parcial: el tipo es `string | undefined` aunque
    // el control sea no anulable. Sin esto, `.trim()` no compila.
    const marca = this.valores().marcaTexto ?? '';

    if (marca.trim() === '') {
      return this.todosLosModelos();
    }

    const laMarca = this.marcas().find((m) => mismoNombre(m.nombre, marca));

    return laMarca === undefined
      ? []
      : this.todosLosModelos().filter((m) => m.marcaId === laMarca.id);
  });

  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().equipos.sinResultados(texto);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().equipos.sinDeEseEstado(this.nombreEstado(estado));
    }

    return t().equipos.sinEquipos;
  });

  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().equipos.contextoResultados(n);
    }

    const estado = this.estadoFiltrado();

    if (estado !== undefined) {
      return t().equipos.contextoDeEstado(n, this.nombreEstado(estado));
    }

    return t().equipos.contexto(n);
  });

  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() => Math.min(this.pagina() * TAMANO_PAGINA, this.total()));

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().equipos.titulo,
        contexto: this.contexto(),
        busqueda: null,
        accion: null,
      }),
    );

    effect(() => {
      this.busquedaDiferida();
      this.estadoFiltrado();
      this.ubicacionFiltrada();
      this.marcaFiltrada();
      this.categoriaFiltrada();
      this.pagina.set(1);
    });

    // CAMBIAR DE MARCA LIMPIA EL MODELO SI YA NO ES DE ESA MARCA, y lo mismo con la categoría
    // y el tipo. Sin esto queda seleccionado un valor que ya no está en la lista: el `<select>`
    // se pinta en blanco mientras el formulario se cree lleno, y se envía un modelo de otra
    // marca. Es el mismo arreglo que Movimientos necesitó para el tipo al cambiar de máquina.
    // **AQUÍ HABÍA UN EFECTO QUE LIMPIABA EL MODELO al cambiar de marca, y se retiró el
    // 2026-09-07 junto con el `<select>`.** Ahora el campo es texto libre: la marca solo acota
    // las SUGERENCIAS del `datalist`, y borrar lo escrito porque el filtro cambió sería borrar
    // algo que la persona tecleó. Si el texto no corresponde a ningún modelo de esa marca, se
    // crea uno — que es exactamente lo que se pidió.
  }

  /**
   * Al elegir el modelo, **propone su categoría** si el catálogo la tiene declarada.
   *
   * `modelo_equipo.categoria_equipo_id` es opcional y existe justo para esto. Es la §1 del
   * documento funcional —capturar una vez y reutilizar— y no una imposición: se puede cambiar
   * después, porque el mismo modelo puede darse de alta en otra categoría en un caso raro.
   *
   * NO SOBREESCRIBE lo que ya hay: quien eligió una categoría a mano no quiere que se le cambie
   * por corregir el modelo.
   */
  protected alElegirModelo(): void {
    const escrito = this.formulario.controls.modeloTexto.value;

    // Por NOMBRE, no por id: el campo es texto. Solo hace algo cuando lo escrito coincide con
    // un modelo del catálogo — mientras se teclea a medias no coincide nada y no pasa nada.
    const modelo = this.todosLosModelos().find((m) => mismoNombre(m.nombre, escrito));

    if (modelo === undefined) {
      return;
    }

    // La marca del modelo se escribe en su campo, para que las sugerencias se acoten solas y
    // para no obligar a teclear dos veces lo que el catálogo ya sabe.
    this.formulario.controls.marcaTexto.setValue(modelo.marca);

    if (modelo.categoriaEquipoId != null && this.formulario.controls.categoriaTexto.value === '') {
      const categoria = this.categorias().find((c) => c.id === modelo.categoriaEquipoId);

      if (categoria !== undefined) {
        this.formulario.controls.categoriaTexto.setValue(categoria.nombre);
      }
    }
  }

  protected filtrarPorMarca(id: string): void {
    this.marcaFiltrada.set(id);
  }

  protected filtrarPorCategoria(id: string): void {
    this.categoriaFiltrada.set(id);
  }

  protected nombreEstado(estado: EstadoEquipo): string {
    return t().equipos.estados[estado] ?? String(estado);
  }

  /** Los `<select>` entregan TEXTO; los tres enums son numéricos. */
  protected elegirEstado(valor: string): void {
    this.estadoFiltrado.set(valor === '' ? undefined : (Number(valor) as EstadoEquipo));
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

    // **YA NO SE PIDE «quien recibe»**, retirado el 2026-09-09: el movimiento de entrada al
    // inventario toma su responsable del que tenga la UBICACION de destino. Si esa ubicacion no
    // tiene responsable asignado, el servidor rechaza el alta diciendolo — no hay forma de
    // saberlo desde aqui sin pedir la ubicacion entera.
    return true;
  }

  /** En la edicion la ubicacion se muestra y no se toca: la mueve un movimiento. */
  protected get editandoExpediente(): boolean {
    return this.editando() !== null;
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigoInterno: '',
      marcaTexto: '',
      modeloTexto: '',
      categoriaTexto: '',
      ubicacionId: '',
      numeroSerie: '',
      anio: null,
      fechaAdquisicion: '',
      costoAdquisicion: null,
      tarifaHora: null,
      tarifaDia: null,
      tarifaSemana: null,
      tarifaMes: null,
      horometro: null,
      kilometraje: null,
      descripcion: '',
      notas: '',
    });
    this.panelAbierto.set(true);
  }

  protected abrirEdicion(equipo: Equipo): void {
    this.editando.set(equipo);
    this.errorMutacion.set(null);
    this.formulario.reset({
      codigoInterno: equipo.codigoInterno,
      // LOS DOS FILTROS SE PRECARGAN, y desde el PROPIO equipo — que desde el 2026-09-03
      // guarda `marcaId` y `categoriaEquipoId` en columnas suyas. Buscarlos en el catálogo,
      // como estaba antes, devolvía cadena vacía si los catálogos aún no habían respondido, y
      // entonces la edición se abría diciendo «Todas las marcas».
      // Al editar se precargan los NOMBRES, que es lo que el campo muestra. Si nadie los toca,
      // `enviar` los vuelve a resolver al mismo id y no se crea nada.
      marcaTexto: equipo.marca,
      modeloTexto: equipo.modelo,
      categoriaTexto: equipo.categoria,
      ubicacionId: equipo.ubicacionId ?? '',
      numeroSerie: equipo.numeroSerie ?? '',
      anio: equipo.anio ?? null,
      fechaAdquisicion: equipo.fechaAdquisicion ?? '',
      costoAdquisicion: equipo.costoAdquisicion ?? null,
      tarifaHora: equipo.tarifaHora ?? null,
      tarifaDia: equipo.tarifaDia ?? null,
      tarifaSemana: equipo.tarifaSemana ?? null,
      tarifaMes: equipo.tarifaMes ?? null,
      horometro: equipo.horometro ?? null,
      kilometraje: equipo.kilometraje ?? null,
      descripcion: equipo.descripcion ?? '',
      notas: equipo.notas ?? '',
    });
    this.panelAbierto.set(true);
  }

  protected cerrarPanel(): void {
    this.panelAbierto.set(false);
  }

  protected abrirEstado(equipo: Equipo): void {
    this.cambiandoEstadoA.set(equipo);
    this.errorMutacion.set(null);
    // Si el equipo está en un estado que pone la operación, el desplegable no puede
    // preseleccionarlo: se arranca en Disponible, que es el destino habitual.
    const actual = ESTADOS_MANUALES.includes(equipo.estado) ? equipo.estado : 1;
    this.formularioEstado.reset({ estado: actual, nota: '' });
    this.panelEstadoAbierto.set(true);
  }

  protected cerrarPanelEstado(): void {
    this.panelEstadoAbierto.set(false);
  }

  /**
   * El id de la marca escrita, creándola si no existe.
   *
   * El catálogo de marcas solo pide el nombre, así que crear una es directo — a diferencia de
   * la categoría, que exige un código y hay que derivarlo.
   */
  private marcaResuelta(nombre: string): Observable<string> {
    const existente = this.marcas().find((m) => mismoNombre(m.nombre, nombre));

    return existente !== undefined
      ? of(existente.id)
      : this.catalogos.marcas.crear({ nombre: nombre.trim() }).pipe(map((creada) => creada.id));
  }

  /**
   * El id de la categoría escrita, creándola si no existe.
   *
   * El código se deriva del nombre porque el catálogo lo exige y el alta rápida no lo pregunta:
   * sin acentos, en mayúsculas, sin lo que no sea letra o número. Si ese código ya está tomado
   * —dos nombres distintos pueden reducirse al mismo— se le pega un sufijo en lugar de dejar
   * que el servidor devuelva un 409 que aquí no significaría nada para quien captura.
   */
  private categoriaResuelta(nombre: string): Observable<string> {
    const existente = this.categorias().find((c) => mismoNombre(c.nombre, nombre));

    if (existente !== undefined) {
      return of(existente.id);
    }

    const base =
      nombre
        .trim()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 12) || 'CAT';

    const tomados = new Set(this.categorias().map((c) => c.codigo));
    let codigo = base;

    for (let n = 2; tomados.has(codigo); n++) {
      codigo = `${base.slice(0, 10)}${n}`;
    }

    return this.catalogos.categorias
      .crear({ codigo, nombre: nombre.trim(), descripcion: null })
      .pipe(map((creada) => creada.id));
  }

  /**
   * El id del modelo escrito, creándolo si no existe.
   *
   * **Se busca DENTRO DE LA MARCA elegida**, no en todo el catálogo: dos marcas pueden tener un
   * «320» y son modelos distintos. Por eso crear un modelo exige marca, y sin ella se rechaza
   * con un mensaje en lugar de inventar a cuál pertenece.
   *
   * La categoría escrita se le pasa al modelo nuevo, para que la próxima máquina de ese modelo
   * la traiga propuesta.
   */
  private modeloResuelto(nombre: string, marcaId: string, categoriaId: string): Observable<string> {
    const existente = this.todosLosModelos().find(
      (m) => mismoNombre(m.nombre, nombre) && m.marcaId === marcaId,
    );

    if (existente !== undefined) {
      return of(existente.id);
    }

    return this.catalogos.modelos
      .crear({
        marcaId,
        categoriaEquipoId: categoriaId,
        nombre: nombre.trim(),
        descripcion: null,
        horasEntreServicios: null,
      })
      .pipe(map((creado) => creado.id));
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

    // MARCA, CATEGORÍA Y DESPUÉS MODELO. Encadenados y no en paralelo, porque el orden es una
    // dependencia real: un modelo nuevo se crea CON su marca y su categoría, así que necesita
    // los dos ids antes de existir. Si algo falla a mitad, lo que quedó creado son entradas de
    // catálogo válidas —una marca, una categoría—, nunca un modelo colgando de nada.
    forkJoin({
      marcaId: this.marcaResuelta(v.marcaTexto),
      categoriaEquipoId: this.categoriaResuelta(v.categoriaTexto),
    })
      .pipe(
        switchMap(({ marcaId, categoriaEquipoId }) =>
          this.modeloResuelto(v.modeloTexto, marcaId, categoriaEquipoId).pipe(
            map((modeloEquipoId) => ({ categoriaEquipoId, modeloEquipoId })),
          ),
        ),
        switchMap(({ categoriaEquipoId, modeloEquipoId }) =>
          this.guardar(v, categoriaEquipoId, modeloEquipoId, vacioANulo),
        ),
      )
      .subscribe({
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

  private guardar(
    v: ReturnType<typeof this.formulario.getRawValue>,
    categoriaEquipoId: string,
    modeloEquipoId: string,
    vacioANulo: (texto: string) => string | null,
  ): Observable<Equipo> {
    const alta = {
      codigoInterno: v.codigoInterno.trim().toUpperCase(),
      modeloEquipoId,
      categoriaEquipoId,
      ubicacionId: vacioANulo(v.ubicacionId),
      // SIN `trabajadorId`: quien recibe la maquina dejo de preguntarse el 2026-09-09. Lo pone
      // el servidor con el responsable de la ubicacion de destino.
      numeroSerie: vacioANulo(v.numeroSerie),
      // `Math.trunc` porque el accesor usa `parseFloat`: un año con decimales llegaría al
      // servidor y una columna `int` lo rechazaría con un 400 de model binding.
      anio: v.anio === null ? null : Math.trunc(v.anio),
      fechaAdquisicion: vacioANulo(v.fechaAdquisicion),
      costoAdquisicion: v.costoAdquisicion,
      tarifaHora: v.tarifaHora,
      tarifaDia: v.tarifaDia,
      tarifaSemana: v.tarifaSemana,
      tarifaMes: v.tarifaMes,
      horometro: v.horometro,
      kilometraje: v.kilometraje,
      descripcion: vacioANulo(v.descripcion),
      notas: vacioANulo(v.notas),
    } satisfies AltaEquipo;

    const enEdicion = this.editando();

    return enEdicion ? this.api.equipos.editar(enEdicion.id, alta) : this.api.equipos.crear(alta);
  }

  protected enviarEstado(): void {
    const equipo = this.cambiandoEstadoA();

    if (equipo === null || this.enviando()) {
      return;
    }

    const v = this.formularioEstado.getRawValue();

    this.enviando.set(true);
    this.errorMutacion.set(null);

    this.api
      .cambiarEstadoEquipo(equipo.id, {
        estado: v.estado,
        nota: v.nota.trim() === '' ? null : v.nota.trim(),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.cerrarPanelEstado();
        },
        error: (e: unknown) => {
          // Aquí es donde aparece el 409 del calendario ocupado, con el texto del servidor.
          this.errorMutacion.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  protected async eliminar(equipo: Equipo): Promise<void> {
    const sigue = await this.confirmacion.pedir({
      titulo: t().equipos.eliminar,
      mensaje: t().equipos.confirmarEliminar(equipo.codigoInterno),
      confirmar: t().equipos.eliminar,
      peligro: true,
    });

    if (!sigue) {
      return;
    }

    this.errorMutacion.set(null);

    this.api.eliminarEquipo(equipo.id).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
