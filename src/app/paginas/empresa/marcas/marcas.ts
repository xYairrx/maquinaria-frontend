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
import type { FiltroListado, Marca } from '../../../nucleo/api/contratos';
import { mensajeDeError } from '../../../nucleo/api/mensaje-error';
import { t } from '../../../nucleo/i18n/i18n';
import { MarcasEsqueleto } from './esqueleto';

/** Techo del servidor. Pedir más no trae más, así que la pantalla no lo intenta. */
const TAMANO_PAGINA = 50;

/**
 * Marcas de maquinaria. **La pantalla canónica de un módulo de catálogo.**
 *
 * Las otras seis —modelos, tipos, categorías, tarifas, cláusulas y puestos— copian esta
 * forma: listado paginado con búsqueda y filtro de activos, hoja inferior para el alta y
 * la edición, y `PATCH .../activo` para retirar. Lo que cambia entre ellas son los campos,
 * no la forma. Ver `docs/plan-fase1-front.md` §8.
 *
 * DOS COSAS QUE NO SON OBVIAS:
 *
 * **Retirar no borra.** `marca` no tiene borrado lógico —solo `equipo`, `archivo` y
 * `tenant` lo tienen—, así que aquí no hay `DELETE`. Una marca retirada sigue existiendo y
 * los modelos que cuelgan de ella la siguen apuntando; lo único que cambia es que deja de
 * ofrecerse al capturar un equipo. La pantalla lo dice en voz alta.
 *
 * **El filtro de activos tiene TRES estados, no dos.** Sin valor trae activas y retiradas;
 * `true` solo activas; `false` solo retiradas. Un interruptor de dos posiciones no puede
 * representar eso, de ahí los tres chips.
 */
