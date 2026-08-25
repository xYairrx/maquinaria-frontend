import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { t } from '../nucleo/i18n/i18n';

/** Los anclajes por defecto, en porcentaje del alto de la pantalla. */
const ANCLAJES_POR_DEFECTO = [50, 70] as const;

/** Cuanto hay que arrastrar, como fraccion del alto de la hoja, para cambiar de anclaje. */
const UMBRAL_ANCLAJE = 0.15;

/** Velocidad, en px/ms, que cuenta como lanzamiento en lugar de arrastre. */
const VELOCIDAD_LANZAMIENTO = 0.5;

/** Velocidad hacia abajo que cierra de golpe, sin ir bajando anclaje por anclaje. */
const VELOCIDAD_CIERRE_DIRECTO = 1.2;

/**
 * Milisegundos minimos entre dos muestras para calcular velocidad.
 *
 * NO es un detalle: sin este piso, dos `pointermove` que llegan en el mismo milisegundo
 * —normal con un puntero de alta frecuencia, o con eventos coalescidos— dan una division por
 * casi cero y una velocidad enorme. El sintoma es una hoja que se cierra sola en un arrastre
 * LENTO de pocos pixeles, que es justo lo contrario de lo que el gesto quiere decir.
 */
const MUESTRA_MINIMA_MS = 8;

/**
 * Una hoja inferior ARRASTRABLE con varios puntos de anclaje.
 *
 * QUE LA HACE UNA HOJA Y NO UN MODAL: se agarra del asa y se mueve entre sus anclajes. Un
 * panel que solo aparece y desaparece es un modal con las esquinas redondeadas.
 *
 * LOS ANCLAJES SON CONFIGURABLES por quien la usa (`[anclajes]="[50, 70, 95]"`, en porcentaje
 * del alto de la pantalla). Se abre siempre en el mas bajo, sube de uno en uno al arrastrar
 * hacia arriba, baja al arrastrar hacia abajo, y desde el mas bajo un arrastre hacia abajo la
 * cierra. Un lanzamiento rapido hacia abajo cierra desde cualquier anclaje.
 *
 * EL GESTO SOLO VIVE EN EL ASA Y EN LA CABECERA, y eso es deliberado. Arrastrar desde el
 * cuerpo obliga a distinguir «quiero mover la hoja» de «quiero desplazar el contenido», que
 * se resuelve mirando si el contenedor esta en su tope y encadenando los dos gestos — mucho
 * codigo para un caso que casi nadie intenta. Con el asa como unica zona de arrastre, el
 * cuerpo se desplaza como cualquier lista y no hay conflicto.
 *
 * ACCESIBILIDAD: el arrastre NO es la unica forma de hacer nada. El asa es un `<button>` que
 * recorre los anclajes con teclado; Escape cierra —eso si lo da el `<dialog>`— y hay un boton
 * de cerrar explicito. Un gesto de puntero como unico camino dejaria fuera a quien navega con
 * teclado (WCAG 2.1.1).
 *
 * Sobre el elemento: es un `<dialog>` con `showModal()`. De ahi salen el atrapado de foco, el
 * `aria-modal`, el resto de la pagina inerte, la capa superior y el cierre con Escape. Lo que
 * este componente agrega es el gesto, los anclajes y el cierre al pulsar el velo — que el
 * navegador NO da: un `<dialog>` modal ignora los clics en su velo.
 */
@Component({
  selector: 'app-hoja',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hoja.html',
})
export class Hoja {
  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');

  protected readonly t = t;

  readonly abierta = input(false);

  /** El titulo de la hoja. Da el nombre accesible del dialogo. */
  readonly titulo = input('');

  /** Linea de apoyo bajo el titulo. Vacia si no hay. */
  readonly apoyo = input('');

  /**
   * Los anclajes, en PORCENTAJE del alto de la pantalla. Se abre en el mas bajo.
   *
   * Se normalizan al leerlos: ordenados, sin repetidos y acotados entre 20 y 98. Un anclaje
   * de 5 dejaria una hoja donde no cabe ni su cabecera, y uno de 100 la pega al borde
   * superior, que se lee como una pantalla completa y no como una hoja.
   */
  readonly anclajes = input<readonly number[]>(ANCLAJES_POR_DEFECTO);

  readonly cerrar = output<void>();

  protected readonly anclajesNormalizados = computed(() => {
    const validos = [...new Set(this.anclajes())]
      .filter((a) => Number.isFinite(a))
      .map((a) => Math.min(98, Math.max(20, a)))
      .sort((a, b) => a - b);

    // Si quien la usa manda una lista vacia o solo basura, se cae a los de por defecto en
    // lugar de quedarse sin alto: una hoja de cero pixeles no es un error visible, es una
    // hoja que «no abre».
    return validos.length > 0 ? validos : [...ANCLAJES_POR_DEFECTO];
  });

  /** En que anclaje esta, como indice. Al abrir siempre vuelve al mas bajo. */
  private readonly indice = signal(0);

  /**
   * Recorrido del dedo, en px, mientras se arrastra. Negativo hacia arriba. Cero sin gesto.
   *
   * NO se aplica igual en las dos direcciones, y esa asimetria es el corazon del gesto:
   * ver `desplazamiento` y `topeAltura`.
   */
  private readonly arrastre = signal(0);

  protected readonly arrastrando = signal(false);

  /**
   * El anclaje activo como TOPE de alto, en `dvh`.
   *
   * Tope y no alto fijo por dos razones: un alto fijo deja hueco vacio cuando el contenido es
   * mas corto que el anclaje, y el `max-height` que el navegador le pone a un `<dialog>` modal
   * capaba el alto pedido sin dar ningun error.
   */
  protected readonly alturaVh = computed(() => {
    const lista = this.anclajesNormalizados();

    return lista[Math.min(this.indice(), lista.length - 1)];
  });

  /**
   * El `translate`, y SOLO admite valores hacia abajo.
   *
   * ESTE ERA EL FALLO, y se veia: la hoja esta clavada al fondo con `inset: auto 0 0`, asi
   * que un `translate` NEGATIVO la despega del borde inferior y deja ver el velo debajo —con
   * el pie y su accion principal subiendo con ella—. Al soltar, el desplazamiento volvia a
   * cero y el tope saltaba al anclaje nuevo: de ahi el «se sube todo y al soltarlo se
   * acomoda».
   *
   * Una hoja inferior no se MUEVE hacia arriba, CRECE hacia arriba: su borde de abajo no se
   * separa del de la pantalla nunca. Subir es cosa de `topeAltura`; aqui solo baja, que si es
   * un desplazamiento de verdad —la hoja se va por debajo del borde, que es exactamente lo
   * que tiene que parecer cuando se la descarta.
   */
  protected readonly desplazamiento = computed(() => Math.max(0, this.arrastre()));

  /**
   * El tope de alto: el anclaje, mas lo que se haya arrastrado HACIA ARRIBA.
   *
   * El `min()` es el freno, y va en CSS y no en JavaScript porque mezcla unidades: `dvh` del
   * anclaje con `px` del dedo, y solo el navegador sabe cuanto mide un `dvh` en este momento.
   * Sin el, un arrastre largo pediria una hoja mas alta que la pantalla.
   *
   * Sigue siendo TOPE y no alto fijo, por lo mismo que antes: un alto fijo deja hueco vacio
   * cuando el contenido es mas corto que el anclaje. La consecuencia honesta es que si el
   * contenido ya cabe entero, arrastrar hacia arriba no mueve nada — porque no hay nada mas
   * que descubrir.
   */
  protected readonly topeAltura = computed(() => {
    const subida = Math.max(0, -this.arrastre());

    return `min(98dvh, calc(${this.alturaVh()}dvh + ${subida}px))`;
  });

  /**
   * El asa dice a donde lleva pulsarla, que es lo que un teclado necesita saber.
   *
   * En el anclaje mas alto vuelve al mas bajo, para que el recorrido con teclado sea circular
   * y no un callejon.
   */
  protected readonly etiquetaAsa = computed(() =>
    this.indice() >= this.anclajesNormalizados().length - 1 ? t().hoja.contraer : t().hoja.expandir,
  );

  private inicioY = 0;
  private ultimaY = 0;
  private ultimoTiempo = 0;
  private velocidad = 0;

  /**
   * Si el ultimo gesto movio la hoja de verdad.
   *
   * Existe por el clic del velo: al soltar un arrastre que acabo fuera de la hoja, el
   * navegador emite tambien un `click`, y sin esta bandera ese clic se leeria como «pulso el
   * velo» y cerraria la hoja justo despues de haberla arrastrado.
   */
  private huboArrastre = false;

  constructor() {
    effect(() => {
      const dialogo = this.dialogo()?.nativeElement;

      if (dialogo === undefined) {
        return;
      }

      if (this.abierta() && !dialogo.open) {
        // Cada apertura arranca en el anclaje mas bajo: si se quedara donde la dejaron, la
        // hoja volveria expandida sin que nadie lo haya pedido.
        this.indice.set(0);
        this.arrastre.set(0);
        dialogo.showModal();
      } else if (!this.abierta() && dialogo.open) {
        dialogo.close();
      }
    });
  }

  /** Recorre los anclajes. Es lo que hace el asa con teclado, y con un toque sin arrastre. */
  protected siguienteAnclaje(): void {
    this.indice.update((actual) =>
      actual >= this.anclajesNormalizados().length - 1 ? 0 : actual + 1,
    );
  }