@Component({
  selector: 'app-marcas',
  imports: [Hoja, MarcasEsqueleto, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './marcas.html',
})
export class Marcas {
  private readonly api = inject(ApiCatalogos);
  private readonly barra = inject(Barra);
  private readonly confirmacion = inject(Confirmacion);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly t = t;

  /**
   * El texto de la barra superior. Es la señal de la PANTALLA: la barra escribe en ella y
   * aquí se lee para filtrar. Pasarla en lugar de copiarla evita un estado intermedio que
   * haya que sincronizar.
   */
  protected readonly busqueda = signal('');

  /**
   * La búsqueda, con retardo. **Es la que filtra**; `busqueda` es la que se teclea.
   *
   * Sin esto, escribir «Caterpillar» son ONCE peticiones de las que diez se cancelan a
   * medio camino. Se ve en el backend: cada cancelación llega por el `CancellationToken` y
   * EF Core aborta la consulta con `OperationCanceledException` —correcto, pero es trabajo
   * abierto contra Neon para nada, y un depurador enganchado se detiene en cada una—.
   *
   * 300 ms es el punto donde la lista se siente inmediata al dejar de teclear sin
   * disparar por letra.
   */
  private readonly busquedaDiferida = toSignal(
    toObservable(this.busqueda).pipe(debounceTime(300), distinctUntilChanged()),
    { initialValue: '' },
  );

  /** `undefined` = activas y retiradas. Ver la nota de la clase. */
  protected readonly soloActivas = signal<boolean | undefined>(undefined);

  protected readonly pagina = signal(1);

  private readonly filtro = computed<FiltroListado>(() => ({
    Texto: this.busquedaDiferida().trim() || undefined,
    Activo: this.soloActivas(),
    Numero: this.pagina(),
    Tamano: TAMANO_PAGINA,
    Orden: 'nombre',
  }));

  private readonly listado = this.api.marcas.listado(this.filtro);

  protected readonly marcas = this.listado.filas;
  protected readonly total = this.listado.total;
  protected readonly paginas = this.listado.paginas;

  /**
   * Solo la PRIMERA carga, no las recargas.
   *
   * `isLoading` del recurso es `true` también al recargar, y conectarlo directo al
   * esqueleto hacía que crear, editar o retirar reemplazara la tabla entera por bloques
   * grises un instante. El esqueleto es para «todavía no sé qué forma tiene esto»; al
   * recargar ya se sabe, porque los datos están en pantalla, y taparlos se lee como si
   * algo se hubiera roto.
   *
   * Es la regla de `convenciones.md#esqueletos-de-carga`: nada de siluetas para acciones
   * que provocó una persona.
   *
   * Durante una recarga el recurso CONSERVA el valor anterior, así que `marcas()` sigue
   * teniendo filas y esta condición es falsa. En la primera carga no hay ninguna y sí sale.
   */
  protected readonly cargando = computed(
    () => this.listado.cargando() && this.marcas().length === 0,
  );

  /**
   * Que hay algo en vuelo. Va al `aria-busy` de la tabla y **a nada visual**: el sistema de
   * diseño prohíbe apagar contenido con `opacity` porque arrastra el texto por debajo del
   * contraste mínimo. Lo que se ve es la fila cambiando, que ya es la señal.
   */
  protected readonly recargando = this.listado.cargando;

  protected readonly enviando = signal(false);
  protected readonly hojaAbierta = signal(false);

  /** El error de la mutación. El del listado lo trae el recurso. */
  private readonly errorMutacion = signal<string | null>(null);

  /** Con el de la mutación por delante: es el que acaba de provocar la persona. */
  protected readonly error = computed(() => this.errorMutacion() ?? this.listado.error());

  /**
   * La marca que se está editando, o `null` si la hoja va a crear una.
   *
   * Una sola hoja para las dos operaciones: el formulario es idéntico —un campo— y dos
   * hojas serían dos copias del mismo marcado que se separan con el tiempo.
   */
  protected readonly editando = signal<Marca | null>(null);

  protected readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
  });

  /**
   * Qué decir cuando no hay filas, y **decir POR QUÉ**.
   *
   * Un solo texto de vacío miente en cuanto hay filtros. Con el chip «Retiradas» puesto y
   * ninguna retirada, «Todavía no hay marcas» es **falso**: puede haber diez activas. Y peor
   * que falso, es inútil — invita a crear una marca cuando lo que hay que hacer es quitar el
   * filtro.
   *
   * Los tres mensajes filtrados NO infieren nada sobre el resto del catálogo. Decir «todas
   * están activas» exigiría un conteo sin filtro que esta pantalla no pide, y sería mentira
   * con el catálogo vacío. Cada texto afirma solo lo que esta consulta demuestra.
   *
   * La llamada a la acción va **solo** en el vacío de verdad: con un filtro puesto, «la
   * primera se crea con el botón de arriba» es ruido.
   */
  protected readonly mensajeVacio = computed(() => {
    const texto = this.busquedaDiferida().trim();

    if (texto !== '') {
      return t().marcas.sinResultados(texto);
    }

    if (this.soloActivas() === true) {
      return t().marcas.sinActivas;
    }

    if (this.soloActivas() === false) {
      return t().marcas.sinRetiradas;
    }

    return t().marcas.sinMarcas;
  });

  /**
   * Lo que va bajo el título, y también tiene que decir la verdad.
   *
   * «0 marcas» con el filtro de retiradas puesto se lee como «el catálogo está vacío», y no
   * lo está: es que ninguna está retirada. El contexto nombra lo que de verdad está contando.
   */
  protected readonly contexto = computed(() => {
    const n = this.total();

    if (this.busquedaDiferida().trim() !== '') {
      return t().marcas.contextoResultados(n);
    }

    if (this.soloActivas() === true) {
      return t().marcas.contextoActivas(n);
    }

    if (this.soloActivas() === false) {
      return t().marcas.contextoRetiradas(n);
    }

    return t().marcas.contexto(n);
  });

  /** El rango que se está viendo, para «51-100 de 3,842». */
  protected readonly desde = computed(() =>
    this.total() === 0 ? 0 : (this.pagina() - 1) * TAMANO_PAGINA + 1,
  );

  protected readonly hasta = computed(() =>
    Math.min(this.pagina() * TAMANO_PAGINA, this.total()),
  );

  constructor() {
    effect(() =>
      this.barra.configurar({
        titulo: t().marcas.titulo,
        contexto: this.contexto(),
        busqueda: { marcador: t().marcas.buscar, valor: this.busqueda },
        accion: { etiqueta: t().marcas.crear, alPulsar: () => this.abrirAlta() },
      }),
    );

    // Al cambiar el filtro hay que volver a la primera página: quedarse en la 7 tras
    // buscar deja una lista vacía que se lee como «no hay resultados».
    //
    // Lee la búsqueda DIFERIDA, no la que se teclea. Con la inmediata, estando en la
    // página 3 la primera tecla cambiaría `Numero` sin cambiar `Texto` todavía —el retardo
    // no ha corrido— y eso dispara una petición de más: el texto viejo en la página 1.
    effect(() => {
      this.busquedaDiferida();
      this.soloActivas();
      this.pagina.set(1);
    });
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.errorMutacion.set(null);
    this.formulario.reset({ nombre: '' });
    this.hojaAbierta.set(true);
  }

  protected abrirEdicion(marca: Marca): void {
    this.editando.set(marca);
    this.errorMutacion.set(null);
    this.formulario.reset({ nombre: marca.nombre });
    this.hojaAbierta.set(true);
  }

  protected cerrarHoja(): void {
    this.hojaAbierta.set(false);
  }

  protected filtrarPor(activo: boolean | undefined): void {
    this.soloActivas.set(activo);
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

    const nombre = this.formulario.getRawValue().nombre.trim();
    const enEdicion = this.editando();

    const peticion = enEdicion
      ? this.api.marcas.editar(enEdicion.id, { nombre })
      : this.api.marcas.crear({ nombre });

    peticion.subscribe({
      next: () => {
        // Sin recargar a mano: las dos mutaciones refrescan el listado en el servicio.
        this.enviando.set(false);
        this.cerrarHoja();
      },
      error: (e: unknown) => {
        // El 409 llega aquí con su `detail` del servidor —«ya existe una marca con ese
        // nombre»— y se pinta tal cual. Traducirlo lo desalinearía del servidor, que es
        // quien decide qué revela un mensaje.
        this.errorMutacion.set(mensajeDeError(e));
        this.enviando.set(false);
      },
    });
  }

  protected async alternarActivo(marca: Marca): Promise<void> {
    // Se pregunta solo al RETIRAR: reactivar no le quita nada a nadie.
    if (marca.activo) {
      const sigue = await this.confirmacion.pedir({
        titulo: t().marcas.retirar,
        mensaje: t().marcas.confirmarRetiro(marca.nombre),
        confirmar: t().marcas.retirar,
        peligro: true,
      });

      if (!sigue) {
        return;
      }
    }

    this.errorMutacion.set(null);

    this.api.marcas.cambiarActivo(marca.id, !marca.activo).subscribe({
      error: (e: unknown) => this.errorMutacion.set(mensajeDeError(e)),
    });
  }
}