  /**
   * Cierra si el clic cayo en el VELO.
   *
   * Esto no lo da el navegador: un `<dialog>` modal cierra con Escape pero ignora los clics en
   * su velo.
   *
   * SE COMPRUEBA POR `target`, NO POR COORDENADAS, y esa decision costo un fallo de
   * accesibilidad: un `click` nacido del TECLADO —Enter o Espacio sobre un boton— llega con
   * `clientX` y `clientY` en cero. Con la comprobacion geometrica, ese cero quedaba «por
   * encima» de la hoja y se leia como un clic en el velo, asi que pulsar con teclado
   * CUALQUIER boton de dentro cerraba la hoja entera. Con `target` no hay ambiguedad: el velo
   * es area del propio `<dialog>`, y todo lo de dentro esta cubierto por sus hijos.
   */
  protected alPulsar(evento: MouseEvent): void {
    const dialogo = this.dialogo()?.nativeElement;

    if (dialogo === undefined || evento.target !== dialogo) {
      return;
    }

    // Un clic que viene de terminar un arrastre fuera de la hoja no es un clic en el velo.
    if (this.huboArrastre) {
      this.huboArrastre = false;
      return;
    }

    this.cerrar.emit();
  }

  protected iniciarArrastre(evento: PointerEvent): void {
    // Solo el boton principal: un arrastre con el boton derecho abriria el menu contextual a
    // media accion.
    if (evento.button !== 0) {
      return;
    }

    // La captura va PRIMERO y entre `try`: sin ella, sacar el dedo del asa mientras se
    // arrastra corta el gesto a medias y la hoja se queda flotando donde la dejaron. Pero
    // `setPointerCapture` LANZA si el puntero ya no existe —pasa con un toque muy rapido—, y
    // si eso ocurriera despues de marcar `arrastrando`, la hoja se quedaria en modo gesto
    // para siempre: sin transicion y esperando un `pointerup` que nunca llega.
    try {
      (evento.target as HTMLElement).setPointerCapture(evento.pointerId);
    } catch {
      // Sin captura el gesto sigue funcionando mientras el dedo no salga de la zona.
    }

    this.inicioY = evento.clientY;
    this.ultimaY = evento.clientY;
    this.ultimoTiempo = evento.timeStamp;
    this.velocidad = 0;
    this.arrastrando.set(true);
  }

  protected moverArrastre(evento: PointerEvent): void {
    if (!this.arrastrando()) {
      return;
    }

    const delta = evento.clientY - this.inicioY;
    const transcurrido = evento.timeStamp - this.ultimoTiempo;

    // Solo se remuestrea con un intervalo de verdad. Con menos, se conserva la ultima
    // velocidad buena en lugar de calcular una absurda.
    if (transcurrido >= MUESTRA_MINIMA_MS) {
      this.velocidad = (evento.clientY - this.ultimaY) / transcurrido;
      this.ultimaY = evento.clientY;
      this.ultimoTiempo = evento.timeStamp;
    }

    // En el anclaje mas alto, tirar hacia arriba no hace nada. Antes se amortiguaba a un
    // cuarto para dar el efecto de goma de las hojas de movil, pero eso se conseguia
    // levantando la hoja del fondo —el mismo fallo que arregla `desplazamiento`, en pequeno—.
    // Ahora subir es crecer, y por encima del anclaje mas alto no hay nada que crecer: la
    // hoja ya no cabe mas en la pantalla. Se ignora en lugar de fingir movimiento.
    const enElTope = this.indice() >= this.anclajesNormalizados().length - 1;

    this.arrastre.set(delta < 0 && enElTope ? 0 : delta);
  }

  protected terminarArrastre(): void {
    if (!this.arrastrando()) {
      return;
    }

    const recorrido = this.arrastre();
    const alto = this.dialogo()?.nativeElement.getBoundingClientRect().height ?? 0;
    const velocidad = this.velocidad;

    this.arrastrando.set(false);
    this.arrastre.set(0);
    this.huboArrastre = Math.abs(recorrido) > 4;

    // Un lanzamiento fuerte hacia abajo cierra desde cualquier anclaje, sin ir bajando de uno
    // en uno: es lo que se espera de un manotazo.
    if (velocidad > VELOCIDAD_CIERRE_DIRECTO) {
      this.cerrar.emit();
      return;
    }

    const suficiente =
      alto > 0 && Math.abs(recorrido) > alto * UMBRAL_ANCLAJE
        ? true
        : Math.abs(velocidad) > VELOCIDAD_LANZAMIENTO;

    if (!suficiente) {
      // Ni recorrido ni velocidad: vuelve a su anclaje.
      return;
    }

    if (recorrido > 0) {
      // Hacia abajo: un anclaje menos, y desde el mas bajo se cierra.
      if (this.indice() === 0) {
        this.cerrar.emit();
      } else {
        this.indice.update((i) => i - 1);
      }

      return;
    }

    // Hacia arriba: un anclaje mas, si queda alguno.
    this.indice.update((i) => Math.min(i + 1, this.anclajesNormalizados().length - 1));
  }

  /**
   * Lo emite el `<dialog>` al cerrarse.
   *
   * NO es opcional: Escape lo cierra el NAVEGADOR sin pasar por aqui, y sin escuchar `close`
   * la señal de quien nos usa se queda diciendo que esta abierta —y como su efecto no se
   * reejecuta si nada cambio, el boton deja de abrir la hoja para siempre.
   */
  protected alCerrarse(): void {
    if (this.abierta()) {
      this.cerrar.emit();
    }
  }
}
